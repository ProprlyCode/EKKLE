/**
 * "Two lives, one thread" — the homepage story (see the film & photo brief).
 *
 * The journey is one master timeline, `T` units long, scrubbed by scroll across
 * the stage's track. Chapter `at` values are positions on that timeline; the
 * chapter rail jumps to them. Chapter 7 (Join) is the section after the stage.
 */

export const T = 122;

/** Viewport-heights of scroll the stage spans (≈ 2 minutes of unhurried scroll). */
export const TRACK_VH = 1600;

export interface Chapter {
  id: string;
  n: number;
  title: string;
  /** Timeline position. */
  at: number;
}

export const CHAPTERS: Chapter[] = [
  { id: 'conversation', n: 1, title: 'A conversation', at: 0 },
  { id: 'cut-short', n: 2, title: 'Cut short', at: 16 },
  { id: 'the-code', n: 3, title: 'The code', at: 26 },
  { id: 'two-lives', n: 4, title: 'Two lives', at: 41.5 },
  { id: 'the-thread', n: 5, title: 'The thread holds', at: 71 },
  { id: 'together', n: 6, title: 'Together', at: 88 },
  { id: 'join', n: 7, title: 'Join', at: 112 },
];

/** The one who shares, as the product UI names them. */
export const MEMBER = 'Sam';
/** The one Sam shares with. */
export const FRIEND = 'Jordan';

/**
 * One narrator throughout: quiet, present tense, museum-caption. Titles (t*)
 * are that narrator's big beats. The page only turns to "you" at Join, where it
 * speaks to church leaders.
 */
export const COPY = {
  hero: 'Empowering individuals to make connections — and grow them.',
  c1: 'It starts the way it always has: two people, one real conversation.',
  c2: `But ${MEMBER} has to go, and the conversation isn’t finished.`,
  t3: 'The conversation doesn’t have to end here.',
  c3: `Something as important as the gospel deserves personal accountability. What ${MEMBER} shares carries ${MEMBER}’s name.`,
  c4a: `${MEMBER} goes through the rest of the day.`,
  c4b: `That night, alone and unhurried, ${FRIEND} reads what ${MEMBER} shared.`,
  c4c: 'A quiet place to explore, with someone to explore it with.',
  t5: `The reply goes back to ${MEMBER} — not to a stranger.`,
  c5: 'Everything shared stays tied to the person who shared it, and open to more conversation.',
  c6: 'Days later: the same table, and an open Bible between them.',
  c6b: 'This is relational integrity: faith shared person to person, and kept.',
  t6: 'Together, Behold Him',
  joinTitle: 'Vindicating the character of God, one intentional conversation at a time.',
  joinSub:
    'Ekklē is a system for churches and individuals to do ministry in a more personal way.',
} as const;

/** The real recipient screens (the product's 4-screen arc), played inside B's phone. */
export const SCREENS = [
  {
    headline: 'life carries a lot',
    body: 'Most of us carry more than we say out loud. Before anything else: that’s worth taking seriously.',
  },
  {
    headline: 'you’re not the only one who’s felt it',
    body: 'Jesus wasn’t distant from any of this. Whatever you’re carrying, he’s been near it himself.',
  },
  {
    headline: 'this is an invitation, not a pitch',
    body: 'At the center of it is something simpler than a set of beliefs: the chance to actually know him.',
  },
  {
    headline: 'someone here would love to talk',
    body: `${MEMBER} shared this because they’d genuinely welcome a conversation — no pressure, no script.`,
  },
] as const;
