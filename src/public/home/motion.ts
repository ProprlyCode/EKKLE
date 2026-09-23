import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * desktop — the full cinematic register: pins, scrubs, 3D, pointer parallax.
 * mobile  — craft-preserving, NOT a generic fallback: same art direction and the
 *           Scene 3 pivot, minus long pins and 3D (see docs/homepage-build.md).
 * reduce  — prefers-reduced-motion: simple opacity fade-ins only.
 */
export type MotionMode = 'desktop' | 'mobile' | 'reduce';

export interface MotionHooks {
  /** Tell the Scene 5 demo whether its pin is active (drives its dwell timer). */
  onDemoToggle: (active: boolean) => void;
  /** Receive Scene 5's pin so the page can release it when the demo finishes. */
  setDemoTrigger: (trigger: ScrollTrigger | null) => void;
}

/**
 * All homepage scroll choreography, created top-to-bottom (ScrollTrigger measures
 * later pins against earlier ones). Called inside gsap.matchMedia, which reverts
 * every tween/trigger made here when the mode changes or the page unmounts; the
 * returned cleanup handles the few non-GSAP side effects (listeners, hooks).
 *
 * Only transform and opacity are ever animated. `will-change` is applied only to
 * layers while their scene is actively animating.
 */
export function setupMotion(root: HTMLElement, mode: MotionMode, hooks: MotionHooks) {
  const q = gsap.utils.selector(root);
  const one = (sel: string) => q(sel)[0] as HTMLElement;
  const cleanups: Array<() => void> = [];
  const willChange = (els: (HTMLElement | undefined)[], value: string) =>
    els.forEach((el) => el && (el.style.willChange = value));

  const headline = one('[data-anim="s1-headline"]');

  // ------------------------------------------------------------------ reduced
  if (mode === 'reduce') {
    // Every scene simply fades in on enter. Scene 3 already rests in its warm
    // end-state (the CSS defaults); the Scene 5 demo still works by tap.
    gsap.from(headline, { opacity: 0, duration: 0.8, ease: 'power1.out' });
    q('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        opacity: 0,
        duration: 0.7,
        ease: 'power1.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      });
    });
    return () => {};
  }

  const desktop = mode === 'desktop';

  // ------------------------------------------------------- Scene 1 Threshold
  const s1 = one('[data-scene="s1"]');
  const far = one('[data-anim="s1-far"]');
  const near = q('[data-anim="s1-near"]')[0] as HTMLElement | undefined;

  gsap.from(headline, { y: 24, opacity: 0, duration: 0.8, delay: 0.2, ease: 'power2.out' });

  if (desktop) {
    // Idle pointer parallax on two depth layers: ±8px near, ±4px far.
    const layers = [
      { el: far, amt: 4 },
      ...(near ? [{ el: near, amt: 8 }] : []),
    ].map(({ el, amt }) => ({
      el,
      amt,
      x: gsap.quickTo(el, 'x', { duration: 1, ease: 'power3.out' }),
      y: gsap.quickTo(el, 'y', { duration: 1, ease: 'power3.out' }),
    }));
    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      for (const l of layers) {
        l.x(-nx * 2 * l.amt);
        l.y(-ny * 2 * l.amt);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    cleanups.push(() => window.removeEventListener('pointermove', onMove));
    ScrollTrigger.create({
      trigger: s1,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => willChange(layers.map((l) => l.el), self.isActive ? 'transform' : ''),
    });
  } else {
    // Mobile: no hover on touch — a slow push-in settle instead of parallax.
    gsap.fromTo(far, { scale: 1.06 }, { scale: 1, duration: 2.8, ease: 'power2.out' });
    if (near) gsap.fromTo(near, { scale: 1.09 }, { scale: 1, duration: 2.8, ease: 'power2.out' });
  }

  // ------------------------------------------------------ Scene 2 Status quo
  const s2 = one('[data-scene="s2"]');
  gsap.fromTo(
    one('[data-anim="s2-line"]'),
    { opacity: 0, y: 40, scale: desktop ? 1 : 0.98 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: one('[data-anim="s2-line"]'), start: 'top 80%', end: 'top 40%', scrub: true },
    },
  );
  gsap.fromTo(
    one('[data-anim="s2-art"]'),
    { yPercent: -5 },
    {
      yPercent: 5,
      ease: 'none',
      scrollTrigger: { trigger: s2, start: 'top bottom', end: 'bottom top', scrub: true },
    },
  );

  // ----------------------------------------------------------- Scene 3 Behold
  const s3 = one('[data-scene="s3"]');
  const stage = one('[data-anim="s3-stage"]');
  const desat = one('[data-anim="s3-desat"]');
  const cool = one('[data-anim="s3-cool"]');
  const warm = one('[data-anim="s3-warm"]');
  const bloom = one('[data-anim="s3-bloom"]');
  const word = one('[data-anim="s3-word"]');
  const promoteS3 = (on: boolean) => {
    willChange([stage], on ? 'transform' : '');
    willChange([desat, cool, warm, bloom], on ? 'opacity' : '');
  };

  // Cold starting state (the CSS defaults are the warm end-state).
  gsap.set(desat, { opacity: 1 });
  gsap.set(cool, { opacity: 0.55 });
  gsap.set([warm, bloom], { opacity: 0 });
  gsap.set(word, { opacity: 0, y: 16 });

  if (desktop) {
    gsap.set(stage, { scale: 0.9, rotateX: 4, transformOrigin: '50% 55%' });
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: s3,
          pin: true,
          scrub: 1,
          start: 'top top',
          end: '+=150%',
          anticipatePin: 1,
          onToggle: (self) => promoteS3(self.isActive),
        },
      })
      // 0–⅓: cold, desaturated, the camera pulled back
      .to(stage, { scale: 0.93, duration: 1 }, 0)
      // ⅓–⅔: warm light bleeds in from the right; the camera pushes in
      .to(warm, { opacity: 0.6, duration: 1 }, 1)
      .to(desat, { opacity: 0.45, duration: 1 }, 1)
      .to(cool, { opacity: 0.2, duration: 1 }, 1)
      .to(stage, { scale: 1.05, rotateX: 1.5, duration: 1 }, 1)
      // ⅔–1: full brass glow, the figures clear, the camera settles
      .to([desat, cool], { opacity: 0, duration: 1 }, 2)
      .to(bloom, { opacity: 1, duration: 1 }, 2)
      .to(stage, { scale: 1, rotateX: 0, duration: 1 }, 2)
      .to(word, { opacity: 1, y: 0, duration: 0.6 }, 2.3);
  } else {
    // Mobile: the same cold → warm pivot, unpinned and without 3D — linked to the
    // scene rising into view, so the emotional beat survives on a phone.
    gsap.set(stage, { scale: 1.06 });
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: s3,
          start: 'top 85%',
          end: 'top 5%',
          scrub: true,
          onToggle: (self) => promoteS3(self.isActive),
        },
      })
      .to(stage, { scale: 1, duration: 2.2 }, 0)
      .to([desat, cool], { opacity: 0, duration: 1.2 }, 0.5)
      .to(warm, { opacity: 0.6, duration: 1 }, 0.5)
      .to(bloom, { opacity: 1, duration: 1 }, 1.2)
      .to(word, { opacity: 1, y: 0, duration: 0.6 }, 1.6);
  }

  // ----------------------------------------------------- Scene 4 How it works
  const s4 = one('[data-scene="s4"]');
  const steps = q('[data-anim="s4-step"]') as HTMLElement[];

  if (desktop) {
    gsap.set(steps, { opacity: 0, rotateY: -15, x: -14, transformOrigin: '0% 50%' });
    const tl = gsap.timeline({
      defaults: { ease: 'power1.out' },
      scrollTrigger: {
        trigger: s4,
        pin: true,
        scrub: 1,
        start: 'top top',
        end: '+=100%',
        onToggle: (self) => willChange(steps, self.isActive ? 'transform, opacity' : ''),
      },
    });
    steps.forEach((el, i) => tl.to(el, { opacity: 1, rotateY: 0, x: 0, duration: 0.7 }, i));
    tl.to({}, { duration: 0.3 }, 2.7); // each beat owns an even third of the pin
  } else {
    // Mobile: beats are spaced apart and rise in one by one as each enters.
    steps.forEach((el) =>
      gsap.fromTo(
        el,
        { opacity: 0, y: 30, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 88%', end: 'top 62%', scrub: true },
        },
      ),
    );
    gsap.fromTo(
      one('[data-anim="s4-art"]'),
      { yPercent: -4 },
      {
        yPercent: 4,
        ease: 'none',
        scrollTrigger: { trigger: s4, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  }

  // ------------------------------------------------------------ Scene 5 Demo
  // Pinned on desktop AND mobile — it's tap-driven, not scrubbed. The demo
  // releases the pin itself when finished (see Home → releaseDemo).
  const s5 = one('[data-scene="s5"]');
  hooks.setDemoTrigger(
    ScrollTrigger.create({
      trigger: s5,
      pin: true,
      start: 'top top',
      end: '+=100%',
      onToggle: (self) => hooks.onDemoToggle(self.isActive),
    }),
  );
  cleanups.push(() => {
    hooks.setDemoTrigger(null);
    hooks.onDemoToggle(false);
  });
  gsap.from(one('[data-anim="s5-card"]'), {
    opacity: 0,
    y: 32,
    scale: 0.97,
    duration: 0.9,
    ease: 'power2.out',
    scrollTrigger: { trigger: s5, start: 'top 70%', toggleActions: 'play none none reverse' },
  });

  // ------------------------------------------------------- Scene 6 Integrity
  // Opacity tied directly to scroll position: in as the line rises to center,
  // held while centered, out as it leaves.
  (q('[data-anim="s6-beat"]') as HTMLElement[]).forEach((beat) => {
    const line = beat.querySelector('[data-anim="s6-line"]');
    const glow = beat.querySelector('[data-anim="s6-glow"]');
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: beat, start: 'top bottom', end: 'bottom top', scrub: true },
      })
      .fromTo(line, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 })
      .fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 1 }, 0)
      .to({}, { duration: 0.5 })
      .to(line, { opacity: 0, y: -40, duration: 1 })
      .to(glow, { opacity: 0, duration: 1 }, '<');
  });

  // ------------------------------------------------------ Scene 7 Invitation
  // Still: a simple fade-in, no scrub, no parallax, no 3D.
  gsap.from(one('[data-anim="s7-content"]'), {
    opacity: 0,
    y: 16,
    duration: 1,
    ease: 'power2.out',
    scrollTrigger: { trigger: one('[data-scene="s7"]'), start: 'top 65%', toggleActions: 'play none none none' },
  });

  return () => cleanups.forEach((fn) => fn());
}
