import { useEffect, useState, type FormEvent } from 'react';
import {
  listMembers,
  inviteMember,
  setMemberActive,
  type Member,
} from '@/data/members';
import { listReports, resolveReport, type IncidentReport } from '@/data/reports';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { EmptyState, ErrorNote, Spinner } from '@/ui/states';

/**
 * Leadership → People. A calm roster (not a data grid): each member is a row
 * with name leading, role/handle demoted, and one quiet action. Invite by email;
 * self-signups can be paused.
 */
export default function People() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setMembers(await listMembers());
    } catch {
      setError('Couldn’t load the roster.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl">People</h1>
        <p className="mt-1 text-sm text-muted-strong">
          Everyone who can share in your church’s space.
        </p>
      </div>

      <IncidentReports />

      <InviteForm onInvited={refresh} />

      {error && <ErrorNote>{error}</ErrorNote>}

      {members === null ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          title="No one yet"
          note="Invite someone by email, or share your join code so they can add themselves."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-edge/70">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} onChanged={refresh} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function IncidentReports() {
  const [reports, setReports] = useState<IncidentReport[] | null>(null);
  const [showReviewed, setShowReviewed] = useState(false);

  async function refresh() {
    try {
      setReports(await listReports());
    } catch {
      setReports([]);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  if (reports === null || reports.length === 0) return null;

  const open = reports.filter((r) => !r.reviewed);
  const shown = showReviewed ? reports : open;

  async function markReviewed(id: string) {
    setReports((rs) => rs?.map((r) => (r.id === id ? { ...r, reviewed: true } : r)) ?? rs);
    try {
      await resolveReport(id);
    } catch {
      void refresh();
    }
  }

  return (
    <Card className="border-amber-700/30 p-0">
      <div className="flex items-center justify-between border-b border-edge/70 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="eyebrow">incident reports</span>
          {open.length > 0 && (
            <span className="rounded-full bg-amber-700/15 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              {open.length} to review
            </span>
          )}
        </div>
        <button
          onClick={() => setShowReviewed((v) => !v)}
          className="text-[12px] text-muted transition-colors hover:text-sage"
        >
          {showReviewed ? 'Hide resolved' : 'Show all'}
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted">Nothing needs review right now.</p>
      ) : (
        <ul className="divide-y divide-edge/70">
          {shown.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm text-sage">
                  {r.reporter_type === 'member' ? r.member_name : r.recipient_name || 'A recipient'}{' '}
                  <span className="text-muted">reported this conversation</span>
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Between {r.member_name} and {r.recipient_name || 'a recipient'} ·{' '}
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
                {r.reason && (
                  <p className="mt-1.5 rounded-lg border border-edge bg-canvas px-3 py-2 text-[13px] text-muted-strong">
                    “{r.reason}”
                  </p>
                )}
              </div>
              {r.reviewed ? (
                <span className="shrink-0 text-[12px] uppercase tracking-eyebrow text-muted">
                  Resolved
                </span>
              ) : (
                <Button variant="quiet" size="sm" onClick={() => void markReviewed(r.id)}>
                  Mark reviewed
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-edge/70 px-5 py-3 text-[12px] text-muted">
        You see who reported and their note — never the messages themselves.
      </p>
    </Card>
  );
}

function MemberRow({
  member,
  onChanged,
}: {
  member: Member;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const pending = member.auth_uid === null;

  async function toggleActive() {
    setBusy(true);
    try {
      await setMemberActive(member.id, !member.active);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sage">{member.name}</span>
          {member.role === 'platform_admin' && (
            <span className="eyebrow text-[10px]">admin</span>
          )}
          {member.role === 'leadership' && (
            <span className="eyebrow text-[10px]">leader</span>
          )}
          {!member.active && (
            <span className="text-[11px] text-muted">paused</span>
          )}
          {pending && member.active && (
            <span className="text-[11px] text-muted">invited</span>
          )}
        </div>
        <p className="truncate text-[13px] text-muted">/r/{member.code_slug}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleActive}
        disabled={busy}
      >
        {member.active ? 'Pause' : 'Restore'}
      </Button>
    </li>
  );
}

function InviteForm({ onInvited }: { onInvited: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await inviteMember(name, email);
      setName('');
      setEmail('');
      setDone(true);
      setTimeout(() => setDone(false), 1600);
      await onInvited();
    } catch {
      setError('Couldn’t send that invite. Check the email and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base">Invite someone</h2>
        <p className="mt-1 text-sm text-muted-strong">
          They’ll be linked when they first sign in with this email.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextInput
          label="Name"
          className="sm:w-40"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextInput
          label="Email"
          type="email"
          className="flex-1"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="them@church.org"
        />
        <Button type="submit" disabled={busy || !email}>
          {busy ? 'Inviting…' : done ? 'Invited' : 'Invite'}
        </Button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  );
}
