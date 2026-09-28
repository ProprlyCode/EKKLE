import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A short guided tour: the page dims, one thing on it is lit, and a small card
 * explains it, with Back / Next / Skip. Started only when someone asks
 * ("Take a quick tour"). On phones the card sits at the bottom of the screen so
 * it never covers what it points at. Esc closes; ← → step through.
 *
 * A step's `target` is a CSS selector; the first visible match is lit (the
 * same tab can be in a top bar on wide screens and a bottom bar on phones).
 * No match: the card shows on its own.
 */
export interface TourStep {
  target?: string;
  title: string;
  body: string;
}

const PAD = 6;

function findTarget(selector?: string): HTMLElement | null {
  if (!selector) return null;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
  }
  return null;
}

export function Tour({ steps, onClose, label }: { steps: TourStep[]; onClose: () => void; label: string }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640);
  const card = useRef<HTMLDivElement>(null);
  const step = steps[i]!;
  const last = i === steps.length - 1;

  const measure = useCallback(() => {
    setNarrow(window.innerWidth < 640);
    setRect(findTarget(step.target)?.getBoundingClientRect() ?? null);
  }, [step.target]);

  // Bring the step's target into view, then light it.
  useLayoutEffect(() => {
    const el = findTarget(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const bottomRoom = window.innerWidth < 640 ? window.innerHeight * 0.45 : 0;
      if (r.top < 60 || r.bottom > window.innerHeight - bottomRoom) {
        el.scrollIntoView({ block: r.height > window.innerHeight * 0.5 ? 'start' : 'center' });
      }
    }
    measure();
  }, [step.target, measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    card.current?.focus();
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && !last) setI((n) => n + 1);
      if (e.key === 'ArrowLeft' && i > 0) setI((n) => n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, last, onClose]);

  // Card placement: bottom sheet on phones; beside the lit thing otherwise.
  let cardStyle: React.CSSProperties = {};
  if (!narrow) {
    const w = 340;
    if (rect) {
      // Below it, else above it, else (a tall target) at the bottom of the screen.
      const room = 240;
      const left = Math.min(Math.max(16, rect.left), window.innerWidth - w - 16);
      if (window.innerHeight - rect.bottom - PAD >= room) cardStyle = { width: w, left, top: rect.bottom + PAD + 12 };
      else if (rect.top - PAD >= room) cardStyle = { width: w, left, bottom: window.innerHeight - rect.top + PAD + 12 };
      else cardStyle = { width: w, right: 16, bottom: 16 };
    } else {
      cardStyle = { width: w, left: (window.innerWidth - w) / 2, top: window.innerHeight * 0.3 };
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* The dim, with a lit window over the target. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl ring-2 ring-accent transition-all duration-200"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgb(20 24 20 / 0.55)',
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgb(20_24_20/0.55)]" />
      )}
      {/* Clicks outside the card do nothing (Skip or Esc closes). */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={cardStyle}
        className={
          'fixed flex flex-col gap-3 border border-edge bg-card px-5 py-4 shadow-lg outline-none ' +
          (narrow
            ? 'inset-x-0 bottom-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]'
            : 'rounded-xl')
        }
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] tabular-nums text-muted">
            {i + 1} of {steps.length}
          </span>
          <button onClick={onClose} className="text-[13px] text-muted hover:text-sage">
            {last ? 'Close' : 'Skip'}
          </button>
        </div>
        <div>
          <h2 className="font-serif text-lg leading-snug text-sage">{step.title}</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-strong">{step.body}</p>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={() => setI((n) => n - 1)}
            disabled={i === 0}
            className="h-10 rounded-lg px-3 text-sm text-muted hover:text-sage disabled:invisible"
          >
            Back
          </button>
          <button
            onClick={() => (last ? onClose() : setI((n) => n + 1))}
            className="h-10 rounded-lg bg-accent px-5 text-sm font-medium text-canvas hover:bg-accent-soft"
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Take a quick tour" — the only way a tour starts. */
export function TourButton({ steps, label }: { steps: TourStep[]; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 self-start text-[13px] text-sage underline-offset-2 hover:underline"
      >
        <span aria-hidden>◎</span> Take a quick tour
      </button>
      {open && <Tour steps={steps} label={label} onClose={() => setOpen(false)} />}
    </>
  );
}
