import type { Outcomes, Range } from '@/data/outcomes';

/** The steps of the outcomes path, in order (N4). */
export const STEPS: Array<{ key: keyof Outcomes; label: string; hint: string }> = [
  { key: 'opened', label: 'Opened a link', hint: 'Someone opened a member’s link or code' },
  { key: 'finished', label: 'Went through it', hint: 'They reached the end of the introduction' },
  { key: 'reached_out', label: 'Reached out', hint: 'They wrote to the member' },
  { key: 'replied', label: 'Got a reply', hint: 'The member wrote back' },
  { key: 'met', label: 'Connected', hint: 'The member marked “we connected”' },
];

export const RANGES: Array<{ value: Range; label: string }> = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: null, label: 'All time' },
];

export function sumOutcomes(list: Outcomes[]): Outcomes {
  const total: Outcomes = { opened: 0, finished: 0, reached_out: 0, replied: 0, met: 0, studies_started: 0, studies_completed: 0 };
  for (const o of list) for (const k of Object.keys(total) as Array<keyof Outcomes>) total[k] += o[k];
  return total;
}
