import { useEffect, useState } from 'react';
import {
  listLeadershipConversations,
  reassignConversation,
  type LeadershipConversation,
} from '@/data/conversations';
import { listMembers, type Member } from '@/data/members';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ErrorNote, Spinner } from '@/ui/states';

/**
 * Overview → Conversations (Admins and Leaders): who is talking with whom and
 * who is waiting for a reply — metadata only, never what anyone wrote. A
 * conversation can be moved to another member; the history goes with it and
 * the person sees "You're now talking with …".
 */
export function ConversationsCard({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<LeadershipConversation[] | null>(null);
  const [team, setTeam] = useState<Member[]>([]);
  const [moving, setMoving] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    try {
      setItems(await listLeadershipConversations());
    } catch {
      setError('Couldn’t load the conversations.');
    }
  }
  useEffect(() => {
    void refresh();
    listMembers(orgId)
      .then((m) => setTeam(m.filter((x) => x.active && x.auth_uid)))
      .catch(() => {});
  }, [orgId]);

  async function onMove(c: LeadershipConversation) {
    if (!to) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await reassignConversation(c.id, to);
      const name = team.find((m) => m.id === to)?.name ?? 'them';
      setNotice(`${c.first_name}’s conversation is now with ${name}.`);
      setMoving(null);
      setTo('');
      await refresh();
    } catch (err) {
      const code = err && typeof err === 'object' && 'message' in err ? String(err.message) : '';
      setError(
        code.includes('already_talking')
          ? `That person already has a conversation with ${c.first_name}.`
          : 'Couldn’t move the conversation. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const waiting = items?.filter((c) => c.waiting_since && c.status === 'active').length ?? 0;

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between gap-3 border-b border-edge/70 px-5 py-3">
        <span className="eyebrow">conversations</span>
        {items && waiting > 0 && (
          <span className="text-[13px] text-muted-strong">{waiting} waiting for a reply</span>
        )}
      </div>
      {error && (
        <div className="px-5 pt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {notice && (
        <p role="status" className="px-5 pt-3 text-sm text-sage">
          {notice}
        </p>
      )}
      {items === null ? (
        !error && (
          <div className="py-6">
            <Spinner />
          </div>
        )
      ) : items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No conversations yet.</p>
      ) : (
        <ul className="divide-y divide-edge/70">
          {items.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-sage">
                    {c.first_name} <span className="font-normal text-muted">with</span> {c.member_name}
                    {!c.member_active && <span className="text-muted"> (no longer on the team)</span>}
                  </span>
                  <span className="text-[12px] text-muted">
                    {c.status === 'blocked'
                      ? 'Closed'
                      : c.waiting_since
                        ? `Waiting for a reply · ${waitedFor(c.waiting_since)}`
                        : c.last_at
                          ? `Last message ${waitedFor(c.last_at)} ago`
                          : 'No messages yet'}
                  </span>
                </span>
                {c.status === 'active' && moving !== c.id && (
                  <Button variant="ghost" size="sm" onClick={() => {
                      setMoving(c.id);
                      setTo('');
                    }}>
                    Move to…
                  </Button>
                )}
              </div>
              {moving === c.id && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`move-${c.id}`}>
                    Move {c.first_name}’s conversation to
                  </label>
                  <select
                    id={`move-${c.id}`}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-8 rounded-lg border border-edge bg-canvas px-2 text-[13px] text-sage"
                  >
                    <option value="">Choose someone…</option>
                    {team
                      .filter((m) => m.id !== c.member_id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                  <Button size="sm" onClick={() => void onMove(c)} disabled={!to || busy}>
                    Move
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMoving(null)}>
                    Cancel
                  </Button>
                  <span className="w-full text-[12px] text-muted">
                    The history moves with it. {c.first_name} sees a note that they’re now talking with someone
                    new.
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** "3 hours", "2 days". */
function waitedFor(since: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(since).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}
