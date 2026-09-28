import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getStudy,
  previewStudy,
  saveStudyProgress,
  completeStudy,
  type StudyBlock,
  type StudyDetail,
  type StudyPage,
} from '@/data/studies';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/states';
import { BibleBase, ScriptureText } from '@/bible/ScriptureText';
import { SongOffer, SongPlayer } from '@/studies/Song';

/**
 * The study reader — a paginated, brand-styled workbook. One page at a time
 * with prev/next and "Page X of N"; fill-in blanks render inline; a final
 * "Submit answers" page enables once every blank has a value (any value), then
 * completes the study and unlocks the next.
 *
 * Church-owned warmth (brand guide): Fraunces headings, Inter body, sage on
 * canvas, generous whitespace. No Ekklē platform chrome.
 */

const SECTIONS = new Set(['discover', 'connect', 'experience']);
const BLANK = '{{}}';

/** How many fill-in blanks a page contains (across all its text blocks). */
function countBlanks(page: StudyPage): number {
  return page.blocks.reduce(
    (n, b) => n + (b.t === 'p' ? b.text.split(BLANK).length - 1 : 0),
    0,
  );
}

/**
 * `preview`: Admins and Leaders reading a study exactly as seekers see it
 * (Resources → Bible studies). Every page and blank works; nothing is saved,
 * and the closing page returns to Resources.
 */
export default function StudyReader({
  preview = false,
  draft,
  onClose,
}: {
  preview?: boolean;
  /** The study editor's preview: this content, not a saved study. */
  draft?: StudyDetail;
  onClose?: () => void;
}) {
  const { studyId = '' } = useParams();
  const navigate = useNavigate();
  const backTo = preview ? '/leadership/resources' : '/space/studies';
  const leave = () => (onClose ? onClose() : navigate(backTo));
  // Preview: after "Submit answers", show the answers as people would.
  const [previewSubmitted, setPreviewSubmitted] = useState(false);
  const [study, setStudy] = useState<StudyDetail | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1); // 1-indexed; last page is the submit page
  const [submitting, setSubmitting] = useState(false);
  // The Experience song (0040): nothing plays until they tap.
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (draft) {
      setStudy(draft);
      return;
    }
    let active = true;
    (preview ? previewStudy(studyId) : getStudy(studyId))
      .then((data) => {
        if (!active) return;
        setStudy(data);
        if (data && !data.locked) {
          setAnswers(data.progress?.answers ?? {});
          setPage(Math.max(1, data.progress?.last_page ?? 1));
        }
      })
      .catch(() => active && setStudy(null));
    return () => {
      active = false;
    };
  }, [studyId, preview, draft]);

  // Blank offsets: the global index of the first blank on each content page.
  const pageBlankStart = useMemo(() => {
    const starts: number[] = [];
    let running = 0;
    for (const pg of study?.pages ?? []) {
      starts.push(running);
      running += countBlanks(pg);
    }
    return { starts, total: running };
  }, [study]);

  const contentPages = study?.pages?.length ?? 0;
  const totalPages = contentPages + 1; // + the closing submit page

  // Persist place + answers, debounced, whenever they change.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!study || study.locked || preview || draft) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveStudyProgress(study.id, page, answers);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [study, page, answers, preview]);

  if (study === undefined) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      </Shell>
    );
  }

  if (study === null || study.locked) {
    return (
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <span aria-hidden className="mb-1 block h-[2px] w-8 rounded-full bg-sage/70" />
          <h1 className="font-serif text-2xl text-sage">
            {study === null ? 'This study isn’t available' : 'Not yet unlocked'}
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-muted-strong">
            {study === null
              ? 'It may have moved. Head back to the library to keep going.'
              : 'Finish the study before this one, and it opens up next.'}
          </p>
          <Button variant="quiet" onClick={leave} className="mt-2">
            {preview ? 'Back to resources' : 'Back to studies'}
          </Button>
        </div>
      </Shell>
    );
  }

  const filledCount = Object.values(answers).filter((v) => v.trim()).length;
  const allFilled = filledCount >= pageBlankStart.total;
  const onSubmitPage = page > contentPages;
  // The Experience section: from the page with the "Experience" heading on.
  const experienceFrom =
    study.pages.findIndex((pg) =>
      pg.blocks.some((b) => b.t === 'h' && b.text.trim().toLowerCase() === 'experience'),
    ) + 1;
  const inExperience = !!study.song && experienceFrom > 0 && page >= experienceFrom && !onSubmitPage;

  function setAnswer(index: number, value: string) {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  }

  async function onSubmit() {
    if (!study) return;
    if (preview || draft) return setPreviewSubmitted(true);
    setSubmitting(true);
    try {
      await completeStudy(study.id, answers);
      // Stay here: the answers are shown now that it's submitted.
      const fresh = await getStudy(study.id);
      if (fresh) setStudy(fresh);
    } catch {
      /* the button stays, to try again */
    } finally {
      setSubmitting(false);
    }
  }

  const submitted = previewSubmitted || !!study.progress?.completed;

  return (
    <BibleBase.Provider value={preview ? '/app/bible' : '/space/bible'}>
    <Shell>
      {preview && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-edge bg-card px-3 py-2 text-[13px] text-muted-strong">
          <span>Preview — what people see. Nothing is saved.</span>
          <button onClick={leave} className="text-sage underline-offset-2 hover:underline">
            {onClose ? 'Close preview' : 'Back to resources'}
          </button>
        </div>
      )}
      {/* Header: lesson + title */}
      <div className="border-b border-edge/70 pb-4">
        {study.number != null && (
          <span className="eyebrow">Study {study.number}</span>
        )}
        <h1 className="mt-1 font-serif text-2xl leading-tight text-sage">
          {study.title}
        </h1>
        {study.credit && <Credit credit={study.credit} url={study.credit_url} />}
      </div>

      {/* Body */}
      <div className="flex-1 py-8">
        {onSubmitPage ? (
          submitted ? (
            <Results
              answers={answers}
              intended={study.answers ?? null}
              total={pageBlankStart.total}
              onDone={() =>
                preview || draft ? leave() : navigate('/space/studies', { state: { completed: study.id } })
              }
              doneLabel={preview || draft ? (onClose ? 'Close preview' : 'Back to resources') : 'Back to studies'}
            />
          ) : (
            <SubmitPage
              allFilled={allFilled}
              filled={filledCount}
              total={pageBlankStart.total}
              submitting={submitting}
              onSubmit={onSubmit}
            />
          )
        ) : (
          <>
            {inExperience && !playing && study.song && (
              <SongOffer song={study.song} onPlay={() => setPlaying(true)} />
            )}
            <PageBody
              page={study.pages[page - 1]}
              startIndex={pageBlankStart.starts[page - 1] ?? 0}
              answers={answers}
              onAnswer={setAnswer}
            />
          </>
        )}
      </div>

      {playing && study.song && <SongPlayer song={study.song} onClose={() => setPlaying(false)} />}

      {/* Pager */}
      <div className="sticky bottom-0 -mx-5 flex items-center justify-between border-t border-edge/70 bg-canvas/95 px-5 py-3 backdrop-blur">
        <PagerButton
          dir="prev"
          disabled={page === 1}
          onClick={() => go(setPage, page - 1)}
        />
        <span className="text-[13px] tabular-nums text-muted">
          Page {page} of {totalPages}
        </span>
        <PagerButton
          dir="next"
          disabled={page >= totalPages}
          onClick={() => go(setPage, page + 1)}
        />
      </div>
    </Shell>
    </BibleBase.Provider>
  );
}

