import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  discardDraft,
  editorStudy,
  publishStudy,
  reason,
  saveDraft,
  setStudySong,
  type EditorStudy,
  type StudyContent,
} from '@/data/studyEditor';
import type { StudyDetail, StudySong } from '@/data/studies';
import StudyReader from '@/space/StudyReader';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextInput } from '@/ui/Field';
import { ErrorNote, Spinner } from '@/ui/states';
import { BLANK, countBlanks, pageToText, textToBlocks } from './format';
import { useSession } from '@/auth/SessionProvider';
import { SongForm, songLabel } from './Song';

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

/**
 * One study in the editor: title, pages as text (# headings, _____ blanks),
 * the answer for every blank beside its page, preview, and publish. Changes
 * save to the draft as you go; people see them only once it's published.
 */
export function StudyEditor({ base }: { base: string }) {
  const { studyId = '' } = useParams();
  const { membership } = useSession();
  const navigate = useNavigate();
  const [study, setStudy] = useState<EditorStudy | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [pages, setPages] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  // Blanks with no set answer: people write their own.
  const [open, setOpen] = useState<boolean[]>([]);
  const images = useRef<string[]>([]);
  const [save, setSave] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const dirty = useRef(false);

  function load(s: EditorStudy) {
    setStudy(s);
    images.current = [];
    setTitle(s.content.title);
    setTagline(s.content.tagline ?? '');
    const texts = s.content.pages.map((p) => pageToText(p.blocks ?? [], images.current));
    setPages(texts.length ? texts : ['']);
    const blanks = s.content.pages.reduce((n, p) => n + countBlanks(p.blocks ?? []), 0);
    setAnswers(Array.from({ length: blanks }, (_, i) => s.content.answers[i] ?? ''));
    setOpen(Array.from({ length: blanks }, (_, i) => !!s.content.open?.[i]));
    dirty.current = false;
    setSave('saved');
  }

  useEffect(() => {
    editorStudy(studyId)
      .then(load)
      .catch(() => setLoadError(true));
  }, [studyId]);

  const readOnly = !!study?.series.locked;
  const blocks = useMemo(() => pages.map((t) => textToBlocks(t, images.current)), [pages]);
  const counts = useMemo(() => blocks.map(countBlanks), [blocks]);
  const starts = useMemo(() => counts.map((_, i) => counts.slice(0, i).reduce((a, b) => a + b, 0)), [counts]);

  const content: StudyContent = useMemo(
    () => ({
      title: title.trim(),
      tagline: tagline.trim() || null,
      pages: blocks.map((b) => ({ blocks: b })),
      answers: answers.map((a, i) => (open[i] ? '' : a.trim())),
      open,
    }),
    [title, tagline, blocks, answers, open],
  );

  // Save the draft a moment after each change.
  useEffect(() => {
    if (!study || readOnly || !dirty.current) return;
    setSave('unsaved');
    const t = setTimeout(() => {
      setSave('saving');
      saveDraft(study.id, content)
        .then(() => setSave('saved'))
        .catch(() => setSave('error'));
    }, 1000);
    return () => clearTimeout(t);
  }, [content, study, readOnly]);

  function change<T>(set: (v: T) => void) {
    return (v: T) => {
      dirty.current = true;
      setNotice(null);
      set(v);
    };
  }

  function setPageText(i: number, text: string) {
    const before = counts[i];
    const after = countBlanks(textToBlocks(text, images.current));
    const at = starts[i] + Math.min(before, after);
    if (after !== before) {
      const splice = <T,>(prev: T[], blank: T) => {
        const next = [...prev];
        if (after > before) next.splice(at, 0, ...Array<T>(after - before).fill(blank));
        else next.splice(at, before - after);
        return next;
      };
      setAnswers((prev) => splice(prev, ''));
      setOpen((prev) => splice(prev, false));
    }
    change(setPages)(pages.map((p, j) => (j === i ? text : p)));
  }

  function addPageAfter(i: number) {
    change(setPages)([...pages.slice(0, i + 1), '', ...pages.slice(i + 1)]);
  }
  function joinWithNext(i: number) {
    const joined = [pages[i], pages[i + 1]].filter((t) => t.trim()).join('\n\n');
    change(setPages)([...pages.slice(0, i), joined, ...pages.slice(i + 2)]);
  }
  function removePage(i: number) {
    change(setPages)(pages.filter((_, j) => j !== i));
  }

  const totalBlanks = counts.reduce((a, b) => a + b, 0);
  const missing = answers.filter((a, i) => !open[i] && !a.trim()).length;
  const problems = [
    !title.trim() && 'Give the study a title.',
    !blocks.some((b) => b.length) && 'Add some content.',
    missing > 0 &&
      `${missing} of ${totalBlanks} blanks still need an answer (or tick “No set answer”).`,
  ].filter(Boolean) as string[];

  async function onPublish() {
    if (!study) return;
    setPublishing(true);
    setError(null);
    try {
      await saveDraft(study.id, content);
      await publishStudy(study.id);
      load(await editorStudy(study.id));
      setNotice('Published — people now see this version.');
    } catch (err) {
      setError(
        reason(err).includes('answers_mismatch')
          ? 'Every blank needs an answer before publishing.'
          : 'Couldn’t publish. Please try again.',
      );
    } finally {
      setPublishing(false);
    }
  }

  async function onDiscard() {
    if (!study) return;
    setError(null);
    try {
      await discardDraft(study.id);
      if (study.status === 'draft') return navigate(base);
      load(await editorStudy(study.id));
      setConfirmDiscard(false);
      setNotice('Changes discarded — this is the published version.');
    } catch {
      setError('That didn’t work. Please try again.');
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorNote>This study couldn’t be opened.</ErrorNote>
        <Link to={base} className="text-sm text-sage underline">
          Back to studies
        </Link>
      </div>
    );
  }
  if (!study) return <Spinner />;

  const preview: StudyDetail = {
    id: study.id,
    number: null,
    title: content.title || 'Untitled study',
    tagline: content.tagline,
    locked: false,
    pages: content.pages.map((p, i) => ({ page_number: i + 1, blocks: p.blocks })),
    answers: content.answers,
    credit: study.series.credit,
    credit_url: study.series.credit_url,
    song: study.song,
    progress: null,
  };

  const published = study.status === 'approved';
  const changed = study.has_draft || save !== 'saved' || dirty.current;

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div>
        <Link to={base} className="text-[13px] text-muted hover:text-sage">
          ← Studies
        </Link>
        <p className="eyebrow mt-3">
          {study.series.title} ·{' '}
          {readOnly ? 'Locked' : !published ? 'Draft — not published' : changed ? 'Changes not published' : 'Published'}
        </p>
        <h1 className="mt-1 font-serif text-2xl text-sage">{title || 'Untitled study'}</h1>
        {published && study.people_started > 0 && !readOnly && (
          <p className="mt-1 text-[13px] text-muted">
            {study.people_started} {study.people_started === 1 ? 'person has' : 'people have'} started this study.
            Their answers stay with them; if you add or remove blanks, answers after that point may no longer line up.
          </p>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {notice && (
        <p role="status" className="text-sm text-sage">
          {notice}
        </p>
      )}

      <Card className="flex flex-col gap-4">
        <TextInput label="Title" value={title} onChange={(e) => change(setTitle)(e.target.value)} disabled={readOnly} />
        <TextInput
          label="Lead line"
          hint="Shown under the title in the list of studies."
          value={tagline}
          onChange={(e) => change(setTagline)(e.target.value)}
          disabled={readOnly}
        />
        {!readOnly && (
          <p className="text-[12px] leading-relaxed text-muted">
            On each page: start a line with <code># </code> for a heading, type <code>_____</code> (three or more
            underscores) for a blank, and leave a blank line between paragraphs. Images show as{' '}
            <code>[image 1]</code>. A blank with no single right answer (their own thoughts): tick
            “No set answer”.
          </p>
        )}
      </Card>

      <StudySongCard
        studyId={study.id}
        initial={study.song}
        folder={base.startsWith('/platform') ? 'ekkle' : (membership?.org_id ?? '')}
      />

      {pages.map((text, i) => (
        <Card key={i} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-base">
              Page {i + 1} of {pages.length + 1}
            </h2>
            {!readOnly && (
              <>
                <Button variant="ghost" size="sm" onClick={() => addPageAfter(i)}>
                  Add a page after
                </Button>
                {i < pages.length - 1 && (
                  <Button variant="ghost" size="sm" onClick={() => joinWithNext(i)}>
                    Join with next page
                  </Button>
                )}
                {pages.length > 1 && !text.trim() && (
                  <Button variant="ghost" size="sm" onClick={() => removePage(i)}>
                    Remove page
                  </Button>
                )}
              </>
            )}
          </div>
          <textarea
            aria-label={`Page ${i + 1}`}
            value={text}
            onChange={(e) => setPageText(i, e.target.value)}
            readOnly={readOnly}
            rows={Math.min(28, Math.max(6, Math.ceil(text.length / 70) + text.split('\n').length))}
            className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 font-mono text-[13px] leading-relaxed text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
          />
          {counts[i] > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-medium text-muted-strong">Answers</p>
              {blankContexts(blocks[i]).map((ctx, k) => {
                const n = starts[i] + k;
                const isOpen = !!open[n];
                return (
                  <div key={n} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                    <span className="w-7 shrink-0 tabular-nums text-muted">{n + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-muted" title={ctx}>
                      …{ctx} <span className="text-sage">_____</span>
                    </span>
                    <input
                      aria-label={`Answer ${n + 1}`}
                      value={isOpen ? '' : (answers[n] ?? '')}
                      placeholder={isOpen ? 'Their own words' : ''}
                      readOnly={readOnly}
                      disabled={isOpen}
                      onChange={(e) =>
                        change(setAnswers)(answers.map((a, j) => (j === n ? e.target.value : a)))
                      }
                      className={
                        'w-40 rounded-md border bg-canvas px-2 py-1 text-sage placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 disabled:opacity-60 ' +
                        (isOpen || answers[n]?.trim() ? 'border-edge' : 'border-sage/60')
                      }
                    />
                    <label className="flex items-center gap-1.5 text-[12px] text-muted-strong">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        disabled={readOnly}
                        onChange={(e) => change(setOpen)(open.map((o, j) => (j === n ? e.target.checked : o)))}
                        aria-label={`Blank ${n + 1}: no set answer`}
                        className="h-3.5 w-3.5 accent-sage"
                      />
                      No set answer
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ))}
      <Card className="text-center text-sm text-muted">
        Page {pages.length + 1} of {pages.length + 1}: “Submit answers”, then the answers — added for you.
      </Card>

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-2 border-t border-edge/70 bg-canvas px-5 py-3">
        <span className="mr-auto text-[13px] text-muted" role="status">
          {readOnly
            ? 'This series is locked.'
            : save === 'saving'
              ? 'Saving…'
              : save === 'unsaved'
                ? 'Unsaved changes'
                : save === 'error'
                  ? 'Couldn’t save — check your connection'
                  : problems[0] ?? (changed ? 'Draft saved' : 'Up to date')}
        </span>
        <Button variant="quiet" size="sm" onClick={() => setPreviewing(true)}>
          Preview
        </Button>
        {!readOnly && (
          <>
            {(changed || !published) &&
              (confirmDiscard ? (
                <>
                  <span className="text-[13px] text-muted-strong">
                    {published ? 'Discard your changes?' : 'Delete this study?'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => void onDiscard()}>
                    Yes
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDiscard(false)}>
                    No
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDiscard(true)}>
                  {published ? 'Discard changes' : 'Delete study'}
                </Button>
              ))}
            <Button
              size="sm"
              onClick={() => void onPublish()}
              disabled={problems.length > 0 || publishing || (!changed && published)}
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </Button>
          </>
        )}
      </div>

      {previewing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas" role="dialog" aria-label="Preview">
          <StudyReader preview draft={preview} onClose={() => setPreviewing(false)} />
        </div>
      )}
    </div>
  );
}

/** The few words before each blank on a page, to tell them apart. */
function blankContexts(blocks: ReturnType<typeof textToBlocks>): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.t !== 'p') continue;
    const parts = b.text.split(BLANK);
    for (let i = 0; i < parts.length - 1; i++) {
      const words = parts[i].trim().split(/\s+/).filter(Boolean);
      out.push(words.slice(-6).join(' ') || (parts[i + 1] ?? '').trim().split(/\s+/).slice(0, 4).join(' '));
    }
  }
  return out;
}

/**
 * The song offered at the study's Experience section (0040). Saved on its own
 * (not part of the draft), and can be changed after the series is locked.
 */
function StudySongCard({ studyId, initial, folder }: { studyId: string; initial: StudySong | null; folder: string }) {
  const [song, setSong] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: StudySong | null) {
    setBusy(true);
    setError(null);
    try {
      await setStudySong(studyId, next);
      setSong(next);
      setEditing(false);
    } catch {
      setError('Couldn’t save the song. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block text-base">Song for the Experience section</span>
          <span className="text-[13px] text-muted">
            {song ? songLabel(song) : 'None — people can be offered a song to listen to while they reflect.'}
          </span>
        </span>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {song ? 'Change' : 'Add a song'}
          </Button>
        )}
        {!editing && song && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void save(null)}>
            Remove
          </Button>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {editing && (
        <SongForm initial={song} folder={folder} busy={busy} onSave={(s) => void save(s)} onCancel={() => setEditing(false)} />
      )}
    </Card>
  );
}
