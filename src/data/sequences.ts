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

export type CtaKind = 'message' | 'link';
export interface Cta {
  label: string;
  kind: CtaKind;
  url: string | null;
}
export interface ConnectConfig {
  headline: string;
  body: string;
  ctas: Cta[];
}

/** Parse a sequence row's stored ending config into a typed ConnectConfig. */
export function readConnect(sequence: Sequence): ConnectConfig {
  const ctas = Array.isArray(sequence.ctas)
    ? (sequence.ctas as unknown as Cta[])
    : [];
  return {
    headline: sequence.connect_headline ?? '',
    body: sequence.connect_body ?? '',
    ctas,
  };
}

export interface SequenceWithScreens {
  sequence: Sequence;
  screens: SequenceScreen[];
}

/** All of the org's flows (leadership sees drafts too), newest last. */
export async function listSequences(): Promise<Sequence[]> {
  const { data, error } = await supabase
    .from('sequences')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Approved flows a member can choose from (id + title). */
export async function listApprovedSequences(): Promise<
  Pick<Sequence, 'id' | 'title'>[]
> {
  const { data, error } = await supabase
    .from('sequences')
    .select('id, title')
    .eq('status', 'approved')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** One flow + its ordered screens. */
export async function getSequence(id: string): Promise<SequenceWithScreens | null> {
  const { data: sequence, error: seqErr } = await supabase
    .from('sequences')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (seqErr) throw seqErr;
  if (!sequence) return null;

  const { data: screens, error: scrErr } = await supabase
    .from('sequence_screens')
    .select('*')
    .eq('sequence_id', id)
    .order('sort_order', { ascending: true });
  if (scrErr) throw scrErr;

  return { sequence, screens: screens ?? [] };
}

/** Create a new (draft) flow in the org. */
export async function createSequence(
  orgId: string,
  title: string,
): Promise<Sequence> {
  const { data, error } = await supabase
    .from('sequences')
    .insert({ org_id: orgId, title: title.trim() || 'Untitled flow', status: 'draft' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateSequenceTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('sequences')
    .update({ title: title.trim() || 'Untitled flow' })
    .eq('id', id);
  if (error) throw error;
}

/** Save a flow's ending headline/body + CTAs. */
export async function updateSequenceConnect(
  id: string,
  connect: ConnectConfig,
): Promise<void> {
  const { error } = await supabase
    .from('sequences')
    .update({
      connect_headline: connect.headline,
      connect_body: connect.body,
      ctas: connect.ctas as unknown as Json,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSequence(id: string): Promise<void> {
  const { error } = await supabase.from('sequences').delete().eq('id', id);
  if (error) throw error;
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
