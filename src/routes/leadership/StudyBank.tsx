import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStudyBank, saveStudyBank, setMinistrySong, type BankStudy, type StudySong } from '@/data/studies';
import { useSession } from '@/auth/SessionProvider';
import { SongForm, songLabel } from '@/studies/Song';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ErrorNote, Spinner } from '@/ui/states';

/**
 * Resources → Bible studies (Admins and Leaders): the Ekklē study bank plus the
 * ministry's own studies. Choose which your seekers get, set the order they
 * unlock in, and preview each exactly as seekers see it. Changes save at once.
 */
export function StudyBank() {
  const [studies, setStudies] = useState<BankStudy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [songFor, setSongFor] = useState<string | null>(null);
  const { membership } = useSession();

  useEffect(() => {
    listStudyBank()
      .then(setStudies)
      .catch(() => setError('Couldn’t load the studies.'));
  }, []);

  async function save(next: BankStudy[]) {
    const before = studies;
    // Renumber the ones that are on, as seekers will see them.
    let n = 0;
    setStudies(next.map((s) => ({ ...s, number: s.enabled ? ++n : null })));
    setSaving(true);
    setError(null);
    try {
      await saveStudyBank(next.map((s) => ({ id: s.id, enabled: s.enabled })));
    } catch {
      setStudies(before);
      setError('Couldn’t save that change. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: string) {
    if (!studies) return;
    void save(studies.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }

  function move(index: number, by: -1 | 1) {
    if (!studies) return;
    const to = index + by;
    if (to < 0 || to >= studies.length) return;
    const next = [...studies];
    [next[index], next[to]] = [next[to], next[index]];
    void save(next);
  }

  const on = studies?.filter((s) => s.enabled).length ?? 0;

  return (
    <Card className="p-0">
      <div className="flex items-start justify-between gap-4 border-b border-edge/70 px-5 py-4">
        <div>
          <h2 className="text-base">Bible studies</h2>
          <p className="mt-1 text-sm text-muted-strong">
            The Ekklē study bank. Choose which studies people get and the order they unlock in.
          </p>
          <Link
            to="/leadership/study-editor"
            className="mt-1 inline-block text-[13px] text-sage underline decoration-sage/30 underline-offset-2 hover:decoration-sage"
          >
            Write or import your own studies →
          </Link>
        </div>
        {studies && (
          <span className="shrink-0 text-[13px] text-muted" role="status">
            {saving ? 'Saving…' : `${on} of ${studies.length} offered`}
          </span>
        )}
      </div>
      {error && (
        <div className="px-5 pt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {studies === null ? (
        !error && (
          <div className="py-8">
            <Spinner />
          </div>
        )
      ) : studies.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No studies yet.</p>
      ) : (
        <ol className="divide-y divide-edge/70">
          {studies.map((s, i) => (
            <li key={s.id} className="flex flex-col gap-2 px-5 py-3">
              <div className="flex items-center gap-3">
              <span className="w-7 shrink-0 text-center font-serif text-lg tabular-nums text-sage">
                {s.number ?? '–'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={'truncate font-medium ' + (s.enabled ? 'text-sage' : 'text-muted')}>{s.title}</span>
                  <span className="eyebrow text-[10px]">
                    {s.source === 'ekkle' ? 'Ekklē' : 'Your ministry'}
                    {s.series ? ` · ${s.series}` : ''}
                  </span>
                </span>
                <span className="block text-[12px] text-muted">
                  {s.pages} {s.pages === 1 ? 'page' : 'pages'} · {s.seekers_started} started ·{' '}
                  {s.seekers_completed} finished
                  {s.credit ? ` · from ${s.credit}` : ''}
                </span>
              </span>
              <Link
                to={`/leadership/studies/${s.id}`}
                className="text-[13px] text-sage underline decoration-sage/30 underline-offset-2 hover:decoration-sage"
              >
                Preview
              </Link>
              <span className="flex flex-col">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || saving}
                  aria-label={`Move ${s.title} up`}
                  className="px-1 text-[12px] leading-none text-muted hover:text-sage disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === studies.length - 1 || saving}
                  aria-label={`Move ${s.title} down`}
                  className="px-1 text-[12px] leading-none text-muted hover:text-sage disabled:opacity-30"
                >
                  ▼
                </button>
              </span>
              <label className="flex items-center gap-1.5 text-[13px] text-muted-strong">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={() => toggle(s.id)}
                  disabled={saving}
                  aria-label={`Offer ${s.title}`}
                  className="h-4 w-4 accent-sage"
                />
                Offer
              </label>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-10 text-[12px] text-muted">
                <span>
                  Song:{' '}
                  {s.song ? songLabel(s.song) : 'none'}
                  {s.song_choice === 'own' ? ' (your own)' : s.song_choice === 'none' && s.default_song ? ' (turned off)' : ''}
                </span>
                <button
                  onClick={() => setSongFor(songFor === s.id ? null : s.id)}
                  aria-expanded={songFor === s.id}
                  aria-label={`Song for ${s.title}`}
                  className="text-sage underline decoration-sage/30 underline-offset-2 hover:decoration-sage"
                >
                  Change
                </button>
              </div>
              {songFor === s.id && (
                <SongChoice
                  study={s}
                  folder={membership?.org_id ?? ''}
                  onDone={async (choice, song) => {
                    await setMinistrySong(s.id, choice, song);
                    setSongFor(null);
                    setStudies(await listStudyBank());
                  }}
                  onCancel={() => setSongFor(null)}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** A ministry's song for a study: Ekklē's default, its own, or none (0040). */
function SongChoice({
  study,
  folder,
  onDone,
  onCancel,
}: {
  study: BankStudy;
  folder: string;
  onDone: (choice: 'default' | 'own' | 'none', song: StudySong | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [own, setOwn] = useState(study.song_choice === 'own');

  async function choose(choice: 'default' | 'own' | 'none', song: StudySong | null) {
    setBusy(true);
    setError(null);
    try {
      await onDone(choice, song);
    } catch {
      setBusy(false);
      setError('Couldn’t save that. Please try again.');
    }
  }

  return (
    <div className="ml-10 flex flex-col gap-3 rounded-lg border border-edge bg-canvas p-3 text-[13px]">
      <p className="text-muted-strong">Offered when someone reaches this study’s Experience section.</p>
      <div className="flex flex-wrap gap-2">
        {study.default_song && (
          <Button size="sm" variant="quiet" disabled={busy} onClick={() => void choose('default', null)}>
            Use {study.source === 'ekkle' ? 'Ekklē’s' : 'the study’s'} song ({songLabel(study.default_song)})
          </Button>
        )}
        <Button size="sm" variant="quiet" disabled={busy} onClick={() => setOwn(true)}>
          Use our own song
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void choose('none', null)}>
          No song
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {own && (
        <SongForm
          initial={study.song_choice === 'own' ? (study.song ?? null) : null}
          folder={folder}
          busy={busy}
          saveLabel="Use this song"
          onSave={(song) => void choose('own', song)}
        />
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
