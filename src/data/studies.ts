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
  series?: string | null;
}

export interface StudyDetail {
  id: string;
  number: number | null;
  title: string;
  tagline: string | null;
  locked: boolean;
  /** The series it belongs to. */
  series?: string | null;
  pages: StudyPage[];
  /** The intended answers — once the study is submitted (and in previews). */
  answers?: string[] | null;
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

// ---------------------------------------------------------------- the bank
// Admins and Leaders (Resources → Bible studies): Ekklē's shared studies and
// the ministry's own — which seekers get, and in what order.

export interface BankStudy {
  id: string;
  title: string;
  tagline: string | null;
  source: 'ekkle' | 'ministry';
  series?: string | null;
  enabled: boolean;
  /** Its place in the unlock order (only when on). */
  number: number | null;
  pages: number;
  seekers_started: number;
  seekers_completed: number;
}

export async function listStudyBank(): Promise<BankStudy[]> {
  const { data, error } = await supabase.rpc('ministry_study_bank');
  if (error) throw error;
  return (data as unknown as BankStudy[]) ?? [];
}

/** Save the whole list: every study in order, each on or off. */
export async function saveStudyBank(items: Array<{ id: string; enabled: boolean }>): Promise<void> {
  const { error } = await supabase.rpc('save_ministry_studies', { p_items: items });
  if (error) throw error;
}

/** A study exactly as seekers see it (all pages), for Admins and Leaders. */
export async function previewStudy(studyId: string): Promise<StudyDetail | null> {
  const { data, error } = await supabase.rpc('preview_study', { p_study_id: studyId });
  if (error) throw error;
  return (data as StudyDetail | null) ?? null;
}
