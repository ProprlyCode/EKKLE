import { useEffect, useState } from 'react';
import { platformOutcomes, type Outcomes, type Range } from '@/data/outcomes';
import { Card } from '@/ui/Card';
import { ErrorNote, Spinner } from '@/ui/states';
import { Funnel, OutcomesTable, RangePicker } from '@/outcomes/Outcomes';
import { sumOutcomes } from '@/outcomes/steps';

/** Platform → Outcomes: every ministry, and all of them together (N4). Counts only. */
export default function PlatformOutcomes() {
  const [range, setRange] = useState<Range>(90);
  const [rows, setRows] = useState<Array<{ id: string; name: string; outcomes: Outcomes }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    platformOutcomes(range)
      .then((r) => active && setRows(r))
      .catch(() => active && setError('Couldn’t load outcomes.'));
    return () => {
      active = false;
    };
  }, [range]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!rows)
    return (
      <div className="py-16">
        <Spinner />
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl">Outcomes</h1>
          <p className="mt-1 text-sm text-muted-strong">Every ministry, from a shared link to a real connection.</p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>
      <Card className="flex flex-col gap-4">
        <span className="eyebrow">all ministries</span>
        <Funnel outcomes={sumOutcomes(rows.map((r) => r.outcomes))} label="Outcomes across all ministries" />
      </Card>
      <Card className="p-0">
        <div className="border-b border-edge/70 px-5 py-3">
          <span className="eyebrow">by ministry</span>
        </div>
        <OutcomesTable caption="Outcomes by ministry" nameHeader="Ministry" rows={rows} />
      </Card>
    </div>
  );
}
