import { supabase } from '@/lib/supabase';
import { appConfig } from '@/config/app';
import type { Role, Tables } from '@/lib/database.types';

/**
 * Member/leadership data access. All church-side reads/writes for the `users`
 * table and its RPCs live here.
 */

export type Member = Tables<'users'>;

/**
 * The signed-in person's membership in the ministry of this address (a person
 * can belong to several), or null — always null on ekkle.org itself.
 */
export async function getMyMembership(): Promise<Member | null> {
  const { data, error } = await supabase.rpc('my_membership');
  if (error) throw error;
  // A SQL function returning "no row" comes back as a row of nulls.
  return data && (data as Member).id ? (data as Member) : null;
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

/**
 * Admins and Leaders: this ministry's team (for People). Filtered by ministry —
 * RLS also shows a person their own memberships elsewhere.
 */
export async function listMembers(orgId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('org_id', orgId)
    .is('removed_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Invite someone by email with a role (Leaders: Members; Admins: anyone). They
 * are linked when they first sign in with that email on this address.
 */
export async function inviteMember(name: string, email: string, role: Role = 'member'): Promise<Member> {
  const { data, error } = await supabase.rpc('invite_member', {
    p_name: name.trim(),
    p_email: email.trim(),
    p_role: role,
  });
  if (error) throw error;
  return data;
}

/** Admins: change someone's role (the ministry always keeps an Admin). */
export async function setMemberRole(userId: string, role: Role): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
}

/** Cancel an invitation that hasn't been accepted. */
export async function cancelInvitation(userId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_invitation', { p_user_id: userId });
  if (error) throw error;
}

/** Admins: turn the join code on or off. */
export async function setJoinEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_join_enabled', { p_enabled: enabled });
  if (error) throw error;
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

/** How many conversations someone has (to hand them on when removing them). */
export async function memberConversationCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('member_conversation_count', { p_user_id: userId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/**
 * Remove someone from the team: access and their link end; their
 * conversations go to `handTo` (required when they have any). An invitation
 * nobody accepted is simply deleted.
 */
export async function removeMember(userId: string, handTo: string | null): Promise<void> {
  const { error } = await supabase.rpc('remove_member', { p_user_id: userId, p_hand_to: handTo });
  if (error) throw error;
}

// ---------------------------------------------------------------- photos (0041)

const PHOTOS = 'photos';

export function photoUrl(path: string): string {
  return supabase.storage.from(PHOTOS).getPublicUrl(path).data.publicUrl;
}

/**
 * Upload the member's (already square, resized) photo into their own folder,
 * point their profile at it, and tidy away the old one.
 */
export async function setMyPhoto(member: Member, photo: Blob | null): Promise<string | null> {
  let path: string | null = null;
  if (photo) {
    path = `${member.id}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(PHOTOS).upload(path, photo, { contentType: 'image/jpeg' });
    if (error) throw error;
  }
  const { error } = await supabase.rpc('set_my_photo', { p_path: path });
  if (error) throw error;
  if (member.photo) await supabase.storage.from(PHOTOS).remove([member.photo]);
  return path;
}

/** Admins and Leaders: take a member's photo down. */
export async function removeMemberPhoto(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member_photo', { p_member: memberId });
  if (error) throw error;
}
