import { useEffect, useState, type FormEvent } from 'react';
import {
  listMembers,
  inviteMember,
  setMemberActive,
  type Member,
} from '@/data/members';
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
