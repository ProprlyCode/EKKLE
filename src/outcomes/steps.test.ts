import { describe, expect, it } from 'vitest';
import { STEPS, sumOutcomes } from './steps';

const one = { opened: 5, finished: 4, reached_out: 2, replied: 2, met: 1, studies_started: 3, studies_completed: 1 };

describe('outcomes', () => {
  it('adds ministries together, step by step', () => {
    expect(sumOutcomes([one, one])).toEqual({
      opened: 10, finished: 8, reached_out: 4, replied: 4, met: 2, studies_started: 6, studies_completed: 2,
    });
    expect(sumOutcomes([]).opened).toBe(0);
  });

  it('walks the path from a link to a connection', () => {
    expect(STEPS.map((s) => s.key)).toEqual(['opened', 'finished', 'reached_out', 'replied', 'met']);
  });
});
