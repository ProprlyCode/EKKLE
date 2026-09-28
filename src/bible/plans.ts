import { supabase } from '@/lib/supabase';

export { dayLabel, parseDayLine, parseReadingId, readingLabel, type Reading } from './readings';

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