function go(setPage: (n: number) => void, n: number) {
  setPage(n);
  window.scrollTo({ top: 0 });
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto flex min-h-full max-w-xl flex-col px-5 py-8">
        {children}
      </div>
    </div>
  );
}

function PageBody({
  page,
  startIndex,
  answers,
  onAnswer,
}: {
  page: StudyPage;
  startIndex: number;
  answers: Record<string, string>;
  onAnswer: (index: number, value: string) => void;
}) {
  let blankIndex = startIndex;
  return (
    <article className="flex flex-col gap-5">
      {page.blocks.map((block, i) => {
        const rendered = renderBlock(block, blankIndex, answers, onAnswer);
        blankIndex = rendered.nextIndex;
        return <Fragment key={i}>{rendered.node}</Fragment>;
      })}
    </article>
  );
}

function renderBlock(
  block: StudyBlock,
  startIndex: number,
  answers: Record<string, string>,
  onAnswer: (index: number, value: string) => void,
): { node: ReactNode; nextIndex: number } {
  if (block.t === 'img') {
    return {
      node: (
        <img
          src={block.src}
          alt=""
          className="mx-auto my-2 max-h-80 w-auto rounded-card border border-edge"
        />
      ),
      nextIndex: startIndex,
    };
  }
  if (block.t === 'h') {
    const key = block.text.trim().toLowerCase();
    if (SECTIONS.has(key)) {
      return {
        node: <span className="eyebrow block pt-2">{block.text}</span>,
        nextIndex: startIndex,
      };
    }
    return {
      node: (
        <h2 className="font-serif text-xl leading-snug text-sage">{block.text}</h2>
      ),
      nextIndex: startIndex,
    };
  }
  // paragraph — interleave inline blank inputs
  const parts = block.text.split(BLANK);
  let idx = startIndex;
  const nodes: ReactNode[] = [];
  parts.forEach((chunk, i) => {
    if (chunk) nodes.push(<ScriptureText key={`t${i}`} text={chunk} />);
    if (i < parts.length - 1) {
      const at = idx++;
      nodes.push(
        <BlankInput
          key={`b${i}`}
          value={answers[at] ?? ''}
          onChange={(v) => onAnswer(at, v)}
          n={at + 1}
        />,
      );
    }
  });
  return {
    node: (
      <p className="whitespace-pre-wrap text-[17px] leading-relaxed text-muted-strong">
        {nodes}
      </p>
    ),
    nextIndex: idx,
  };
}

