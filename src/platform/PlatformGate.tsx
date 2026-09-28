import { createContext, useContext, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { claimPlatformSeat, markPlatformPasswordSet, type PlatformSeat } from '@/data/platformTeam';
import { setMyPassword } from '@/data/auth';
import { TextInput } from '@/ui/Field';
import type { PlatformRole } from '@/lib/database.types';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/ui/Button';
import { CenterLayout, ErrorNote, FullPageLoading } from '@/ui/states';

const RoleContext = createContext<PlatformRole | null>(null);

/** My role on the Ekklē team (inside the platform area). */
export function usePlatformRole(): PlatformRole | null {
  return useContext(RoleContext);
}

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  support: 'Support',
};

/**
 * ekkle.org/platform is for the Ekklē team only (platform_team). Signed out →
 * sign in; signed in but not on the team → a plain note pointing to Find your
 * church or ministry. An invitation is linked to the login here. The first
 * sign-in is by emailed code; a team member then sets a password before
 * reaching the console (and signs in with it from then on).
 */
export function PlatformGate() {
  const { ready, session, signOut } = useSession();
  const location = useLocation();
  const [seat, setSeat] = useState<PlatformSeat | null | undefined>(undefined);

  // Only when the signed-in person changes — not on every session refresh
  // (saving a password refreshes it, mid-way through the password step).
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    claimPlatformSeat()
      .then((r) => active && setSeat(r))
      .catch(() => active && setSeat(null));
    return () => {
      active = false;
    };
  }, [userId]);

  if (!ready) return <FullPageLoading />;
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  if (seat === undefined) return <FullPageLoading />;
  if (seat === null)
    return (
      <CenterLayout>
        <Wordmark />
        <div className="card flex flex-col gap-4 px-6 py-8 text-center">
          <h1 className="text-lg">This is the Ekklē team’s area</h1>
          <p className="text-sm leading-relaxed text-muted-strong">
            {session.user.email} isn’t on the Ekklē team. Your church or ministry has its own
            address — find it to sign in there.
          </p>
          <Link to="/find" className="text-sm text-sage underline-offset-2 hover:underline">
            Find your church or ministry
          </Link>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </CenterLayout>
    );

  if (!seat.password_set)
    return <SetPassword email={session.user.email ?? ''} onDone={() => setSeat({ ...seat, password_set: true })} />;

  return (
    <RoleContext.Provider value={seat.role}>
      <Outlet />
    </RoleContext.Provider>
  );
}

/** First sign-in on the Ekklē team: choose the password used from now on. */
function SetPassword({ email, onDone }: { email: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError('Use at least 10 characters.');
    if (password !== confirm) return setError('Those passwords don’t match.');
    setSaving(true);
    try {
      await setMyPassword(password);
      await markPlatformPasswordSet();
      onDone();
    } catch {
      setSaving(false);
      setError('We couldn’t save that password. Please try again.');
    }
  }

  return (
    <CenterLayout>
      <Wordmark />
      <div className="card w-full px-6 py-8">
        <div className="mb-4">
          <h1 className="text-lg">Set your password</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-strong">
            You’re on the Ekklē team as {email}. Choose a password — you’ll sign in with it
            from now on.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextInput
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 10 characters."
          />
          <TextInput
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={saving || !password || !confirm}>
            {saving ? 'Saving…' : 'Save and continue'}
          </Button>
        </form>
      </div>
    </CenterLayout>
  );
}
