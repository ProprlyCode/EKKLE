import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

/**
 * Data-access layer.
 *
 * All Supabase reads/writes live in src/data/* — UI components call these
 * functions, never `supabase` directly. This keeps queries in one place,
 * makes RLS assumptions explicit, and means swapping the backend (or moving to
 * multi-tenant) touches this layer, not every screen.
 *
 * Each module returns plain typed rows and throws on error, so callers can rely
 * on a resolved value being valid.
 */

export type Organization = Tables<'organizations'>;

/** A ministry the signed-in person belongs to (RLS: their own only). */
export async function getOrganization(id: string): Promise<Organization> {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
