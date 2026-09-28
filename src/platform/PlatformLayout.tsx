import { Outlet } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { AppShell, type NavItem } from '@/ui/AppShell';
import { Button } from '@/ui/Button';
import { PLATFORM_ROLE_LABEL, usePlatformRole } from './PlatformGate';

const NAV: NavItem[] = [
  { to: '/platform', label: 'Accounts' },
  { to: '/platform/outcomes', label: 'Outcomes' },
  { to: '/platform/team', label: 'Team' },
  { to: '/platform/studies', label: 'Studies', end: false },
  { to: '/platform/plans', label: 'Plans', end: false },
  { to: '/platform/prompts', label: 'Prompts' },
  { to: '/platform/waitlist', label: 'Waitlist' },
  { to: '/platform/settings', label: 'Settings' },
];

/** The Ekklē team's chrome on ekkle.org: its own tabs, never a ministry's. */
export default function PlatformLayout() {
  const { signOut } = useSession();
  const role = usePlatformRole();
  return (
    <AppShell
      // Studies, plans and prompts are kept by Owners and Admins.
      nav={role === 'support' ? NAV.filter((n) => !['/platform/studies', '/platform/plans', '/platform/prompts'].includes(n.to)) : NAV}
      right={
        <span className="flex items-center gap-3">
          {role && <span className="eyebrow">{PLATFORM_ROLE_LABEL[role]}</span>}
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </span>
      }
    >
      <Outlet />
    </AppShell>
  );
}
