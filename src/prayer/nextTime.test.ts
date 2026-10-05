import { describe, expect, it } from 'vitest';
import { nextTime } from './nextTime';

const times = [{ at: '21:00' }, { at: '07:00' }, { at: '12:30' }];
const at = (h: number, m: number) => new Date(2026, 9, 5, h, m);

describe('nextTime', () => {
  it('is the next one later today', () => {
    expect(nextTime(times, at(6, 0))?.at).toBe('07:00');
    expect(nextTime(times, at(9, 15))?.at).toBe('12:30');
    expect(nextTime(times, at(12, 30))?.at).toBe('21:00');
  });
  it('after the last one, it is tomorrow’s first', () => {
    expect(nextTime(times, at(22, 0))?.at).toBe('07:00');
  });
  it('none set: none', () => {
    expect(nextTime([], at(9, 0))).toBeNull();
  });
});
