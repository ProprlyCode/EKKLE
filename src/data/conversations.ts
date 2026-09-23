import { supabase } from '@/lib/supabase';
import type { Tables, SenderType, ConversationStatus } from '@/lib/database.types';

/** Member-side messaging data access (RLS-backed + realtime). */

export type Message = Tables<'messages'>;

export interface InboxItem {
  conversationId: string;
  recipientId: string;
  recipientFirstName: string;
  lastBody: string | null;
  lastAt: string | null;
  lastSender: SenderType | null;
  unread: boolean;
  status: ConversationStatus;
}

export async function listConversations(): Promise<InboxItem[]> {
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    conversationId: r.conversation_id,
    recipientId: r.recipient_id,
    recipientFirstName: r.recipient_first_name,
    lastBody: r.last_body,
    lastAt: r.last_at,
    lastSender: r.last_sender,
    unread: r.unread,
    status: r.status,
  }));
}

/** Count of conversations with an unread recipient message. */
export async function unreadCount(): Promise<number> {
  const items = await listConversations();
  return items.filter((i) => i.unread).length;
}

export type CheckinValue = 'yes' | 'not_yet' | 'no';

export interface ConversationMeta {
  recipientFirstName: string;
  status: ConversationStatus;
  erased: boolean;
  lastCheckin: CheckinValue | null;
}

export async function getConversationMeta(
  conversationId: string,
): Promise<ConversationMeta | null> {
  const { data, error } = await supabase.rpc('conversation_meta', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  const meta = data as unknown as {
    recipient_first_name: string;
    status: ConversationStatus;
    erased: boolean;
    last_checkin: CheckinValue | null;
  } | null;
  if (!meta) return null;
  return {
    recipientFirstName: meta.recipient_first_name ?? 'Someone',
    status: meta.status,
    erased: meta.erased,
    lastCheckin: meta.last_checkin,
  };
}

/** Block + report a conversation (member). Both sides can no longer post. */
export async function reportConversation(
  conversationId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('report_conversation', {
    p_conversation_id: conversationId,
    p_reason: reason,
  });
  if (error) throw error;
}

/** Erase the recipient's data (member/leadership) — messages deleted, record redacted. */
export async function eraseConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('erase_conversation', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

/** Record the connection check-in ("did you connect?"). */
export async function recordCheckin(
  conversationId: string,
  value: CheckinValue,
): Promise<void> {
  const { error } = await supabase.rpc('record_checkin', {
    p_conversation_id: conversationId,
    p_value: value,
  });
  if (error) throw error;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMemberMessage(
  conversationId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_type: 'member', body: body.trim() });
  if (error) throw error;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ member_last_read_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (error) throw error;
}

/** Subscribe to new messages in a conversation (member side, RLS-backed). */
export function subscribeToMessages(
  conversationId: string,
  onInsert: (message: Message) => void,
): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onInsert(payload.new as Message),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
