import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CHAPTERS, T } from './chapters';
import { SQUARE, WIDE } from './frame';
import { coverPoint, NIGHT_PHONE } from './geometry';

gsap.registerPlugin(ScrollTrigger);

export type JourneyMode = 'desktop' | 'mobile';

export interface JourneyHooks {
  /** The chapter (1–6, as an index into CHAPTERS) the reader is in. */
  onChapter: (index: number) => void;
  /** 0–1 through the stage. */
  onProgress: (progress: number) => void;
}

// Points on the art the thread runs between (fractions of each painting).
const SCAN_A = { fx: 660 / 1600, fy: 470 / 900 }; // Sam's phone, chapter 3
const SCAN_B = { fx: 960 / 1600, fy: 480 / 900 }; // Jordan's phone, once it arrives
const DAY_A = { fx: 0.52, fy: 0.57 }; // Sam, in the day panel

/**
 * Builds the whole story as ONE timeline, T units long, scrubbed by scroll from
 * the top of the track to its bottom (the stage is sticky inside it). Positions
 * are in story units; chapters sit at CHAPTERS[].at.
 *
 * Runs inside gsap.matchMedia (desktop / mobile), which reverts every tween and
 * trigger made here on mode change or unmount. Only transform and opacity are
 * animated, plus the thread's stroke-dashoffset (one thin path).
 */
