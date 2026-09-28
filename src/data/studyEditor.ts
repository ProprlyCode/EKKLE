import { supabase } from '@/lib/supabase';
import type { Json } from '@/lib/database.types';
import type { StudyBlock, StudySong } from './studies';

/**
 * The study editor. On ekkle.org the Ekklē team's Owners and Admins keep
 * Ekklē's series (the shared bank); on a ministry's address its Admins and
 * Leaders keep their own. Everything goes through the 0034 functions.
 */

export interface StudyContent {
  title: string;
  tagline: string | null;
  pages: Array<{ blocks: StudyBlock[] }>;
  /** One per blank, in order ('' for a blank answered in their own words). */
  answers: string[];
  /** Blanks with no set answer — people write their own (one per blank). */
  open?: boolean[];
}

export interface LibraryStudy {
  id: string;
  title: string;
  status: 'draft' | 'approved';
  has_draft: boolean;
  pages: number;
  people_started: number;
}

export interface LibrarySeries {
  id: string;
  title: string;
  locked: boolean;
  /** Where its studies come from, e.g. "[truth]Link" (0037). */
  credit: string | null;
  credit_url: string | null;
  studies: LibraryStudy[];
}

export interface EditorStudy {
  id: string;
  status: 'draft' | 'approved';
  series: { id: string; title: string; locked: boolean; credit: string | null; credit_url: string | null };
  has_draft: boolean;
  /** The song offered at the Experience section (0040). */
  song: StudySong | null;
  content: StudyContent;
  people_started: number;
}

/** The database error's message (our functions raise short codes). */
export function reason(err: unknown): string {
  return err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
}

export async function studyLibrary(): Promise<LibrarySeries[]> {
  const { data, error } = await supabase.rpc('study_library');
  if (error) throw error;
  return (data as unknown as LibrarySeries[]) ?? [];
}

export async function saveSeries(id: string | null, title: string): Promise<string> {
  const { data, error } = await supabase.rpc('save_study_series', { p_id: id, p_title: title });
  if (error) throw error;
  return data as string;
}

/** Set (or clear) where a series' studies come from. Allowed after locking. */
export async function setSeriesCredit(id: string, credit: string, url: string): Promise<void> {
  const { error } = await supabase.rpc('set_study_series_credit', { p_id: id, p_credit: credit, p_url: url });
  if (error) throw error;
}

/** Set (or remove, with null) a study's song. Allowed after locking. */
export async function setStudySong(id: string, song: StudySong | null): Promise<void> {
  const { error } = await supabase.rpc('set_study_song', { p_study: id, p_song: song as unknown as Json });
  if (error) throw error;
}

export async function lockSeries(id: string): Promise<void> {
  const { error } = await supabase.rpc('lock_study_series', { p_id: id });
  if (error) throw error;
}

export async function createStudy(seriesId: string, content: StudyContent): Promise<string> {
  const { data, error } = await supabase.rpc('create_study', { p_series: seriesId, p_draft: content as unknown as Json });
  if (error) throw error;
  return data as string;
}

export async function editorStudy(id: string): Promise<EditorStudy> {
  const { data, error } = await supabase.rpc('editor_study', { p_id: id });
  if (error) throw error;
  const study = data as unknown as EditorStudy;
  const c = study.content;
  study.content = {
    title: c.title ?? '',
    tagline: c.tagline ?? null,
    pages: c.pages ?? [],
    answers: c.answers ?? [],
    // Published studies keep an open blank as an empty answer.
    open: c.open ?? (c.answers ?? []).map((a) => study.status === 'approved' && !a),
  };
  return study;
}

export async function saveDraft(id: string, content: StudyContent): Promise<void> {
  const { error } = await supabase.rpc('save_study_draft', { p_id: id, p_draft: content as unknown as Json });
  if (error) throw error;
}

export async function publishStudy(id: string): Promise<void> {
  const { error } = await supabase.rpc('publish_study', { p_id: id });
  if (error) throw error;
}

export async function discardDraft(id: string): Promise<void> {
  const { error } = await supabase.rpc('discard_study_draft', { p_id: id });
  if (error) throw error;
}

export async function moveStudy(id: string, by: -1 | 1): Promise<void> {
  const { error } = await supabase.rpc('move_study', { p_id: id, p_by: by });
  if (error) throw error;
}
