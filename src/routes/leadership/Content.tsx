import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/auth/SessionProvider';
import {
  listSequences,
  getSequence,
  createSequence,
  updateSequenceTitle,
  updateSequenceConnect,
  deleteSequence,
  setSequenceStatus,
  replaceScreens,
  readConnect,
  type Sequence,
  type ScreenDraft,
  type ConnectConfig,
  type Cta,
} from '@/data/sequences';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput, TextArea } from '@/ui/Field';
import { EmptyState, ErrorNote, Spinner } from '@/ui/states';
import { SequenceScreenContent } from '@/recipient/SequenceScreenContent';

/**
 * Leadership → Content. Manage multiple invitation flows: a list of flows, and
 * an editor for each (title, screens with live preview, draft/published).
 * Members choose a published flow for their own QR (see the member dashboard).
 */
export default function Content() {
  const { membership } = useSession();
  const [view, setView] = useState<{ mode: 'list' } | { mode: 'edit'; id: string }>({
    mode: 'list',
  });
  const [sequences, setSequences] = useState<Sequence[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setSequences(await listSequences());
    } catch {
      setError('Couldn’t load your flows.');
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function newFlow() {
    if (!membership) return;
    try {
      const seq = await createSequence(membership.org_id, 'New flow');
      await refresh();
      setView({ mode: 'edit', id: seq.id });
    } catch {
      setError('Couldn’t create a flow.');
    }
  }

  if (view.mode === 'edit') {
    return (
      <FlowEditor
        id={view.id}
        onBack={() => {
          setView({ mode: 'list' });
          void refresh();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl">Content</h1>
          <p className="mt-1 text-sm text-muted-strong">
            Invitation flows your members can share.
          </p>
        </div>
        <Button onClick={newFlow}>New flow</Button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {sequences === null ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : sequences.length === 0 ? (
        <EmptyState
          title="No flows yet"
          note="Create your first invitation flow to get started."
          action={
            <Button className="mt-1" onClick={newFlow}>
              New flow
            </Button>
          }
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-edge/70">
            {sequences.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setView({ mode: 'edit', id: s.id })}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-sage/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-sage">
                      {s.title}
                    </span>
                    <span className="text-[13px] text-muted">
                      {s.status === 'approved' ? 'Published' : 'Draft'}
                    </span>
                  </span>
                  <span aria-hidden className="text-muted">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

interface EditableScreen extends ScreenDraft {
  key: string;
}

function FlowEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [savedTitle, setSavedTitle] = useState('');
  const [status, setStatus] = useState<'draft' | 'approved'>('draft');
  const [screens, setScreens] = useState<EditableScreen[]>([]);
  const [savedScreens, setSavedScreens] = useState<EditableScreen[]>([]);
  const [connect, setConnect] = useState<ConnectConfig>({
    headline: '',
    body: '',
    ctas: [],
  });
  const [savedConnect, setSavedConnect] = useState<ConnectConfig>({
    headline: '',
    body: '',
    ctas: [],
  });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(0);

  useEffect(() => {
    getSequence(id)
      .then((data) => {
        if (!data) return;
        setTitle(data.sequence.title);
        setSavedTitle(data.sequence.title);
        setStatus(data.sequence.status);
        const es = data.screens.map((s) => ({
          key: crypto.randomUUID(),
          headline: s.headline,
          body: s.body,
          icon: s.icon,
        }));
        setScreens(es);
        setSavedScreens(es);
        const c = readConnect(data.sequence);
        setConnect(c);
        setSavedConnect(c);
      })
      .catch(() => setError('Couldn’t load this flow.'))
      .finally(() => setLoading(false));
  }, [id]);

  const dirty = useMemo(
    () =>
      title !== savedTitle ||
      JSON.stringify(strip(screens)) !== JSON.stringify(strip(savedScreens)) ||
      JSON.stringify(connect) !== JSON.stringify(savedConnect),
    [title, savedTitle, screens, savedScreens, connect, savedConnect],
  );

  function update(key: string, patch: Partial<ScreenDraft>) {
    setScreens((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  function add() {
    setScreens((prev) => [
      ...prev,
      { key: crypto.randomUUID(), headline: '', body: '', icon: null },
    ]);
  }
  function remove(key: string) {
    setScreens((prev) => prev.filter((s) => s.key !== key));
  }
  function move(index: number, dir: -1 | 1) {
    setScreens((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (title !== savedTitle) {
        await updateSequenceTitle(id, title);
        setSavedTitle(title);
      }
      await replaceScreens(id, strip(screens));
      setSavedScreens(screens);
      await updateSequenceConnect(id, connect);
      setSavedConnect(connect);
    } catch {
      setError('Couldn’t save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function updateCta(index: number, patch: Partial<Cta>) {
    setConnect((c) => ({
      ...c,
      ctas: c.ctas.map((cta, i) => (i === index ? { ...cta, ...patch } : cta)),
    }));
  }
  function addCta() {
    setConnect((c) => ({
      ...c,
      ctas: [...c.ctas, { label: '', kind: 'message', url: null }],
    }));
  }
  function removeCta(index: number) {
    setConnect((c) => ({ ...c, ctas: c.ctas.filter((_, i) => i !== index) }));
  }

  async function toggleStatus() {
    const next = status === 'approved' ? 'draft' : 'approved';
    setStatus(next);
    try {
      await setSequenceStatus(id, next);
    } catch {
      setStatus(status);
      setError('Couldn’t change status.');
    }
  }

  async function removeFlow() {
    if (!confirm('Delete this flow? This can’t be undone.')) return;
    try {
      await deleteSequence(id);
      onBack();
    } catch {
      setError('Couldn’t delete this flow.');
    }
  }

  if (loading)
    return (
      <div className="py-16">
        <Spinner />
      </div>
    );

  const previewIndex = Math.min(preview, Math.max(0, screens.length - 1));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <button
          onClick={onBack}
          className="text-[13px] text-muted transition-colors hover:text-sage"
        >
          ← All flows
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-2 w-full bg-transparent font-serif text-2xl font-medium text-sage focus:outline-none"
          aria-label="Flow title"
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sage">
            {status === 'approved' ? 'Published' : 'Draft'}
          </p>
          <p className="mt-1 text-[13px] text-muted-strong">
            {status === 'approved'
              ? 'Members can choose this flow for their code.'
              : 'Only you can see this. Publish so members can choose it.'}
          </p>
        </div>
        <Button
          variant={status === 'approved' ? 'quiet' : 'primary'}
          onClick={toggleStatus}
        >
          {status === 'approved' ? 'Move to draft' : 'Publish'}
        </Button>
      </Card>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {screens.map((s, i) => (
            <Card key={s.key} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="eyebrow">screen {i + 1}</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => move(i, 1)}
                    disabled={i === screens.length - 1}
                  >
                    ↓
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.key)}>
                    Remove
                  </Button>
                </div>
              </div>
              <TextInput
                label="Headline"
                value={s.headline}
                onChange={(e) => update(s.key, { headline: e.target.value })}
                onFocus={() => setPreview(i)}
              />
              <TextArea
                label="Body"
                rows={4}
                value={s.body}
                onChange={(e) => update(s.key, { body: e.target.value })}
                onFocus={() => setPreview(i)}
              />
            </Card>
          ))}
          <Button variant="quiet" className="self-start" onClick={add}>
            Add screen
          </Button>

          {/* Ending: headline, body, and the CTAs that decide where people go */}
          <Card className="flex flex-col gap-3">
            <div>
              <span className="eyebrow">ending</span>
              <p className="mt-1 text-[13px] text-muted-strong">
                The last screen and where its buttons take people.
              </p>
            </div>
            <TextInput
              label="Headline"
              value={connect.headline}
              placeholder="someone here would love to talk"
              onChange={(e) => setConnect((c) => ({ ...c, headline: e.target.value }))}
            />
            <TextArea
              label="Body"
              rows={3}
              value={connect.body}
              placeholder="Leave blank to use the default invitation."
              onChange={(e) => setConnect((c) => ({ ...c, body: e.target.value }))}
            />
            <div className="flex flex-col gap-3">
              <span className="text-[13px] font-medium text-muted-strong">Buttons</span>
              {connect.ctas.length === 0 && (
                <p className="text-[13px] text-muted">
                  No buttons yet — recipients will just see “Message {`{member}`}”.
                </p>
              )}
              {connect.ctas.map((cta, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-edge/70 p-3">
                  <div className="flex gap-2">
                    <input
                      value={cta.label}
                      placeholder="Button label"
                      onChange={(e) => updateCta(i, { label: e.target.value })}
                      className="flex-1 rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
                    />
                    <select
                      value={cta.kind}
                      onChange={(e) =>
                        updateCta(i, { kind: e.target.value as Cta['kind'] })
                      }
                      className="rounded-lg border border-edge bg-canvas px-2 py-2 text-sm text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
                    >
                      <option value="message">Message the member</option>
                      <option value="link">Open a link</option>
                    </select>
                  </div>
                  {cta.kind === 'link' && (
                    <input
                      value={cta.url ?? ''}
                      placeholder="https://…"
                      inputMode="url"
                      onChange={(e) => updateCta(i, { url: e.target.value })}
                      className="rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
                    />
                  )}
                  <button
                    onClick={() => removeCta(i)}
                    className="self-start text-[12px] text-muted transition-colors hover:text-sage"
                  >
                    Remove button
                  </button>
                </div>
              ))}
              <Button variant="quiet" size="sm" className="self-start" onClick={addCta}>
                Add button
              </Button>
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <div className="flex-1" />
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <button
            onClick={removeFlow}
            className="self-start pt-2 text-[13px] text-muted transition-colors hover:text-sage"
          >
            Delete this flow
          </button>
        </div>

        <div className="md:sticky md:top-6 md:self-start">
          <span className="eyebrow">preview</span>
          <div className="mt-2 overflow-hidden rounded-2xl border border-edge bg-canvas">
            <div className="flex min-h-[420px] flex-col px-5 py-6">
              {screens.length === 0 ? (
                <p className="m-auto text-sm text-muted">Add a screen to preview it.</p>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 pt-1" aria-hidden>
                    {screens.map((_, i) => (
                      <span
                        key={i}
                        className={
                          'h-1 flex-1 rounded-full ' +
                          (i <= previewIndex ? 'bg-sage/70' : 'bg-edge')
                        }
                      />
                    ))}
                  </div>
                  <div className="flex flex-1 flex-col justify-center py-8">
                    <SequenceScreenContent
                      headline={screens[previewIndex].headline}
                      body={screens[previewIndex].body}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[13px] text-muted">
                    <button
                      onClick={() => setPreview((p) => Math.max(0, p - 1))}
                      disabled={previewIndex === 0}
                      className="disabled:opacity-40"
                    >
                      ← prev
                    </button>
                    <span>
                      {previewIndex + 1} / {screens.length}
                    </span>
                    <button
                      onClick={() => setPreview((p) => Math.min(screens.length - 1, p + 1))}
                      disabled={previewIndex === screens.length - 1}
                      className="disabled:opacity-40"
                    >
                      next →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <span className="mt-4 block eyebrow">ending preview</span>
          <div className="mt-2 overflow-hidden rounded-2xl border border-edge bg-canvas">
            <div className="flex flex-col gap-4 px-5 py-6">
              <h1 className="font-serif text-2xl leading-tight text-sage">
                {connect.headline.trim() || 'someone here would love to talk'}
              </h1>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-strong">
                {connect.body.trim() ||
                  'They shared this with you and would genuinely welcome a conversation.'}
              </p>
              <div className="flex flex-col gap-2">
                {(connect.ctas.length > 0
                  ? connect.ctas
                  : [{ label: 'Message the member', kind: 'message' as const, url: null }]
                ).map((cta, i) => (
                  <span
                    key={i}
                    className={
                      'inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-medium ' +
                      (i === 0 ? 'bg-sage text-canvas' : 'text-sage')
                    }
                  >
                    {cta.label || (cta.kind === 'link' ? 'Open' : 'Message the member')}
                  </span>
                ))}
                <span className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-medium text-sage">
                  Not right now
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function strip(screens: EditableScreen[]): ScreenDraft[] {
  return screens.map(({ headline, body, icon }) => ({ headline, body, icon }));
}
