import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { BrandName } from '@/components/BrandName';
import { setupMotion, type MotionMode } from './motion';
import { homeLogoLight } from './images';
import { SceneThreshold } from './scenes/SceneThreshold';
import { SceneStatusQuo } from './scenes/SceneStatusQuo';
import { SceneBehold } from './scenes/SceneBehold';
import { SceneHowItWorks } from './scenes/SceneHowItWorks';
import { SceneDemo, type DemoController } from './scenes/SceneDemo';
import { SceneIntegrity } from './scenes/SceneIntegrity';
import { SceneInvitation } from './scenes/SceneInvitation';
import './home.css';

const INK = '#232a2e';

/**
 * ekkle.org/ — the cinematic "Ecce Homo" homepage (docs/homepage-build.md).
 *
 * Seven scenes of image and motion, one quiet ask. This component owns the page
 * chrome and the motion lifecycle: Lenis smooth scroll (desktop only), and one
 * gsap.matchMedia that sets up desktop / mobile / reduced-motion choreography and
 * reverts it all on mode change or unmount. The rest of the app never loads this
 * (the route is code-split), so GSAP/Lenis stay out of the product bundle.
 */
export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const demoRef = useRef<DemoController | null>(null);
  const demoTriggerRef = useRef<ScrollTrigger | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Dark browser chrome + dark overscroll while on the homepage; restored on leave.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevMeta = meta?.getAttribute('content') ?? null;
    const prevBg = document.body.style.backgroundColor;
    meta?.setAttribute('content', INK);
    document.body.style.backgroundColor = INK;
    return () => {
      if (meta && prevMeta) meta.setAttribute('content', prevMeta);
      document.body.style.backgroundColor = prevBg;
    };
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    ScrollTrigger.config({ ignoreMobileResize: true });
    const mm = gsap.matchMedia();
    mm.add(
      {
        desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
        mobile: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
        reduce: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const c = context.conditions as Record<'desktop' | 'mobile' | 'reduce', boolean>;
        const mode: MotionMode = c.desktop ? 'desktop' : c.mobile ? 'mobile' : 'reduce';

        // Smooth scroll on desktop only; touch keeps native momentum scrolling and
        // reduced motion keeps plain scrolling.
        let lenis: Lenis | null = null;
        const raf = (time: number) => lenis?.raf(time * 1000);
        if (mode === 'desktop') {
          lenis = new Lenis({ duration: 1.1, smoothWheel: true });
          lenis.on('scroll', ScrollTrigger.update);
          gsap.ticker.add(raf);
          gsap.ticker.lagSmoothing(0);
          lenisRef.current = lenis;
        }

        const teardown = setupMotion(root, mode, {
          onDemoToggle: (active) => demoRef.current?.setActive(active),
          setDemoTrigger: (trigger) => {
            demoTriggerRef.current = trigger;
          },
        });

        return () => {
          teardown();
          gsap.ticker.remove(raf);
          gsap.ticker.lagSmoothing(500, 33);
          lenis?.destroy();
          lenisRef.current = null;
        };
      },
    );

    // Webfonts change line heights — recompute trigger positions once they land.
    let live = true;
    void document.fonts?.ready.then(() => live && ScrollTrigger.refresh());

    return () => {
      live = false;
      mm.revert();
    };
  }, []);

  // The demo finished by tap → release its pin by gliding just past it.
  const releaseDemo = useCallback(() => {
    const st = demoTriggerRef.current;
    if (!st || !st.isActive) return;
    const target = st.end + 2;
    if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: 1.2 });
    else window.scrollTo({ top: target, behavior: 'smooth' });
  }, []);

  return (
    <div ref={rootRef} className="home-root">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 md:px-10 md:py-7">
        <Link to="/" aria-label="Ekklē home" className="home-focus">
          {homeLogoLight ? (
            <img src={homeLogoLight} alt="" className="h-9 w-9" />
          ) : (
            <BrandName className="font-serif text-xl text-home-stone" />
          )}
        </Link>
        <Link
          to="/sign-in"
          className="home-focus text-[14px] text-home-stone-dim transition-colors hover:text-home-stone"
        >
          Sign in
        </Link>
      </header>

      <main>
        <SceneThreshold />
        <SceneStatusQuo />
        <SceneBehold />
        <SceneHowItWorks />
        <SceneDemo controllerRef={demoRef} onComplete={releaseDemo} />
        <SceneIntegrity />
        <SceneInvitation />
      </main>

      <div className="home-grain" aria-hidden />
    </div>
  );
}
