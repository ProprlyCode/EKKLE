import { useEffect, useState } from 'react';
import { myOutcomes, type Outcomes, type Range } from '@/data/outcomes';
import { Card } from '@/ui/Card';
import { Funnel, RangePicker } from './Outcomes';

/** A member's own outcomes, on their QR page (N4). */
export function MyOutcomes() {
  const [range, setRange] = useState<Range>(90);
  const [outcomes, setOutcomes] = useState<Outcomes | null>(null);

  useEffect(() => {
    let active = true;
    myOutcomes(range)
      .then((o) => active && setOutcomes(o))
      .catch(() => active && setOutcomes(null));
    return () => {
      active = false;
    };
  }, [range]);

  if (!outcomes) return null;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base">What’s come of your link</h2>
          <p className="mt-1 text-sm text-muted-strong">Counts only — what people wrote stays between you.</p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>
      <Funnel outcomes={outcomes} label="Your outcomes" />
    </Card>
  );
}
