import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';

/**
 * Chrome for the seeker study account (dashboard / messages / account). Quiet,
 * brand-led top bar — a signed-in home for study-takers, distinct from the
 * member/leadership AppShell. The reader itself stays immersive (no bar).
 */
export default function SeekerLayout() {
  const { signOut } = useSession();

  const tabs = [
    { to: '/studies', label: 'Studies', end: true },
    { to: '/studies/connection', label: 'Messages' },
    { to: '/studies/account', label: 'Account' },
  ];

  return (
    <div className="min-h-full bg-canvas">
      <header className="sticky top-0 z-10 border-b border-edge/70 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7" />
            <nav className="flex items-center gap-1">
              {tabs.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    'rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ' +
                    (isActive
                      ? 'font-medium text-sage'
                      : 'text-muted hover:text-sage')
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <button
            onClick={() => void signOut()}
            className="text-[13px] text-muted transition-colors hover:text-sage"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}
