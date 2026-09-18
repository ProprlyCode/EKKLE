import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

/** Platform-owner (platform_admin) data access: overview + org settings. */

export interface PlatformOverview {
  started: number;
  completed: number;
  messaged: number;
  conversations: number;
  active_conversations: number;
  recipients: number;
  checkins: { yes: number; not_yet: number; no: number };
  members: Array<{
    name: string;
    code_slug: string;
    started: number;
    messaged: number;
    conversations: number;
  }>;
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const { data, error } = await supabase.rpc('platform_overview');
  if (error) throw error;
  return data as unknown as PlatformOverview;
}

export type Organization = Tables<'organizations'>;

export async function setOrgSettings(input: {
  name: string;
  defaultMemberId: string | null;
  offerEnabled: boolean;
}): Promise<Organization> {
  const { data, error } = await supabase.rpc('set_org_settings', {
    p_name: input.name,
    p_default_member_id: input.defaultMemberId,
    p_offer_enabled: input.offerEnabled,
  });
  if (error) throw error;
  return data;
}

export async function regenerateJoinCode(): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_join_code');
  if (error) throw error;
  return data as string;
}
