import { SceneImage } from '../SceneImage';
import { BeholdArt } from '../art';

/**
 * Scene 3 — Behold. The pivot and the page's one elaborate moment: one figure
 * presents another, and the whole scene turns from cold to warm as you scroll.
 *
 * The stage is overscanned (-8%) so the scale 0.9 → 1.05 → 1.0 camera move never
 * shows an edge. Overlay opacities in CSS are the warm END state — motion.ts sets
 * the cold starting state — so no-JS and reduced motion see the resolved moment.
 */
export function SceneBehold() {
  return (
    <section data-scene="s3" className="relative h-[100svh] min-h-[560px] overflow-hidden">
      <div className="absolute inset-0 [perspective:1400px]">
        <div data-anim="s3-stage" className="absolute -inset-[8%] [transform-style:preserve-3d]">
          <SceneImage slot="behold" placeholder={<BeholdArt />} />
          <div data-anim="s3-desat" className="home-desat absolute inset-0" aria-hidden />
          <div data-anim="s3-cool" className="home-cool absolute inset-0" aria-hidden />
          <div data-anim="s3-warm" className="home-warm absolute inset-0" aria-hidden />
          <div data-anim="s3-bloom" className="home-bloom absolute inset-0" aria-hidden />
        </div>
      </div>
      <div className="home-vignette absolute inset-0" aria-hidden />

      <p
        data-anim="s3-word"
        data-reveal
        className="home-display absolute inset-x-0 bottom-[12svh] z-10 text-center text-[clamp(2rem,4vw,3.5rem)] text-home-stone"
      >
        Behold.
      </p>
    </section>
  );
}
