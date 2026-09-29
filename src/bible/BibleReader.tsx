import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { markDay } from './plans';
import { BOOKS, BOOK_BY_ID, formatReference, type Book } from './books';
import {
  ESV_COPYRIGHT,
  getChapter,
  getMarks,
  getPlace,
  isEsvAvailable,
  listMyMarks,
  saveMark,
  savePlace,
  searchBible,
  TRANSLATIONS,
  type Mark,
  type MarkColor,
  type SearchHit,
  type Translation,
} from './data';
import { Button } from '@/ui/Button';
import { ErrorNote, Spinner } from '@/ui/states';

const HIGHLIGHT: Record<MarkColor, string> = {
  yellow: 'bg-[#f3e3a1]/70',
  green: 'bg-[#cfe3c4]/80',
  blue: 'bg-[#cddcec]/80',
  pink: 'bg-[#efd2d6]/80',
};
const SWATCH: Record<MarkColor, string> = {
  yellow: '#ecd67a',
  green: '#a9cc98',
  blue: '#a6c1de',
  pink: '#e2aeb6',
};

type Panel = null | 'books' | 'search' | 'notes';

/**
 * The built-in Bible (Your space → Bible, and the members' app). One chapter
 * at a time in BSB, KJV or ESV; tap a verse to highlight it or add a note;
 * search; your notes; it remembers where you left off.
 * `base` is where it lives: '/space/bible' or '/app/bible'.
 */
