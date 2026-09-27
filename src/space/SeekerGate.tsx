import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { linkSeekerAccount } from '@/data/seeker';
import { CenterLayout, ErrorNote, FullPageLoading } from '@/ui/states';
import { Wordmark } from '@/components/Wordmark';
import SeekerSignIn from './SeekerSignIn';

/**
 * Gate for the seeker area, Your space (/space/*). Not signed in → the seeker
 * sign-in. Signed in → ensure the account (recipient row) exists, then render.
 *
 * Deliberately separate from the member/leadership guards: a seeker has a
 * session but no membership, and must never be pushed into member onboarding.
 */
export default function SeekerGate() {
  const { ready, configured, session } = useSession();
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState(false);
  // Keyed on the person, not the session object: token refreshes and the
  // several auth events after a sign-in link must not re-link each time.
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      setLinked(false);
      return;
    }
    let active = true;
    setError(false);
    linkSeekerAccount()
      .then(() => active && setLinked(true))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [userId]);

  if (!configured)
    return (
      <CenterLayout>
        <Wordmark withTagline />
        <ErrorNote>Not connected to its database yet.</ErrorNote>
      </CenterLayout>
    );
  if (!ready) return <FullPageLoading />;
  if (!session) return <SeekerSignIn />;

  if (error)
    return (
      <CenterLayout>
        <ErrorNote>
          We couldn’t open your account just now. Please refresh to try again.
        </ErrorNote>
      </CenterLayout>
    );
  if (!linked) return <FullPageLoading />;

  return <Outlet />;
}
