import type { Outcomes, Range } from '@/data/outcomes';
import { RANGES, STEPS } from './steps';

/**
 * Outcomes (N4): the path from a shared link to a real connection, and the
 * studies alongside it. Counts only — never message contents. One hue (the
 * account's accent) for magnitude; every step is labelled with its count and
 * its share of those who opened a link.
 */

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div role="radiogroup" aria-label="Time range" className="inline-flex rounded-lg border border-edge bg-card p-0.5 text-[13px]">
      {RANGES.map((r) => (
        <button
          key={r.label}
          role="radio"
          aria-checked={value === r.value}
          onClick={() => onChange(r.value)}
          className={
            'rounded-md px-3 py-1 transition-colors ' +
            (value === r.value ? 'bg-sage/10 font-medium text-sage' : 'text-muted hover:text-sage')
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

// Share of those who opened a link. Hidden past 100%: people can also reach
// out without a member's link (the offer page, a ministry's own address).
const pct = (n: number, of: number) => (of > 0 && n <= of ? `${Math.round((n / of) * 100)}%` : null);

/** The path as horizontal bars, scaled to the largest step. */
export function Funnel({ outcomes, label }: { outcomes: Outcomes; label: string }) {
  const top = Math.max(1, ...STEPS.map((s) => outcomes[s.key]));
  return (
    <figure aria-label={label} className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2.5">
        {STEPS.map((s, i) => {
          const n = outcomes[s.key];
          const share = i > 0 ? pct(n, outcomes.opened) : null;
          return (
            <li
              key={s.key}
              className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-[13px] sm:grid-cols-[9rem_1fr_auto]"
              title={`${s.hint}: ${n}${share ? ` (${share} of those who opened a link)` : ''}`}
            >
              <span className="text-muted-strong">{s.label}</span>
              <span className="h-2.5 overflow-hidden rounded-r bg-edge/50">
                <span
                  className="block h-full rounded-r bg-accent transition-[width] duration-500"
                  style={{ width: `${(n / top) * 100}%` }}
                />
              </span>
              <span className="min-w-[4.5rem] text-right tabular-nums">
                <span className="font-medium text-sage">{n}</span>
                <span className="ml-1.5 inline-block w-8 text-left text-[11px] text-muted">{share}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <figcaption className="flex flex-wrap gap-x-6 gap-y-1 border-t border-edge/70 pt-3 text-[13px] text-muted-strong">
        <span>
          <span className="font-medium tabular-nums text-sage">{outcomes.studies_started}</span> started a study
        </span>
        <span>
          <span className="font-medium tabular-nums text-sage">{outcomes.studies_completed}</span> studies completed
        </span>
      </figcaption>
    </figure>
  );
}

/** Every stage as a table, a row per person or ministry. */
export function OutcomesTable({
  rows,
  caption,
  nameHeader,
}: {
  rows: Array<{ id: string; name: React.ReactNode; outcomes: Outcomes }>;
  caption: string;
  nameHeader: string;
}) {
  return (
    // Scrolls sideways on phones; focusable so it scrolls from the keyboard too.
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[720px] text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-edge/70 text-left text-[11px] uppercase tracking-eyebrow text-muted">
            <th scope="col" className="whitespace-nowrap px-5 py-2 font-normal">{nameHeader}</th>
            {STEPS.map((s) => (
              <th key={s.key} scope="col" className="whitespace-nowrap px-2 py-2 text-right font-normal">{s.label}</th>
            ))}
            <th scope="col" className="px-2 py-2 text-right font-normal">Studies</th>
            <th scope="col" className="py-2 pl-2 pr-5 text-right font-normal">Completed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge/70">
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="px-5 py-2.5 text-left font-medium text-sage">{r.name}</th>
              {STEPS.map((s) => (
                <td key={s.key} className="px-2 py-2.5 text-right tabular-nums text-muted-strong">{r.outcomes[s.key]}</td>
              ))}
              <td className="px-2 py-2.5 text-right tabular-nums text-muted-strong">{r.outcomes.studies_started}</td>
              <td className="py-2.5 pl-2 pr-5 text-right tabular-nums text-muted-strong">{r.outcomes.studies_completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
