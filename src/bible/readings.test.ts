import { describe, expect, it } from 'vitest';
import { dayLabel, parseDayLine, readingLabel } from './readings';

describe('reading plans', () => {
  it('reads a day as people write it', () => {
    expect(parseDayLine('John 1; Luke 1:1-38; Genesis 1-3')).toEqual([
      'JHN.1',
      'LUK.1:1-38',
      'GEN.1',
      'GEN.2',
      'GEN.3',
    ]);
    expect(parseDayLine('Ps 23, 1 John 4')).toEqual(['PSA.23', '1JN.4']);
  });

  it('says what is wrong', () => {
    expect(parseDayLine('Hezekiah 3')).toMatch(/isn’t a passage/);
    expect(parseDayLine('Jude 2')).toMatch(/Jude has 1 chapter\./);
    expect(parseDayLine('  ')).toMatch(/Add at least one passage/);
  });

  it('writes a day back compactly', () => {
    expect(dayLabel(['GEN.1', 'GEN.2', 'GEN.3', 'MAT.1'])).toBe('Genesis 1–3; Matthew 1');
    expect(dayLabel(['PSA.1', 'PSA.2', 'PRO.1'])).toBe('Psalms 1–2; Proverbs 1');
    expect(readingLabel('LUK.1:1-38')).toBe('Luke 1:1–38');
    expect(readingLabel('MAT.6:6-6')).toBe('Matthew 6:6');
    // Round trip.
    expect(parseDayLine(dayLabel(['GEN.1', 'GEN.2', 'LUK.1:39-80']))).toEqual(['GEN.1', 'GEN.2', 'LUK.1:39-80']);
  });
});
