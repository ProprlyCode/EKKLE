import { supabase } from '@/lib/supabase';

/**
 * Recipient-side data access — all via anonymous-safe RPCs (no table access).
 * The recipient is identified only by a device-local session token.
 */

export interface RecipientCta {
  label: string;
  kind: 'message' | 'link';
  url: string | null;
}

export interface RecipientLanding {
  member: { name: string; short_message: string };
  sequence: { id: string; title: string };
  connect: { headline: string; body: string; ctas: RecipientCta[] };
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

/**
 * Resolve which member a public-offer visitor should be routed to: an explicit
 * referral (?ref=<slug>), else the org's designated responder, else the first
 * active member. Returns a code_slug to send them to /r/<slug>.
 */
export async function resolveOfferMember(ref: string | null): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_offer_member', {
    p_ref: ref && ref.trim() ? ref.trim() : null,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

const LEAD_KEY = 'ekkle_offer_lead';

/** The name/email captured at the /offer gate, remembered to prefill later. */
export function savedLead(): { firstName: string; email: string } | null {
  try {
    const raw = localStorage.getItem(LEAD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Offer email gate: capture the lead (name + email) attributed to the resolved
 * member, then return the member slug to route into the study (/r/<slug>).
 */
export async function registerOfferLead(input: {
  ref: string | null;
  firstName: string;
  email: string;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc('register_offer_lead', {
    p_session_token: getRecipientSessionToken(),
    p_ref: input.ref && input.ref.trim() ? input.ref.trim() : null,
    p_first_name: input.firstName,
    p_email: input.email,
  });
  if (error) throw error;
  try {
    localStorage.setItem(
      LEAD_KEY,
      JSON.stringify({ firstName: input.firstName.trim(), email: input.email.trim() }),
    );
  } catch {
    /* storage blocked — prefill just won't persist */
  }
  return (data as string | null) ?? null;
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
  const conversationId = data as string;
  rememberConversation(input.slug, conversationId);
  return conversationId;
}

export interface RecipientConversation {
  member_name: string;
  status: 'active' | 'blocked';
  messages: Array<{
    sender_type: 'member' | 'recipient';
    body: string;
    created_at: string;
  }>;
}

export async function getConversation(
  conversationId: string,
): Promise<RecipientConversation | null> {
  const { data, error } = await supabase.rpc('get_recipient_conversation', {
    p_session_token: getRecipientSessionToken(),
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return (data as RecipientConversation | null) ?? null;
}

export async function sendRecipientMessage(
  conversationId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.rpc('send_recipient_message', {
    p_session_token: getRecipientSessionToken(),
    p_conversation_id: conversationId,
    p_body: body,
  });
  if (error) throw error;
}

/** Remember the conversation for this member on this device, to resume later. */
function convoKey(slug: string) {
  return `ekkle_convo_${slug}`;
}
export function rememberConversation(slug: string, conversationId: string) {
  try {
    localStorage.setItem(convoKey(slug), conversationId);
  } catch {
    /* storage blocked — resume just won't persist */
  }
}
export function savedConversation(slug: string): string | null {
  try {
    return localStorage.getItem(convoKey(slug));
  } catch {
    return null;
  }
}
