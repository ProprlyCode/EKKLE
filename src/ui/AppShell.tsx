import { NavLink } from 'react-router-dom';
import { BrandName } from '@/components/BrandName';
import { cn } from '@/lib/cn';

/**
 * Church-side chrome: top wordmark + a few quiet tabs, content centered like a
 * page. Mobile-first — the tab row wraps and stays touch-sized on narrow
 * screens; no sidebar. Sage wordmark is the only strong mark up top.
 */

export interface NavItem {
  to: string;
  label: string;
}

export function AppShell({
  nav,
  right,
  children,
}: {
  nav: NavItem[];
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full">
      <header className="border-b border-edge/70">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 pt-5 pb-0 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7" />
              <BrandName className="font-serif text-xl font-medium tracking-tight text-sage" />
            </span>
            {right && <div className="sm:hidden">{right}</div>}
          </div>
          <div className="hidden sm:block">{right}</div>
        </div>
        <nav className="mx-auto max-w-3xl px-4">
          <ul className="flex flex-wrap gap-1 pb-0">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'inline-block px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
                      isActive
                        ? 'border-sage text-sage'
                        : 'border-transparent text-muted hover:text-sage',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
