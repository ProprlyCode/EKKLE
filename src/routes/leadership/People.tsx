import { useEffect, useState, type FormEvent } from 'react';
import {
  listMembers,
  inviteMember,
  setMemberActive,
  setMemberRole,
  removeMember,
  memberConversationCount,
  type Member,
} from '@/data/members';
import { sendInvitation } from '@/data/auth';
import { listReports, resolveReport, type IncidentReport } from '@/data/reports';
import { useSession } from '@/auth/SessionProvider';
import { useAccount } from '@/account/AccountProvider';
import { accountUrl } from '@/account/address';
import type { Role } from '@/lib/database.types';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { EmptyState, ErrorNote, Spinner } from '@/ui/states';
import { isAccountAdmin, ROLE_LABEL } from '@/auth/roles';

const ROLE_NOTE: Record<Role, string> = {
  admin: 'Everything, including settings and the team',
  leader: 'Content, resources and people',
  member: 'Their own link and conversations',
};

/**
 * Leadership → People (Admins and Leaders). A calm roster (not a data grid):
 * name leading, role and link demoted, quiet actions. Leaders invite, pause
 * and remove Members; Admins invite and manage anyone and change roles
 * (docs/accounts-and-roles.md). Invitations are emailed from here.
 */
export default function People() {
  const { membership } = useSession();
  const account = useAccount();
  const admin = isAccountAdmin(membership?.role);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const orgId = membership?.org_id;
  // Where invitations land: this ministry's app, on its own address.
  const landing = account.status === 'account' ? accountUrl(account.account, '/app') : `${window.location.origin}/app`;

  async function refresh() {
    if (!orgId) return;
    try {
      setMembers(await listMembers(orgId));
    } catch {
      setError('Couldn’t load the roster.');
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function act(fn: () => Promise<unknown>, done: string) {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      await refresh();
    } catch (err) {
      const msg = (err as { message?: string } | null)?.message ?? '';
      setError(
        msg.includes('last_admin')
          ? 'Your ministry needs at least one Admin.'
          : msg.includes('has_conversations')
            ? 'Choose a teammate to hand their conversations to.'
            : msg.includes('over_email_send_rate_limit') || (err as { status?: number }).status === 429
            ? 'An email just went to them — try again in a minute.'
            : 'That didn’t work. Please try again.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl">People</h1>
        <p className="mt-1 text-sm text-muted-strong">
          Everyone who can share in your ministry’s space.
        </p>
      </div>

      <IncidentReports />

      <InviteForm
        admin={admin}
        landing={landing}
        onInvited={async (msg) => {
          setNotice(msg);
          await refresh();
        }}
      />

      {notice && (
        <p role="status" className="rounded-lg border border-edge bg-card px-4 py-3 text-sm text-sage">
          {notice}
        </p>
      )}
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
              <MemberRow
                key={m.id}
                member={m}
                me={m.id === membership?.id}
                admin={admin}
                onAct={act}
                landing={landing}
                teammates={members.filter((t) => t.id !== m.id && t.active && t.auth_uid)}
              />
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
  me,
  admin,
  landing,
  teammates,
  onAct,
}: {
  member: Member;
  me: boolean;
  admin: boolean;
  landing: string;
  /** Who a removed person's conversations can be handed to. */
  teammates: Member[];
  onAct: (fn: () => Promise<unknown>, done: string) => Promise<void>;
}) {
  const pending = member.auth_uid === null;
  // Leaders manage Members; Admins manage anyone (never themselves here).
  const canManage = !me && (admin || member.role === 'member');
  const [removing, setRemoving] = useState(false);

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-sage">{member.name}</span>
            {me && <span className="text-[11px] text-muted">you</span>}
            {!(admin && canManage) && (
              <span className="eyebrow text-[10px]">{ROLE_LABEL[member.role]}</span>
            )}
            {!member.active && !pending && <span className="text-[11px] text-muted">paused</span>}
            {pending && <span className="text-[11px] text-muted">invited</span>}
          </div>
          <p className="truncate text-[13px] text-muted">
            {pending ? member.email : `/r/${member.code_slug}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          {admin && canManage && (
            <label className="flex items-center gap-2 text-muted-strong">
              Role
              <select
                aria-label={`Role for ${member.name}`}
                value={member.role}
                onChange={(e) =>
                  onAct(
                    () => setMemberRole(member.id, e.target.value as Role),
                    `${member.name} is now ${ROLE_LABEL[e.target.value as Role]}.`,
                  )
                }
                className="rounded-lg border border-edge bg-canvas px-2 py-1 text-sm text-sage"
              >
                {(['member', 'leader', 'admin'] as const).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {canManage && pending && member.email && (
            <button
              onClick={() => onAct(() => sendInvitation(member.email!, landing), `Invitation sent again to ${member.email}.`)}
              className="text-sage underline-offset-2 hover:underline"
            >
              Resend
            </button>
          )}
          {canManage && !pending && (
            <button
              onClick={() =>
                onAct(
                  () => setMemberActive(member.id, !member.active),
                  member.active ? `${member.name} is paused.` : `${member.name} is active again.`,
                )
              }
              className="text-muted hover:text-sage"
            >
              {member.active ? 'Pause' : 'Restore'}
            </button>
          )}
          {canManage && !removing && (
            <button onClick={() => setRemoving(true)} className="text-muted hover:text-sage">
              Remove
            </button>
          )}
        </div>
      </div>
      {removing && (
        <RemovePanel
          member={member}
          pending={pending}
          teammates={teammates}
          onCancel={() => setRemoving(false)}
          onRemove={(handTo) =>
            onAct(
              () => removeMember(member.id, handTo),
              pending ? `The invitation to ${member.email} is removed.` : `${member.name} was removed from the team.`,
            )
          }
        />
      )}
    </li>
  );
}

/**
 * Confirm a removal. Someone who has joined loses access and their link;
 * their conversations must go to a teammate (they're never deleted).
 */
function RemovePanel({
  member,
  pending,
  teammates,
  onCancel,
  onRemove,
}: {
  member: Member;
  pending: boolean;
  teammates: Member[];
  onCancel: () => void;
  onRemove: (handTo: string | null) => Promise<void>;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [handTo, setHandTo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    memberConversationCount(member.id)
      .then(setCount)
      .catch(() => setCount(0));
  }, [member.id]);

  const needsHandTo = (count ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-edge bg-canvas px-4 py-3 text-sm text-muted-strong">
      {count === null ? (
        <Spinner />
      ) : pending && !needsHandTo ? (
        <p>Remove the invitation to {member.email}?</p>
      ) : (
        <>
          <p>
            Remove {member.name} from the team? They’ll lose access, and their link will stop working.
          </p>
          {needsHandTo && (
            <label className="flex flex-col gap-1.5">
              <span>
                {member.name} has {count} {count === 1 ? 'conversation' : 'conversations'}. Hand{' '}
                {count === 1 ? 'it' : 'them'} to:
              </span>
              <select
                aria-label="Hand conversations to"
                value={handTo}
                onChange={(e) => setHandTo(e.target.value)}
                className="rounded-lg border border-edge bg-card px-2 py-1.5 text-sm text-sage sm:max-w-xs"
              >
                <option value="">Choose a teammate…</option>
                {teammates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={busy || count === null || (needsHandTo && !handTo)}
          onClick={async () => {
            setBusy(true);
            await onRemove(needsHandTo ? handTo : null);
            setBusy(false);
          }}
        >
          {pending && !needsHandTo ? 'Remove invitation' : `Remove ${member.name}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Keep
        </Button>
      </div>
    </div>
  );
}

function InviteForm({
  admin,
  landing,
  onInvited,
}: {
  admin: boolean;
  landing: string;
  onInvited: (msg: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await inviteMember(name, email, admin ? role : 'member');
      let msg = `${email.trim()} is invited${admin && role !== 'member' ? ` as ${ROLE_LABEL[role]}` : ''}.`;
      try {
        await sendInvitation(email, landing);
        msg += ' We emailed them an invitation.';
      } catch {
        msg += ' The email didn’t send — use “Resend”.';
      }
      setName('');
      setEmail('');
      setRole('member');
      await onInvited(msg);
    } catch (err) {
      const m = (err as { message?: string } | null)?.message ?? '';
      setError(
        m.includes('already_member')
          ? 'They’re already on your team (or invited).'
          : 'Couldn’t invite them. Check the email and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base">Invite someone</h2>
        <p className="mt-1 text-sm text-muted-strong">
          We’ll email them an invitation; they join when they open it.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextInput label="Name" className="sm:w-40" value={name} onChange={(e) => setName(e.target.value)} />
          <TextInput
            label="Email"
            type="email"
            className="flex-1"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="them@ministry.org"
          />
          {!admin && (
            <Button type="submit" disabled={busy || !email}>
              {busy ? 'Inviting…' : 'Invite'}
            </Button>
          )}
        </div>
        {admin && (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] font-medium text-muted-strong">Role</legend>
              {(['member', 'leader', 'admin'] as const).map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-sage">
                  <input type="radio" name="invite-role" checked={role === r} onChange={() => setRole(r)} className="accent-sage" />
                  <span className="font-medium">{ROLE_LABEL[r]}</span>
                  <span className="text-muted">— {ROLE_NOTE[r]}</span>
                </label>
              ))}
            </fieldset>
            <Button type="submit" disabled={busy || !email} className="self-start">
              {busy ? 'Inviting…' : 'Invite'}
            </Button>
          </>
        )}
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  );
}
