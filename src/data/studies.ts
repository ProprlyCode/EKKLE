import { supabase } from '@/lib/supabase';
import { getRecipientSessionToken } from '@/data/recipient';

/**
 * Studies data access — the self-hosted, progressively-unlocked workbook
 * library. All anonymous-safe RPCs, keyed by the device session token; no
 * direct table access.
 */

export type StudyBlock =
  | { t: 'h'; text: string }
  | { t: 'p'; text: string }
  | { t: 'img'; src: string };

export interface StudyPage {
  page_number: number;
  blocks: StudyBlock[];
}

export interface StudySummary {
  id: string;
  number: number | null;
  title: string;
  tagline: string | null;
  completed: boolean;
  locked: boolean;
}

export interface StudyDetail {
  id: string;
  number: number | null;
  title: string;
  tagline: string | null;
  locked: boolean;
  pages: StudyPage[];
  progress: {
    last_page: number;
    answers: Record<string, string>;
    completed: boolean;
  } | null;
}

/** The full library with per-recipient lock + completion state. */
export async function listStudies(): Promise<StudySummary[]> {
  const { data, error } = await supabase.rpc('list_studies', {
    p_session_token: getRecipientSessionToken(),
  });
  if (error) throw error;
  return (data as unknown as StudySummary[]) ?? [];
}

/** One study's pages + saved progress. `locked: true` (no pages) if not yet unlocked. */
export async function getStudy(studyId: string): Promise<StudyDetail | null> {
  const { data, error } = await supabase.rpc('get_study', {
    p_session_token: getRecipientSessionToken(),
    p_study_id: studyId,
  });
  if (error) throw error;
  return (data as StudyDetail | null) ?? null;
}

/** Persist place + answers so far (best-effort; never blocks the reader). */
export async function saveStudyProgress(
  studyId: string,
  lastPage: number,
  answers: Record<string, string>,
): Promise<void> {
  const { error } = await supabase.rpc('save_study_progress', {
    p_session_token: getRecipientSessionToken(),
    p_study_id: studyId,
    p_last_page: lastPage,
    p_answers: answers,
  });
  if (error) console.warn('saveStudyProgress failed', error.message);
}

/** Mark the study complete — unlocks the next one in the library. */
export async function completeStudy(
  studyId: string,
  answers: Record<string, string>,
): Promise<void> {
  const { error } = await supabase.rpc('complete_study', {
    p_session_token: getRecipientSessionToken(),
    p_study_id: studyId,
    p_answers: answers,
  });
  if (error) throw error;
}
