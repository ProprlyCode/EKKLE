import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { isLeader } from './roles';
import { AppShell, type NavItem } from '@/ui/AppShell';
import { Button } from '@/ui/Button';
import { CenterLayout, FullPageLoading } from '@/ui/states';
import { Wordmark } from '@/components/Wordmark';

/**
 * Route guards. Order of checks: Supabase configured → signed in → is a member →
 * (optionally) is leadership. Each failure routes somewhere sensible rather than
 * dead-ending.
 */

export function RequireAuth() {
  const { ready, configured, session } = useSession();
  const location = useLocation();

  if (!configured) return <NotConnected />;
  if (!ready) return <FullPageLoading />;
  if (!session)
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RequireMembership() {
  const { ready, session, membership } = useSession();
  if (!ready) return <FullPageLoading />;
  if (!session) return <Navigate to="/sign-in" replace />;
  if (!membership) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

export function RequireLeadership() {
  const { membership } = useSession();
  if (membership && !isLeader(membership.role))
    return <Navigate to="/app" replace />;
  return <Outlet />;
}

/** Authed chrome: role-aware nav + sign-out, wrapping the member/leader routes. */
export function AuthedLayout() {
  const { membership, signOut } = useSession();
  const leader = isLeader(membership?.role);

  const nav: NavItem[] = [
    { to: '/app', label: 'Your code' },
    { to: '/app/messages', label: 'Messages' },
    ...(leader
      ? [
          { to: '/leadership/content', label: 'Content' },
          { to: '/leadership/people', label: 'People' },
        ]
      : []),
  ];

  return (
    <AppShell
      nav={nav}
      right={
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      }
    >
      <Outlet />
    </AppShell>
  );
}

function NotConnected() {
  return (
    <CenterLayout>
      <Wordmark withTagline />
      <div className="card px-6 py-8 text-center">
        <h1 className="text-lg">Not connected yet</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-strong">
          This app isn’t linked to its database. Add the Supabase environment
          variables and redeploy, then this screen will step aside.
        </p>
      </div>
    </CenterLayout>
  );
}
