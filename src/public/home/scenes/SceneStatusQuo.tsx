import { SceneImage } from '../SceneImage';
import { ColonnadeArt } from '../art';

/**
 * Scene 2 — the same architecture gone cold and flat, a crowd far off. Carries the
 * positioning line. Fade + slide on enter; the art drifts slightly (parallax).
 */
export function SceneStatusQuo() {
  return (
    <section
      data-scene="s2"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden"
    >
      <div data-anim="s2-art" className="absolute inset-x-0 -inset-y-[8%]">
        <SceneImage slot="statusQuo" placeholder={<ColonnadeArt />} />
      </div>
      <div className="absolute inset-0 bg-home-ink/30" aria-hidden />
      <div className="home-scrim absolute inset-0" aria-hidden />
      <div className="home-vignette absolute inset-0" aria-hidden />

      <h2
        data-anim="s2-line"
        data-reveal
        className="home-display relative z-10 max-w-[21ch] px-6 text-center text-[clamp(1.75rem,3.7vw,3rem)] text-home-stone"
      >
        a system for churches and individuals to do ministry in a more personal way
      </h2>
    </section>
  );
}
