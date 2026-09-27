import { Link, Navigate } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { Wordmark } from '@/components/Wordmark';
import { FullPageLoading } from '@/ui/states';
import { useAccount } from './AccountProvider';

/**
 * The front door of an account's address (<sub>.ekkle.org/). Signed-in
 * members and leaders go to the app; signed-in seekers to Your space;
 * everyone else is welcomed with the ways in.
 */
export default function AccountHome() {
  const { ready, session, membership } = useSession();
  const account = useAccount();

  if (!ready) return <FullPageLoading />;
  if (membership) return <Navigate to="/app" replace />;
  if (session) return <Navigate to="/space" replace />;

  const name = account.status === 'account' ? account.account.name : '';

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-10 px-5 py-16">
      <Wordmark />
      <div className="flex flex-col gap-3">
        <span className="eyebrow">welcome</span>
        <h1 className="font-serif text-4xl leading-tight text-sage">{name}</h1>
        <p className="text-[16px] leading-relaxed text-muted-strong">
          A quiet place to explore the Bible and talk with a real person — at your own pace.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          to="/offer"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-sage text-[15px] font-medium text-canvas transition-colors hover:bg-sage-soft"
        >
          Start free Bible studies
        </Link>
        <Link
          to="/space"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-edge bg-card text-[15px] text-sage transition-colors hover:border-sage/40"
        >
          Sign in to your space
        </Link>
      </div>

      <Link to="/sign-in" className="text-center text-[13px] text-muted hover:text-sage">
        Members &amp; leaders sign in
      </Link>
    </main>
  );
}
