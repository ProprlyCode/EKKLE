import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  deletePrompt,
  promptLibrary,
  PROMPT_KINDS,
  savePrompt,
  type LibraryPrompt,
  type PromptKind,
} from '@/data/prompts';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Collapsible } from '@/ui/Collapsible';
import { TextArea } from '@/ui/Field';
import { ErrorNote, Spinner } from '@/ui/states';

type Draft = { id: string | null; kind: PromptKind; body: string; published: boolean };

/**
 * Faith in action prompts. On ekkle.org (`bank`) the Ekklē team writes
 * Ekklē's — drafts until published. On a ministry's address its Admins and
 * Leaders add their own beside Ekklē's. Members see one each week by their
 * code, and can browse the rest.
 */
export function PromptLibrary({ bank }: { bank: boolean }) {
  const [prompts, setPrompts] = useState<LibraryPrompt[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setPrompts(await promptLibrary());
    } catch {
      setError('Couldn’t load the prompts.');
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch {
      setError('That didn’t work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (!editing?.body.trim()) return;
    const d = editing;
    void act(async () => {
      await savePrompt(d.id, { kind: d.kind, body: d.body, status: d.published ? 'published' : 'draft' });
      setEditing(null);
    });
  }

  const mine = prompts?.filter((p) => p.editable) ?? [];
  const drafts = mine.filter((p) => p.status === 'draft').length;
  const others = prompts?.filter((p) => !p.editable) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!bank && (
            <Link to="/leadership/resources" className="text-[13px] text-muted hover:text-sage">
              ← Resources
            </Link>
          )}
          <h1 className="mt-1 font-serif text-2xl text-sage">Faith in action</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-strong">
            Ideas and prompts beside each member’s code: one for the week, and more to browse.
            {bank ? ' These are Ekklē’s — every ministry gets them.' : ' Add your own beside Ekklē’s.'}
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing({ id: null, kind: 'moment', body: '', published: true })}>
          New prompt
        </Button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {bank && drafts > 0 && (
        <p className="rounded-lg border border-sage/20 bg-sage/5 px-4 py-3 text-[14px] text-muted-strong">
          {drafts} {drafts === 1 ? 'prompt is a draft' : 'prompts are drafts'} — members see them once you publish.
        </p>
      )}

      {editing && (
        <Card>
          <form onSubmit={onSave} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted-strong">
              Kind
              <select
                value={editing.kind}
                onChange={(e) => setEditing({ ...editing, kind: e.target.value as PromptKind })}
                className="h-9 rounded-lg border border-edge bg-canvas px-2 text-sm font-normal text-sage"
              >
                {(Object.keys(PROMPT_KINDS) as PromptKind[]).map((k) => (
                  <option key={k} value={k}>
                    {PROMPT_KINDS[k]}
                  </option>
                ))}
              </select>
            </label>
            <TextArea
              label="Prompt"
              rows={3}
              value={editing.body}
              maxLength={400}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            />
            <label className="flex items-center gap-2 text-[13px] text-muted-strong">
              <input
                type="checkbox"
                checked={editing.published}
                onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                className="h-4 w-4 accent-sage"
              />
              Published (members see it)
            </label>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy || !editing.body.trim()}>
                Save prompt
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {prompts === null ? (
        !error && <Spinner />
      ) : (
        (Object.keys(PROMPT_KINDS) as PromptKind[]).map((kind) => {
          const list = mine.filter((p) => p.kind === kind);
          const theirs = others.filter((p) => p.kind === kind);
          if (!list.length && !theirs.length) return null;
          return (
            <Card key={kind} className="p-0">
              <Collapsible
                storageKey={`prompts.${kind}`}
                // Open when short, or when there are drafts to publish.
                defaultOpen={list.length + theirs.length <= 5 || list.some((p) => p.status === 'draft')}
                title={<h2 className="text-base">{PROMPT_KINDS[kind]}</h2>}
                summary={`${list.length + theirs.length}${
                  list.some((p) => p.status === 'draft')
                    ? ` · ${list.filter((p) => p.status === 'draft').length} drafts`
                    : ''
                }`}
              >
              <ul className="divide-y divide-edge/70 border-t border-edge/70">
                {list.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1 text-[15px] leading-relaxed text-sage">
                      {p.body}
                      {p.status === 'draft' && <span className="eyebrow ml-2 text-[10px]">Draft</span>}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {p.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="quiet"
                          disabled={busy}
                          onClick={() => void act(() => savePrompt(p.id, { kind: p.kind, body: p.body, status: 'published' }))}
                        >
                          Publish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing({ id: p.id, kind: p.kind, body: p.body, published: p.status === 'published' })}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => deletePrompt(p.id))}>
                        Delete
                      </Button>
                    </span>
                  </li>
                ))}
                {theirs.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1 text-[15px] leading-relaxed text-muted-strong">{p.body}</span>
                    <span className="eyebrow shrink-0 text-[10px]">Ekklē</span>
                  </li>
                ))}
              </ul>
              </Collapsible>
            </Card>
          );
        })
      )}
    </div>
  );
}
