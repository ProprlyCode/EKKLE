import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';
import { getMyMembership, type Member } from '@/data/members';

/**
 * Auth + membership context for the church side.
 *
 * Two layers of identity:
 *  - `session`   — the Supabase auth session (email verified via magic link)
 *  - `membership`— the app `users` row (role, code_slug, message). A signed-in
 *    person may have a session but no membership yet (needs onboarding).
 */
interface SessionState {
  ready: boolean; // initial load settled
  configured: boolean; // Supabase env present
  session: Session | null;
  membership: Member | null;
  refreshMembership: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Member | null>(null);

  const loadMembership = useCallback(async (active: Session | null) => {
    if (!active) {
      setMembership(null);
      return;
    }
    try {
      setMembership(await getMyMembership());
    } catch {
      setMembership(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadMembership(data.session);
      if (mounted) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, next) => {
      if (!mounted) return;
      setSession(next);
      await loadMembership(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadMembership]);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      configured: isSupabaseConfigured,
      session,
      membership,
      refreshMembership: () => loadMembership(session),
      signOut: async () => {
        await supabase.auth.signOut();
        setMembership(null);
      },
    }),
    [ready, session, membership, loadMembership],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
