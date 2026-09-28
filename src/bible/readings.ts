import { BOOK_BY_ID, findBook, type Book } from './books';

/**
 * Readings in a plan (0038), with no database access (unit-tested): a reading
 * is "BOOK.CHAPTER" or "BOOK.CHAPTER:FROM-TO" (verses), e.g. "JHN.3".
 */

export interface Reading {
  book: Book;
  chapter: number;
  from: number | null;
  to: number | null;
}

export function parseReadingId(id: string): Reading | null {
  const m = /^([1-3A-Z]{3})\.(\d{1,3})(?::(\d{1,3})-(\d{1,3}))?$/.exec(id);
  const book = m && BOOK_BY_ID[m[1]];
  if (!m || !book) return null;
  return { book, chapter: +m[2], from: m[3] ? +m[3] : null, to: m[4] ? +m[4] : null };
}

/** "Luke 1:1–38", "John 3". */
export function readingLabel(id: string): string {
  const r = parseReadingId(id);
  if (!r) return id;
  return `${r.book.name} ${r.chapter}${r.from ? `:${r.from}–${r.to}` : ''}`;
}

/** A day's readings as one line: "Genesis 1–3", "Psalms 1–5; Proverbs 1". */
export function dayLabel(readings: string[]): string {
  const parts: string[] = [];
  let run: { book: Book; start: number; end: number } | null = null;
  const flush = () => {
    if (run) parts.push(`${run.book.name} ${run.start}${run.end > run.start ? `–${run.end}` : ''}`);
    run = null;
  };
  for (const id of readings) {
    const r = parseReadingId(id);
    if (!r) continue;
    if (!r.from && run && run.book.id === r.book.id && run.end + 1 === r.chapter) {
      run.end = r.chapter;
      continue;
    }
    flush();
    if (r.from) parts.push(readingLabel(id));
    else run = { book: r.book, start: r.chapter, end: r.chapter };
  }
  flush();
  return parts.join('; ');
}

/**
 * A day as people write it — "John 1; Luke 1:1-38; Genesis 1-3" — into
 * readings. Returns an error message instead when something isn't a passage.
 */
export function parseDayLine(line: string): string[] | string {
  const out: string[] = [];
  for (const raw of line.split(/[;,]/)) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(.+?)\s+(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?(?::(\d{1,3})\s*[-–]\s*(\d{1,3}))?$/.exec(part);
    const book = m && findBook(m[1]);
    if (!m || !book) return `“${part}” isn’t a passage (try “John 3” or “Luke 1:1-38”).`;
    const from = +m[2];
    if (m[4] && m[5]) {
      if (m[3] || from > book.chapters) return `“${part}” isn’t in ${book.name}.`;
      out.push(`${book.id}.${from}:${m[4]}-${m[5]}`);
      continue;
    }
    const to = m[3] ? +m[3] : from;
    if (from < 1 || to < from || to > book.chapters) return `${book.name} has ${book.chapters} ${book.chapters === 1 ? 'chapter' : 'chapters'}.`;
    for (let c = from; c <= to; c++) out.push(`${book.id}.${c}`);
  }
  return out.length ? out : 'Add at least one passage.';
}

