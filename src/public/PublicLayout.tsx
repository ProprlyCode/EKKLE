import { Link } from 'react-router-dom';
import { BrandName } from '@/components/BrandName';
import { appConfig } from '@/config/app';

/**
 * Public marketing chrome for the home pages — brand-guide-led (editorial,
 * reverent), separate from the authed product shell and the recipient view.
 */
export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <header className="border-b border-edge/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7" />
            <BrandName className="font-serif text-xl font-medium tracking-tight text-sage" />
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              to="/for-churches"
              className="text-muted-strong transition-colors hover:text-sage"
            >
              For churches
            </Link>
            <Link
              to="/sign-in"
              className="text-muted-strong transition-colors hover:text-sage"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-edge/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 py-8 text-center">
          <span className="eyebrow">{appConfig.tagline}</span>
          <p className="text-[13px] text-muted">
            {appConfig.brandName} — a quiet place for real conversations.
          </p>
        </div>
      </footer>
    </div>
  );
}
