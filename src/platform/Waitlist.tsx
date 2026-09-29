import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listWaitlist, type WaitlistEntry } from '@/data/platformTeam';
import { Card } from '@/ui/Card';
import { EmptyState, ErrorNote, Spinner } from '@/ui/states';
import { usePlatformRole } from './PlatformGate';

/**
 * Platform → Waitlist: who asked for Ekklē on ekkle.org. Owners and Admins can
 * turn an entry into an account (the create form, filled in).
 */
export default function Waitlist() {
  const role = usePlatformRole();
  const canCreate = role === 'owner' || role === 'admin';
  const [entries, setEntries] = useState<WaitlistEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWaitlist()
      .then(setEntries)
      .catch(() => setError('Couldn’t load the waitlist.'));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl">Waitlist</h1>
        <p className="mt-1 text-sm text-muted-strong">People who joined the waitlist on ekkle.org.</p>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {entries === null && !error ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : entries && entries.length === 0 ? (
        <EmptyState title="No one yet" note="Sign-ups from the homepage appear here." />
      ) : entries ? (
        <Card className="p-0">
          <ul className="divide-y divide-edge/70">
            {entries.map((w) => (
              <li key={w.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-sage">{w.ministry_name || '—'}</span>
                  <span className="text-[13px] text-muted">
                    {w.name} · {w.email} · {new Date(w.created_at).toLocaleDateString()}
                  </span>
                </span>
                {canCreate && (
                  <Link
                    to={`/platform?${new URLSearchParams({ new: '1', name: w.ministry_name, admin: w.name, email: w.email })}`}
                    className="text-[13px] text-sage underline decoration-sage/30 underline-offset-2 hover:decoration-sage"
                  >
                    Create account
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
