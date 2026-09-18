import { supabase } from '@/lib/supabase';
import type { Tables, SequenceStatus, Json } from '@/lib/database.types';

/** Leadership-side data access for sequences + their screens. */

export type Sequence = Tables<'sequences'>;
export type SequenceScreen = Tables<'sequence_screens'>;

export interface ScreenDraft {
  headline: string;
  body: string;
  icon: string | null;
}

export interface SequenceWithScreens {
  sequence: Sequence;
  screens: SequenceScreen[];
}

/** The org's primary sequence + ordered screens (leadership sees drafts too). */
export async function getOrgSequence(): Promise<SequenceWithScreens | null> {
  const { data: sequence, error: seqErr } = await supabase
    .from('sequences')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (seqErr) throw seqErr;
  if (!sequence) return null;

  const { data: screens, error: scrErr } = await supabase
    .from('sequence_screens')
    .select('*')
    .eq('sequence_id', sequence.id)
    .order('sort_order', { ascending: true });
  if (scrErr) throw scrErr;

  return { sequence, screens: screens ?? [] };
}

export async function setSequenceStatus(
  id: string,
  status: SequenceStatus,
): Promise<void> {
  const { error } = await supabase
    .from('sequences')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

/** Replace the sequence's screens atomically (leadership only). */
export async function replaceScreens(
  sequenceId: string,
  screens: ScreenDraft[],
): Promise<void> {
  const { error } = await supabase.rpc('replace_sequence_screens', {
    p_sequence_id: sequenceId,
    p_screens: screens as unknown as Json,
  });
  if (error) throw error;
}