function BlankInput({
  value,
  onChange,
  n,
}: {
  value: string;
  onChange: (v: string) => void;
  n: number;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={`Blank ${n}`}
      size={Math.max(6, value.length + 1)}
      className="mx-0.5 inline-block min-w-[5rem] appearance-none rounded-none border-0 border-b-2 border-sage/40 bg-transparent px-1 text-center font-medium text-sage focus:border-sage focus:outline-none"
    />
  );
}

function SubmitPage({
  allFilled,
  filled,
  total,
  submitting,
  onSubmit,
}: {
  allFilled: boolean;
  filled: number;
  total: number;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <span aria-hidden className="block h-[2px] w-8 rounded-full bg-sage/70" />
      <h2 className="font-serif text-2xl text-sage">You’ve reached the end</h2>
      <p className="max-w-sm text-[15px] leading-relaxed text-muted-strong">
        Take a moment to look back over what you wrote. When you’re ready, submit
        your answers to finish this study.
      </p>
      {!allFilled && (
        <p className="text-[13px] text-muted">
          {filled} of {total} filled in — complete each one to submit.
        </p>
      )}
      <Button
        onClick={onSubmit}
        disabled={!allFilled || submitting}
        className="mt-1 w-full max-w-xs"
      >
        {submitting ? 'Saving…' : 'Submit answers'}
      </Button>
    </div>
  );
}

/** Where the study comes from, e.g. "A study from [truth]Link". */
export function Credit({ credit, url, className = 'mt-1' }: { credit: string; url?: string | null; className?: string }) {
  return (
    <p className={`${className} text-[13px] text-muted`}>
      A study from{' '}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-sage hover:underline">
          {credit}
        </a>
      ) : (
        credit
      )}
    </p>
  );
}

/** After submitting: each answer given beside the intended one. */
function Results({
  answers,
  intended,
  total,
  onDone,
  doneLabel,
}: {
  answers: Record<string, string>;
  intended: string[] | null;
  total: number;
  onDone: () => void;
  doneLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <span aria-hidden className="block h-[2px] w-8 rounded-full bg-sage/70" />
      <h2 className="font-serif text-2xl text-sage">Study complete</h2>
      {intended && total > 0 && (
        <>
          <p className="max-w-sm text-[15px] leading-relaxed text-muted-strong">
            Here are your answers beside the ones the study had in mind.
          </p>
          <table className="w-full max-w-sm text-left text-[15px]">
            <thead>
              <tr className="border-b border-edge text-[12px] uppercase tracking-wide text-muted">
                <th className="w-8 py-2 font-medium">#</th>
                <th className="py-2 font-medium">Your answer</th>
                <th className="py-2 font-medium">Answer</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: total }, (_, i) => {
                const mine = (answers[i] ?? '').trim();
                const expected = (intended[i] ?? '').trim();
                // No set answer: what they wrote is the answer.
                const same = !expected || mine.toLowerCase() === expected.toLowerCase();
                return (
                  <tr key={i} className="border-b border-edge/60">
                    <td className="py-2 tabular-nums text-muted">{i + 1}</td>
                    <td className="py-2 text-muted-strong">{mine || '—'}</td>
                    <td className={'py-2 ' + (same ? 'text-muted-strong' : 'font-medium text-sage')}>
                      {expected || <span className="text-muted">Your own words</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      <Button onClick={onDone} className="mt-1 w-full max-w-xs">
        {doneLabel}
      </Button>
    </div>
  );
}

function PagerButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous page' : 'Next page'}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-edge text-sage transition-colors enabled:hover:bg-sage/5 disabled:opacity-30"
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  );
}
