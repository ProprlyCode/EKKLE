import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { claimPlatformSeat } from '@/data/platformTeam';
import type { PlatformRole } from '@/lib/database.types';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/ui/Button';
import { CenterLayout, FullPageLoading } from '@/ui/states';

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
 * church or ministry. An invitation is linked to the login here.
 */
export function PlatformGate() {
  const { ready, session, signOut } = useSession();
  const location = useLocation();
  const [role, setRole] = useState<PlatformRole | null | undefined>(undefined);

  useEffect(() => {
    if (!session) return;
    let active = true;
    claimPlatformSeat()
      .then((r) => active && setRole(r))
      .catch(() => active && setRole(null));
    return () => {
      active = false;
    };
  }, [session]);

  if (!ready) return <FullPageLoading />;
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  if (role === undefined) return <FullPageLoading />;
  if (role === null)
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

  return (
    <RoleContext.Provider value={role}>
      <Outlet />
    </RoleContext.Provider>
  );
}
