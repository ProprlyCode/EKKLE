import { useEffect, useState, type FormEvent } from 'react';
import { platformUrl } from '@/account/address';
import {
  inviteTeamMember,
  listTeam,
  reason,
  removeTeamMember,
  sendInvitation,
  setTeamRole,
  type TeamMember,
} from '@/data/platformTeam';
import type { PlatformRole } from '@/lib/database.types';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { ErrorNote, Spinner } from '@/ui/states';
import { PLATFORM_ROLE_LABEL, usePlatformRole } from './PlatformGate';

const ROLE_NOTE: Record<PlatformRole, string> = {
  owner: 'Everything, including the team',
  admin: 'Create and pause accounts',
  support: 'View only',
};

/**
 * Platform → Team: the Ekklē team. Everyone on it sees who's there; Owners
 * invite, change roles and remove — and the team always keeps an Owner.
 */
export default function Team() {
  const myRole = usePlatformRole();
  const isOwner = myRole === 'owner';
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    try {
      setTeam(await listTeam());
    } catch {
      setError('Couldn’t load the team.');
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function act(fn: () => Promise<void>, done: string) {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      await refresh();
    } catch (err) {
      setError(
        reason(err).includes('last_owner')
          ? 'The team needs at least one Owner.'
          : 'That didn’t work. Please try again.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl">Team</h1>
        <p className="mt-1 text-sm text-muted-strong">The people who run Ekklē.</p>
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-edge bg-card px-4 py-3 text-sm text-sage">
          {notice}
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}

      {team === null ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-edge/70">
            {team.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-sage">{m.name || m.email}</span>
                    {m.me && <span className="text-[11px] text-muted">you</span>}
                    {!m.joined && <span className="text-[11px] text-muted">invited</span>}
                  </span>
                  <span className="text-[13px] text-muted">{m.email}</span>
                </span>
                <span className="flex flex-wrap items-center gap-3 text-[13px]">
                  {isOwner && !m.me ? (
                    <select
                      aria-label={`Role for ${m.email}`}
                      value={m.role}
                      onChange={(e) =>
                        act(
                          () => setTeamRole(m.id, e.target.value as PlatformRole),
                          `${m.email} is now ${PLATFORM_ROLE_LABEL[e.target.value as PlatformRole]}.`,
                        )
                      }
                      className="rounded-lg border border-edge bg-canvas px-2 py-1 text-sm text-sage"
                    >
                      {(['owner', 'admin', 'support'] as const).map((r) => (
                        <option key={r} value={r}>
                          {PLATFORM_ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="eyebrow">{PLATFORM_ROLE_LABEL[m.role]}</span>
                  )}
                  {isOwner && !m.joined && (
                    <button
                      onClick={() =>
                        act(() => sendInvitation(m.email, platformUrl('/platform')), `Invitation sent again to ${m.email}.`)
                      }
                      className="text-sage underline decoration-sage/30 underline-offset-2 hover:decoration-sage"
                    >
                      Resend
                    </button>
                  )}
                  {isOwner && !m.me && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${m.email} from the Ekklē team?`))
                          void act(() => removeTeamMember(m.id), `${m.email} was removed.`);
                      }}
                      className="text-muted hover:text-sage"
                    >
                      Remove
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isOwner && <InviteForm onInvited={(msg) => { setNotice(msg); void refresh(); }} />}
    </div>
  );
}

function InviteForm({ onInvited }: { onInvited: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<PlatformRole>('support');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await inviteTeamMember(email, name, role);
      let msg = `${email.trim()} is invited as ${PLATFORM_ROLE_LABEL[role]}.`;
      try {
        await sendInvitation(email, platformUrl('/platform'));
        msg += ' We emailed them a sign-in.';
      } catch {
        msg += ' The email didn’t send — use “Resend”.';
      }
      setEmail('');
      setName('');
      onInvited(msg);
    } catch (err) {
      const r = reason(err);
      setError(
        r.includes('already_on_team')
          ? 'They’re already on the team.'
          : r.includes('invalid_email')
            ? 'Check the email address.'
            : 'Couldn’t invite them. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex max-w-lg flex-col gap-4">
      <h2 className="text-base">Invite to the team</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextInput label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-medium text-muted-strong">Role</legend>
          {(['support', 'admin', 'owner'] as const).map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-sage">
              <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="accent-sage" />
              <span className="font-medium">{PLATFORM_ROLE_LABEL[r]}</span>
              <span className="text-muted">— {ROLE_NOTE[r]}</span>
            </label>
          ))}
        </fieldset>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={busy || !email.trim()} className="self-start">
          {busy ? 'Inviting…' : 'Invite'}
        </Button>
      </form>
    </Card>
  );
}
