import { SceneImage } from '../SceneImage';
import { SanctuaryArt } from '../art';

const STEPS = ['Share your code.', 'They behold it, on their own.', 'You follow up — personally.'];

/**
 * Scene 4 — how it works, three plain beats. The one place numbering is earned (it
 * is literally a sequence). Desktop: pinned, each beat takes a third of the pin
 * and tilts in with perspective. Mobile: the beats are spaced out and rise in one
 * by one as they scroll into view. Warm ground continues from Scene 3.
 */
export function SceneHowItWorks() {
  return (
    <section
      data-scene="s4"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden py-24"
    >
      <div data-anim="s4-art" className="absolute inset-x-0 -inset-y-[6%]">
        <SceneImage slot="sanctuary" placeholder={<SanctuaryArt />} />
      </div>
      <div className="absolute inset-0 bg-home-ink/50" aria-hidden />
      <div className="home-scrim absolute inset-0" aria-hidden />
      <div className="home-vignette absolute inset-0" aria-hidden />

      <div className="relative z-10 w-full max-w-3xl px-6">
        <h2 className="sr-only">How it works</h2>
        <ol
          data-reveal
          className="flex flex-col gap-[14svh] [perspective:1000px] md:gap-14"
        >
          {STEPS.map((step, i) => (
            <li key={step} data-anim="s4-step" className="flex items-baseline gap-5 md:gap-8">
              <span
                className="home-display w-6 shrink-0 text-[clamp(1.25rem,2vw,1.75rem)] text-home-brass"
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="home-display text-[clamp(1.875rem,4.2vw,3.5rem)] text-home-stone">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
