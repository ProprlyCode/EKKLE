import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/auth/SessionProvider';
import { claimPlatformSeat } from '@/data/platformTeam';
import { Wordmark } from '@/components/Wordmark';
import { TextInput } from '@/ui/Field';
import { accountUrl, type AccountAddress } from './address';

interface Found extends AccountAddress {
  name: string;
}

/**
 * ekkle.org is Ekklē itself; churches and ministries each have their own
 * address. Anyone who lands on an account page here (an old link, a bookmark,
 * signing in) is helped to the right place: straight to their own account if
 * we know it, otherwise by name.
 */
export default function FindAccount() {
  const { pathname, search } = useLocation();
  const { membership, session } = useSession();
  // The Ekklē team signs in on ekkle.org itself, not on a ministry's address.
  const [onTeam, setOnTeam] = useState(false);
  const [mine, setMine] = useState<Found | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[]>([]);
  const target = `${pathname}${search}`;

  // A signed-in member: we know their account.
  useEffect(() => {
    if (!membership) return;
    let active = true;
    supabase
      .from('organizations')
      .select('name, subdomain, custom_domain')
      .eq('id', membership.org_id)
      .maybeSingle()
      .then(({ data }) => active && data && setMine(data as Found));
    return () => {
      active = false;
    };
  }, [membership]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    claimPlatformSeat()
      .then((seat) => active && setOnTeam(!!seat))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      supabase.rpc('find_accounts', { p_query: query }).then(({ data }) => {
        if (active) setResults(((data as unknown as Found[]) ?? []).slice(0, 10));
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  // "Sign in" on ekkle.org leads here: the Ekklē team goes straight to its console.
  if (onTeam && pathname === '/find') return <Navigate to="/platform" replace />;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-5 py-16">
      <Wordmark />
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl leading-tight text-sage">Find your church or ministry</h1>
        <p className="text-[15px] leading-relaxed text-muted-strong">
          Each church and ministry on Ekklē has its own address. Find yours to continue.
        </p>
      </div>

      {onTeam && (
        <Link
          to="/platform"
          className="card flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-sage/40"
        >
          <span>
            <span className="block text-[12px] uppercase tracking-wide text-muted">Ekklē team</span>
            <span className="font-serif text-lg text-sage">Go to the console</span>
          </span>
          <span aria-hidden className="text-muted">→</span>
        </Link>
      )}

      {mine && (
        <a
          href={accountUrl(mine, target)}
          className="card flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:border-sage/40"
        >
          <span>
            <span className="block text-[12px] uppercase tracking-wide text-muted">Your account</span>
            <span className="font-serif text-lg text-sage">{mine.name}</span>
          </span>
          <span aria-hidden className="text-muted">→</span>
        </a>
      )}

      <div className="flex flex-col gap-3">
        <TextInput
          label="Church or ministry name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="organization"
        />
        {results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((r) => (
              <li key={r.subdomain}>
                <a
                  href={accountUrl(r, target)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-card px-4 py-3 text-[15px] text-sage transition-colors hover:border-sage/40"
                >
                  <span className="truncate">{r.name}</span>
                  <span aria-hidden className="text-muted">→</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && results.length === 0 && (
          <p className="text-[13px] text-muted">No match yet — check the spelling, or ask whoever invited you for the link.</p>
        )}
      </div>

      {!session && (
        <Link to="/sign-in" className="text-center text-[13px] text-muted hover:text-sage">
          On the Ekklē team? Sign in here
        </Link>
      )}
    </main>
  );
}