export default function BibleReader({ base, stickyTop = 'top-0' }: { base: string; stickyTop?: string }) {
  const params = useParams();
  const navigate = useNavigate();
  const book = params.book ? BOOK_BY_ID[params.book.toUpperCase()] : undefined;
  const chapter = Number(params.chapter) || 1;

  const [translation, setTranslation] = useState<Translation>('bsb');
  const [esv, setEsv] = useState(false);
  const [verses, setVerses] = useState<string[] | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  // Opened from a reading plan: "Day 3 — Mark as read" (0038).
  const [search] = useSearchParams();
  const planId = search.get('plan');
  const planDay = Number(search.get('day')) || null;

  // No place in the URL: pick up where they left off (else John 1).
  useEffect(() => {
    if (book) return;
    let live = true;
    getPlace()
      .then((p) => {
        if (!live) return;
        if (p) setTranslation(p.translation);
        navigate(`${base}/${(p?.book ?? BOOK_BY_ID.JHN).id}/${p?.chapter ?? 1}`, { replace: true });
      })
      .catch(() => live && navigate(`${base}/JHN/1`, { replace: true }));
    return () => {
      live = false;
    };
  }, [book, base, navigate]);

  useEffect(() => {
    void isEsvAvailable().then(setEsv);
    void getPlace().then((p) => p && setTranslation(p.translation)).catch(() => {});
  }, []);

  // The chapter, its marks, and remembering the place.
  useEffect(() => {
    if (!book) return;
    let live = true;
    setVerses(null);
    setError(null);
    setSelected(null);
    getChapter(translation, book, chapter)
      .then((v) => live && setVerses(v))
      .catch(() => live && setError('Couldn’t open this chapter. Please try again.'));
    getMarks(book.id, chapter)
      .then((m) => live && setMarks(m))
      .catch(() => {});
    void savePlace({ translation, book, chapter }).catch(() => {});
    window.scrollTo({ top: 0 });
    return () => {
      live = false;
    };
  }, [book, chapter, translation]);

  const markByVerse = useMemo(() => new Map(marks.map((m) => [m.verse, m])), [marks]);

  if (!book) return <Spinner />;

  const go = (b: Book, c: number) => {
    setPanel(null);
    navigate(`${base}/${b.id}/${c}`);
  };
  const index = BOOKS.indexOf(book);
  const prev = chapter > 1 ? [book, chapter - 1] as const : index > 0 ? [BOOKS[index - 1], BOOKS[index - 1].chapters] as const : null;
  const next = chapter < book.chapters ? [book, chapter + 1] as const : index < 65 ? [BOOKS[index + 1], 1] as const : null;

  async function onSaveMark(verse: number, mark: { color: MarkColor | null; note: string | null }) {
    if (!book) return;
    await saveMark(book.id, chapter, verse, mark);
    setMarks(await getMarks(book.id, chapter));
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div
        // Edge to edge: the members' app pads its pages 1rem, Your space 1.25rem.
        className={`sticky ${stickyTop} z-[5] flex items-center gap-2 border-b border-edge/70 bg-canvas py-2 ${
          base.startsWith('/app') ? '-mx-4 px-4' : '-mx-5 px-5'
        }`}
      >
        <button
          onClick={() => setPanel(panel === 'books' ? null : 'books')}
          aria-expanded={panel === 'books'}
          aria-label={`${book.name} ${chapter}, choose a book`}
          className="rounded-lg px-2 py-1 font-serif text-lg text-sage hover:bg-sage/5"
        >
          {book.name} {chapter} <span aria-hidden className="text-sm text-muted">▾</span>
        </button>
        <span className="flex-1" />
        <div role="group" aria-label="Translation" className="flex rounded-lg border border-edge p-0.5">
          {(['bsb', 'kjv', ...(esv ? ['esv'] : [])] as Translation[]).map((t) => (
            <button
              key={t}
              onClick={() => setTranslation(t)}
              aria-pressed={translation === t}
              title={TRANSLATIONS[t].name}
              className={
                'rounded-md px-2 py-0.5 text-[12px] font-medium transition-colors ' +
                (translation === t ? 'bg-accent text-canvas' : 'text-muted hover:text-sage')
              }
            >
              {TRANSLATIONS[t].short}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPanel(panel === 'search' ? null : 'search')}
          aria-label="Search the Bible"
          aria-expanded={panel === 'search'}
          className="rounded-lg px-2 py-1 text-muted hover:bg-sage/5 hover:text-sage"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => setPanel(panel === 'notes' ? null : 'notes')}
          aria-expanded={panel === 'notes'}
          className="rounded-lg px-2 py-1 text-[13px] text-muted hover:bg-sage/5 hover:text-sage"
        >
          Notes
        </button>
        <Link
          to={`${base}/plans`}
          className="rounded-lg px-2 py-1 text-[13px] text-muted hover:bg-sage/5 hover:text-sage"
        >
          Plans
        </Link>
      </div>

      {planId && planDay && (
        <PlanBar
          onDone={async () => {
            await markDay(planId, planDay, true);
            navigate(`${base}/plans/${planId}`);
          }}
          day={planDay}
          back={`${base}/plans/${planId}`}
        />
      )}

      {panel === 'books' && <BookPicker current={book} onPick={go} />}
      {panel === 'search' && <SearchPanel translation={translation} onOpen={(h) => go(h.book, h.chapter)} />}
      {panel === 'notes' && <NotesPanel onOpen={(b, c) => go(b, c)} />}

      {/* The chapter */}
      <article className="font-serif text-[19px] leading-[1.85] text-sage">
        <h1 className="mb-4 text-2xl">
          {book.name} {chapter}
        </h1>
        {error && <ErrorNote>{error}</ErrorNote>}
        {verses === null && !error ? (
          <div className="py-10">
            <Spinner />
          </div>
        ) : (
          <p>
            {verses?.map((text, i) => {
              if (!text) return null;
              const n = i + 1;
              const mark = markByVerse.get(n);
              return (
                <span key={n}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(selected === n ? null : n)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(selected === n ? null : n)}
                    aria-label={`Verse ${n}`}
                    className={
                      'cursor-pointer rounded-sm transition-colors ' +
                      (mark?.color ? HIGHLIGHT[mark.color] + ' ' : '') +
                      (selected === n ? 'underline decoration-accent decoration-2 underline-offset-4' : '')
                    }
                  >
                    <sup className="mr-0.5 font-sans text-[11px] font-medium text-muted">{n}</sup>
                    <VerseText text={text} />
                    {mark?.note && (
                      <span aria-label="Has a note" className="ml-0.5 align-super font-sans text-[10px] text-accent">
                        ✎
                      </span>
                    )}
                  </span>{' '}
                </span>
              );
            })}
          </p>
        )}
      </article>

      {selected !== null && verses && (
        <MarkSheet
          reference={formatReference({ book, chapter, verse: selected, toVerse: null })}
          text={verses[selected - 1]}
          mark={markByVerse.get(selected)}
          onClose={() => setSelected(null)}
          onSave={(m) => onSaveMark(selected, m)}
        />
      )}

      {translation === 'esv' && verses && (
        <p className="text-[11px] leading-relaxed text-muted">
          {ESV_COPYRIGHT}{' '}
          <a href="https://www.esv.org" target="_blank" rel="noreferrer" className="underline">
            esv.org
          </a>
        </p>
      )}
      {translation !== 'esv' && (
        <p className="text-[11px] text-muted">{TRANSLATIONS[translation].name} · public domain</p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-edge/70 pt-4 pb-6">
        {prev ? (
          <Button variant="quiet" onClick={() => go(prev[0], prev[1])}>
            ← {prev[0].name} {prev[1]}
          </Button>
        ) : (
          <span />
        )}
        {next && (
          <Button variant="quiet" onClick={() => go(next[0], next[1])}>
            {next[0].name} {next[1]} →
          </Button>
        )}
      </div>
    </div>
  );
}

/** KJV marks supplied words with [brackets]; show them in italics instead. */
function VerseText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('[') && p.endsWith(']') ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function Sheet({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-sage/20 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border border-edge bg-card p-5 shadow-lg sm:rounded-2xl"
      >
        {children}
      </div>
    </div>
  );
}

function MarkSheet({
  reference,
  text,
  mark,
  onClose,
  onSave,
}: {
  reference: string;
  text: string;
  mark: Mark | undefined;
  onClose: () => void;
  onSave: (m: { color: MarkColor | null; note: string | null }) => Promise<void>;
}) {
  const [color, setColor] = useState<MarkColor | null>(mark?.color ?? null);
  const [note, setNote] = useState(mark?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function save(next: { color: MarkColor | null; note: string | null }) {
    setBusy(true);
    setError(null);
    try {
      await onSave(next);
    } catch {
      setBusy(false);
      setError('Couldn’t save. Please try again.');
    }
  }

  return (
    <Sheet onClose={onClose} label={reference}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted-strong">{reference}</p>
          <p className="mt-1 line-clamp-3 font-serif text-[15px] leading-relaxed text-sage">{text}</p>
        </div>
        <div className="flex items-center gap-3" role="group" aria-label="Highlight">
          {(Object.keys(SWATCH) as MarkColor[]).map((c) => (
            <button
              key={c}
              onClick={() => setColor(color === c ? null : c)}
              aria-label={`Highlight ${c}`}
              aria-pressed={color === c}
              className={'h-8 w-8 rounded-full ring-offset-2 ring-offset-card ' + (color === c ? 'ring-2 ring-sage' : '')}
              style={{ backgroundColor: SWATCH[c] }}
            />
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted-strong">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What stands out to you?"
            className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-sage placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => save({ color, note })} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {mark && (
            <Button variant="ghost" onClick={() => save({ color: null, note: null })} disabled={busy}>
              Clear
            </Button>
          )}
          <button
            onClick={async () => {
              await navigator.clipboard?.writeText(`“${text}” — ${reference}`).catch(() => {});
              setCopied(true);
            }}
            className="ml-auto text-[13px] text-muted hover:text-sage"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function BookPicker({ current, onPick }: { current: Book; onPick: (b: Book, c: number) => void }) {
  const [book, setBook] = useState<Book | null>(null);
  if (book)
    return (
      <div className="rounded-card border border-edge bg-card p-4">
        <button onClick={() => setBook(null)} className="mb-3 text-[13px] text-muted hover:text-sage">
          ← Books
        </button>
        <h2 className="mb-3 font-serif text-lg text-sage">{book.name}</h2>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
          {Array.from({ length: book.chapters }, (_, i) => (
            <button
              key={i}
              onClick={() => onPick(book, i + 1)}
              className="rounded-lg border border-edge py-2 text-sm text-sage hover:border-accent/60"
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <div className="rounded-card border border-edge bg-card p-4">
      {(['OT', 'NT'] as const).map((t) => (
        <div key={t} className="mb-4 last:mb-0">
          <p className="eyebrow mb-2">{t === 'OT' ? 'Old Testament' : 'New Testament'}</p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {BOOKS.filter((b) => b.testament === t).map((b) => (
              <button
                key={b.id}
                onClick={() => (b.chapters === 1 ? onPick(b, 1) : setBook(b))}
                className={
                  'rounded-md px-2 py-1.5 text-left text-sm hover:bg-sage/5 ' +
                  (b.id === current.id ? 'font-medium text-sage' : 'text-muted-strong')
                }
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchPanel({ translation, onOpen }: { translation: Translation; onOpen: (h: SearchHit) => void }) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<{ hits: SearchHit[]; more: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await searchBible(translation, q));
    } catch {
      setError('Search didn’t work just now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-edge bg-card p-4">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search words or a phrase"
          aria-label="Search the Bible"
          autoFocus
          className="flex-1 rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-sage placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <Button type="submit" disabled={busy || !q.trim()}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
      {result && (
        <>
          <p className="text-[12px] text-muted" role="status">
            {result.hits.length === 0
              ? 'No verses found.'
              : `${result.hits.length}${result.more ? '+' : ''} verses · ${TRANSLATIONS[translation].short}`}
          </p>
          <ul className="flex max-h-[50vh] flex-col divide-y divide-edge/70 overflow-y-auto">
            {result.hits.map((h) => (
              <li key={`${h.book.id}${h.chapter}:${h.verse}`}>
                <button onClick={() => onOpen(h)} className="w-full py-2.5 text-left hover:bg-sage/5">
                  <span className="block text-[13px] font-medium text-sage">
                    {formatReference({ book: h.book, chapter: h.chapter, verse: h.verse, toVerse: null })}
                  </span>
                  <span className="block font-serif text-[14px] leading-relaxed text-muted-strong">{h.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NotesPanel({ onOpen }: { onOpen: (b: Book, c: number) => void }) {
  const [marks, setMarks] = useState<Mark[] | null>(null);
  useEffect(() => {
    listMyMarks()
      .then(setMarks)
      .catch(() => setMarks([]));
  }, []);
  const withNotes = marks?.filter((m) => m.note) ?? [];
  return (
    <div className="rounded-card border border-edge bg-card p-4">
      <p className="eyebrow mb-2">your notes</p>
      {marks === null ? (
        <Spinner />
      ) : withNotes.length === 0 ? (
        <p className="text-sm text-muted">Tap any verse to highlight it or write a note.</p>
      ) : (
        <ul className="flex max-h-[50vh] flex-col divide-y divide-edge/70 overflow-y-auto">
          {withNotes.map((m) => {
            const b = BOOK_BY_ID[m.book];
            return (
              <li key={m.id}>
                <button onClick={() => onOpen(b, m.chapter)} className="w-full py-2.5 text-left hover:bg-sage/5">
                  <span className="block text-[13px] font-medium text-sage">
                    {formatReference({ book: b, chapter: m.chapter, verse: m.verse, toVerse: null })}
                  </span>
                  <span className="block text-[14px] text-muted-strong">{m.note}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Reading from a plan: mark the day read, or go back to the plan. */
function PlanBar({ day, back, onDone }: { day: number; back: string; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-card px-4 py-2 text-[13px] text-muted-strong">
      <span className="flex-1">Day {day} of your reading plan</span>
      <Link to={back} className="text-sage underline decoration-sage/30 underline-offset-2 hover:decoration-sage">
        Back to the plan
      </Link>
      <Button
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onDone().catch(() => setBusy(false));
        }}
      >
        Mark day {day} read
      </Button>
    </div>
  );
}