export function buildJourney(root: HTMLElement, mode: JourneyMode, hooks: JourneyHooks) {
  const q = gsap.utils.selector(root);
  const el = (id: string) => q(`[data-j="${id}"]`)[0] as HTMLElement;
  const mobile = mode === 'mobile';
  const stage = el('stage');

  // ------------------------------------------------ stage-size geometry
  // The two-lives panels sit side by side on desktop, stacked on phones.
  const panels = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    return mobile
      ? { w, h, pw: w, ph: h / 2, day: { x: 0, y: 0 }, night: { x: 0, y: h / 2 } }
      : { w, h, pw: w / 2, ph: h, day: { x: 0, y: 0 }, night: { x: w / 2, y: 0 } };
  };

  // A portrait screen crops the wide scan shot to the gap between the phones,
  // so there the two hands are drawn in toward the centre.
  const scanScale = mobile ? 0.7 : 1;
  gsap.set([el('scan-a'), el('scan-b')], { scale: scanScale, transformOrigin: '50% 58%' });

  const thread = el('thread') as unknown as SVGSVGElement;
  const scanPaths = q('[data-j="th-scan"] path') as unknown as SVGPathElement[];
  const splitPaths = q('[data-j="th-split"] path') as unknown as SVGPathElement[];
  let lenScan = 1;
  let lenSplit = 1;

  const layoutThread = () => {
    const P = panels();
    thread.setAttribute('viewBox', `0 0 ${P.w} ${P.h}`);
    // On phones the two hands are pulled in toward the centre (see SCAN_SCALE).
    const pull = (p: { x: number; y: number }) => ({
      x: P.w * 0.5 + (p.x - P.w * 0.5) * scanScale,
      y: P.h * 0.58 + (p.y - P.h * 0.58) * scanScale,
    });
    const a = pull(coverPoint(P.w, P.h, WIDE, SCAN_A.fx, SCAN_A.fy));
    const b = pull(coverPoint(P.w, P.h, WIDE, SCAN_B.fx, SCAN_B.fy));
    const scanD = `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - P.h * 0.14} ${b.x} ${b.y}`;

    const da = coverPoint(P.pw, P.ph, SQUARE, DAY_A.fx, DAY_A.fy);
    const nb = coverPoint(P.pw, P.ph, SQUARE, NIGHT_PHONE.fx, NIGHT_PHONE.fy);
    const A = { x: da.x + P.day.x, y: da.y + P.day.y };
    const B = { x: nb.x + P.night.x, y: nb.y + P.night.y };
    const splitD = mobile
      ? `M ${A.x} ${A.y} C ${A.x + P.w * 0.34} ${A.y + P.h * 0.16} ${B.x - P.w * 0.34} ${B.y - P.h * 0.16} ${B.x} ${B.y}`
      : `M ${A.x} ${A.y} C ${A.x + P.w * 0.15} ${A.y - P.h * 0.24} ${B.x - P.w * 0.15} ${B.y + P.h * 0.24} ${B.x} ${B.y}`;

    scanPaths.forEach((p) => p.setAttribute('d', scanD));
    splitPaths.forEach((p) => p.setAttribute('d', splitD));
    lenScan = scanPaths[0].getTotalLength();
    lenSplit = splitPaths[0].getTotalLength();
    scanPaths.forEach((p) => (p.style.strokeDasharray = `${lenScan}`));
    splitPaths.forEach((p) => (p.style.strokeDasharray = `${lenSplit}`));
  };
  layoutThread();

  // Dive target: Jordan's phone in the night panel → the centre of the screen.
  const dive = () => {
    const P = panels();
    const p = coverPoint(P.pw, P.ph, SQUARE, NIGHT_PHONE.fx, NIGHT_PHONE.fy);
    return {
      origin: `${p.x}px ${p.y}px`,
      dx: P.w / 2 - (P.night.x + p.x),
      dy: P.h / 2 - (P.night.y + p.y),
    };
  };

  // ------------------------------------------------ the timeline
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  // Chapter starts (chapters.ts); later beats are placed relative to them.
  const [, , C3, C4, C5, C6, C7] = CHAPTERS.map((c) => c.at);

  const show = (id: string, at: number, dur = 1.3) => {
    const e = el(id);
    gsap.set(e, { autoAlpha: 0, y: 18 });
    tl.to(e, { autoAlpha: 1, y: 0, duration: dur, ease: 'power1.out' }, at);
  };
  const hide = (id: string, at: number, dur = 1) =>
    tl.to(el(id), { autoAlpha: 0, y: -14, duration: dur, ease: 'power1.in' }, at);

  const cafeMid = [el('cafe-a-seated'), el('cafe-a-standing'), el('cafe-table')];
  gsap.set(cafeMid, { transformOrigin: '50% 72%' });
  gsap.set(el('cafe-bg'), { transformOrigin: '50% 45%' });
  gsap.set(el('cafe-fg'), { transformOrigin: '50% 58%' });
  gsap.set(el('tog-people'), { transformOrigin: '50% 71%' });

  // ── 1 · A conversation: the camera moves through the room to the table.
  tl.to(el('cafe-bg'), { scale: 1.16, duration: 16 }, 0)
    .to(cafeMid, { scale: 1.42, duration: 16 }, 0)
    .to(el('cafe-fg'), { scale: 2.5, duration: 13 }, 0)
    .to(el('cafe-fg'), { opacity: 0, duration: 3 }, 10)
    .to(el('hero'), { autoAlpha: 0, y: -24, duration: 2 }, 3);
  show('c1', 5.5);
  hide('c1', 13);

  // ── 2 · Cut short: Sam has to go.
  tl.to(el('cafe-bg'), { scale: 1.2, duration: 10 }, 16)
    .to(cafeMid, { scale: 1.5, duration: 10 }, 16)
    .to(el('cafe-a-seated'), { opacity: 0, duration: 2 }, 18)
    .fromTo(el('cafe-a-standing'), { opacity: 0, yPercent: 3 }, { opacity: 1, yPercent: 0, duration: 2.4 }, 18);
  show('c2', 19.5);
  hide('c2', 24);

  // ── 3 · The code: the scan, and the thread is born.
  tl.to(el('cafe'), { autoAlpha: 0, scale: 1.18, duration: 3, ease: 'power1.in' }, C3)
    .fromTo(el('scan'), { autoAlpha: 0, scale: 1.1 }, { autoAlpha: 1, scale: 1, duration: 3.2, ease: 'power2.out' }, C3 + 0.6)
    .fromTo(el('scan-a'), { xPercent: -3 }, { xPercent: 0, duration: 7 }, C3 + 0.6)
    .fromTo(
      el('scan-b'),
      { xPercent: 16, yPercent: 7, rotate: 4 },
      { xPercent: 0, yPercent: 0, rotate: 0, duration: 3.8, ease: 'power2.out' },
      C3 + 2.2,
    )
    .fromTo(el('scan-lock'), { opacity: 0 }, { opacity: 1, duration: 0.5 }, C3 + 6)
    .to(el('scan-lock'), { opacity: 0.35, duration: 1.2 }, C3 + 6.5)
    .set(el('th-scan'), { opacity: 1 }, C3 + 6.2)
    .fromTo(scanPaths, { strokeDashoffset: () => lenScan }, { strokeDashoffset: 0, duration: 2.2, ease: 'power1.inOut' }, C3 + 6.2);
  show('t3', C3 + 6.8);
  hide('t3', C3 + 9.8);
  show('c3', C3 + 10.2);
  hide('c3', C4 - 1.4);
  tl.to(el('scan'), { autoAlpha: 0, scale: 0.97, duration: 2.4, ease: 'power1.in' }, C4 - 0.8).to(
    el('th-scan'),
    { opacity: 0, duration: 1.6 },
    C4 - 0.8,
  );

  // ── 4 · Two lives: the screen splits; the thread spans the seam.
  const dayOff = mobile ? { yPercent: -100 } : { xPercent: -100 };
  const nightOff = mobile ? { yPercent: 100 } : { xPercent: 100 };
  tl.set(el('split'), { autoAlpha: 1 }, C4 + 0.4)
    .fromTo(el('day'), dayOff, { xPercent: 0, yPercent: 0, duration: 3.2, ease: 'power3.out' }, C4 + 0.4)
    .fromTo(el('night'), nightOff, { xPercent: 0, yPercent: 0, duration: 3.2, ease: 'power3.out' }, C4 + 0.7)
    .fromTo(el('day-bg'), { scale: 1.1 }, { scale: 1, duration: 14 }, C4 + 0.4)
    .fromTo(el('day-a-walk'), { xPercent: -8 }, { xPercent: 6, duration: 14 }, C4 + 0.4)
    .fromTo(el('night-bg'), { scale: 1 }, { scale: 1.07, duration: 14 }, C4 + 0.4)
    .set(el('th-split'), { opacity: 1 }, C4 + 3.6)
    .fromTo(splitPaths, { strokeDashoffset: () => lenSplit }, { strokeDashoffset: 0, duration: 3, ease: 'power1.inOut' }, C4 + 3.6);
  show('c4a', C4 + 5);
  hide('c4a', C4 + 10.4);
  show('c4b', C4 + 7.8);
  hide('c4b', C4 + 13.4);

  // …the camera dives into Jordan's phone.
  const D = C4 + 14;
  tl.to(el('th-split'), { opacity: 0, duration: 1.2 }, D)
    .to(el('day'), { ...dayOff, duration: 2.6, ease: 'power2.in' }, D)
    .set(el('night'), { transformOrigin: () => dive().origin }, D + 0.3)
    .to(
      el('night'),
      { x: () => dive().dx, y: () => dive().dy, scale: 4.6, duration: 4, ease: 'power2.in' },
      D + 0.4,
    )
    .to(el('night'), { autoAlpha: 0, duration: 1.2 }, D + 3.4)
    .fromTo(el('phone-wrap'), { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 2.6, ease: 'power2.out' }, D + 2.8);

  // The real screens play as you scroll.
  for (let i = 1; i <= 3; i++) {
    const at = D + 6.4 + (i - 1) * 2;
    tl.to(el(`phone-screen-${i - 1}`), { opacity: 0, y: -8, duration: 0.5 }, at)
      .fromTo(el(`phone-screen-${i}`), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8 }, at + 0.55)
      .fromTo(el(`phone-bar-${i}`), { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power1.out' }, at);
  }
  tl.to(el('phone-btn-continue'), { opacity: 0, duration: 0.5 }, D + 10.4).to(
    el('phone-btn-message'),
    { opacity: 1, duration: 0.6 },
    D + 10.6,
  );
  show('c4c', D + 10.9);
  hide('c4c', C5 - 0.9);

  // ── 5 · The thread holds: Jordan replies; Sam's phone lights up.
  tl.to(el('phone-btn-message'), { scale: 0.95, duration: 0.4 }, C5 + 0.4)
    .to(el('phone-btn-message'), { scale: 1, duration: 0.4 }, C5 + 0.8)
    .to(el('phone-btn-message'), { opacity: 0, duration: 0.5 }, C5 + 1.2)
    .to(el('phone-btn-sent'), { opacity: 1, duration: 0.6 }, C5 + 1.3)
    .to(el('phone-wrap'), { autoAlpha: 0, scale: 0.3, duration: 2.4, ease: 'power2.in' }, C5 + 2.2)
    .to(el('night'), { autoAlpha: 1, duration: 1 }, C5 + 2.4)
    .to(el('night'), { x: 0, y: 0, scale: 1, duration: 3, ease: 'power2.out' }, C5 + 2.4)
    .to(el('day'), { xPercent: 0, yPercent: 0, duration: 2.8, ease: 'power3.out' }, C5 + 3)
    .to(el('day-a-walk'), { opacity: 0, duration: 1 }, C5 + 3.4)
    .to(el('day-a-phone'), { opacity: 1, duration: 1.2 }, C5 + 3.6)
    .set(el('th-split'), { opacity: 1 }, C5 + 5)
    // the thread travels back, from Jordan to Sam
    .fromTo(
      splitPaths,
      { strokeDashoffset: () => -lenSplit },
      { strokeDashoffset: 0, duration: 2.4, ease: 'power1.inOut', immediateRender: false },
      C5 + 5,
    )
    .to(el('night-glow'), { opacity: 0.55, duration: 0.8 }, C5 + 5)
    .to(el('night-glow'), { opacity: 1, duration: 0.8 }, C5 + 5.8);
  show('t5', C5 + 6.4);
  hide('t5', C5 + 10);
  show('c5', C5 + 10.4);
  hide('c5', C6 - 2.4);
  tl.to(el('split'), { autoAlpha: 0, scale: 0.95, duration: 2.6, ease: 'power1.in' }, C6 - 2).to(
    el('th-split'),
    { opacity: 0, duration: 1.6 },
    C6 - 2.2,
  );

  // ── 6 · Together: the same table, an open Bible, the warmest light.
  tl.fromTo(el('together'), { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: 3.6, ease: 'power2.out' }, C6)
    .fromTo(el('tog-bg'), { scale: 1 }, { scale: 1.1, duration: 18 }, C6 + 2)
    .fromTo(el('tog-people'), { scale: 1 }, { scale: mobile ? 1.14 : 1.34, duration: 18 }, C6 + 2)
    .to(el('tog-warm'), { opacity: 1, duration: 12 }, C6 + 3);
  show('c6', C6 + 4.6);
  hide('c6', C6 + 9);
  show('c6b', C6 + 9.6);
  hide('c6b', C6 + 14);
  show('t6', C6 + 15, 2.2);
  hide('t6', C7 - 3.2, 1.6);

  // ── 7 · Join: no cut. The camera eases back from the table, the room
  // settles into shadow, and the invitation rises into the same frame.
  tl.to(el('tog-bg'), { scale: 1, duration: 6, ease: 'power1.inOut' }, C7 - 3.6)
    .to(el('tog-people'), { scale: 1, duration: 6, ease: 'power1.inOut' }, C7 - 3.6)
    .to(el('dim'), { opacity: 0.62, duration: 4.5, ease: 'power1.inOut' }, C7 - 2.6)
    .fromTo(el('join'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 3, ease: 'power2.out' }, C7 + 0.6);

  // Dust: strong in the café, faint apart, gone inside the phone, back together.
  tl.fromTo(el('dust-wrap'), { opacity: 0.9 }, { opacity: 0.45, duration: 3 }, C3)
    .to(el('dust-wrap'), { opacity: 0.2, duration: 2 }, C4)
    .to(el('dust-wrap'), { opacity: 0, duration: 2 }, D)
    .to(el('dust-wrap'), { opacity: 1, duration: 4 }, C6)
    .to(el('dust-wrap'), { opacity: 0.4, duration: 4 }, C7 - 2)
    .set({}, {}, T);

  // ------------------------------------------------ scroll drives it
  let lastChapter = -1;
  ScrollTrigger.create({
    trigger: el('track'),
    start: 'top top',
    end: 'bottom bottom',
    scrub: mobile ? 0.6 : 1,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      const t = self.progress * T;
      let idx = 0;
      CHAPTERS.forEach((c, i) => {
        if (t >= c.at - 0.001) idx = i;
      });
      if (idx !== lastChapter) {
        lastChapter = idx;
        hooks.onChapter(idx);
      }
      hooks.onProgress(self.progress);
    },
  });

  ScrollTrigger.addEventListener('refreshInit', layoutThread);
  return () => ScrollTrigger.removeEventListener('refreshInit', layoutThread);
}
