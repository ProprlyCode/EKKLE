import { useEffect, useState } from 'react';
import { flowOutcomes, type FlowOutcome } from '@/data/situations';
import type { Range } from '@/data/outcomes';
import { Card } from '@/ui/Card';

/**
 * Overview → by flow and situation (0049): which introductions people open,
 * finish and write from. Counts only.
 */
export function FlowOutcomes({ range }: { range: Range }) {
  const [rows, setRows] = useState<FlowOutcome[] | null>(null);
  useEffect(() => {
    let live = true;
    flowOutcomes(range)
      .then((r) => live && setRows(r))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [range]);

  if (!rows || rows.length < 2) return null;
  const caption = 'Outcomes by flow and situation';
  return (
    <Card className="p-0">
      <div className="border-b border-edge/70 px-5 py-3">
        <span className="eyebrow">by flow and situation</span>
      </div>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full min-w-[480px] text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-edge/70 text-left text-[11px] uppercase tracking-eyebrow text-muted">
              <th scope="col" className="px-5 py-2 font-normal">Flow</th>
              <th scope="col" className="px-2 py-2 text-right font-normal">Opened</th>
              <th scope="col" className="px-2 py-2 text-right font-normal">Finished</th>
              <th scope="col" className="py-2 pl-2 pr-5 text-right font-normal">Wrote</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/70">
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="px-5 py-2.5 text-left font-medium text-sage">
                  {r.title}
                  {r.situation && <span className="block text-[12px] font-normal text-muted">Situation: {r.situation}</span>}
                </th>
                <td className="px-2 py-2.5 text-right tabular-nums text-muted-strong">{r.opened}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-muted-strong">{r.finished}</td>
                <td className="py-2.5 pl-2 pr-5 text-right tabular-nums text-muted-strong">{r.wrote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
