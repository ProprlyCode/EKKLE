import { supabase } from '@/lib/supabase';
import { appConfig } from '@/config/app';
import type { Tables } from '@/lib/database.types';

/**
 * Member/leadership data access. All church-side reads/writes for the `users`
 * table and its RPCs live here.
 */

export type Member = Tables<'users'>;

/** The current signed-in user's membership row, or null if not yet a member. */
export async function getMyMembership(): Promise<Member | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Must filter by auth_uid: RLS lets a member see every user in their org, so
  // an unfiltered query would return an arbitrary row, not the signed-in one.
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_uid', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Claim membership at first sign-in: links an invite by email, else creates a
 * member via the org join code. Idempotent (returns existing row if any).
 */
export async function claimMembership(
  joinCode: string,
  name: string,
): Promise<Member> {
  const { data, error } = await supabase.rpc('claim_membership', {
    p_join_code: joinCode.trim(),
    p_name: name.trim(),
  });
  if (error) throw error;
  return data;
}

/** Update the signed-in member's own display name + short message (60-char cap). */
export async function updateMyProfile(
  memberId: string,
  fields: { name?: string; short_message?: string },
): Promise<Member> {
  const patch: Partial<Member> = {};
  if (fields.name !== undefined) patch.name = fields.name.trim();
  if (fields.short_message !== undefined) {
    patch.short_message = fields.short_message.slice(
      0,
      appConfig.limits.shortMessageMaxLength,
    );
  }
  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', memberId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Leadership: everyone in the org (for the People view). */
export async function listMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Leadership: pre-create an invited member. */
export async function inviteMember(name: string, email: string): Promise<Member> {
  const { data, error } = await supabase.rpc('invite_member', {
    p_name: name.trim(),
    p_email: email.trim(),
  });
  if (error) throw error;
  return data;
}

/** Set (or clear, with null) the member's active flow. Must be an approved flow. */
export async function setActiveSequence(
  sequenceId: string | null,
): Promise<Member> {
  const { data, error } = await supabase.rpc('set_my_active_sequence', {
    p_sequence_id: sequenceId,
  });
  if (error) throw error;
  return data;
}

/** Leadership: activate/deactivate a member. */
export async function setMemberActive(
  userId: string,
  active: boolean,
): Promise<Member> {
  const { data, error } = await supabase.rpc('set_member_active', {
    p_user_id: userId,
    p_active: active,
  });
  if (error) throw error;
  return data;
}
