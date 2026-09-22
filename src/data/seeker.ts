import { supabase } from '@/lib/supabase';
import { savedSeekerIntake } from '@/data/auth';

/** Seeker account: linking, and the connection (1:1 thread) with their member. */

/**
 * Ensure the signed-in user has a seeker account (recipient row), applying the
 * first name + ?ref captured before they verified. Idempotent.
 */
export async function linkSeekerAccount(): Promise<void> {
  const intake = savedSeekerIntake();
  const { error } = await supabase.rpc('link_seeker_account', {
    p_first_name: intake.firstName || '',
    p_ref: intake.ref || null,
  });
  if (error) throw error;
}

export interface SeekerConnection {
  member: { name: string; short_message: string } | null;
  status: 'active' | 'blocked';
  messages: Array<{
    sender_type: 'member' | 'recipient';
    body: string;
    created_at: string;
  }>;
}

export async function getSeekerConnection(): Promise<SeekerConnection | null> {
  const { data, error } = await supabase.rpc('seeker_connection');
  if (error) throw error;
  return (data as SeekerConnection | null) ?? null;
}

export async function sendSeekerMessage(body: string): Promise<void> {
  const { error } = await supabase.rpc('seeker_send_message', { p_body: body });
  if (error) throw error;
}
