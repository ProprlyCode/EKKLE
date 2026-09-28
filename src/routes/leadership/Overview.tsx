import { useEffect, useState } from 'react';
import { getOrganization } from '@/data/organizations';
import { useSession } from '@/auth/SessionProvider';
import { getPlatformOverview, type PlatformOverview, type Organization } from '@/data/platform';
import { Card } from '@/ui/Card';
import { Spinner, ErrorNote } from '@/ui/states';

/**
 * Leadership → Overview (Admins and Leaders): the ministry's numbers
 * (settings live in Account, for Admins). Metadata only — never message contents. Product UI
 * (interface-design): flat depth, weight+opacity hierarchy, one clear read
 * per tile.
 */
export default function Overview() {
  const { membership } = useSession();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!membership) return;
    Promise.all([getPlatformOverview(), getOrganization(membership.org_id)])
      .then(([o, g]) => {
        setOverview(o);
        setOrg(g);
      })
      .catch(() => setError('Couldn’t load the overview.'));
  }, [membership]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!overview || !org)
    return (
      <div className="py-16">
        <Spinner />
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl">Overview</h1>
        <p className="mt-1 text-sm text-muted-strong">
          Everything happening across {org.name}.
        </p>
      </div>

      {/* Overview tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="studies started" value={overview.started} />
        <Stat label="completed" value={overview.completed} />
        <Stat label="reached out" value={overview.messaged} />
        <Stat label="connections made" value={overview.checkins.yes} />
      </div>

      {/* Per-member */}
      <Card className="p-0">
        <div className="border-b border-edge/70 px-5 py-3">
          <span className="eyebrow">by member</span>
        </div>
        {overview.members.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No members yet.</p>
        ) : (
          <ul className="divide-y divide-edge/70">
            {overview.members.map((m) => (
              <li key={m.code_slug} className="flex items-center justify-between px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-sage">{m.name}</span>
                  <span className="text-[12px] text-muted">/r/{m.code_slug}</span>
                </span>
                <span className="flex gap-5 text-right text-[13px] text-muted-strong">
                  <MiniStat label="started" value={m.started} />
                  <MiniStat label="reached out" value={m.messaged} />
                  <MiniStat label="chats" value={m.conversations} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col items-end">
      <span className="font-medium text-sage tabular-nums">{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </span>
  );
}
