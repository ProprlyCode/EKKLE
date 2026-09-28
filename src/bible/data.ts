import { supabase } from '@/lib/supabase';
import { BOOKS, BOOK_BY_ID, findBook, type Book } from './books';

/**
 * The built-in Bible's data. BSB and KJV (public domain) are static files, one
 * per book (public/bible/<translation>/<BOOK>.json, built by
 * scripts/bible/build.mjs). The ESV comes live from Crossway's ESV API through
 * our bible-esv function (never stored, per the ESV terms). A person's
 * highlights, notes and place are theirs (bible_marks, bible_state).
 */

export type Translation = 'bsb' | 'kjv' | 'esv';

export const TRANSLATIONS: Record<Translation, { short: string; name: string }> = {
  bsb: { short: 'BSB', name: 'Berean Standard Bible' },
  kjv: { short: 'KJV', name: 'King James Version' },
  esv: { short: 'ESV', name: 'English Standard Version' },
};

export const ESV_COPYRIGHT =
  'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.';

// ---------------------------------------------------------------- text

const books = new Map<string, Promise<string[][]>>();

function loadBook(t: 'bsb' | 'kjv', bookId: string): Promise<string[][]> {
  const key = `${t}/${bookId}`;
  if (!books.has(key)) {
    const p = fetch(`/bible/${t}/${bookId}.json`).then((r) => {
      if (!r.ok) throw new Error(`bible ${key} ${r.status}`);
      return r.json() as Promise<string[][]>;
    });
    p.catch(() => books.delete(key));
    books.set(key, p);
  }
  return books.get(key)!;
}

/** One chapter's verses (verse n is at index n-1). */
export async function getChapter(t: Translation, book: Book, chapter: number): Promise<string[]> {
  if (t === 'esv') {
    const { data, error } = await supabase.functions.invoke('bible-esv', {
      body: { action: 'chapter', book: book.name, chapter },
    });
    if (error) throw error;
    return (data as { verses: string[] }).verses;
  }
  return (await loadBook(t, book.id))[chapter - 1] ?? [];
}

let esvAvailable: Promise<boolean> | null = null;
/** Whether the ESV is switched on (its key is set up). */
export function isEsvAvailable(): Promise<boolean> {
  if (!esvAvailable) {
    esvAvailable = supabase.functions
      .invoke('bible-esv', { body: { action: 'check' } })
      .then(({ data, error }) => !error && Boolean((data as { available?: boolean } | null)?.available))
      .catch(() => false);
  }
  return esvAvailable;
}

// ---------------------------------------------------------------- search

export interface SearchHit {
  book: Book;
  chapter: number;
  verse: number;
  text: string;
}

/**
 * Words or a phrase across the whole Bible. BSB/KJV search every book here
 * (all words must appear, in any order); the ESV asks the ESV API.
 */
export async function searchBible(t: Translation, query: string, limit = 60): Promise<{ hits: SearchHit[]; more: boolean }> {
  const q = query.trim();
  if (!q) return { hits: [], more: false };
  if (t === 'esv') {
    const { data, error } = await supabase.functions.invoke('bible-esv', { body: { action: 'search', q } });
    if (error) throw error;
    const d = data as { results: Array<{ reference: string; text: string }>; total: number };
    const hits = d.results.flatMap((r) => {
      const m = r.reference.match(/^(.+?)\s+(\d+):(\d+)/);
      const book = m ? findBook(m[1]) : null;
      return book && m ? [{ book, chapter: Number(m[2]), verse: Number(m[3]), text: r.text }] : [];
    });
    return { hits, more: d.total > hits.length };
  }
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const all = await Promise.all(BOOKS.map((b) => loadBook(t, b.id).then((chs) => [b, chs] as const)));
  const hits: SearchHit[] = [];
  for (const [book, chs] of all) {
    for (let c = 0; c < chs.length; c++) {
      for (let v = 0; v < chs[c].length; v++) {
        const text = chs[c][v];
        const lower = text.toLowerCase();
        if (words.every((w) => lower.includes(w))) {
          if (hits.length >= limit) return { hits, more: true };
          hits.push({ book, chapter: c + 1, verse: v + 1, text });
        }
      }
    }
  }
  return { hits, more: false };
}

// ---------------------------------------------------------------- marks

export type MarkColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface Mark {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  color: MarkColor | null;
  note: string | null;
}

export async function getMarks(bookId: string, chapter: number): Promise<Mark[]> {
  const { data, error } = await supabase
    .from('bible_marks')
    .select('id, book, chapter, verse, color, note')
    .eq('book', bookId)
    .eq('chapter', chapter);
  if (error) throw error;
  return (data ?? []) as Mark[];
}

/** Set a verse's highlight and/or note; clearing both removes the mark. */
export async function saveMark(
  bookId: string,
  chapter: number,
  verse: number,
  mark: { color: MarkColor | null; note: string | null },
): Promise<void> {
  const note = mark.note?.trim() || null;
  if (!mark.color && !note) {
    const { error } = await supabase
      .from('bible_marks')
      .delete()
      .eq('book', bookId)
      .eq('chapter', chapter)
      .eq('verse', verse);
    if (error) throw error;
    return;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');
  const { error } = await supabase
    .from('bible_marks')
    .upsert(
      { auth_uid: user.id, book: bookId, chapter, verse, color: mark.color, note },
      { onConflict: 'auth_uid,book,chapter,verse' },
    );
  if (error) throw error;
}

/** Every note (and highlight) a person has made, newest first. */
export async function listMyMarks(): Promise<Mark[]> {
  const { data, error } = await supabase
    .from('bible_marks')
    .select('id, book, chapter, verse, color, note')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Mark[];
}

// ---------------------------------------------------------------- place

export interface BiblePlace {
  translation: Translation;
  book: Book;
  chapter: number;
}

export async function getPlace(): Promise<BiblePlace | null> {
  const { data } = await supabase.from('bible_state').select('translation, book, chapter').maybeSingle();
  if (!data || !BOOK_BY_ID[data.book]) return null;
  return { translation: data.translation as Translation, book: BOOK_BY_ID[data.book], chapter: data.chapter };
}

export async function savePlace(p: BiblePlace): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('bible_state')
    .upsert({ auth_uid: user.id, translation: p.translation, book: p.book.id, chapter: p.chapter, updated_at: new Date().toISOString() });
}
