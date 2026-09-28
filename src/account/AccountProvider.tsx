import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';
import { accountUrl, isPlatformHost } from './address';
import { applyBranding } from './branding';

export interface Account {
  id: string;
  name: string;
  subdomain: string;
  custom_domain: string | null;
  kind: 'church' | 'personal_ministry';
  accent_color: string | null;
  logo_path: string | null;
  status: 'active' | 'suspended';
}

export type AccountState =
  | { status: 'loading' }
  | { status: 'platform' } // ekkle.org itself
  | { status: 'account'; account: Account }
  | { status: 'unknown' }; // an address no account uses

const AccountContext = createContext<AccountState>({ status: 'loading' });
const UpdateContext = createContext<(account: Account) => void>(() => {});

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
        const found = data as unknown as (Account & { moved_to?: string }) | null;
        if (error || !found) setState({ status: 'unknown' });
        // An old address (0043): go to the same page at the ministry's new one.
        else if (found.moved_to) {
          const { pathname, search, hash } = window.location;
          window.location.replace(accountUrl(found, `${pathname}${search}${hash}`));
        } else setState({ status: 'account', account: found });
      });
    return () => {
      active = false;
    };
  }, [state.status]);

  // Every page on the address wears the account's name, logo and accent.
  const account = state.status === 'account' ? state.account : null;
  useEffect(() => {
    if (account) applyBranding(account);
  }, [account]);

  return (
    <AccountContext.Provider value={state}>
      <UpdateContext.Provider value={(a) => setState({ status: 'account', account: a })}>
        {children}
      </UpdateContext.Provider>
    </AccountContext.Provider>
  );
}

/** Settings: show saved branding straight away, without a reload. */
export function useUpdateAccount() {
  return useContext(UpdateContext);
}

export function useAccount(): AccountState {
  return useContext(AccountContext);
}
