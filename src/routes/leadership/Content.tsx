import { useEffect, useMemo, useState } from 'react';
import {
  getOrgSequence,
  setSequenceStatus,
  replaceScreens,
  type ScreenDraft,
} from '@/data/sequences';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput, TextArea } from '@/ui/Field';
import { EmptyState, ErrorNote, Spinner } from '@/ui/states';
import { SequenceScreenContent } from '@/recipient/SequenceScreenContent';

interface EditableScreen extends ScreenDraft {
  key: string;
}

/**
 * Leadership → Content. Author the guided welcome sequence with a live preview
 * of exactly what recipients see. Draft/approved gates whether it's ever shown.
 */
export default function Content() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sequenceId, setSequenceId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'draft' | 'approved'>('draft');
  const [screens, setScreens] = useState<EditableScreen[]>([]);
  const [savedScreens, setSavedScreens] = useState<EditableScreen[]>([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(0);

  useEffect(() => {
    getOrgSequence()
      .then((data) => {
        if (!data) return;
        setSequenceId(data.sequence.id);
        setTitle(data.sequence.title);
        setStatus(data.sequence.status);
        const es = data.screens.map((s) => ({
          key: crypto.randomUUID(),
          headline: s.headline,
          body: s.body,
          icon: s.icon,
        }));
        setScreens(es);
        setSavedScreens(es);
      })
      .catch(() => setError('Couldn’t load your sequence.'))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(strip(screens)) !== JSON.stringify(strip(savedScreens)),
    [screens, savedScreens],
  );

  function update(key: string, patch: Partial<ScreenDraft>) {
    setScreens((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    );
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
    if (!sequenceId) return;
    setSaving(true);
    setError(null);
    try {
      await replaceScreens(sequenceId, strip(screens));
      setSavedScreens(screens);
    } catch {
      setError('Couldn’t save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!sequenceId) return;
    const next = status === 'approved' ? 'draft' : 'approved';
    setStatus(next);
    try {
      await setSequenceStatus(sequenceId, next);
    } catch {
      setStatus(status); // revert on failure
      setError('Couldn’t change status.');
    }
  }

  if (loading)
    return (
      <div className="py-16">
        <Spinner />
      </div>
    );

  if (!sequenceId)
    return (
      <EmptyState title="No sequence yet" note="A welcome sequence will appear here." />
    );

  const previewIndex = Math.min(preview, Math.max(0, screens.length - 1));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl">Content</h1>
        <p className="mt-1 text-sm text-muted-strong">{title}</p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Status */}
      <Card className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sage">
            {status === 'approved' ? 'Published' : 'Draft'}
          </p>
          <p className="mt-1 text-[13px] text-muted-strong">
            {status === 'approved'
              ? 'This is live — people your members share with will see it.'
              : 'Only you can see this. Publish when it’s ready to share.'}
          </p>
        </div>
        <Button variant={status === 'approved' ? 'quiet' : 'primary'} onClick={toggleStatus}>
          {status === 'approved' ? 'Move to draft' : 'Publish'}
        </Button>
      </Card>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        {/* Editor */}
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
          <div className="flex items-center gap-3">
            <Button variant="quiet" onClick={add}>
              Add screen
            </Button>
            <div className="flex-1" />
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Live preview */}
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
        </div>
      </div>
    </div>
  );
}

function strip(screens: EditableScreen[]): ScreenDraft[] {
  return screens.map(({ headline, body, icon }) => ({ headline, body, icon }));
}
