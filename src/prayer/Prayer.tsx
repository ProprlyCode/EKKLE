import { useEffect, useState, type FormEvent } from 'react';
import {
  answerPrayer,
  deletePrayerPerson,
  deletePrayerTime,
  myPrayer,
  prayerAmen,
  prayerMoment,
  savePrayerPerson,
  savePrayerTime,
  type MyPrayer,
  type PrayerMoment,
  type PrayerPerson,
  type PrayerTime,
} from '@/data/prayer';
import { Passage } from '@/bible/Devotional';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Collapsible } from '@/ui/Collapsible';
import { TextArea, TextInput } from '@/ui/Field';
import { ErrorNote, Spinner } from '@/ui/states';
import { nextTime, showTime } from './nextTime';

/**
 * Prayer (0052): a quiet reminder through a busy day — never a to-do. A few
 * times they choose (like Daniel), an optional email at each, a verse for the
 * day, and a private list of people to hold before God. Nothing is scored.
 */
export default function Prayer() {
  const [mine, setMine] = useState<MyPrayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    myPrayer()
      .then(setMine)
      .catch(() => setError('Couldn’t load this just now. Please try again.'));
  useEffect(() => {
    void load();
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!mine) return <Spinner />;
  const next = nextTime(mine.times);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="eyebrow">prayer</span>
        <h1 className="font-serif text-3xl leading-tight text-sage">A quiet moment</h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-strong">
          Daniel “got down on his knees three times a day and prayed, giving thanks to his God” (Daniel 6:10). Not a
          task to finish — a few pauses in a busy, noisy day.
        </p>
        {next && (
          <p className="text-[13px] text-muted">
            Your next pause: {next.label}, {showTime(next.at)}
          </p>
        )}
      </header>

      <Moment hasPeople={mine.people.length > 0} />
      <PeopleList people={mine.people} onChanged={load} />
      {mine.answered.length > 0 && <Answered list={mine.answered} onChanged={load} />}
      <Times times={mine.times} onChanged={load} />
    </div>
  );
}

