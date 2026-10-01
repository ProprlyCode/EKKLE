import { describe, expect, it } from 'vitest';
import { isLinkName, situationUrl, toLinkName } from './linkName';

describe('link names', () => {
  it.each([
    ['Over coffee', 'over-coffee'],
    ['Someone grieving', 'someone-grieving'],
    ['  Just met!  ', 'just-met'],
    ['Going through a hard time', 'going-through-a-hard-time'],
    ['Café visit', 'cafe-visit'],
    ['Someone’s loss', 'someones-loss'],
    ['A very long situation name that keeps going', 'a-very-long-situation-name-tha'],
  ])('%s → %s', (name, slug) => {
    expect(toLinkName(name)).toBe(slug);
    expect(isLinkName(slug)).toBe(true);
  });

  it('rejects what the database rejects', () => {
    for (const bad of ['', 'Grief', 'grief-', '-grief', 'a--b', 'with space', 'x'.repeat(31)]) {
      expect(isLinkName(bad)).toBe(false);
    }
  });

  it('adds the situation to a member’s link', () => {
    expect(situationUrl('https://pilot.ekkle.org/r/david', 'grief')).toBe('https://pilot.ekkle.org/r/david/grief');
    expect(situationUrl('https://pilot.ekkle.org/r/david', null)).toBe('https://pilot.ekkle.org/r/david');
  });
});
