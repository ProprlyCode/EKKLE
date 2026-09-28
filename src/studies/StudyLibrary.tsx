import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createStudy,
  lockSeries,
  moveStudy,
  reason,
  saveSeries,
  setSeriesCredit,
  studyLibrary,
  type LibrarySeries,
} from '@/data/studyEditor';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextInput } from '@/ui/Field';
import { ErrorNote, Spinner } from '@/ui/states';
import { importDocx } from './importDocx';

/**
 * The studies you keep, by series: import from Word, write new ones, order
 * them, and lock a series once it's finished. `base` is where the editor
 * lives ('/platform/studies' or '/leadership/study-editor'); `bank` says
 * these are Ekklē's shared studies (every ministry gets them).
 */
export function StudyLibrary({ base, bank }: { base: string; bank: boolean }) {
  const navigate = useNavigate();
  const [series, setSeries] = useState<LibrarySeries[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newSeries, setNewSeries] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirmLock, setConfirmLock] = useState<string | null>(null);
  const [crediting, setCrediting] = useState<{ id: string; credit: string; url: string } | null>(null);

  async function refresh() {
    try {
      setSeries(await studyLibrary());
    } catch {
      setError('Couldn’t load the studies.');
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      const code = reason(err);
      setError(
        code.includes('unpublished_changes')
          ? 'Publish or discard every draft in this series before locking it.'
          : code.includes('series_locked')
            ? 'That series is locked.'
            : 'That didn’t work. Please try again.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function onImport(seriesId: string, files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setBusy(`import-${seriesId}`);
    setError(null);
    setNotice(null);
    const report: string[] = [];
    let lastId: string | null = null;
    try {
      const read = await Promise.all(
        list.map(async (f) => {
          try {
            return { file: f.name, study: importDocx(new Uint8Array(await f.arrayBuffer()), f.name) };
          } catch {
            return { file: f.name, study: null };
          }
        }),
      );
      read.sort((a, b) => (a.study?.number ?? 1e9) - (b.study?.number ?? 1e9));
      for (const { file, study } of read) {
        if (!study) {
          report.push(`${file}: couldn’t be read — is it a Word (.docx) file?`);
          continue;
        }
        lastId = await createStudy(seriesId, {
          title: study.title,
          tagline: study.tagline,
          pages: study.pages,
          answers: study.answers,
          open: study.open,
        });
        report.push(
          `${study.title}: ${study.pages.length} pages, ${study.blanks} blanks` +
            (study.warnings.length ? ` — ${study.warnings.join(' ')}` : ''),
        );
      }
    } catch {
      setError('The import stopped partway. Please try again.');
    } finally {
      setBusy(null);
    }
    if (list.length === 1 && lastId) return navigate(`${base}/${lastId}`);
    setNotice(report);
    await refresh();
  }

  async function onNewStudy(seriesId: string) {
    await act(`new-${seriesId}`, async () => {
      const id = await createStudy(seriesId, {
        title: 'Untitled study',
        tagline: null,
        pages: [{ blocks: [] }],
        answers: [],
      });
      navigate(`${base}/${id}`);
    });
  }

  function onAddSeries(e: FormEvent) {
    e.preventDefault();
    const title = newSeries.trim();
    if (!title) return;
    void act('series', async () => {
      await saveSeries(null, title);
      setNewSeries('');
    });
  }

  function onCredit(e: FormEvent) {
    e.preventDefault();
    if (!crediting) return;
    const { id, credit, url } = crediting;
    void act(`credit-${id}`, async () => {
      await setSeriesCredit(id, credit, url);
      setCrediting(null);
    });
  }

  function onRename(e: FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    const { id, title } = renaming;
    void act(`rename-${id}`, async () => {
      await saveSeries(id, title);
      setRenaming(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-sage">Studies</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-strong">
          {bank
            ? 'Ekklē’s shared studies — every ministry gets them in Resources → Bible studies. '
            : 'Your ministry’s own studies — they sit beside Ekklē’s in Resources → Bible studies. '}
          Import a Word document or write one here; check it, preview it, then publish. Studies in a series
          unlock one after another.
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {notice && (
        <Card className="text-sm text-muted-strong" role="status">
          <p className="font-medium text-sage">Imported — open each study to check it and publish.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {notice.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Card>
      )}

      {series === null ? (
        !error && <Spinner />
      ) : (
        series.map((sr) => (
          <Card key={sr.id} className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-edge/70 px-5 py-4">
              {renaming?.id === sr.id ? (
                <form onSubmit={onRename} className="flex flex-1 items-end gap-2">
                  <TextInput
                    label="Series name"
                    value={renaming.title}
                    onChange={(e) => setRenaming({ id: sr.id, title: e.target.value })}
                    autoFocus
                  />
                  <Button type="submit" size="sm" disabled={!!busy}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1">
                    <h2 className="text-base">{sr.title}</h2>
                    <span className="block text-[12px] text-muted">
                      {sr.credit ? `A study from ${sr.credit}${sr.credit_url ? ` · ${sr.credit_url}` : ''}` : 'No credit line'}
                      {' · '}
                      <button
                        onClick={() =>
                          setCrediting({ id: sr.id, credit: sr.credit ?? '', url: sr.credit_url ?? '' })
                        }
                        className="underline-offset-2 hover:text-sage hover:underline"
                        aria-label={`Edit the credit for ${sr.title}`}
                      >
                        Edit credit
                      </button>
                    </span>
                  </span>
                  {sr.locked ? (
                    <span className="eyebrow">Locked</span>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setRenaming({ id: sr.id, title: sr.title })}>
                        Rename
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmLock(sr.id)}>
                        Lock series
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

            {crediting?.id === sr.id && (
              <form
                onSubmit={onCredit}
                className="flex flex-wrap items-end gap-2 border-b border-edge/70 bg-canvas px-5 py-3"
              >
                <TextInput
                  label="Studies from"
                  placeholder="e.g. [truth]Link"
                  value={crediting.credit}
                  onChange={(e) => setCrediting({ ...crediting, credit: e.target.value })}
                />
                <TextInput
                  label="Link"
                  placeholder="https://…"
                  value={crediting.url}
                  onChange={(e) => setCrediting({ ...crediting, url: e.target.value })}
                />
                <Button type="submit" size="sm" disabled={!!busy}>
                  Save credit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCrediting(null)}>
                  Cancel
                </Button>
              </form>
            )}

            {confirmLock === sr.id && (
              <div className="flex flex-wrap items-center gap-3 border-b border-edge/70 bg-canvas px-5 py-3 text-sm text-muted-strong">
                <span className="flex-1">
                  Lock “{sr.title}”? Its studies can’t be edited after this, and nothing more can be added to it.
                </span>
                <Button
                  size="sm"
                  onClick={() => void act(`lock-${sr.id}`, () => lockSeries(sr.id)).then(() => setConfirmLock(null))}
                  disabled={!!busy}
                >
                  Lock it
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmLock(null)}>
                  Cancel
                </Button>
              </div>
            )}

            {sr.studies.length === 0 ? (
              <p className="px-5 py-5 text-sm text-muted">No studies in this series yet.</p>
            ) : (
              <ol className="divide-y divide-edge/70">
                {sr.studies.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-7 shrink-0 text-center font-serif text-lg tabular-nums text-sage">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-sage">{s.title}</span>
                        <span className="eyebrow text-[10px]">
                          {s.status === 'draft' ? 'Draft' : s.has_draft ? 'Changes not published' : 'Published'}
                        </span>
                      </span>
                      <span className="block text-[12px] text-muted">
                        {s.pages} {s.pages === 1 ? 'page' : 'pages'} · {s.people_started} started
                      </span>
                    </span>
                    <Link
                      to={`${base}/${s.id}`}
                      className="text-[13px] text-sage underline-offset-2 hover:underline"
                      aria-label={`${sr.locked ? 'View' : 'Edit'} ${s.title}`}
                    >
                      {sr.locked ? 'View' : 'Edit'}
                    </Link>
                    {!sr.locked && (
                      <span className="flex flex-col">
                        <button
                          onClick={() => void act(`move-${s.id}`, () => moveStudy(s.id, -1))}
                          disabled={i === 0 || !!busy}
                          aria-label={`Move ${s.title} up`}
                          className="px-1 text-[12px] leading-none text-muted hover:text-sage disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => void act(`move-${s.id}`, () => moveStudy(s.id, 1))}
                          disabled={i === sr.studies.length - 1 || !!busy}
                          aria-label={`Move ${s.title} down`}
                          className="px-1 text-[12px] leading-none text-muted hover:text-sage disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {!sr.locked && (
              <div className="flex flex-wrap items-center gap-2 border-t border-edge/70 px-5 py-3">
                <ImportButton
                  label={`Import from Word into ${sr.title}`}
                  busy={busy === `import-${sr.id}`}
                  disabled={!!busy}
                  onFiles={(files) => void onImport(sr.id, files)}
                />
                <Button variant="ghost" size="sm" onClick={() => void onNewStudy(sr.id)} disabled={!!busy}>
                  Write a new study
                </Button>
              </div>
            )}
          </Card>
        ))
      )}

      <form onSubmit={onAddSeries} className="flex max-w-md items-end gap-2">
        <TextInput
          label="New series"
          placeholder="Series name"
          value={newSeries}
          onChange={(e) => setNewSeries(e.target.value)}
        />
        <Button type="submit" variant="quiet" disabled={!newSeries.trim() || !!busy}>
          Add series
        </Button>
      </form>
    </div>
  );
}

function ImportButton({
  label,
  busy,
  disabled,
  onFiles,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Button size="sm" onClick={() => input.current?.click()} disabled={disabled}>
        {busy ? 'Importing…' : 'Import from Word'}
      </Button>
    </>
  );
}
