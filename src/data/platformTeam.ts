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
