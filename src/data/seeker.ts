import { supabase } from '@/lib/supabase';
import { savedSeekerIntake } from '@/data/auth';
import type { MemberCard } from '@/data/recipient';

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
  member: MemberCard | null;
  status: 'active' | 'blocked';
  messages: Array<{
    /** 'note': the conversation moved to someone else (0035). */
    sender_type: 'member' | 'recipient' | 'note';
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

/** Block the conversation with their member (writes a report, closes it). */
export async function blockSeekerConnection(reason: string): Promise<void> {
  const { error } = await supabase.rpc('seeker_block_conversation', { p_reason: reason });
  if (error) throw error;
}

/**
 * Delete my details (0041): messages, conversation, name and email, study
 * progress and reminders — and the sign-in itself unless they're also on a
 * ministry's team. Sign out afterwards.
 */
export async function deleteMyDetails(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_details');
  if (error) throw error;
}

/** The weekly study reminder: a day (0 = Sunday) and a time ("19:00"). */
export interface StudyReminder {
  weekday: number;
  at: string;
  tz: string;
}

export async function getStudyReminder(): Promise<StudyReminder | null> {
  const { data, error } = await supabase.rpc('my_study_reminder');
  if (error) throw error;
  return (data as unknown as StudyReminder | null) ?? null;
}

/** Turn it on in their own time zone, or off with null. */
export async function setStudyReminder(r: { weekday: number; at: string } | null): Promise<void> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const { error } = await supabase.rpc('set_study_reminder', {
    p_weekday: r ? r.weekday : null,
    p_at: r ? r.at : null,
    p_tz: r ? tz : null,
  });
  if (error) throw error;
}
