import { supabase } from '@/lib/supabase';
import { localToday } from './devotionals';

/** Prayer (0052): their times, their private list, and a quiet moment. */

export interface PrayerTime {
  id: string;
  label: string;
  /** "HH:MM", in `tz`. */
  at: string;
  tz: string;
  email: boolean;
}

export interface PrayerPerson {
  id: string;
  name: string;
  request: string;
  answered_at: string | null;
  answered_note: string;
}

export interface MyPrayer {
  times: PrayerTime[];
  people: PrayerPerson[];
  answered: PrayerPerson[];
}

export interface PrayerMoment {
  /** A reading id for the day's verse, e.g. "PSA.5:3-3". */
  verse: string;
  people: Array<Pick<PrayerPerson, 'id' | 'name' | 'request'>>;
}

const myTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export async function myPrayer(): Promise<MyPrayer> {
  const { data, error } = await supabase.rpc('my_prayer');
  if (error) throw error;
  return data as unknown as MyPrayer;
}

export async function prayerMoment(exclude: string[] = []): Promise<PrayerMoment> {
  const { data, error } = await supabase.rpc('prayer_moment', { p_today: localToday(), p_exclude: exclude });
  if (error) throw error;
  return data as unknown as PrayerMoment;
}

export async function prayerAmen(ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('prayer_amen', { p_ids: ids });
  if (error) throw error;
}

export async function savePrayerPerson(id: string | null, name: string, request: string): Promise<string> {
  const { data, error } = await supabase.rpc('save_prayer_person', { p_id: id, p_name: name, p_request: request });
  if (error) throw error;
  return data as string;
}

export async function answerPrayer(id: string, answered: boolean, note = ''): Promise<void> {
  const { error } = await supabase.rpc('answer_prayer', { p_id: id, p_answered: answered, p_note: note });
  if (error) throw error;
}

export async function deletePrayerPerson(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_prayer_person', { p_id: id });
  if (error) throw error;
}

export async function savePrayerTime(t: { id: string | null; label: string; at: string; email: boolean }): Promise<string> {
  const { data, error } = await supabase.rpc('save_prayer_time', {
    p_id: t.id,
    p_label: t.label,
    p_at: t.at,
    p_tz: myTz(),
    p_email: t.email,
  });
  if (error) throw error;
  return data as string;
}

export async function deletePrayerTime(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_prayer_time', { p_id: id });
  if (error) throw error;
}
