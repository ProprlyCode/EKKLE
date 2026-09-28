import { supabase } from '@/lib/supabase';

/**
 * Outcomes (0042): counts only, never message contents. A range is the last
 * 30 or 90 days, or null for all time.
 */
export type Range = 30 | 90 | null;

export interface Outcomes {
  opened: number;
  finished: number;
  reached_out: number;
  replied: number;
  met: number;
  studies_started: number;
  studies_completed: number;
}

export interface MinistryOutcomes {
  ministry: Outcomes;
  members: Array<{ id: string; name: string; photo: string | null; outcomes: Outcomes }>;
}

export async function ministryOutcomes(days: Range): Promise<MinistryOutcomes> {
  const { data, error } = await supabase.rpc('ministry_outcomes', { p_days: days });
  if (error) throw error;
  return data as unknown as MinistryOutcomes;
}

export async function myOutcomes(days: Range): Promise<Outcomes> {
  const { data, error } = await supabase.rpc('my_outcomes', { p_days: days });
  if (error) throw error;
  return data as unknown as Outcomes;
}

export async function platformOutcomes(
  days: Range,
): Promise<Array<{ id: string; name: string; outcomes: Outcomes }>> {
  const { data, error } = await supabase.rpc('platform_outcomes', { p_days: days });
  if (error) throw error;
  return (data as unknown as Array<{ id: string; name: string; outcomes: Outcomes }>) ?? [];
}
