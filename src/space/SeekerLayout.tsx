import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';

/**
 * Chrome for Your space (/space) — a seeker's own signed-in home: their
 * conversation, their studies, and their account. Quiet, brand-led top bar,
 * distinct from the member/leadership AppShell. The study reader stays
 * immersive (no bar).
 */
export default function SeekerLayout() {
  const { signOut } = useSession();

  const tabs = [
    { to: '/space', label: 'Home', end: true },
    { to: '/space/messages', label: 'Messages' },
    { to: '/space/studies', label: 'Studies' },
    { to: '/space/account', label: 'Account' },
  ];

  return (
    <div className="min-h-full bg-canvas">
      <header className="sticky top-0 z-10 border-b border-edge/70 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
            <nav aria-label="Your space" className="flex min-w-0 items-center overflow-x-auto">
              {tabs.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    'shrink-0 rounded-lg px-2 py-1.5 text-[13px] transition-colors sm:px-2.5 ' +
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
            className="shrink-0 text-[13px] text-muted transition-colors hover:text-sage"
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
