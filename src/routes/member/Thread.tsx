import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getMessages,
  getConversationMeta,
  sendMemberMessage,
  markConversationRead,
  subscribeToMessages,
  reportConversation,
  eraseConversation,
  recordCheckin,
  type Message,
  type ConversationMeta,
  type CheckinValue,
} from '@/data/conversations';
import { MessageList } from '@/components/MessageList';
import { TextArea } from '@/ui/Field';
import { Button } from '@/ui/Button';
import { Spinner, ErrorNote } from '@/ui/states';

/** Member's view of one conversation: live thread, reply, check-in, safeguarding. */
export default function Thread() {
  const { conversationId = '' } = useParams();
  const [meta, setMeta] = useState<ConversationMeta | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    setMessages(await getMessages(conversationId));
    void markConversationRead(conversationId);
  }
  const reloadMeta = () =>
    getConversationMeta(conversationId).then((m) => setMeta(m)).catch(() => {});

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

  async function onCheckin(value: CheckinValue) {
    setMeta((m) => (m ? { ...m, lastCheckin: value } : m));
    try {
      await recordCheckin(conversationId, value);
    } catch {
      void reloadMeta();
    }
  }

  async function onReport() {
    const reason = prompt(
      'Block and report this conversation? It will be closed for both sides.\n\nOptionally add a note for leadership:',
    );
    if (reason === null) return; // cancelled
    try {
      await reportConversation(conversationId, reason);
      setManageOpen(false);
      await reloadMeta();
    } catch {
      setError('Couldn’t block this conversation.');
    }
  }

  async function onErase() {
    if (
      !confirm(
        'Erase this person’s data? Their messages are permanently deleted and their details removed. This can’t be undone.',
      )
    )
      return;
    try {
      await eraseConversation(conversationId);
      setManageOpen(false);
      setMessages([]);
      await reloadMeta();
    } catch {
      setError('Couldn’t erase this conversation.');
    }
  }

  if (meta === undefined) {
    return (
      <div className="py-16">
        <Spinner />
      </div>
    );
  }

  const name = meta?.recipientFirstName ?? 'Someone';
  const erased = meta?.erased;
  const closed = meta?.status === 'blocked';

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/app/messages"
            className="text-[13px] text-muted transition-colors hover:text-sage"
          >
            ← Messages
          </Link>
          <span className="font-medium text-sage">{name}</span>
        </div>
        {!erased && (
          <div className="relative">
            <button
              onClick={() => setManageOpen((o) => !o)}
              aria-label="Manage conversation"
              className="rounded-lg px-2 py-1 text-muted transition-colors hover:text-sage"
            >
              •••
            </button>
            {manageOpen && (
              <div className="absolute right-0 top-8 z-10 w-52 overflow-hidden rounded-card border border-edge bg-card py-1 shadow-sm">
                {!closed && (
                  <button
                    onClick={onReport}
                    className="block w-full px-4 py-2 text-left text-[13px] text-muted-strong transition-colors hover:bg-sage/5"
                  >
                    Block &amp; report
                  </button>
                )}
                <button
                  onClick={onErase}
                  className="block w-full px-4 py-2 text-left text-[13px] text-muted-strong transition-colors hover:bg-sage/5"
                >
                  Erase this person’s data
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1">
        {erased ? (
          <p className="py-8 text-center text-sm text-muted">
            This person’s data has been erased.
          </p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No messages yet.</p>
        ) : (
          <MessageList messages={messages} mine="member" />
        )}
        <div ref={bottomRef} />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Connection check-in */}
      {!erased && <CheckinPrompt name={name} value={meta?.lastCheckin ?? null} onPick={onCheckin} />}

      {erased ? null : closed ? (
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

function CheckinPrompt({
  name,
  value,
  onPick,
}: {
  name: string;
  value: CheckinValue | null;
  onPick: (v: CheckinValue) => void;
}) {
  const options: Array<{ v: CheckinValue; label: string }> = [
    { v: 'yes', label: 'Yes' },
    { v: 'not_yet', label: 'Not yet' },
    { v: 'no', label: 'No' },
  ];
  return (
    <div className="rounded-card border border-edge bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-muted-strong">
          Have you connected with {name} in person?
        </span>
        <div className="flex gap-1.5">
          {options.map((o) => (
            <button
              key={o.v}
              onClick={() => onPick(o.v)}
              className={
                'rounded-lg border px-3 py-1 text-[13px] transition-colors ' +
                (value === o.v
                  ? 'border-sage bg-sage text-canvas'
                  : 'border-edge text-muted-strong hover:border-sage/40')
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {value && (
        <p className="mt-1.5 text-[12px] text-muted">
          Thanks — this just helps your leaders see real connections, never the messages.
        </p>
      )}
    </div>
  );
}
