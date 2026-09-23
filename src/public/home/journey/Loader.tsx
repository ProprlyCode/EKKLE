import { useEffect, useState } from 'react';
import { BrandName } from '@/components/BrandName';

const MIN_MS = 2100;
const MAX_MS = 4000;

/**
 * The page loader: an archway draws itself, a single thread winds through it,
 * the name fades in and a brass bar fills. It lifts once the fonts are in and
 * the mark has finished drawing (never longer than MAX_MS), then calls onDone.
 * Under reduced motion it is skipped entirely (the parent doesn't mount it).
 */
export function Loader({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let live = true;
    const start = performance.now();
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, MAX_MS));
    void Promise.race([fonts, timeout]).then(() => {
      const wait = Math.max(0, MIN_MS - (performance.now() - start));
      setTimeout(() => live && setLeaving(true), wait);
    });
    return () => {
      live = false;
    };
  }, []);

  // Hand back as the curtain starts to lift; unmount once it has faded.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!leaving) return;
    onDone();
    const t = setTimeout(() => setGone(true), 950);
    return () => clearTimeout(t);
  }, [leaving, onDone]);
  if (gone) return null;

  return (
    <div className={`j-loader ${leaving ? 'is-leaving' : ''}`} role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-6">
        <svg viewBox="0 0 120 120" className="j-mark h-20 w-20" aria-hidden>
          {/* the arch */}
          <path d="M24 104 V56 A36 36 0 0 1 96 56 V104" stroke="rgb(241 236 225)" strokeWidth="3" />
          {/* the thread, winding through it */}
          <path
            d="M8 92 C 34 92 38 66 60 66 C 82 66 84 40 112 40"
            stroke="rgb(169 130 76)"
            strokeWidth="2.5"
          />
        </svg>
        <BrandName className="j-word font-serif text-2xl text-home-stone" />
        <span className="block h-px w-28 overflow-hidden bg-home-stone/15" aria-hidden>
          <span className="j-bar block h-full w-full bg-home-brass" />
        </span>
      </div>
    </div>
  );
}
