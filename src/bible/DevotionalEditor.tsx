import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  dayName,
  deleteDevotional,
  devotionalLibrary,
  localToday,
  saveDevotional,
  type Devotional,
} from '@/data/devotionals';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextArea, TextInput } from '@/ui/Field';
import { Collapsible } from '@/ui/Collapsible';
import { ErrorNote, Spinner } from '@/ui/states';
import { DevotionalBody } from './Devotional';
import { parseDayLine, readingLabel } from './readings';

/**
 * Leadership → Resources → Devotionals (0046): a ministry's Admins and
 * Leaders write one devotional per date — a passage, a thought, a question
 * and a prayer — as a draft or published. Everyone on the address sees
 * today's at the top of the Bible tab.
 */

type Draft = { id: string | null; day: string; title: string; passage: string; body: string; question: string; prayer: string };

const blank = (day: string): Draft => ({ id: null, day, title: '', passage: '', body: '', question: '', prayer: '' });

function nextFreeDay(list: Devotional[]): string {
  const taken = new Set(list.map((d) => d.day));
  const d = new Date(`${localToday()}T12:00:00`);
  for (let i = 0; i < 400; i++) {
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!taken.has(day)) return day;
    d.setDate(d.getDate() + 1);
  }
  return localToday();
}

export default function DevotionalEditor() {
  const [list, setList] = useState<Devotional[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => devotionalLibrary().then(setList).catch(() => setError('Couldn’t load devotionals.'));
  useEffect(() => {
    void load();
  }, []);

  const today = localToday();
  const upcoming = (list ?? []).filter((d) => d.day >= today).sort((a, b) => a.day.localeCompare(b.day));
  const past = (list ?? []).filter((d) => d.day < today);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/leadership/resources" className="text-[13px] text-muted hover:text-sage">
            ← Resources
          </Link>
          <h1 className="mt-1 text-xl">Devotionals</h1>
          <p className="mt-1 text-sm text-muted-strong">
            One for each day, written ahead. Everyone here sees today’s at the top of the Bible tab — and can get it
            by email.
          </p>
        </div>
        {list && !editing && (
          <Button onClick={() => setEditing(blank(nextFreeDay(list)))}>New devotional</Button>
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-edge bg-card px-4 py-3 text-sm text-sage">
          {notice}
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}

      {editing && (
        <Editor
          draft={editing}
          onCancel={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setNotice(msg);
            void load();
          }}
        />
      )}

      {list === null ? (
        !error && <Spinner />
      ) : list.length === 0 && !editing ? (
        <Card>
          <p className="text-sm text-muted">No devotionals yet. Write the first one — today’s, or one for later.</p>
        </Card>
      ) : (
        <>
          <Card className="p-0">
            <Collapsible
              storageKey="devotionals.upcoming"
              defaultOpen
              title={<h2 className="text-base">Today and coming up</h2>}
              summary={`${upcoming.length}`}
            >
              <DevotionalList list={upcoming} onEdit={setEditing} onChanged={load} empty="Nothing scheduled yet." />
            </Collapsible>
          </Card>
          {past.length > 0 && (
            <Card className="p-0">
              <Collapsible storageKey="devotionals.past" title={<h2 className="text-base">Past</h2>} summary={`${past.length}`}>
                <DevotionalList list={past} onEdit={setEditing} onChanged={load} empty="" />
              </Collapsible>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function DevotionalList({
  list,
  onEdit,
  onChanged,
  empty,
}: {
  list: Devotional[];
  onEdit: (d: Draft) => void;
  onChanged: () => void;
  empty: string;
}) {
  if (list.length === 0) return <p className="border-t border-edge/70 px-5 py-4 text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-edge/70 border-t border-edge/70">
      {list.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] text-muted">
              {dayName(d.day)}
              {d.author ? ` · ${d.author}` : ''}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sage">{d.title}</span>
              {d.status === 'draft' && <span className="eyebrow text-[10px]">Draft</span>}
              {d.passage && <span className="text-[12px] text-muted">{readingLabel(d.passage)}</span>}
            </span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onEdit({
                id: d.id,
                day: d.day,
                title: d.title,
                passage: d.passage ? readingLabel(d.passage).replace('–', '-') : '',
                body: d.body,
                question: d.question ?? '',
                prayer: d.prayer ?? '',
              })
            }
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(`Delete “${d.title}”?`)) void deleteDevotional(d.id).then(onChanged);
            }}
          >
            Delete
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Editor({ draft, onCancel, onSaved }: { draft: Draft; onCancel: () => void; onSaved: (msg: string) => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });

  // One passage, written the way people write them ("John 15:1-11").
  const passage = useMemo(() => {
    if (!d.passage.trim()) return { id: null as string | null, error: null as string | null };
    const r = parseDayLine(d.passage);
    if (typeof r === 'string') return { id: null, error: r };
    if (r.length !== 1) return { id: null, error: 'One chapter or one set of verses (e.g. “John 15:1-11”).' };
    return { id: r[0]!, error: null };
  }, [d.passage]);

  const ready = !!d.day && !!d.title.trim() && !!d.body.trim() && !passage.error;

  async function save(status: 'draft' | 'published', e?: FormEvent) {
    e?.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await saveDevotional(d.id, {
        day: d.day,
        title: d.title,
        passage: passage.id,
        body: d.body,
        question: d.question,
        prayer: d.prayer,
        status,
      });
      onSaved(
        status === 'published'
          ? `“${d.title.trim()}” is published for ${dayName(d.day)}.`
          : `“${d.title.trim()}” is saved as a draft.`,
      );
    } catch (err) {
      setBusy(false);
      const code = (err as { message?: string } | null)?.message;
      setError(code === 'day_taken' ? 'There’s already a devotional for that day — edit that one, or pick another day.' : 'That didn’t save. Please try again.');
    }
  }

  const preview: Devotional = {
    id: 'preview',
    day: d.day,
    title: d.title || 'Title',
    passage: passage.id,
    body: d.body || 'Your thought for the day.',
    question: d.question || null,
    prayer: d.prayer || null,
    status: 'draft',
  };

  return (
    <Card className="flex flex-col gap-5">
      <h2 className="text-base">{d.id ? 'Edit devotional' : 'New devotional'}</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={(e) => void save('published', e)} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <TextInput label="Day" type="date" value={d.day} onChange={set('day')} required />
            <TextInput label="Title" value={d.title} onChange={set('title')} maxLength={120} required />
          </div>
          <TextInput
            label="Passage"
            placeholder="e.g. John 15:1-11"
            value={d.passage}
            onChange={set('passage')}
            error={passage.error ?? undefined}
            hint="Optional. The verses show on the devotional."
          />
          <TextArea label="Thought" rows={7} value={d.body} onChange={set('body')} maxLength={6000} required />
          <TextInput label="A question to sit with" value={d.question} onChange={set('question')} maxLength={500} />
          <TextArea label="A short prayer" rows={2} value={d.prayer} onChange={set('prayer')} maxLength={1000} />
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !ready}>
              Publish
            </Button>
            <Button type="button" variant="quiet" disabled={busy || !ready} onClick={() => void save('draft')}>
              Save as draft
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
        <div className="flex flex-col gap-2">
          <span className="eyebrow">preview · {d.day ? dayName(d.day) : ''}</span>
          <div className="rounded-card border border-edge bg-canvas px-4 py-4">
            <h3 className="mb-3 font-serif text-lg text-sage">{preview.title}</h3>
            <DevotionalBody d={preview} base="/app/bible" />
          </div>
        </div>
      </div>
    </Card>
  );
}
