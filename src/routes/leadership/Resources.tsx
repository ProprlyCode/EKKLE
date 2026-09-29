import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSession } from '@/auth/SessionProvider';
import {
  listResources,
  createResource,
  saveResource,
  setResourcePublished,
  deleteResource,
  type ResourceWithTopics,
  type ResourceDraft,
} from '@/data/resources';
import type { ResourceKind } from '@/lib/database.types';
import { videoEmbedUrl } from '@/lib/video';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput, TextArea } from '@/ui/Field';
import { EmptyState, ErrorNote, Spinner } from '@/ui/states';
import { ResourceView } from '@/space/ResourceView';
import { StudyBank } from './StudyBank';

/**
 * Leadership → Resources. The Bible studies seekers get (the Ekklē study bank:
 * choose, order, preview), then reading, video and links for their Your space —
 * a list, and an editor with a live preview of exactly what seekers see.
 * Only published resources reach seekers.
 */
export default function Resources() {
  const { membership } = useSession();
  const [items, setItems] = useState<ResourceWithTopics[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setItems(await listResources());
    } catch {
      setError('Couldn’t load resources.');
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function add() {
    if (!membership) return;
    try {
      const r = await createResource(membership.org_id);
      await refresh();
      setEditing(r.id);
    } catch {
      setError('Couldn’t create a resource.');
    }
  }

  const current = items?.find((r) => r.id === editing);
  if (editing && current) {
    return (
      <ResourceEditor
        resource={current}
        onDone={() => {
          setEditing(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl">Resources</h1>
          <p className="mt-1 text-sm text-muted-strong">
            Bible studies, reading, video and links for people’s Your space.
          </p>
        </div>
        <Button onClick={add}>New resource</Button>
      </div>

      <StudyBank />

      <Link
        to="/leadership/reading-plans"
        className="card flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-sage/40"
      >
        <span>
          <span className="block text-base text-sage">Reading plans</span>
          <span className="text-sm text-muted-strong">
            Plans people follow in the Bible tab. Read one together, or write your own.
          </span>
        </span>
        <span aria-hidden className="text-muted">→</span>
      </Link>

      <Link
        to="/leadership/devotionals"
        className="card flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-sage/40"
      >
        <span>
          <span className="block text-base text-sage">Devotionals</span>
          <span className="text-sm text-muted-strong">
            A thought for each day, with a passage, a question and a prayer — at the top of the Bible tab.
          </span>
        </span>
        <span aria-hidden className="text-muted">→</span>
      </Link>

      <Link
        to="/leadership/faith-in-action"
        className="card flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-sage/40"
      >
        <span>
          <span className="block text-base text-sage">Faith in action</span>
          <span className="text-sm text-muted-strong">
            Ideas and prompts your members see beside their code. Add your own.
          </span>
        </span>
        <span aria-hidden className="text-muted">→</span>
      </Link>

      <h2 className="-mb-4 text-base">Reading, video and links</h2>

      {error && <ErrorNote>{error}</ErrorNote>}

      {items === null ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No resources yet"
          note="Add a reading, a video or a link — published ones appear in Your space."
          action={
            <Button className="mt-1" onClick={add}>
              New resource
            </Button>
          }
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-edge/70">
            {items.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setEditing(r.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-sage/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-sage">{r.title}</span>
                    <span className="text-[13px] text-muted">
                      {r.status === 'approved' ? 'Published' : 'Draft'} · {KIND_LABEL[r.kind]}
                      {r.topics.length > 0 && ` · ${r.topics.join(', ')}`}
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

const KIND_LABEL: Record<ResourceKind, string> = {
  text: 'Reading',
  video: 'Video',
  link: 'Link',
};

function ResourceEditor({
  resource,
  onDone,
}: {
  resource: ResourceWithTopics;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<ResourceDraft>({
    title: resource.title,
    blurb: resource.blurb,
    body: resource.body,
    kind: resource.kind,
    url: resource.url,
    topics: resource.topics,
  });
  const [topicText, setTopicText] = useState(resource.topics.join(', '));
  const [published, setPublished] = useState(resource.status === 'approved');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topics = topicText
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const videoOk = draft.kind !== 'video' || Boolean(videoEmbedUrl(draft.url));
  const linkOk = draft.kind !== 'link' || Boolean(draft.url?.trim());
  const valid = draft.title.trim().length > 0 && videoOk && linkOk;

  function patch(p: Partial<ResourceDraft>) {
    setDraft((d) => ({ ...d, ...p }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveResource(resource.id, { ...draft, topics });
      setSaved(true);
    } catch {
      setError('Couldn’t save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished() {
    setBusy(true);
    setError(null);
    try {
      await saveResource(resource.id, { ...draft, topics });
      await setResourcePublished(resource.id, !published);
      setPublished(!published);
      setSaved(true);
    } catch {
      setError('Couldn’t update. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this resource? This can’t be undone.')) return;
    try {
      await deleteResource(resource.id);
      onDone();
    } catch {
      setError('Couldn’t delete.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <button onClick={onDone} className="text-sm text-muted hover:text-sage">
          ← Resources
        </button>
        <span className="text-[13px] text-muted">{published ? 'Published' : 'Draft'}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <TextInput
            label="Title"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
          <TextInput
            label="Short description"
            value={draft.blurb}
            onChange={(e) => patch({ blurb: e.target.value })}
            hint="One line, shown in the list."
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">Kind</legend>
            <div className="flex gap-2">
              {(['text', 'video', 'link'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => patch({ kind: k })}
                  aria-pressed={draft.kind === k}
                  className={
                    'rounded-lg border px-3 py-1.5 text-sm transition-colors ' +
                    (draft.kind === k
                      ? 'border-accent bg-accent text-canvas'
                      : 'border-edge text-muted-strong hover:border-sage/50')
                  }
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </fieldset>

          {draft.kind !== 'text' && (
            <TextInput
              label={draft.kind === 'video' ? 'YouTube or Vimeo link' : 'Link'}
              value={draft.url ?? ''}
              onChange={(e) => patch({ url: e.target.value })}
              hint={
                draft.kind === 'video' && draft.url && !videoOk
                  ? 'That doesn’t look like a YouTube or Vimeo link.'
                  : undefined
              }
            />
          )}

          <TextArea
            label={draft.kind === 'text' ? 'Text' : 'Notes (optional)'}
            rows={draft.kind === 'text' ? 10 : 4}
            value={draft.body}
            onChange={(e) => patch({ body: e.target.value })}
          />
          <TextInput
            label="Topics"
            value={topicText}
            onChange={(e) => {
              setTopicText(e.target.value);
              setSaved(false);
            }}
            hint="Separate with commas, e.g. Getting started, Prayer"
          />

          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={busy || !valid}>
              {saved ? 'Saved' : 'Save'}
            </Button>
            <Button variant="quiet" onClick={togglePublished} disabled={busy || !valid}>
              {published ? 'Unpublish' : 'Publish'}
            </Button>
            <button
              onClick={remove}
              className="ml-auto text-[13px] text-muted hover:text-sage"
            >
              Delete
            </button>
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          <span className="eyebrow">preview — what people see</span>
          <div className="rounded-card border border-edge bg-canvas px-5 py-6">
            <ResourceView
              resource={{
                id: resource.id,
                title: draft.title,
                blurb: draft.blurb,
                body: draft.body,
                kind: draft.kind,
                url: draft.url,
                topics,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
