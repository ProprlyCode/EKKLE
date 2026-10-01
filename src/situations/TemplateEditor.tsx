import { useEffect, useState, type FormEvent } from 'react';
import {
  deleteFlowTemplate,
  platformFlowTemplates,
  saveFlowTemplate,
  type FlowTemplate,
  type TemplateDraft,
} from '@/data/situations';
import type { Cta } from '@/data/sequences';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextArea, TextInput } from '@/ui/Field';
import { ErrorNote, Spinner } from '@/ui/states';
import { SequenceScreenContent } from '@/recipient/SequenceScreenContent';
import { isLinkName, toLinkName } from './linkName';

/**
 * Platform → Flow templates (0048): the Ekklē team writes introductions for
 * everyday situations. Published ones appear in every ministry's Content,
 * where Admins and Leaders copy them to edit.
 */

const blank = (): TemplateDraft => ({
  id: null,
  situation: '',
  slug: '',
  title: '',
  when_to_use: '',
  audience: 'personal',
  screens: [{ headline: '', body: '' }],
  connect: { headline: '', body: '', ctas: [] },
});

const toDraft = (t: FlowTemplate): TemplateDraft => ({
  id: t.id,
  situation: t.situation,
  slug: t.slug,
  title: t.title,
  when_to_use: t.when_to_use,
  audience: t.audience,
  screens: t.screens.length ? t.screens : [{ headline: '', body: '' }],
  connect: t.connect,
});

