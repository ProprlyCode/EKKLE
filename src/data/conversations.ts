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

export interface ConversationMeta {
  recipientFirstName: string;
  status: ConversationStatus;
}

export async function getConversationMeta(
  conversationId: string,
): Promise<ConversationMeta | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('status, recipient:recipients(first_name)')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const recipient = data.recipient as unknown as { first_name: string } | null;
  return {
    recipientFirstName: recipient?.first_name ?? 'Someone',
    status: data.status,
  };
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
