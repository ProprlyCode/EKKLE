import { supabase } from '@/lib/supabase';
import { BOOK_BY_ID, findBook, type Book } from './books';

/**
 * Bible reading plans (0038). A reading is "BOOK.CHAPTER" or
 * "BOOK.CHAPTER:FROM-TO" (verses), e.g. "JHN.3" or "LUK.1:1-38".
 */

export interface PlanSummary {
  id: string;
  title: string;
  description: string | null;
  source: 'ekkle' | 'ministry';
  days: number;
  /** The ministry is reading it together (a count of readers, never names). */
  together: { group_id: string; start_on: string; day: number; readers: number } | null;
  mine: { done: number; next_day: number | null; remind_at: string | null; together: boolean } | null;
}

export interface PlanDetail {
  id: string;
  title: string;
  description: string | null;
  source: 'ekkle' | 'ministry';
  days: Array<{ day: number; readings: string[] }>;
  together: PlanSummary['together'];
  mine: { done_days: number[]; remind_at: string | null; tz: string | null; together: boolean } | null;
}

// ---------------------------------------------------------------- readings

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

// ---------------------------------------------------------------- reading

export async function listPlans(): Promise<PlanSummary[]> {
  const { data, error } = await supabase.rpc('reading_plans');
  if (error) throw error;
  return (data as unknown as PlanSummary[]) ?? [];
}

export async function getPlan(id: string): Promise<PlanDetail | null> {
  const { data, error } = await supabase.rpc('reading_plan', { p_id: id });
  if (error) throw error;
  return (data as unknown as PlanDetail | null) ?? null;
}

export async function startPlan(id: string, together: boolean, area: 'space' | 'app'): Promise<void> {
  const { error } = await supabase.rpc('start_reading_plan', { p_id: id, p_together: together, p_area: area });
  if (error) throw error;
}

export async function markDay(id: string, day: number, done: boolean): Promise<void> {
  const { error } = await supabase.rpc('mark_reading_day', { p_id: id, p_day: day, p_done: done });
  if (error) throw error;
}

export async function stopPlan(id: string): Promise<void> {
  const { error } = await supabase.rpc('stop_reading_plan', { p_id: id });
  if (error) throw error;
}

/** The daily email at a time ("07:00") in their time zone, or null to stop. */
export async function setReminder(id: string, at: string | null): Promise<void> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { error } = await supabase.rpc('set_reading_reminder', { p_id: id, p_at: at, p_tz: tz });
  if (error) throw error;
}

// ---------------------------------------------------------------- writing plans

export interface LibraryPlan {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published';
  source: 'ekkle' | 'ministry';
  editable: boolean;
  days: number;
  together: { group_id: string; start_on: string; readers: number } | null;
}

export async function planLibrary(): Promise<LibraryPlan[]> {
  const { data, error } = await supabase.rpc('plan_library');
  if (error) throw error;
  return (data as unknown as LibraryPlan[]) ?? [];
}

export async function planForEditing(
  id: string,
): Promise<{ id: string; title: string; description: string | null; status: 'draft' | 'published'; days: string[][] }> {
  const { data, error } = await supabase.rpc('plan_for_editing', { p_id: id });
  if (error) throw error;
  return data as never;
}

export async function savePlan(
  id: string | null,
  plan: { title: string; description: string; days: string[][]; status: 'draft' | 'published' },
): Promise<string> {
  const { data, error } = await supabase.rpc('save_reading_plan', {
    p_id: id,
    p_title: plan.title,
    p_description: plan.description,
    p_days: plan.days,
    p_status: plan.status,
  });
  if (error) throw error;
  return data as string;
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_reading_plan', { p_id: id });
  if (error) throw error;
}

export async function startTogether(planId: string, startOn: string): Promise<void> {
  const { error } = await supabase.rpc('start_reading_together', { p_plan: planId, p_start: startOn });
  if (error) throw error;
}

export async function endTogether(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('end_reading_together', { p_group: groupId });
  if (error) throw error;
}
