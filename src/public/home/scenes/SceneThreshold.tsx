import { SceneImage } from '../SceneImage';
import { ThresholdFar, ThresholdNear } from '../art';
import { homeImages } from '../images';

/**
 * Scene 1 — Threshold. The painterly world before any words: an archway, one shaft
 * of brass light, no figure yet. Idle pointer parallax on two depth layers; the
 * headline rises in on load. A thin brass line breathes as the exit cue.
 */
export function SceneThreshold() {
  return (
    <section data-scene="s1" className="relative h-[100svh] min-h-[560px] overflow-hidden">
      <div data-anim="s1-far" className="absolute -inset-[3%]">
        <SceneImage slot="hero" placeholder={<ThresholdFar />} eager />
      </div>
      {/* Foreground depth layer (columns + light). Part of the placeholder art;
          a supplied hero image already contains its own foreground. */}
      {!homeImages.hero && (
        <div data-anim="s1-near" className="absolute -inset-[3%]" aria-hidden>
          <ThresholdNear />
        </div>
      )}
      <div className="home-vignette absolute inset-0" aria-hidden />
      {/* The floor falls into shadow: keeps the lower-center dim for the headline
          whatever the image (the manifest's "safe zone"). */}
      <div
        className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-home-ink/90 via-home-ink/55 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-end px-6 pb-[18svh] text-center">
        <h1
          data-anim="s1-headline"
          className="home-display max-w-[17ch] text-[clamp(2.25rem,5.4vw,4rem)] text-home-stone"
        >
          Empowering individuals to make connections and grow them
        </h1>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2" aria-hidden>
        <span className="home-cue block h-px w-16 bg-home-brass" />
      </div>
    </section>
  );
}
