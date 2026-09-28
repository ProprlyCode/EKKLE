import { supabase } from '@/lib/supabase';

/** "Get started" checklists (0044): Admins, team members and seekers. */
export type StartArea = 'admin' | 'member' | 'seeker';

export interface StartState {
  steps: Record<string, boolean>;
  dismissed: boolean;
}

export async function gettingStarted(area: StartArea): Promise<StartState | null> {
  const { data, error } = await supabase.rpc('getting_started', { p_area: area });
  if (error) throw error;
  return (data as unknown as StartState | null) ?? null;
}

/** Tick a step the data can't show (previewed, printed, installed). Quiet on failure. */
export async function markStarted(area: StartArea, step: string): Promise<void> {
  await supabase.rpc('mark_getting_started', { p_area: area, p_step: step });
}

export async function hideStarted(area: StartArea, hide = true): Promise<void> {
  const { error } = await supabase.rpc('dismiss_getting_started', { p_area: area, p_hide: hide });
  if (error) throw error;
}
