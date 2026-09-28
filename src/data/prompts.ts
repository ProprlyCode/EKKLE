import { supabase } from '@/lib/supabase';

/** Faith in action (0039): ideas and prompts beside a member's code. */

export type PromptKind = 'moment' | 'share' | 'starter';

export const PROMPT_KINDS: Record<PromptKind, string> = {
  moment: 'Everyday moments',
  share: 'Sharing your code',
  starter: 'Conversation starters',
};

export interface Prompt {
  id: string;
  kind: PromptKind;
  body: string;
}

/** This week's prompt (the same for the whole ministry) and all of them. */
export async function faithPrompts(): Promise<{ this_week: Prompt | null; prompts: Prompt[] } | null> {
  const { data, error } = await supabase.rpc('faith_prompts');
  if (error) throw error;
  return (data as never) ?? null;
}

export interface LibraryPrompt extends Prompt {
  status: 'draft' | 'published';
  source: 'ekkle' | 'ministry';
  editable: boolean;
}

export async function promptLibrary(): Promise<LibraryPrompt[]> {
  const { data, error } = await supabase.rpc('prompt_library');
  if (error) throw error;
  return (data as unknown as LibraryPrompt[]) ?? [];
}

export async function savePrompt(
  id: string | null,
  prompt: { kind: PromptKind; body: string; status: 'draft' | 'published' },
): Promise<string> {
  const { data, error } = await supabase.rpc('save_faith_prompt', {
    p_id: id,
    p_kind: prompt.kind,
    p_body: prompt.body,
    p_status: prompt.status,
  });
  if (error) throw error;
  return data as string;
}

export async function deletePrompt(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_faith_prompt', { p_id: id });
  if (error) throw error;
}
