import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  dayName,
  devotionalReminder,
  localToday,
  pastDevotionals,
  setDevotionalReminder,
  todaysDevotional,
  type Devotional,
} from '@/data/devotionals';
import { Button } from '@/ui/Button';
import { Collapsible } from '@/ui/Collapsible';
import { ErrorNote, Spinner } from '@/ui/states';
import { getChapter } from './data';
import { parseReadingId, readingLabel } from './readings';

/**
 * Daily devotionals (0046) in the Bible tab: today's at the top (folds away,
 * remembered per devotional), and past ones with the opt-in daily email.
 */

/** The passage's verses (Berean Standard Bible), shown on the card. */
function Passage({ passage, base }: { passage: string; base: string }) {
  const r = parseReadingId(passage);
  const [verses, setVerses] = useState<string[] | null>(null);
  useEffect(() => {
    if (!r) return;
    let live = true;
    getChapter('bsb', r.book, r.chapter)
      .then((all) => live && setVerses(all))
      .catch(() => live && setVerses([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage]);
  if (!r) return null;
  const from = r.from ?? 1;
  const to = r.to ?? verses?.length ?? 1;
  const shown = (verses ?? []).slice(from - 1, to);
  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-edge bg-canvas px-4 py-3">
      {shown.length > 0 && (
        <blockquote tabIndex={0} aria-label={readingLabel(passage)} className="max-h-72 overflow-y-auto font-serif text-[17px] leading-[1.75] text-sage">
          {shown.map((v, i) => (
            <span key={i}>
              <sup className="mr-0.5 font-sans text-[10px] text-muted">{from + i}</sup>
              {v}{' '}
            </span>
          ))}
        </blockquote>
      )}
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
        <span>{readingLabel(passage)} · BSB</span>
        <Link
          to={`${base}/${r.book.id}/${r.chapter}`}
          className="text-sage underline decoration-sage/30 underline-offset-2 hover:decoration-sage"
        >
          Read {r.book.name} {r.chapter}
        </Link>
      </figcaption>
    </figure>
  );
}

/** A devotional's body: passage, thought, question, prayer. */
export function DevotionalBody({ d, base }: { d: Devotional; base: string }) {
  return (
    <div className="flex flex-col gap-4">
      {d.passage && <Passage passage={d.passage} base={base} />}
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-muted-strong">
        {d.body.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="whitespace-pre-line">
            {para}
          </p>
        ))}
      </div>
      {d.question && (
        <div className="rounded-lg bg-sage/[0.05] px-4 py-3">
          <span className="eyebrow">to sit with</span>
          <p className="mt-1 text-[15px] leading-relaxed text-sage">{d.question}</p>
        </div>
      )}
      {d.prayer && <p className="whitespace-pre-line font-serif text-[16px] italic leading-relaxed text-sage">{d.prayer}</p>}
    </div>
  );
}

/** Today's devotional, at the top of the Bible tab (nothing when there's none). */
export function TodayDevotional({ base }: { base: string }) {
  const [d, setD] = useState<Devotional | null>(null);
  useEffect(() => {
    let live = true;
    todaysDevotional()
      .then((x) => live && setD(x))
      .catch(() => live && setD(null));
    return () => {
      live = false;
    };
  }, []);
  if (!d) return null;
  const today = d.day === localToday();
  return (
    <section aria-label="Today’s devotional" className="card p-0">
      <Collapsible
        storageKey={`devotional.${d.id}`}
        defaultOpen
        headerClassName="px-5 py-4"
        title={
          <span className="flex flex-col">
            <span className="eyebrow">{today ? 'today’s devotional' : `devotional · ${dayName(d.day)}`}</span>
            <span className="font-serif text-lg leading-snug text-sage">{d.title}</span>
          </span>
        }
        summary={d.passage ? readingLabel(d.passage) : undefined}
      >
        <div className="flex flex-col gap-4 border-t border-edge/70 px-5 py-4">
          <DevotionalBody d={d} base={base} />
          <Link to={`${base}/devotionals`} className="self-start text-[13px] text-muted hover:text-sage">
            Past devotionals →
          </Link>
        </div>
      </Collapsible>
    </section>
  );
}

/** The daily email, off until they choose a time. */
function Reminder({ area }: { area: 'app' | 'space' }) {
  const [current, setCurrent] = useState<{ at: string } | null | undefined>(undefined);
  const [time, setTime] = useState('07:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    devotionalReminder()
      .then((r) => {
        setCurrent(r);
        if (r) setTime(r.at);
      })
      .catch(() => setCurrent(null));
  }, []);
  async function save(at: string | null) {
    setBusy(true);
    setError(null);
    try {
      await setDevotionalReminder(at, area);
      setCurrent(await devotionalReminder());
    } catch {
      setError('That didn’t save. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (current === undefined) return null;
  return (
    <section aria-label="Daily devotional email" className="card flex flex-col gap-3 px-5 py-4 text-[14px]">
      <span>
        <span className="block font-medium text-sage">Daily email</span>
        <span className="text-[13px] text-muted">
          {current ? `Each day’s devotional arrives at ${current.at}.` : 'Off. Get each day’s devotional by email, at a time you choose.'}
        </span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px] text-muted-strong">
          At
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Email time"
            className="rounded-md border border-edge bg-canvas px-2 py-1 text-sage"
          />
        </label>
        {current ? (
          <>
            <Button size="sm" variant="quiet" disabled={busy || !time} onClick={() => void save(time)}>
              Save time
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void save(null)}>
              Turn off
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={busy || !time} onClick={() => void save(time)}>
            Turn on
          </Button>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </section>
  );
}

/** Past devotionals, newest first, each folding open. */
export function PastDevotionals({ base }: { base: string }) {
  const [list, setList] = useState<Devotional[] | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    pastDevotionals()
      .then((l) => {
        setList(l);
        setMore(l.length === 60);
      })
      .catch(() => setList([]));
  }, []);
  async function loadMore() {
    if (!list?.length) return;
    const next = await pastDevotionals(list[list.length - 1]!.day);
    setList([...list, ...next]);
    setMore(next.length === 60);
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link to={base} className="text-[13px] text-muted hover:text-sage">
          ← Bible
        </Link>
        <h1 className="font-serif text-3xl leading-tight text-sage">Devotionals</h1>
      </div>
      <Reminder area={base.startsWith('/app') ? 'app' : 'space'} />
      {list === null ? (
        <Spinner />
      ) : list.length === 0 ? (
        <p className="text-sm text-muted">No devotionals yet.</p>
      ) : (
        <ol className="card divide-y divide-edge/70 p-0">
          {list.map((d, i) => (
            <li key={d.id}>
              <Collapsible
                defaultOpen={i === 0}
                title={
                  <span className="flex flex-col">
                    <span className="text-[12px] text-muted">{dayName(d.day)}</span>
                    <span className="font-serif text-lg leading-snug text-sage">{d.title}</span>
                  </span>
                }
                summary={d.passage ? readingLabel(d.passage) : undefined}
                headerClassName="px-5 py-3"
              >
                <div className="px-5 pb-5">
                  <DevotionalBody d={d} base={base} />
                </div>
              </Collapsible>
            </li>
          ))}
        </ol>
      )}
      {more && (
        <Button variant="quiet" onClick={() => void loadMore()} className="self-center">
          Show earlier ones
        </Button>
      )}
    </div>
  );
}
