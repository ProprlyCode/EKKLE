import { useEffect, useState } from 'react';
import { accountUrl } from '@/account/address';
import { listPlatformAccounts, type PlatformAccount } from '@/data/platformTeam';
import { Card } from '@/ui/Card';
import { EmptyState, ErrorNote, Spinner } from '@/ui/states';

const KIND: Record<PlatformAccount['kind'], string> = {
  church: 'Church',
  personal_ministry: 'Personal ministry',
};

/**
 * Platform → Accounts: every ministry on Ekklē, with metadata only — team size,
 * seekers, studies, conversations, connections. Never message contents, never
 * seekers' names or emails (docs/accounts-and-roles.md).
 */
export default function Accounts() {
  const [accounts, setAccounts] = useState<PlatformAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPlatformAccounts()
      .then(setAccounts)
      .catch(() => setError('Couldn’t load the accounts.'));
  }, []);

  const totals = accounts?.reduce(
    (t, a) => ({
      seekers: t.seekers + a.seekers,
      conversations: t.conversations + a.conversations,
      connections: t.connections + a.connections,
    }),
    { seekers: 0, conversations: 0, connections: 0 },
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl">Accounts</h1>
        <p className="mt-1 text-sm text-muted-strong">
          Every church and ministry on Ekklē. Numbers only — conversations stay private.
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {accounts === null && !error ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : accounts && accounts.length === 0 ? (
        <EmptyState title="No accounts yet" note="Ministry accounts will appear here." />
      ) : accounts && totals ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="accounts" value={accounts.length} />
            <Stat label="seekers" value={totals.seekers} />
            <Stat label="conversations" value={totals.conversations} />
            <Stat label="connections made" value={totals.connections} />
          </div>
          <Card className="p-0">
            <ul className="divide-y divide-edge/70">
              {accounts.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-sage">{a.name}</span>
                      <span className="eyebrow text-[10px]">{KIND[a.kind]}</span>
                      {a.admins === 0 && <span className="text-[11px] text-sage">no admin</span>}
                    </span>
                    <a
                      href={accountUrl(a)}
                      className="text-[13px] text-muted underline-offset-2 hover:text-sage hover:underline"
                    >
                      {new URL(accountUrl(a)).host}
                    </a>
                  </span>
                  <span className="flex gap-5 text-right text-[13px] text-muted-strong">
                    <Mini label="team" value={a.team} />
                    <Mini label="seekers" value={a.seekers} />
                    <Mini label="studies" value={a.studies_started} />
                    <Mini label="chats" value={a.conversations} />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-edge bg-card px-4 py-4">
      <div className="font-serif text-2xl font-medium text-sage tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-muted">{label}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col items-end">
      <span className="font-medium text-sage tabular-nums">{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </span>
  );
}
