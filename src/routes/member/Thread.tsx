import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getMessages,
  getConversationMeta,
  sendMemberMessage,
  markConversationRead,
  subscribeToMessages,
  type Message,
  type ConversationMeta,
} from '@/data/conversations';
import { MessageList } from '@/components/MessageList';
import { TextArea } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Spinner, ErrorNote } from '@/ui/states';

/** Member's view of one conversation: live thread + reply. */
export default function Thread() {
  const { conversationId = '' } = useParams();
  const [meta, setMeta] = useState<ConversationMeta | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    setMessages(await getMessages(conversationId));
    void markConversationRead(conversationId);
  }

  useEffect(() => {
    let active = true;
    getConversationMeta(conversationId)
      .then((m) => active && setMeta(m))
      .catch(() => active && setMeta(null));
    getMessages(conversationId)
      .then((m) => {
        if (active) setMessages(m);
        void markConversationRead(conversationId);
      })
      .catch(() => active && setError('Couldn’t load this conversation.'));

    const unsub = subscribeToMessages(conversationId, () => void refresh());
    return () => {
      active = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendMemberMessage(conversationId, body);
      setBody('');
      await refresh();
    } catch {
      setError('Couldn’t send. Try again.');
    } finally {
      setSending(false);
    }
  }

  if (meta === undefined) {
    return (
      <div className="py-16">
        <Spinner />
      </div>
    );
  }

  const closed = meta?.status === 'blocked';

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          to="/app/messages"
          className="text-[13px] text-muted transition-colors hover:text-sage"
        >
          ← Messages
        </Link>
        <span className="font-medium text-sage">
          {meta?.recipientFirstName ?? 'Someone'}
        </span>
      </div>

      <div className="flex-1">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No messages yet.</p>
        ) : (
          <MessageList messages={messages} mine="member" />
        )}
        <div ref={bottomRef} />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {closed ? (
        <p className="rounded-lg border border-edge bg-card px-3 py-3 text-center text-[13px] text-muted">
          This conversation is closed.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <div className="flex-1">
            <TextArea
              label=""
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a reply…"
            />
          </div>
          <Button type="submit" disabled={sending || !body.trim()}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