export default function TemplateEditor() {
  const [list, setList] = useState<FlowTemplate[] | null>(null);
  const [editing, setEditing] = useState<TemplateDraft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    platformFlowTemplates()
      .then(setList)
      .catch(() => setError('Couldn’t load the templates.'));
  useEffect(() => {
    void load();
  }, []);

  if (editing) {
    return (
      <Editor
        draft={editing}
        onDone={(msg) => {
          setEditing(null);
          setNotice(msg);
          void load();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl">Flow templates</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-strong">
            Introductions for everyday situations. Published templates appear in every ministry’s Content, where Admins
            and Leaders copy one and make it their own. Editing a template never changes their copies.
          </p>
        </div>
        <Button onClick={() => setEditing(blank())}>New template</Button>
      </div>
      {notice && (
        <p role="status" className="rounded-lg border border-edge bg-card px-4 py-3 text-sm text-sage">
          {notice}
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {list === null ? (
        !error && <Spinner />
      ) : (
        (['personal', 'public'] as const).map((aud) => {
          const group = list.filter((t) => t.audience === aud);
          if (!group.length) return null;
          return (
            <Card key={aud} className="p-0">
              <h2 className="px-5 pt-4 text-base">
                {aud === 'personal' ? 'For members to share in person' : 'For posters, clothing and welcome tables'}
              </h2>
              <ul className="mt-3 divide-y divide-edge/70 border-t border-edge/70">
                {group.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sage">{t.situation}</span>
                        {t.status === 'draft' && <span className="eyebrow text-[10px]">Draft</span>}
                      </span>
                      <span className="block text-[13px] text-muted">
                        “{t.title}” · /{t.slug} · {t.screens.length} screens
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(toDraft(t))}>
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
    </div>
  );
}

function Editor({ draft, onDone }: { draft: TemplateDraft; onDone: (msg: string | null) => void }) {
  const [d, setD] = useState<TemplateDraft>(draft);
  const [slugEdited, setSlugEdited] = useState(Boolean(draft.slug));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(0);

  const slugError = d.slug && !isLinkName(d.slug) ? 'Lowercase letters, numbers and hyphens.' : null;
  const hasScreen = d.screens.some((s) => (s.headline + s.body).trim());
  const ready = !!d.situation.trim() && !!d.title.trim() && !!d.slug && !slugError;

  const setScreen = (i: number, patch: Partial<TemplateDraft['screens'][number]>) =>
    setD({ ...d, screens: d.screens.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.screens.length) return;
    const next = [...d.screens];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setD({ ...d, screens: next });
  };
  const setCta = (i: number, patch: Partial<Cta>) =>
    setD({ ...d, connect: { ...d.connect, ctas: d.connect.ctas.map((c, j) => (j === i ? { ...c, ...patch } : c)) } });

  async function save(status: 'draft' | 'published', e?: FormEvent) {
    e?.preventDefault();
    if (!ready || (status === 'published' && !hasScreen)) return;
    setBusy(true);
    setError(null);
    try {
      await saveFlowTemplate(d, status);
      onDone(status === 'published' ? `“${d.situation.trim()}” is published.` : `“${d.situation.trim()}” is saved as a draft.`);
    } catch (err) {
      setBusy(false);
      const code = (err as { message?: string } | null)?.message;
      setError(code === 'slug_taken' ? 'Another template uses that link name.' : 'That didn’t save. Please try again.');
    }
  }

  async function remove() {
    if (!d.id || !confirm(`Delete “${d.situation}”? Ministries keep the copies they made.`)) return;
    try {
      await deleteFlowTemplate(d.id);
      onDone(`“${d.situation}” is deleted.`);
    } catch {
      setError('Couldn’t delete it.');
    }
  }

  const shown = d.screens[Math.min(preview, d.screens.length - 1)];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button onClick={() => onDone(null)} className="text-[13px] text-muted hover:text-sage">
          ← Flow templates
        </button>
        <h1 className="mt-1 text-xl">{d.id ? 'Edit template' : 'New template'}</h1>
      </div>
      <form onSubmit={(e) => void save('published', e)} className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="Situation"
                placeholder="e.g. Over coffee"
                value={d.situation}
                maxLength={40}
                required
                onChange={(e) =>
                  setD({ ...d, situation: e.target.value, slug: slugEdited ? d.slug : toLinkName(e.target.value) })
                }
              />
              <TextInput
                label="Link name"
                value={d.slug}
                maxLength={30}
                required
                error={slugError ?? undefined}
                hint="Suggested for a ministry’s copy: /r/name/…"
                onChange={(e) => {
                  setSlugEdited(true);
                  setD({ ...d, slug: e.target.value.toLowerCase() });
                }}
              />
            </div>
            <TextInput label="Flow title" value={d.title} maxLength={120} required onChange={(e) => setD({ ...d, title: e.target.value })} />
            <TextArea
              label="When to use it"
              rows={2}
              maxLength={300}
              value={d.when_to_use}
              onChange={(e) => setD({ ...d, when_to_use: e.target.value })}
            />
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted-strong">
              Who shares it
              <select
                value={d.audience}
                onChange={(e) => setD({ ...d, audience: e.target.value as TemplateDraft['audience'] })}
                className="rounded-lg border border-edge bg-canvas px-3 py-2 text-sm font-normal text-sage"
              >
                <option value="personal">A member, in person</option>
                <option value="public">The ministry — posters, clothing, welcome tables</option>
              </select>
            </label>
          </Card>

          {d.screens.map((s, i) => (
            <Card key={i} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="eyebrow">screen {i + 1}</span>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" aria-label={`Move screen ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Move screen ${i + 1} down`}
                    disabled={i === d.screens.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={d.screens.length === 1}
                    onClick={() => setD({ ...d, screens: d.screens.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <TextInput label="Headline" value={s.headline} onFocus={() => setPreview(i)} onChange={(e) => setScreen(i, { headline: e.target.value })} />
              <TextArea label="Body" rows={4} value={s.body} onFocus={() => setPreview(i)} onChange={(e) => setScreen(i, { body: e.target.value })} />
            </Card>
          ))}
          <Button
            type="button"
            variant="quiet"
            className="self-start"
            onClick={() => setD({ ...d, screens: [...d.screens, { headline: '', body: '' }] })}
          >
            Add screen
          </Button>

          <Card className="flex flex-col gap-3">
            <span className="eyebrow">ending</span>
            <TextInput
              label="Headline"
              value={d.connect.headline}
              onChange={(e) => setD({ ...d, connect: { ...d.connect, headline: e.target.value } })}
            />
            <TextArea
              label="Body"
              rows={3}
              value={d.connect.body}
              onChange={(e) => setD({ ...d, connect: { ...d.connect, body: e.target.value } })}
            />
            <span className="text-[13px] font-medium text-muted-strong">Buttons</span>
            {d.connect.ctas.length === 0 && (
              <p className="text-[13px] text-muted">None — people see “Message …” with the member’s name.</p>
            )}
            {d.connect.ctas.map((c, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-edge/70 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <TextInput label={`Button ${i + 1} label`} value={c.label} onChange={(e) => setCta(i, { label: e.target.value })} />
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted-strong">
                    Does
                    <select
                      value={c.kind}
                      onChange={(e) => setCta(i, { kind: e.target.value as Cta['kind'] })}
                      className="rounded-lg border border-edge bg-canvas px-2 py-2 text-sm font-normal text-sage"
                    >
                      <option value="message">Message the member</option>
                      <option value="link">Open a link</option>
                    </select>
                  </label>
                </div>
                {c.kind === 'link' && (
                  <TextInput label="Link" inputMode="url" value={c.url ?? ''} onChange={(e) => setCta(i, { url: e.target.value })} />
                )}
                <button
                  type="button"
                  className="self-start text-[12px] text-muted hover:text-sage"
                  onClick={() => setD({ ...d, connect: { ...d.connect, ctas: d.connect.ctas.filter((_, j) => j !== i) } })}
                >
                  Remove button
                </button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="quiet"
              className="self-start"
              onClick={() => setD({ ...d, connect: { ...d.connect, ctas: [...d.connect.ctas, { label: '', kind: 'message', url: null }] } })}
            >
              Add button
            </Button>
          </Card>

          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !ready || !hasScreen}>
              Publish
            </Button>
            <Button type="button" variant="quiet" disabled={busy || !ready} onClick={() => void save('draft')}>
              Save as draft
            </Button>
            <Button type="button" variant="ghost" onClick={() => onDone(null)}>
              Cancel
            </Button>
            {d.id && (
              <Button type="button" variant="ghost" className="ml-auto" onClick={() => void remove()}>
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="md:sticky md:top-6 md:self-start">
          <span className="eyebrow">preview · screen {Math.min(preview, d.screens.length - 1) + 1}</span>
          <div className="mt-2 rounded-2xl border border-edge bg-canvas px-5 py-8">
            {shown && <SequenceScreenContent headline={shown.headline} body={shown.body} />}
          </div>
        </div>
      </form>
    </div>
  );
}
