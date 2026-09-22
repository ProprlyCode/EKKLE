import { supabase } from '@/lib/supabase';

/**
 * Studies data access for the signed-in seeker. All seeker_* RPCs resolve the
 * account by auth.uid() (no device token), so progress follows the person.
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
  started: boolean;
  last_page: number;
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

/** The full library with per-account lock + completion state. */
export async function listStudies(): Promise<StudySummary[]> {
  const { data, error } = await supabase.rpc('seeker_studies');
  if (error) throw error;
  return (data as unknown as StudySummary[]) ?? [];
}

/** One study's pages + saved progress. `locked: true` (no pages) if not unlocked. */
export async function getStudy(studyId: string): Promise<StudyDetail | null> {
  const { data, error } = await supabase.rpc('seeker_study', { p_study_id: studyId });
  if (error) throw error;
  return (data as StudyDetail | null) ?? null;
}

/** Persist place + answers so far (best-effort; never blocks the reader). */
export async function saveStudyProgress(
  studyId: string,
  lastPage: number,
  answers: Record<string, string>,
): Promise<void> {
  const { error } = await supabase.rpc('seeker_save_progress', {
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
  const { error } = await supabase.rpc('seeker_complete_study', {
    p_study_id: studyId,
    p_answers: answers,
  });
  if (error) throw error;
}
