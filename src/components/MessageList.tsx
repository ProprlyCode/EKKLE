import { cn } from '@/lib/cn';

export interface ChatMessage {
  /** 'note': a quiet line from Ekklē (e.g. the conversation moved to someone). */
  sender_type: 'member' | 'recipient' | 'note';
  body: string;
  created_at: string;
}

/**
 * Message bubbles. `mine` says which side is the current viewer, so their
 * messages sit on the right in sage; the other side sits left on a cream card.
 * Notes sit centred, small, between the messages.
 */
export function MessageList({
  messages,
  mine,
}: {
  messages: ChatMessage[];
  mine: 'member' | 'recipient';
}) {
  return (
    <div className="flex flex-col gap-2">
      {messages.map((m, i) => {
        if (m.sender_type === 'note') {
          return (
            <p key={i} role="note" className="py-2 text-center text-[13px] text-muted">
              {m.body}
            </p>
          );
        }
        const isMine = m.sender_type === mine;
        return (
          <div
            key={i}
            className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-[15px] leading-relaxed',
                isMine
                  ? 'bg-accent text-canvas'
                  : 'border border-edge bg-card text-sage',
              )}
            >
              {m.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The last real message (not a note). */
export function lastMessage<T extends ChatMessage>(messages: T[]): T | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_type !== 'note') return messages[i];
  }
  return undefined;
}
