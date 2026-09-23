import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  getSeekerConnection,
  sendSeekerMessage,
  blockSeekerConnection,
  type SeekerConnection,
} from '@/data/seeker';
import { Button } from '@/ui/Button';
import { TextArea } from '@/ui/Field';
import { Spinner } from '@/ui/states';
import { MessageList } from '@/components/MessageList';

/**
 * The seeker's connection (/studies/connection) — a 1:1 thread with the person
 * who invited them (or the church's designated responder). The warm, contained
 * space where a real conversation can begin.
 */
export default function Connection() {
  const [convo, setConvo] = useState<SeekerConnection | null | undefined>(undefined);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      getSeekerConnection()
        .then((c) => active && setConvo(c))
        .catch(() => active && setConvo(null));
    void load();
    const t = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [convo]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await sendSeekerMessage(body);
      setBody('');
      setConvo(await getSeekerConnection());
    } catch {
      /* keep the text so they can retry */
    } finally {
      setSending(false);
    }
  }

  async function onBlock() {
    if (
      !confirm(
        'Block this conversation? They won’t be able to message you, and it will be closed.',
      )
    )
      return;
    const reason = prompt('Optionally tell us why (this goes to the church’s leaders):') ?? '';
    try {
      await blockSeekerConnection(reason);
      setConvo(await getSeekerConnection());
    } catch {
      /* no-op; the thread will reflect state on next poll */
    }
  }

  if (convo === undefined)
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );

  const member = convo?.member ?? null;

  if (!member)
    return (
      <div className="card px-6 py-10 text-center">
        <h1 className="font-serif text-xl text-sage">No one to reach just yet</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-strong">
          Once you’re connected to someone from the church, your conversation will
          live here.
        </p>
      </div>
    );

  const closed = convo?.status === 'blocked';
  const messages = convo?.messages ?? [];

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <header className="border-b border-edge/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="eyebrow">your connection</span>
            <h1 className="mt-1 font-serif text-2xl text-sage">{member.name}</h1>
          </div>
          {!closed && (
            <button
              onClick={onBlock}
              className="mt-1 shrink-0 text-[12px] text-muted underline-offset-2 hover:text-sage hover:underline"
            >
              Block
            </button>
          )}
        </div>
        {member.short_message && messages.length === 0 && (
          <p className="mt-2 text-[15px] leading-relaxed text-muted-strong">
            “{member.short_message}”
          </p>
        )}
      </header>

      <div className="flex-1">
        {messages.length > 0 ? (
          <MessageList messages={messages} mine="recipient" />
        ) : (
          <p className="py-10 text-center text-sm text-muted">
            Say hello whenever you’re ready — {member.name} will reply personally.
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <p className="rounded-lg border border-edge bg-card px-3 py-3 text-center text-[13px] text-muted">
          This conversation has been closed.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <div className="flex-1">
            <TextArea
              label=""
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Write to ${member.name}…`}
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
