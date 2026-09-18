import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listConversations, type InboxItem } from '@/data/conversations';
import { Card } from '@/ui/Card';
import { EmptyState, Spinner, ErrorNote } from '@/ui/states';

/** Member inbox: conversations started by recipients, newest first. */
export default function Inbox() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listConversations()
      .then(setItems)
      .catch(() => setError('Couldn’t load your messages.'));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl">Messages</h1>
        <p className="mt-1 text-sm text-muted-strong">
          People who reached out after you shared with them.
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {items === null ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No messages yet"
          note="When someone you shared with reaches out, they’ll appear here."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-edge/70">
            {items.map((it) => (
              <li key={it.conversationId}>
                <Link
                  to={`/app/messages/${it.conversationId}`}
                  className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-sage/5"
                >
                  {it.unread ? (
                    <span
                      aria-label="unread"
                      className="h-2 w-2 shrink-0 rounded-full bg-sage"
                    />
                  ) : (
                    <span className="h-2 w-2 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={
                          'truncate ' +
                          (it.unread ? 'font-semibold text-sage' : 'font-medium text-sage')
                        }
                      >
                        {it.recipientFirstName || 'Someone'}
                      </span>
                      <span className="shrink-0 text-[12px] text-muted">
                        {formatWhen(it.lastAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted-strong">
                      {it.status === 'blocked'
                        ? 'Conversation closed'
                        : it.lastSender === 'member'
                          ? `You: ${it.lastBody ?? ''}`
                          : (it.lastBody ?? '')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
