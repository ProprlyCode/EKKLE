import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { SceneImage } from '../SceneImage';
import { SanctuaryArt } from '../art';
import { useReducedMotion } from '../useReducedMotion';

/** Lets the scroll orchestration tell the demo when its pin is active. */
export interface DemoController {
  setActive: (active: boolean) => void;
}

const MEMBER = 'Sarah';

/** Two of the real four screens — Acknowledge and Connect bookend the arc. */
const SCREENS = [
  {
    headline: 'life carries a lot',
    body: 'Most of us carry more than we say out loud. Before anything else: that’s worth taking seriously.',
  },
  {
    headline: 'someone here would love to talk',
    body: `${MEMBER} shared this because they’d genuinely welcome a conversation — no pressure, no script.`,
  },
];

/**
 * Scene 5 — the real demo. A compressed recipient flow the visitor actually taps
 * through. The card is the one place the product UI shows through the painterly
 * page (cream surface, sage headline in the product's own serif, brass Continue).
 *
 * - Tap "Continue" → cross-fade (opacity, 400ms) to the next screen.
 * - Finish → a caption lands, then the pin is released (onComplete) so no extra
 *   scrolling is needed to move on.
 * - Only scrolling, no tap? After ~4s of dwell in the pin it advances once, so the
 *   section never feels stuck. Never auto-advances under reduced motion.
 */
export function SceneDemo({
  controllerRef,
  onComplete,
}: {
  controllerRef: MutableRefObject<DemoController | null>;
  onComplete: () => void;
}) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0); // 0 Acknowledge · 1 Connect · 2 sent
  const [active, setActive] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    controllerRef.current = { setActive };
    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef]);

  useEffect(() => {
    if (!active || reduced || step !== 0) return;
    const t = window.setTimeout(() => setStep(1), 4000);
    return () => window.clearTimeout(t);
  }, [active, reduced, step]);

  function advance() {
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      setStep(2);
      // Keep keyboard focus in the card once its button is replaced.
      window.requestAnimationFrame(() => statusRef.current?.focus());
      window.setTimeout(onComplete, reduced ? 0 : 1100);
    }
  }

  const screenIndex = Math.min(step, 1);
  const live =
    step === 1
      ? `Screen 2 of 2. ${SCREENS[1].headline}.`
      : step === 2
        ? `Message sent to ${MEMBER}.`
        : '';

  return (
    <section
      data-scene="s5"
      className="relative flex h-[100svh] min-h-[640px] flex-col items-center justify-center gap-6 overflow-hidden px-4 py-10"
    >
      <div className="absolute inset-0">
        <SceneImage slot="sanctuary" placeholder={<SanctuaryArt />} decorative />
      </div>
      <div className="absolute inset-0 bg-home-ink/80" aria-hidden />
      <div className="home-vignette absolute inset-0" aria-hidden />

      <h2 className="relative z-10 text-center font-sans text-[15px] font-normal text-home-stone-dim">
        What someone sees when you share with them
      </h2>

      <div
        data-anim="s5-card"
        data-reveal
        role="group"
        aria-label="Preview of what someone receives"
        className="relative z-10 flex w-full max-w-[380px] flex-col overflow-hidden rounded-[28px] border border-home-stone/15 bg-home-cream text-home-ink shadow-[0_30px_80px_-24px_rgba(0,0,0,0.65)]"
      >
        <div className="flex gap-1.5 px-6 pt-6" aria-hidden>
          {SCREENS.map((_, i) => (
            <span
              key={i}
              className={
                'h-1 flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none ' +
                (i <= screenIndex ? 'bg-home-sage/70' : 'bg-home-stone-dim/60')
              }
            />
          ))}
        </div>

        <div className="relative min-h-[260px] px-6 pb-4 pt-9 md:min-h-[290px]">
          {SCREENS.map((s, i) => {
            const shown = i === screenIndex;
            return (
              <div
                key={s.headline}
                aria-hidden={!shown}
                className={
                  'absolute inset-x-6 top-9 transition-opacity duration-[400ms] motion-reduce:transition-none ' +
                  (shown ? 'opacity-100' : 'pointer-events-none opacity-0')
                }
              >
                <h3 className="font-serif text-[28px] font-medium leading-tight text-home-sage">
                  {s.headline}
                </h3>
                <p className="mt-4 text-[16px] leading-relaxed text-[#6b6754]">{s.body}</p>
              </div>
            );
          })}
        </div>

        <div className="px-6 pb-6">
          {step < 2 ? (
            <button
              type="button"
              onClick={advance}
              className="home-focus h-12 w-full rounded-xl bg-home-brass text-[15px] font-medium text-home-ink transition-colors hover:bg-[#b8915a]"
            >
              {step === 0 ? 'Continue' : `Message ${MEMBER}`}
            </button>
          ) : (
            <p
              ref={statusRef}
              tabIndex={-1}
              className="home-focus flex h-12 items-center justify-center rounded-xl border border-home-sage/25 text-[15px] text-home-sage"
            >
              Message sent to {MEMBER}
            </p>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
      </div>

      <p
        aria-hidden={step !== 2}
        className={
          'home-display relative z-10 max-w-[24ch] text-center text-[clamp(1.25rem,2.2vw,1.75rem)] text-home-stone transition-opacity duration-700 motion-reduce:transition-none ' +
          (step === 2 ? 'opacity-100' : 'opacity-0')
        }
      >
        and a real conversation begins — with the person who shared it
      </p>
    </section>
  );
}
