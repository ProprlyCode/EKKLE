import { useEffect, useState } from 'react';
import { getOrganization } from '@/data/organizations';
import { useSession } from '@/auth/SessionProvider';
import type { Organization } from '@/data/platform';
import { ministryOutcomes, type MinistryOutcomes, type Range } from '@/data/outcomes';
import { Card } from '@/ui/Card';
import { Spinner, ErrorNote } from '@/ui/states';
import { PersonPhoto } from '@/components/TalkingTo';
import { Funnel, OutcomesTable, RangePicker } from '@/outcomes/Outcomes';
import { ConversationsCard } from './ConversationsCard';
import { GetStarted } from '@/components/GetStarted';
import { TourButton } from '@/tour/Tour';
import { ADMIN_TOUR, LEADER_TOUR } from '@/tour/tours';
import { isAccountAdmin } from '@/auth/roles';

/**
 * Leadership → Overview (Admins and Leaders): the ministry's outcomes — from a
 * shared link to a real connection, and studies — for the ministry and each
 * member (N4). Counts only, never message contents. Settings live in Account.
 */
export default function Overview() {
  const { membership } = useSession();
  const [range, setRange] = useState<Range>(90);
  const [outcomes, setOutcomes] = useState<MinistryOutcomes | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!membership) return;
    getOrganization(membership.org_id)
      .then(setOrg)
      .catch(() => setError('Couldn’t load the overview.'));
  }, [membership]);

  useEffect(() => {
    let active = true;
    ministryOutcomes(range)
      .then((o) => active && setOutcomes(o))
      .catch(() => active && setError('Couldn’t load the overview.'));
    return () => {
      active = false;
    };
  }, [range]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!outcomes || !org)
    return (
      <div className="py-16">
        <Spinner />
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl">Overview</h1>
          <p className="mt-1 text-sm text-muted-strong">What’s come of sharing across {org.name}.</p>
          <div className="mt-2">
            <TourButton
              steps={isAccountAdmin(membership?.role) ? ADMIN_TOUR : LEADER_TOUR}
              label="Tour of the leadership tabs"
            />
          </div>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>

      <GetStarted area="admin" />

      <Card className="flex flex-col gap-4">
        <span className="eyebrow">outcomes</span>
        <Funnel outcomes={outcomes.ministry} label={`Outcomes for ${org.name}`} />
      </Card>

      <Card className="p-0">
        <div className="border-b border-edge/70 px-5 py-3">
          <span className="eyebrow">by member</span>
        </div>
        {outcomes.members.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No members yet.</p>
        ) : (
          <OutcomesTable
            caption="Outcomes by member"
            nameHeader="Member"
            rows={outcomes.members.map((m) => ({
              id: m.id,
              name: (
                <span className="flex items-center gap-2">
                  <PersonPhoto name={m.name} photo={m.photo} size={24} />
                  {m.name}
                </span>
              ),
              outcomes: m.outcomes,
            }))}
          />
        )}
      </Card>

      <ConversationsCard orgId={org.id} />
    </div>
  );
}
