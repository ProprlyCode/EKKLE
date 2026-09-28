import { supabase } from '@/lib/supabase';
import type { PlatformRole } from '@/lib/database.types';

/**
 * The Ekklē team (platform_team) — separate from every ministry
 * (docs/accounts-and-roles.md). Metadata only: never message contents, never
 * seekers' names or emails.
 */

export interface PlatformSeat {
  role: PlatformRole;
  /** Set once they've chosen a password (first sign-in is by emailed code). */
  password_set: boolean;
  email: string;
  name: string | null;
}

/** Signing in on ekkle.org: link an invitation to this login; my seat or null. */
export async function claimPlatformSeat(): Promise<PlatformSeat | null> {
  const { data, error } = await supabase.rpc('claim_platform_seat');
  if (error) throw error;
  return (data as unknown as PlatformSeat | null) ?? null;
}

/** Record that this team member has set a password on their login. */
export async function markPlatformPasswordSet(): Promise<void> {
  const { error } = await supabase.rpc('platform_password_saved');
  if (error) throw error;
}

export interface PlatformAccount {
  id: string;
  status: 'active' | 'suspended';
  /** First-admin invitations not yet accepted. */
  invited_admins: string[];
  name: string;
  subdomain: string;
  custom_domain: string | null;
  kind: 'church' | 'personal_ministry';
  created_at: string;
  team: number;
  admins: number;
  seekers: number;
  studies_started: number;
  conversations: number;
  connections: number;
}

export async function listPlatformAccounts(): Promise<PlatformAccount[]> {
  const { data, error } = await supabase.rpc('platform_accounts');
  if (error) throw error;
  return (data as unknown as PlatformAccount[]) ?? [];
}

export async function setMyPlatformName(name: string): Promise<void> {
  const { error } = await supabase.rpc('set_my_platform_name', { p_name: name });
  if (error) throw error;
}

// ---------------------------------------------------------------- accounts

export interface NewAccount {
  name: string;
  kind: 'church' | 'personal_ministry';
  subdomain: string;
  adminName: string;
  adminEmail: string;
}

export async function isSubdomainAvailable(subdomain: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('platform_subdomain_available', { p_subdomain: subdomain });
  if (error) throw error;
  return data === true;
}

/** Creates the account (with a starter welcome flow and its first Admin invited). */
export async function createAccount(input: NewAccount): Promise<{ id: string; subdomain: string; custom_domain: string | null }> {
  const { data, error } = await supabase.rpc('platform_create_account', {
    p_name: input.name,
    p_kind: input.kind,
    p_subdomain: input.subdomain,
    p_admin_name: input.adminName,
    p_admin_email: input.adminEmail,
  });
  if (error) throw error;
  return data as unknown as { id: string; subdomain: string; custom_domain: string | null };
}

export async function setAccountStatus(orgId: string, status: 'active' | 'suspended'): Promise<void> {
  const { error } = await supabase.rpc('platform_set_account_status', { p_org_id: orgId, p_status: status });
  if (error) throw error;
}

export { sendInvitation } from './auth';

// ---------------------------------------------------------------- the team

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: PlatformRole;
  joined: boolean;
  me: boolean;
  created_at: string;
}

export async function listTeam(): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('platform_team_list');
  if (error) throw error;
  return (data as unknown as TeamMember[]) ?? [];
}

export async function inviteTeamMember(email: string, name: string, role: PlatformRole): Promise<void> {
  const { error } = await supabase.rpc('platform_invite_member', { p_email: email, p_name: name, p_role: role });
  if (error) throw error;
}

export async function setTeamRole(id: string, role: PlatformRole): Promise<void> {
  const { error } = await supabase.rpc('platform_set_member_role', { p_id: id, p_role: role });
  if (error) throw error;
}

export async function removeTeamMember(id: string): Promise<void> {
  const { error } = await supabase.rpc('platform_remove_member', { p_id: id });
  if (error) throw error;
}

// ---------------------------------------------------------------- waitlist

export interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  ministry_name: string;
  created_at: string;
}

export async function listWaitlist(): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase.rpc('platform_waitlist');
  if (error) throw error;
  return (data as unknown as WaitlistEntry[]) ?? [];
}

/** The Postgres error name a platform function raised ('address_taken', …). */
export function reason(err: unknown): string {
  return (err as { message?: string } | null)?.message ?? '';
}
