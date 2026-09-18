import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  getLanding,
  logEvent,
  startConversation,
  getConversation,
  sendRecipientMessage,
  savedConversation,
  type RecipientLanding,
  type RecipientConversation,
} from '@/data/recipient';
import { Button } from '@/ui/Button';
import { TextInput, TextArea } from '@/ui/Field';
import { Spinner } from '@/ui/states';
import { MessageList } from '@/components/MessageList';
import { SequenceScreenContent } from './SequenceScreenContent';

/**
 * The recipient experience (/r/:slug) — no login.
 *
 * This layer belongs to the church, not to Ekklē: it is intentionally warm and
 * content-first per the brand guide, with the platform identity absent. Unhurried,
 * one screen at a time, a soft next step that is never forced.
 */

type Step =
  | { kind: 'intro' }
  | { kind: 'screen'; index: number }
  | { kind: 'connect' }
  | { kind: 'message' }
  | { kind: 'thread'; conversationId: string }
  | { kind: 'closing' };

export default function RecipientExperience() {
  const { slug = '' } = useParams();
  const [landing, setLanding] = useState<RecipientLanding | null | undefined>(
    undefined,
  );
  const [step, setStep] = useState<Step>({ kind: 'intro' });
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    let active = true;
    getLanding(slug)
      .then((data) => active && setLanding(data))
      .catch(() => active && setLanding(null));
    return () => {
      active = false;
    };
  }, [slug]);

  // Fire 'started' once the content is available.
  useEffect(() => {
    if (landing && !startedRef.current) {
      startedRef.current = true;
      void logEvent(slug, 'started');
    }
  }, [landing, slug]);

  function goTo(next: Step) {
    if (next.kind === 'connect' && !completedRef.current) {
      completedRef.current = true;
      void logEvent(slug, 'completed');
    }
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  if (landing === undefined) {
    return (
      <Shell>
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      </Shell>
    );
  }

  if (landing === null) {
    return (
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <h1 className="font-serif text-2xl text-sage">This link isn’t active</h1>
          <p className="max-w-xs text-sm leading-relaxed text-muted-strong">
            The person who shared this may be able to send you a fresh one.
          </p>
        </div>
      </Shell>
    );
  }

  const { member, screens } = landing;
  const resumeId = savedConversation(slug);

  return (
    <Shell>
      {step.kind === 'intro' && (
        <Intro
          member={member}
          onBegin={() =>
            goTo(
              screens.length > 0
                ? { kind: 'screen', index: 0 }
                : { kind: 'connect' },
            )
          }
          onResume={
            resumeId
              ? () => goTo({ kind: 'thread', conversationId: resumeId })
              : undefined
          }
        />
      )}

      {step.kind === 'screen' && (
        <ScreenView
          screen={screens[step.index]}
          index={step.index}
          total={screens.length}
          onBack={() =>
            goTo(
              step.index === 0
                ? { kind: 'intro' }
                : { kind: 'screen', index: step.index - 1 },
            )
          }
          onContinue={() =>
            goTo(
              step.index + 1 < screens.length
                ? { kind: 'screen', index: step.index + 1 }
                : { kind: 'connect' },
            )
          }
        />
      )}

      {step.kind === 'connect' && (
        <Connect
          connect={landing.connect}
          memberName={member.name}
          onMessage={() => goTo({ kind: 'message' })}
          onKeepReading={() => goTo({ kind: 'closing' })}
        />
      )}

      {step.kind === 'message' && (
        <MessageForm
          slug={slug}
          memberName={member.name}
          onSent={(conversationId) => goTo({ kind: 'thread', conversationId })}
          onCancel={() => goTo({ kind: 'connect' })}
        />
      )}

      {step.kind === 'thread' && (
        <RecipientThread
          conversationId={step.conversationId}
          fallbackName={member.name}
        />
      )}
      {step.kind === 'closing' && <Closing />}
    </Shell>
  );
}

