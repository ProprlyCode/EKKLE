/**
 * "Two lives, one thread" — the homepage story (see the film & photo brief).
 *
 * The journey is one master timeline, `T` units long, scrubbed by scroll across
 * the stage's track. Chapter `at` values are positions on that timeline; the
 * chapter rail jumps to them. Chapter 7 (Join) is the section after the stage.
 */

export const T = 114;

/** Viewport-heights of scroll the stage spans (≈ 2 minutes of unhurried scroll). */
export const TRACK_VH = 1500;

export interface Chapter {
  id: string;
  n: number;
  title: string;
  /** Timeline position; null = the Join section after the stage. */
  at: number | null;
}

export const CHAPTERS: Chapter[] = [
  { id: 'conversation', n: 1, title: 'A conversation', at: 0 },
  { id: 'cut-short', n: 2, title: 'Cut short', at: 16 },
  { id: 'the-code', n: 3, title: 'The code', at: 26 },
  { id: 'two-lives', n: 4, title: 'Two lives', at: 38 },
  { id: 'the-thread', n: 5, title: 'The thread holds', at: 64 },
  { id: 'together', n: 6, title: 'Together', at: 76 },
  { id: 'join', n: 7, title: 'Join', at: null },
];

/** The one who shares, as the product UI names them. */
export const MEMBER = 'Sam';

export const COPY = {
  hero: 'Empowering individuals to make connections and grow them',
  c1: 'It starts the way it always has — two people, one real conversation.',
  c2: 'But life interrupts.',
  t3: 'Continue the conversation.',
  c4a: 'One goes back to an ordinary day.',
  c4b: 'The other reads it that night — unhurried, alone.',
  t5: 'Back to the same person — not a stranger.',
  c6: 'Days later: the same table, and an open Bible between them.',
  t6: 'Together, Behold Him',
  integrity: [
    'Relational integrity on display between individuals.',
    'Sharing something as important as the gospel needs personal accountability.',
    'Everything you share is uniquely tied to you, and available for further conversation with you.',
    'Vindicating the character of God, one intentional conversation at a time.',
  ],
  positioning:
    'Ekklē is a system for churches and individuals to do ministry in a more personal way.',
  join: 'A quiet place to explore — together.',
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
