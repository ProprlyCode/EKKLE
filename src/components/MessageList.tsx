import { cn } from '@/lib/cn';

export interface ChatMessage {
  sender_type: 'member' | 'recipient';
  body: string;
  created_at: string;
}

/**
 * Message bubbles. `mine` says which side is the current viewer, so their
 * messages sit on the right in sage; the other side sits left on a cream card.
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
                  ? 'bg-sage text-canvas'
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
