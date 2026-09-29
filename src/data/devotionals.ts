import { supabase } from '@/lib/supabase';

/**
 * Daily devotionals (0046): a ministry's Admins and Leaders write one per
 * date; everyone on the address reads today's, and past ones.
 */
export interface Devotional {
  id: string;
  day: string; // YYYY-MM-DD
  title: string;
  /** A reading id ("JHN.15:1-11"), or null. */
  passage: string | null;
  body: string;
  question: string | null;
  prayer: string | null;
  status: 'draft' | 'published';
  author?: string | null;
}

/** "Friday, October 3". */
export function dayName(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Today on this device, as YYYY-MM-DD. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function todaysDevotional(): Promise<Devotional | null> {
  const { data, error } = await supabase.rpc('todays_devotional', { p_today: localToday() });
  if (error) throw error;
  return (data as unknown as Devotional | null) ?? null;
}

export async function pastDevotionals(before: string | null = null): Promise<Devotional[]> {
  const { data, error } = await supabase.rpc('past_devotionals', { p_today: localToday(), p_before: before });
  if (error) throw error;
  return (data as unknown as Devotional[]) ?? [];
}

export async function devotionalLibrary(): Promise<Devotional[]> {
  const { data, error } = await supabase.rpc('devotional_library');
  if (error) throw error;
  return (data as unknown as Devotional[]) ?? [];
}

export async function saveDevotional(
  id: string | null,
  d: Pick<Devotional, 'day' | 'title' | 'passage' | 'body' | 'question' | 'prayer' | 'status'>,
): Promise<string> {
  const { data, error } = await supabase.rpc('save_devotional', {
    p_id: id,
    p_day: d.day,
    p_title: d.title,
    p_passage: d.passage ?? '',
    p_body: d.body,
    p_question: d.question ?? '',
    p_prayer: d.prayer ?? '',
    p_status: d.status,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteDevotional(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_devotional', { p_id: id });
  if (error) throw error;
}

export async function devotionalReminder(): Promise<{ at: string } | null> {
  const { data, error } = await supabase.rpc('my_devotional_reminder');
  if (error) throw error;
  return (data as unknown as { at: string } | null) ?? null;
}

/** The daily email at a time ("07:00") in their time zone, or null to stop. */
export async function setDevotionalReminder(at: string | null, area: 'app' | 'space'): Promise<void> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { error } = await supabase.rpc('set_devotional_reminder', { p_at: at, p_tz: tz, p_area: area });
  if (error) throw error;
}
