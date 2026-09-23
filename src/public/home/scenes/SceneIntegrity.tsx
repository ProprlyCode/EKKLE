/**
 * Scene 6 — relational integrity. One line at a time, nothing competing: each beat
 * is a full viewport, its opacity tied directly to scroll position (in as it
 * rises to center, out as it leaves). A continuous dark ground with one warm light
 * source sits sticky behind all the beats.
 *
 * Jonathan's long accountability line is split across two beats to keep within the
 * ~12-words-on-screen rule.
 */
const LINES = [
  'Relational integrity on display between individuals',
  'Sharing something as important as the gospel needs personal accountability.',
  'Everything you share is uniquely tied to you, and available for further conversation with you',
  'Vindicating the character of God, one intentional conversation at a time',
];

export function SceneIntegrity() {
  return (
    <section data-scene="s6" className="relative">
      {/* sticky painterly ground (no overflow-hidden on the section, or sticky breaks) */}
      <div className="home-s6-ground sticky top-0 h-[100svh] overflow-hidden" aria-hidden>
        <div className="home-vignette absolute inset-0" />
      </div>

      <div className="relative -mt-[100svh]">
        <h2 className="sr-only">Why it matters</h2>
        {LINES.map((line) => (
          <div
            key={line}
            data-anim="s6-beat"
            className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6"
          >
            <div data-anim="s6-glow" className="home-glow absolute inset-0" aria-hidden />
            <p
              data-anim="s6-line"
              data-reveal
              className="home-display relative z-10 max-w-[20ch] text-center text-[clamp(1.75rem,3.8vw,3.25rem)] text-home-stone"
            >
              {line}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