/** Warm, church-owned frame. No Ekklē chrome. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 py-10">
        {children}
      </div>
    </div>
  );
}

function Intro({
  member,
  onBegin,
  onResume,
}: {
  member: RecipientLanding['member'];
  onBegin: () => void;
  onResume?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">A note from {member.name}</p>
        {member.short_message && (
          <p className="font-serif text-2xl leading-snug text-sage">
            “{member.short_message}”
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Button onClick={onBegin} className="w-full">
          Begin
        </Button>
        {onResume && (
          <Button variant="quiet" onClick={onResume} className="w-full">
            Continue your conversation with {member.name}
          </Button>
        )}
      </div>
    </div>
  );
}

function ScreenView({
  screen,
  index,
  total,
  onBack,
  onContinue,
}: {
  screen: RecipientLanding['screens'][number];
  index: number;
  total: number;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <Progress index={index} total={total} />
      <div className="flex flex-1 flex-col justify-center py-10">
        <SequenceScreenContent headline={screen.headline} body={screen.body} />
      </div>
      <div className="flex flex-col gap-3">
        <Button onClick={onContinue} className="w-full">
          {index + 1 < total ? 'Continue' : 'One more thing'}
        </Button>
        <button
          onClick={onBack}
          className="text-center text-[13px] text-muted transition-colors hover:text-sage"
        >
          Back
        </button>
      </div>
    </div>
  );
}

function Progress({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 pt-1" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={
            'h-1 flex-1 rounded-full transition-colors ' +
            (i <= index ? 'bg-sage/70' : 'bg-edge')
          }
        />
      ))}
    </div>
  );
}

function Connect({
  connect,
  memberName,
  onMessage,
  onKeepReading,
}: {
  connect: RecipientLanding['connect'];
  memberName: string;
  onMessage: () => void;
  onKeepReading: () => void;
}) {
  const headline = connect.headline?.trim() || 'someone here would love to talk';
  const body =
    connect.body?.trim() ||
    `${memberName} shared this with you and would genuinely welcome a conversation — no pressure, no script. Or you can sit with it a while. Both are okay.`;
  // Default to a single "message the member" action if nothing is configured.
  const ctas =
    connect.ctas.length > 0
      ? connect.ctas
      : [{ label: `Message ${memberName}`, kind: 'message' as const, url: null }];

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-3xl leading-tight text-sage">{headline}</h1>
        <p className="whitespace-pre-wrap text-[17px] leading-relaxed text-muted-strong">
          {body}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {ctas.map((cta, i) =>
          cta.kind === 'message' ? (
            <Button
              key={i}
              variant={i === 0 ? 'primary' : 'quiet'}
              onClick={onMessage}
              className="w-full"
            >
              {cta.label || `Message ${memberName}`}
            </Button>
          ) : (
            <a
              key={i}
              href={safeHref(cta.url)}
              target="_blank"
              rel="noopener noreferrer"
              className={
                'inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors ' +
                (i === 0
                  ? 'bg-sage text-canvas hover:bg-sage-soft'
                  : 'text-sage hover:bg-sage/5')
              }
            >
              {cta.label || 'Open'}
            </a>
          ),
        )}
        <Button variant="quiet" onClick={onKeepReading} className="w-full">
          Not right now
        </Button>
      </div>
    </div>
  );
}

function MessageForm({
  slug,
  memberName,
  onSent,
  onCancel,
}: {
  slug: string;
  memberName: string;
  onSent: (conversationId: string) => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const conversationId = await startConversation({ slug, firstName, email, body });
      onSent(conversationId);
    } catch {
      setSending(false);
      setError('That didn’t send. Please try again in a moment.');
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl leading-tight text-sage">
          Say hello to {memberName}
        </h1>
        <p className="text-sm leading-relaxed text-muted-strong">
          They’ll see your note and reply personally.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextInput
          label="Your first name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <TextInput
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          hint="So they can reply to you."
        />
        <TextArea
          label="Your message"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          placeholder="Even a few words is a good start."
        />
        <p className="text-[12px] leading-relaxed text-muted">
          By sending, you’re sharing your name and email with {memberName} so they
          can reply. You can ask them to delete your details at any time.
        </p>
        {error && (
          <p className="rounded-lg border border-sage/20 bg-sage/5 px-3 py-2 text-[13px] text-muted-strong">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={sending || !firstName || !email || !body}>
            {sending ? 'Sending…' : 'Send'}
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="text-center text-[13px] text-muted transition-colors hover:text-sage"
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

/** Only allow http(s) link destinations; add https:// if the scheme is missing. */
function safeHref(url: string | null): string {
  const raw = (url ?? '').trim();
  if (!raw) return '#';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '#'; // some other scheme (javascript:, data:, …)
  return `https://${raw}`;
}

function RecipientThread({
  conversationId,
  fallbackName,
}: {
  conversationId: string;
  fallbackName: string;
}) {
  const [convo, setConvo] = useState<RecipientConversation | null | undefined>(
    undefined,
  );
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const c = await getConversation(conversationId);
        if (active) setConvo(c);
      } catch {
        if (active) setConvo(null);
      }
    }
    void load();
    // Poll for replies while the thread is open.
    const t = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [convo]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await sendRecipientMessage(conversationId, body);
      setBody('');
      setConvo(await getConversation(conversationId));
    } catch {
      /* keep the text so they can retry */
    } finally {
      setSending(false);
    }
  }

  if (convo === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const name = convo?.member_name || fallbackName;
  const closed = convo?.status === 'blocked';

  return (
    <div className="flex min-h-[80vh] flex-col gap-4 py-4">
      <div className="border-b border-edge/70 pb-3">
        <p className="text-sm text-muted">Your conversation with</p>
        <p className="font-serif text-xl text-sage">{name}</p>
      </div>

      <div className="flex-1">
        {convo && convo.messages.length > 0 ? (
          <MessageList messages={convo.messages} mine="recipient" />
        ) : (
          <p className="py-8 text-center text-sm text-muted">No messages yet.</p>
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
              placeholder="Write a message…"
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

function Closing() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
      <span aria-hidden className="mb-1 block h-[2px] w-8 rounded-full bg-sage/70" />
      <h1 className="font-serif text-2xl text-sage">Thank you for reading</h1>
      <p className="max-w-xs text-sm leading-relaxed text-muted-strong">
        There’s no rush and no next step you have to take. Whenever you’re ready,
        the door is open.
      </p>
    </div>
  );
}
