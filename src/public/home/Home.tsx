import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { BrandName } from '@/components/BrandName';
import { useReducedMotion } from './useReducedMotion';
import { CHAPTERS, T } from './journey/chapters';
import { Stage } from './journey/Stage';
import { buildJourney, type JourneyMode } from './journey/timeline';
import { Loader } from './journey/Loader';
import { ChapterRail } from './journey/ChapterRail';
import { Footer, Invitation } from './journey/Invitation';
import { JourneyStatic } from './journey/JourneyStatic';
import './home.css';

const INK = '#232a2e';

/**
 * ekkle.org/ — "Two lives, one thread" (docs/homepage-build.md).
 *
 * A layered-depth scroll journey: Sam and Jordan's café conversation cut short,
 * a code scanned to continue it, two lives apart, one reply back to the same
 * person, and the two of them together over an open Bible — then the invitation
 * rises into that same last frame. Scroll is the camera.
 *
 * This component owns the chrome and the motion lifecycle: the loader, Lenis
 * smooth scroll (desktop only), the chapter rail, and one gsap.matchMedia that
 * builds the journey timeline for desktop or phones and reverts it on change or
 * unmount. Reduced motion renders JourneyStatic instead: every word, no motion.
 * The route is code-split, so GSAP/Lenis never load in the product.
 */
export default function Home() {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [loaded, setLoaded] = useState(reduced);
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  const [chapter, setChapter] = useState(0);
  const [progress, setProgress] = useState(0);

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

  // The story starts at the beginning; scroll stays locked under the loader.
  useLayoutEffect(() => {
    if (loaded) return;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    lenisRef.current?.stop();
    return () => {
      html.style.overflow = prev;
      lenisRef.current?.start();
    };
  }, [loaded]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;

    ScrollTrigger.config({ ignoreMobileResize: true });
    const mm = gsap.matchMedia();
    mm.add(
      {
        desktop: '(min-width: 768px)',
        mobile: '(max-width: 767px)',
      },
      (context) => {
        const mode: JourneyMode = context.conditions?.desktop ? 'desktop' : 'mobile';

        // Smooth scroll on desktop only; touch keeps native momentum scrolling.
        let lenis: Lenis | null = null;
        const raf = (time: number) => lenis?.raf(time * 1000);
        if (mode === 'desktop') {
          lenis = new Lenis({ duration: 1.2, smoothWheel: true });
          lenis.on('scroll', ScrollTrigger.update);
          gsap.ticker.add(raf);
          gsap.ticker.lagSmoothing(0);
          lenisRef.current = lenis;
          if (!loadedRef.current) lenis.stop();
        }

        const teardown = buildJourney(root, mode, {
          onChapter: setChapter,
          onProgress: setProgress,
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
  }, [reduced]);

  const onLoaded = useCallback(() => {
    setLoaded(true);
    const hero = rootRef.current?.querySelector('[data-j="hero-inner"]');
    if (hero) gsap.fromTo(hero, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1.6, ease: 'power3.out', delay: 0.25 });
  }, []);

  const jump = useCallback((index: number) => {
    const c = CHAPTERS[index];
    const track = rootRef.current?.querySelector<HTMLElement>('[data-j="track"]');
    if (!track) return;
    const trackTop = track.getBoundingClientRect().top + window.scrollY;
    const span = track.offsetHeight - window.innerHeight;
    // Land just after a chapter starts, so its first words are coming in; Join
    // lands at the end, with the form settled.
    const last = index === CHAPTERS.length - 1;
    const top = trackTop + (last ? 1 : (c.at + (c.at === 0 ? 0 : 1.5)) / T) * span;
    if (lenisRef.current) lenisRef.current.scrollTo(top, { duration: 2.2 });
    else window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  return (
    <div ref={rootRef} className="home-root">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-5 md:px-10 md:py-7">
        <Link to="/" aria-label="Ekklē home" className="home-focus pointer-events-auto">
          <BrandName className="font-serif text-xl text-home-stone" />
        </Link>
        <Link
          to="/sign-in"
          className="home-focus pointer-events-auto text-[14px] text-home-stone-dim transition-colors hover:text-home-stone"
        >
          Sign in
        </Link>
      </header>

      <main>
        {reduced ? (
          <>
            <JourneyStatic />
            <Invitation />
          </>
        ) : (
          <Stage />
        )}
      </main>
      <Footer />

      {!reduced && <ChapterRail active={chapter} progress={progress} onJump={jump} />}
      {!reduced && <Loader onDone={onLoaded} />}
      <div className="home-grain" aria-hidden />
    </div>
  );
}