/** The day's verse and, if they like, a few names. "Amen" closes it. */
function Moment({ hasPeople }: { hasPeople: boolean }) {
  const [moment, setMoment] = useState<PrayerMoment | null>(null);
  const [done, setDone] = useState(false);
  const [held, setHeld] = useState<string[]>([]);

  useEffect(() => {
    prayerMoment()
      .then(setMoment)
      .catch(() => setMoment(null));
  }, [hasPeople]);

  if (!moment) return null;

  async function someoneElse() {
    const shown = moment!.people.map((p) => p.id);
    const nextOnes = await prayerMoment([...held, ...shown]).catch(() => null);
    setHeld((h) => [...h, ...shown]);
    if (nextOnes && nextOnes.people.length > 0) setMoment({ ...moment!, people: nextOnes.people });
  }

  async function amen() {
    await prayerAmen(moment!.people.map((p) => p.id)).catch(() => undefined);
    setDone(true);
  }

  return (
    <section aria-label="Today’s quiet moment" className="card flex flex-col gap-5 px-5 py-5">
      <Passage passage={moment.verse} base="/app/bible" />
      {done ? (
        <p role="status" className="font-serif text-lg italic text-sage">
          Amen. Go gently.
        </p>
      ) : (
        <>
          {moment.people.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[14px] text-muted-strong">If you’d like, a few people to hold before God:</p>
              <ul className="flex flex-col gap-2">
                {moment.people.map((p) => (
                  <li key={p.id} className="rounded-lg bg-sage/[0.05] px-4 py-3">
                    <span className="font-medium text-sage">{p.name}</span>
                    {p.request && <span className="block text-[14px] text-muted-strong">{p.request}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void amen()}>Amen</Button>
            {moment.people.length > 0 && (
              <Button variant="ghost" onClick={() => void someoneElse()}>
                Someone else
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function PeopleList({ people, onChanged }: { people: PrayerPerson[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <Card className="p-0">
      <Collapsible
        storageKey="prayer.list"
        defaultOpen
        title={<h2 className="text-base">People you’re praying for</h2>}
        summary={people.length ? `${people.length}` : undefined}
      >
        <div className="flex flex-col gap-3 border-t border-edge/70 px-5 py-4">
          <p className="text-[13px] text-muted">Only you see this list.</p>
          {people.length === 0 && !adding && (
            <p className="text-sm text-muted-strong">
              Add someone on your heart — a friend, family, a coworker — and what you’d like to pray for them.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-edge/70">
            {people.map((p) => (
              <PersonRow key={p.id} p={p} onChanged={onChanged} />
            ))}
          </ul>
          {adding ? (
            <PersonForm
              onDone={(saved) => {
                setAdding(false);
                if (saved) onChanged();
              }}
            />
          ) : (
            <Button variant="quiet" size="sm" className="self-start" onClick={() => setAdding(true)}>
              Add someone
            </Button>
          )}
        </div>
      </Collapsible>
    </Card>
  );
}

function PersonForm({ person, onDone }: { person?: PrayerPerson; onDone: (saved: boolean) => void }) {
  const [name, setName] = useState(person?.name ?? '');
  const [request, setRequest] = useState(person?.request ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await savePrayerPerson(person?.id ?? null, name, request);
      onDone(true);
    } catch {
      setBusy(false);
      setError('That didn’t save. Please try again.');
    }
  }
  return (
    <form onSubmit={(e) => void save(e)} aria-label={person ? `Edit ${person.name}` : 'Add someone'} className="flex flex-col gap-3 py-2">
      <TextInput label="Name" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
      <TextArea
        label="What you’d like to pray for (optional)"
        rows={2}
        maxLength={500}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onDone(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PersonRow({ p, onChanged }: { p: PrayerPerson; onChanged: () => void }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'answer'>('view');
  const [note, setNote] = useState('');
  if (mode === 'edit')
    return (
      <li>
        <PersonForm
          person={p}
          onDone={(saved) => {
            setMode('view');
            if (saved) onChanged();
          }}
        />
      </li>
    );
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="font-medium text-sage">{p.name}</span>
          {p.request && <span className="block text-[14px] text-muted-strong">{p.request}</span>}
        </span>
        {mode === 'view' && (
          <span className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setMode('answer')}>
              Answered
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('edit')}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(`Take ${p.name} off your list?`)) void deletePrayerPerson(p.id).then(onChanged);
              }}
            >
              Remove
            </Button>
          </span>
        )}
      </div>
      {mode === 'answer' && (
        <form
          aria-label={`${p.name}: answered`}
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void answerPrayer(p.id, true, note).then(onChanged);
          }}
        >
          <TextArea
            label="What happened? (optional)"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Mark answered
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode('view')}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function Answered({ list, onChanged }: { list: PrayerPerson[]; onChanged: () => void }) {
  return (
    <Card className="p-0">
      <Collapsible
        storageKey="prayer.answered"
        title={<h2 className="text-base">Answered</h2>}
        summary={`${list.length}`}
      >
        <ul className="flex flex-col divide-y divide-edge/70 border-t border-edge/70 px-5">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start gap-2 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-muted">
                  {p.answered_at ? new Date(p.answered_at).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                </span>
                <span className="font-medium text-sage">{p.name}</span>
                {p.request && <span className="block text-[14px] text-muted-strong">{p.request}</span>}
                {p.answered_note && (
                  <span className="mt-1 block font-serif text-[15px] italic text-sage">{p.answered_note}</span>
                )}
              </span>
              <Button size="sm" variant="ghost" onClick={() => void answerPrayer(p.id, false).then(onChanged)}>
                Back to my list
              </Button>
            </li>
          ))}
        </ul>
      </Collapsible>
    </Card>
  );
}

const SUGGESTED = [
  { label: 'Morning', at: '07:00' },
  { label: 'Midday', at: '12:30' },
  { label: 'Evening', at: '21:00' },
];

function Times({ times, onChanged }: { times: PrayerTime[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestion = SUGGESTED.find((s) => !times.some((t) => t.label === s.label)) ?? { label: '', at: '12:00' };

  async function save(t: { id: string | null; label: string; at: string; email: boolean }) {
    setError(null);
    try {
      await savePrayerTime(t);
      onChanged();
      return true;
    } catch {
      setError('That didn’t save. Please try again.');
      return false;
    }
  }

  return (
    <Card className="p-0">
      <Collapsible
        storageKey="prayer.times"
        defaultOpen={times.length === 0}
        title={<h2 className="text-base">Your times</h2>}
        summary={times.length ? times.map((t) => t.label).join(' · ') : 'none yet'}
      >
        <div className="flex flex-col gap-3 border-t border-edge/70 px-5 py-4">
          <p className="text-[13px] text-muted">
            A few pauses through your day, if they help. An email at each is up to you — and if a time passes, it
            simply passes.
          </p>
          <ul className="flex flex-col divide-y divide-edge/70">
            {times.map((t) => (
              <TimeRow key={t.id} t={t} onSave={save} onDelete={() => void deletePrayerTime(t.id).then(onChanged)} />
            ))}
          </ul>
          {error && <ErrorNote>{error}</ErrorNote>}
          {adding ? (
            <TimeForm
              initial={{ id: null, label: suggestion.label, at: suggestion.at, email: false }}
              onSave={async (t) => {
                if (await save(t)) setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            times.length < 5 && (
              <Button variant="quiet" size="sm" className="self-start" onClick={() => setAdding(true)}>
                Add a time
              </Button>
            )
          )}
        </div>
      </Collapsible>
    </Card>
  );
}

type TimeDraft = { id: string | null; label: string; at: string; email: boolean };

function TimeRow({
  t,
  onSave,
  onDelete,
}: {
  t: PrayerTime;
  onSave: (t: TimeDraft) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <li className="py-2">
        <TimeForm
          initial={{ id: t.id, label: t.label, at: t.at, email: t.email }}
          onSave={async (d) => {
            if (await onSave(d)) setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  return (
    <li className="flex flex-wrap items-center gap-2 py-3">
      <span className="min-w-0 flex-1">
        <span className="font-medium text-sage">{t.label}</span>{' '}
        <span className="text-[14px] text-muted-strong">{showTime(t.at)}</span>
        <span className="block text-[12px] text-muted">{t.email ? 'A short email at this time' : 'No email'}</span>
      </span>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        Edit
      </Button>
      <Button size="sm" variant="ghost" onClick={onDelete}>
        Remove
      </Button>
    </li>
  );
}

function TimeForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: TimeDraft;
  onSave: (t: TimeDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState<TimeDraft>(initial);
  const [busy, setBusy] = useState(false);
  return (
    <form
      aria-label={initial.id ? `Edit ${initial.label}` : 'Add a time'}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void onSave(d).finally(() => setBusy(false));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <TextInput label="Name" value={d.label} maxLength={30} required onChange={(e) => setD({ ...d, label: e.target.value })} />
        <TextInput label="Time" type="time" value={d.at} required onChange={(e) => setD({ ...d, at: e.target.value })} />
      </div>
      <label className="flex items-center gap-3 text-sm text-sage">
        <input
          type="checkbox"
          className="h-4 w-4 accent-sage"
          checked={d.email}
          onChange={(e) => setD({ ...d, email: e.target.checked })}
        />
        Send me a short email at this time
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || !d.label.trim() || !d.at}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
