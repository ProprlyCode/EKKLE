import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';
import { isPlatformHost } from './address';

export interface Account {
  id: string;
  name: string;
  subdomain: string;
  custom_domain: string | null;
  kind: 'church' | 'personal_ministry';
}

export type AccountState =
  | { status: 'loading' }
  | { status: 'platform' } // ekkle.org itself
  | { status: 'account'; account: Account }
  | { status: 'unknown' }; // an address no account uses

const AccountContext = createContext<AccountState>({ status: 'loading' });

/**
 * Which account is this address? Resolved once at start-up from the hostname.
 * (The database scopes every lookup the same way, from the request's Origin.)
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>(() =>
    isPlatformHost() ? { status: 'platform' } : { status: 'loading' },
  );

  useEffect(() => {
    if (state.status !== 'loading') return;
    if (!isSupabaseConfigured) {
      setState({ status: 'unknown' });
      return;
    }
    let active = true;
    supabase
      .rpc('resolve_account', { p_host: window.location.host })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) setState({ status: 'unknown' });
        else setState({ status: 'account', account: data as unknown as Account });
      });
    return () => {
      active = false;
    };
  }, [state.status]);

  return <AccountContext.Provider value={state}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  return useContext(AccountContext);
}
