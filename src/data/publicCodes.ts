import { supabase } from '@/lib/supabase';

/** Leadership → Public codes (0050): the ministry's own codes. */

export interface PublicCode {
  id: string;
  name: string;
  code: string;
  active: boolean;
  sequence_id: string | null;
  /** The flow it opens (its own, else the ministry's first published one). */
  flow: string | null;
  first_screen: { headline: string; body: string } | null;
  opened: number;
  wrote: number;
}

export interface PublicCodes {
  /** Who replies: the designated responder, else an Admin. */
  responder: string | null;
  codes: PublicCode[];
}

export async function publicCodes(): Promise<PublicCodes> {
  const { data, error } = await supabase.rpc('public_codes_list');
  if (error) throw error;
  return data as unknown as PublicCodes;
}

export async function savePublicCode(input: {
  id: string | null;
  name: string;
  code: string;
  sequenceId: string | null;
  active: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_public_code', {
    p_id: input.id,
    p_name: input.name,
    p_code: input.code,
    p_sequence: input.sequenceId,
    p_active: input.active,
  });
  if (error) throw error;
  return data as string;
}

export async function deletePublicCode(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_public_code', { p_id: id });
  if (error) throw error;
}
