import { supabase } from '@/lib/supabase';
import type { Json } from '@/lib/database.types';
import type { StudyBlock } from './studies';

/**
 * The study editor. On ekkle.org the Ekklē team's Owners and Admins keep
 * Ekklē's series (the shared bank); on a ministry's address its Admins and
 * Leaders keep their own. Everything goes through the 0034 functions.
 */

export interface StudyContent {
  title: string;
  tagline: string | null;
  pages: Array<{ blocks: StudyBlock[] }>;
  /** One per blank, in order. */
  answers: string[];
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
  studies: LibraryStudy[];
}

export interface EditorStudy {
  id: string;
  status: 'draft' | 'approved';
  series: { id: string; title: string; locked: boolean };
  has_draft: boolean;
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
