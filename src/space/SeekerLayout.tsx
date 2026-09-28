import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { markStarted } from '@/data/gettingStarted';
import { AccountLogo } from '@/account/AccountMark';

/**
 * Chrome for Your space (/space) — a person's own signed-in home: their
 * conversation, their studies, the Bible, resources, and (top corner) their
 * account, where sign out lives. Wider screens get a quiet top bar; phones get
 * an app-style bottom tab bar, so all five fit and it feels right once
 * installed. The study reader stays immersive (no bar).
 */
const TABS = [
  { to: '/space', label: 'Home', end: true },
  { to: '/space/messages', label: 'Messages' },
  { to: '/space/studies', label: 'Studies' },
  { to: '/space/bible', label: 'Bible' },
  { to: '/space/resources', label: 'Resources' },
];

export default function SeekerLayout() {
  // Get started: opened from the home screen, so it's installed.
  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) void markStarted('seeker', 'install').catch(() => undefined);
  }, []);

  return (
    <div className="min-h-full bg-canvas">
      <header className="sticky top-0 z-10 border-b border-edge/70 bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3">
          <AccountLogo className="h-7 shrink-0" />
          <span className="font-serif text-[17px] text-sage sm:hidden">Your space</span>
          <nav aria-label="Your space" className="hidden items-center gap-1 sm:flex">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  'rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ' +
                  (isActive ? 'font-medium text-sage' : 'text-muted hover:text-sage')
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/space/account" className="ml-auto text-[13px] text-muted hover:text-sage">
            Account
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-28 pt-8 sm:pb-8">
        <Outlet />
      </main>

      <nav
        aria-label="Your space"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-edge/70 bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                'flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] transition-colors ' +
                (isActive ? 'font-medium text-sage' : 'text-muted')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className={'h-1 w-5 rounded-full ' + (isActive ? 'bg-accent' : 'bg-transparent')}
                  />
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
