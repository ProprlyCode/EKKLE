import type { ReactNode } from 'react';
import { COPY } from './chapters';
import { CoverFrame, SQUARE, WIDE } from './frame';
import {
  CafeAStanding,
  CafeBg,
  CafeTable,
  DayAPhone,
  DayBg,
  NightBg,
  NightGlow,
  ScanA,
  ScanB,
  ScanBg,
  Together,
  CafeASeated,
} from './art';
import { Phone } from './Phone';

/**
 * The story for reduced motion: the same paintings and words as still frames,
 * one after another, with no scrubbing, zoom or parallax. Every line of copy is
 * here, so nothing is lost by turning motion off.
 */
export function JourneyStatic() {
  return (
    <div aria-label="The Ekklē story">
      <Frame layers={[<CafeBg key="b" />, <CafeASeated key="a" />, <CafeTable key="t" />]}>
        <h1 className="home-display max-w-[17ch] text-[clamp(2.25rem,5.4vw,4.25rem)] text-home-stone">
          {COPY.hero}
        </h1>
        <p className="j-caption mt-8">{COPY.c1}</p>
      </Frame>
      <Frame layers={[<CafeBg key="b" />, <CafeAStanding key="a" />, <CafeTable key="t" />]}>
        <p className="j-caption">{COPY.c2}</p>
      </Frame>
      <Frame layers={[<ScanBg key="b" />, <ScanA key="a" />, <ScanB key="c" />]} center>
        <p className="home-display text-[clamp(2rem,4.4vw,3.75rem)] text-home-stone">{COPY.t3}</p>
        <p className="j-caption mx-auto mt-8 text-center before:mx-auto">{COPY.c3}</p>
      </Frame>

      <section className="relative grid md:grid-cols-2">
        <Panel layers={[<DayBg key="b" />, <DayAPhone key="a" />]} caption={COPY.c4a} />
        <Panel layers={[<NightBg key="b" />, <NightGlow key="g" />]} caption={COPY.c4b} />
      </section>

      <section className="flex flex-col items-center gap-10 bg-home-ink px-6 py-20">
        <Phone reduced />
        <p className="j-caption mx-auto text-center before:mx-auto">{COPY.c4c}</p>
        <p className="home-display max-w-[18ch] text-center text-[clamp(2rem,4.4vw,3.75rem)] text-home-stone">
          {COPY.t5}
        </p>
        <p className="j-caption mx-auto text-center before:mx-auto">{COPY.c5}</p>
      </section>

      <Frame layers={[<CafeBg key="b" golden />, <Together key="t" />]}>
        <p className="j-caption">{COPY.c6}</p>
        <p className="j-caption mt-8">{COPY.c6b}</p>
      </Frame>
      <section className="flex justify-center bg-home-ink px-6 py-24 text-center">
        <p className="home-display text-[clamp(2.75rem,7vw,6rem)] text-home-stone">{COPY.t6}</p>
      </section>
    </div>
  );
}

function Frame({ layers, center = false, children }: { layers: ReactNode[]; center?: boolean; children: ReactNode }) {
  return (
    <section className="relative flex min-h-[100svh] overflow-hidden">
      <div className="j-cq absolute inset-0" aria-hidden>
        <CoverFrame aspect={WIDE}>
          {layers.map((l, i) => (
            <div key={i} className="absolute inset-0">
              {l}
            </div>
          ))}
        </CoverFrame>
      </div>
      <div className="home-vignette absolute inset-0" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-home-ink/80 to-transparent" aria-hidden />
      <div
        className={
          'relative z-10 flex w-full flex-col px-[6vw] pb-[12svh] ' +
          (center ? 'items-center justify-center text-center' : 'justify-end')
        }
      >
        {children}
      </div>
    </section>
  );
}

function Panel({ layers, caption }: { layers: ReactNode[]; caption: string }) {
  return (
    <div className="relative flex min-h-[70svh] overflow-hidden md:min-h-[100svh]">
      <div className="j-cq absolute inset-0" aria-hidden>
        <CoverFrame aspect={SQUARE}>
          {layers.map((l, i) => (
            <div key={i} className="absolute inset-0">
              {l}
            </div>
          ))}
        </CoverFrame>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-home-ink/80 to-transparent" aria-hidden />
      <div className="relative z-10 flex w-full flex-col justify-end px-[6vw] pb-[10svh]">
        <p className="j-caption">{caption}</p>
      </div>
    </div>
  );
}
