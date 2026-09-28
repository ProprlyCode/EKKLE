import { supabase } from '@/lib/supabase';

/**
 * Address change requests (0043). A ministry's Admin asks; the Ekklē team's
 * Owners and Admins decide. Old addresses keep leading to the ministry.
 */
export interface AddressRequest {
  id: string;
  subdomain: string;
  from_subdomain: string;
  note: string | null;
  status: 'pending' | 'approved' | 'declined';
  reason: string | null;
  created_at: string;
  decided_at: string | null;
}

export async function addressAvailable(subdomain: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('address_available', { p_subdomain: subdomain });
  if (error) throw error;
  return !!data;
}

export async function myAddressRequest(): Promise<{ request: AddressRequest | null; previous: string[] }> {
  const { data, error } = await supabase.rpc('my_address_request');
  if (error) throw error;
  return data as unknown as { request: AddressRequest | null; previous: string[] };
}

export async function requestAddressChange(subdomain: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('request_address_change', { p_subdomain: subdomain, p_note: note });
  if (error) throw error;
}

export async function cancelAddressRequest(): Promise<void> {
  const { error } = await supabase.rpc('cancel_address_request');
  if (error) throw error;
}

export type PlatformAddressRequest = AddressRequest & { ministry: string; requested_by: string | null };

export async function platformAddressRequests(): Promise<PlatformAddressRequest[]> {
  const { data, error } = await supabase.rpc('platform_address_requests');
  if (error) throw error;
  return (data as unknown as PlatformAddressRequest[]) ?? [];
}

export async function decideAddressRequest(id: string, approve: boolean, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('decide_address_request', { p_id: id, p_approve: approve, p_reason: reason });
  if (error) throw error;
}
