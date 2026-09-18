import { supabase } from '@/lib/supabase';

/**
 * Recipient-side data access — all via anonymous-safe RPCs (no table access).
 * The recipient is identified only by a device-local session token.
 */

export interface RecipientLanding {
  member: { name: string; short_message: string };
  sequence: { id: string; title: string };
  screens: Array<{ headline: string; body: string; icon: string | null }>;
}

export type SequenceEventKind = 'started' | 'completed' | 'messaged';

const SESSION_KEY = 'ekkle_recipient_session';

/** A stable per-device token, created on first use. Never identifies a person. */
export function getRecipientSessionToken(): string {
  try {
    let token = localStorage.getItem(SESSION_KEY);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, token);
    }
    return token;
  } catch {
    // Private mode / storage blocked — fall back to an ephemeral token.
    return crypto.randomUUID();
  }
}

/** Load the greeting + approved sequence for a member handle, or null. */
export async function getLanding(slug: string): Promise<RecipientLanding | null> {
  const { data, error } = await supabase.rpc('get_recipient_landing', {
    p_slug: slug,
  });
  if (error) throw error;
  return (data as RecipientLanding | null) ?? null;
}

export async function logEvent(
  slug: string,
  event: SequenceEventKind,
): Promise<void> {
  const { error } = await supabase.rpc('log_sequence_event', {
    p_session_token: getRecipientSessionToken(),
    p_slug: slug,
    p_event: event,
  });
  // Telemetry is best-effort — never block the experience on it.
  if (error) console.warn('logEvent failed', error.message);
}

/** Send the first message to the member; returns the conversation id. */
export async function startConversation(input: {
  slug: string;
  firstName: string;
  email: string;
  body: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', {
    p_session_token: getRecipientSessionToken(),
    p_slug: input.slug,
    p_first_name: input.firstName,
    p_email: input.email,
    p_body: input.body,
  });
  if (error) throw error;
  return data as string;
}
