import type { CSSProperties, ReactNode } from 'react';
import { COPY, TRACK_VH } from './chapters';
import { ArtPin, CoverFrame, SQUARE, WIDE } from './frame';
import {
  CafeASeated,
  CafeAStanding,
  CafeBg,
  CafeFg,
  CafeTable,
  DayAPhone,
  DayAWalking,
  DayBg,
  NightBg,
  NightGlow,
  ScanA,
  ScanB,
  ScanBg,
  Together,
} from './art';
import { Phone } from './Phone';
import { Dust } from './Dust';

/**
 * The journey: a tall scroll track holding one sticky, full-screen stage. Every
 * scene, layer, caption and title lives in the stage, hooked with `data-j` for
 * the timeline (timeline.ts), which scroll scrubs from start to finish.
 *
 * Markup order = paint order: scenes back to front, then light, the thread,
 * the vignette, and the words on top.
 */
export function Stage() {
  return (
    <section
      data-j="track"
      aria-label="The Ekklē story"
      className="relative"
      style={{ height: `${TRACK_VH}svh` }}
    >
      <div data-j="stage" className="sticky top-0 h-[100svh] overflow-hidden bg-home-ink">
        {/* ---- Chapters 1–2: the café ---- */}
        <div data-j="cafe" className="absolute inset-0">
          <Layer id="cafe-bg">
            <CafeBg />
          </Layer>
          <Layer id="cafe-a-seated">
            <CafeASeated />
          </Layer>
          <Layer id="cafe-a-standing" style={{ opacity: 0 }}>
            <CafeAStanding />
          </Layer>
          <Layer id="cafe-table">
            <CafeTable />
            <ArtPin fx={0.4675} fy={0.678} className="w-[3.6%]">
              <Steam />
            </ArtPin>
            <ArtPin fx={0.5325} fy={0.678} className="w-[3.6%]">
              <Steam />
            </ArtPin>
          </Layer>
          <Layer id="cafe-fg">
            <CafeFg />
          </Layer>
        </div>

        {/* ---- Chapter 3: the code ---- */}
        <div data-j="scan" className="absolute inset-0" style={{ opacity: 0, visibility: 'hidden' }}>
          <Layer id="scan-bg">
            <ScanBg />
          </Layer>
          <Layer id="scan-a">
            <ScanA />
          </Layer>
          <Layer id="scan-b">
            <ScanB />
            <div
              data-j="scan-lock"
              className="absolute rounded-[18px] opacity-0"
              style={{
                left: '55.25%',
                top: '36%',
                width: '9.5%',
                height: '35%',
                transform: 'rotate(10deg)',
                background: 'radial-gradient(ellipse at 50% 45%, rgb(214 178 120 / 0.55), transparent 70%)',
              }}
            />
          </Layer>
        </div>

        {/* ---- Chapters 4–5: two lives (side by side on desktop, stacked on phones) ---- */}
        <div
          data-j="split"
          className="absolute inset-0 flex flex-col md:flex-row"
          style={{ opacity: 0, visibility: 'hidden' }}
        >
          <div data-j="day" className="relative h-1/2 w-full overflow-hidden md:h-full md:w-1/2">
            <Layer id="day-bg" aspect={SQUARE}>
              <DayBg />
            </Layer>
            <Layer id="day-a-walk" aspect={SQUARE}>
              <DayAWalking />
            </Layer>
            <Layer id="day-a-phone" aspect={SQUARE} style={{ opacity: 0 }}>
              <DayAPhone />
            </Layer>
          </div>
          <div data-j="night" className="relative h-1/2 w-full overflow-hidden md:h-full md:w-1/2">
            <Layer id="night-bg" aspect={SQUARE}>
              <NightBg />
            </Layer>
            <Layer id="night-glow" aspect={SQUARE}>
              <NightGlow />
            </Layer>
          </div>
          {/* the seam between two lives */}
          <div
            className="pointer-events-none absolute bg-home-ink/80 max-md:inset-x-0 max-md:top-1/2 max-md:h-px md:inset-y-0 md:left-1/2 md:w-px"
            aria-hidden
          />
        </div>

        {/* ---- Chapter 4: inside B's phone ---- */}
        <div
          data-j="phone-wrap"
          className="absolute inset-0 z-[5] flex items-center justify-center"
          style={{
            opacity: 0,
            visibility: 'hidden',
            background: 'radial-gradient(ellipse 38% 48% at 50% 50%, rgb(214 178 120 / 0.16), transparent 70%)',
          }}
        >
          <Phone />
        </div>

        {/* ---- Chapter 6: together ---- */}
        <div data-j="together" className="absolute inset-0" style={{ opacity: 0, visibility: 'hidden' }}>
          <Layer id="tog-bg">
            <CafeBg golden />
          </Layer>
          <Layer id="tog-people">
            <Together />
            <ArtPin fx={0.435} fy={0.678} className="w-[3.2%]">
              <Steam />
            </ArtPin>
          </Layer>
          <div data-j="tog-warm" className="j-warm absolute inset-0 opacity-0" aria-hidden />
        </div>

        {/* ---- light, thread, grade ---- */}
        <div data-j="dust-wrap" className="absolute inset-0" aria-hidden>
          <Dust />
        </div>
        <svg data-j="thread" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <filter id="j-thread-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>
          {(['scan', 'split'] as const).map((k) => (
            <g key={k} data-j={`th-${k}`} style={{ opacity: 0 }}>
              <path data-thread className="fill-none stroke-[rgb(214,178,120)]" strokeWidth={10} strokeOpacity={0.35} filter="url(#j-thread-glow)" />
              <path data-thread className="fill-none stroke-[rgb(233,205,150)]" strokeWidth={2} strokeLinecap="round" />
            </g>
          ))}
        </svg>
        <div data-j="dim" className="absolute inset-0 bg-home-ink opacity-0" aria-hidden />
        <div className="home-vignette absolute inset-0" aria-hidden />

        {/* ---- the words ---- */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-home-ink/75 to-transparent"
          aria-hidden
        />
        <div data-j="hero" className="absolute bottom-[11svh] left-[6vw] right-[6vw] z-10 md:left-[8vw]">
          <h1
            data-j="hero-inner"
            className="home-display j-title max-w-[14ch] text-[clamp(2.25rem,5vw,4.25rem)] text-home-stone"
          >
            {COPY.hero}
          </h1>
        </div>

        <Caption id="c1" className="bottom-[12svh] left-[6vw] md:left-[8vw]">
          {COPY.c1}
        </Caption>
        <Caption id="c2" className="bottom-[12svh] left-[6vw] md:left-[8vw]">
          {COPY.c2}
        </Caption>
        <Title id="t3" low>
          {COPY.t3}
        </Title>
        <Caption id="c4a" className="bottom-[calc(50%+5svh)] left-[6vw] md:bottom-[12svh] md:left-[4vw] md:max-w-[36vw]">
          {COPY.c4a}
        </Caption>
        <Caption id="c4b" className="bottom-[6svh] left-[6vw] md:bottom-[12svh] md:left-[54vw] md:max-w-[36vw]">
          {COPY.c4b}
        </Caption>
        <Title id="t5">{COPY.t5}</Title>
        <Caption id="c6" className="bottom-[12svh] left-[6vw] md:left-[8vw]">
          {COPY.c6}
        </Caption>
        <Title id="t6" big>
          {COPY.t6}
        </Title>
        {COPY.integrity.map((line, i) => (
          <Title key={line} id={`i${i}`}>
            {line}
          </Title>
        ))}
        <div
          data-j="pos"
          className="absolute inset-x-0 bottom-[14svh] z-10 flex justify-center px-6"
          style={{ opacity: 0, visibility: 'hidden' }}
        >
          <p className="j-caption text-center before:mx-auto">{COPY.positioning}</p>
        </div>
      </div>
    </section>
  );
}

/** One depth layer: a size container whose art covers it (see CoverFrame). */
function Layer({
  id,
  aspect = WIDE,
  style,
  children,
}: {
  id: string;
  aspect?: number;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div data-j={id} className="j-cq absolute inset-0" style={style} aria-hidden>
      <CoverFrame aspect={aspect}>{children}</CoverFrame>
    </div>
  );
}

function Caption({ id, className, children }: { id: string; className: string; children: ReactNode }) {
  return (
    <div data-j={id} className={`absolute z-10 ${className}`} style={{ opacity: 0, visibility: 'hidden' }}>
      <p className="j-caption">{children}</p>
    </div>
  );
}

/** `low`: on phones, sit in the lower third so the line clears the art's subject. */
function Title({
  id,
  big = false,
  low = false,
  children,
}: {
  id: string;
  big?: boolean;
  low?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-j={id}
      className={
        'absolute inset-0 z-10 flex justify-center px-6 ' +
        (low ? 'items-end pb-[14svh] md:items-center md:pb-0' : 'items-center')
      }
      style={{ opacity: 0, visibility: 'hidden' }}
    >
      <div className="home-scrim absolute inset-0" aria-hidden />
      <p
        className={
          'home-display j-title relative max-w-[18ch] text-center text-home-stone ' +
          (big ? 'text-[clamp(2.75rem,7vw,6rem)]' : 'text-[clamp(2rem,4.4vw,3.75rem)]')
        }
      >
        {children}
      </p>
    </div>
  );
}

function Steam() {
  return (
    <svg viewBox="0 0 60 90" className="j-steam" aria-hidden>
      <path d="M22 88 C 12 70 32 60 22 42 C 14 28 28 20 24 4" />
      <path d="M38 88 C 28 72 46 62 36 44 C 30 32 42 22 38 8" />
    </svg>
  );
}
