import { CHAPTERS } from './chapters';

/**
 * Where you are in the story. Desktop: a quiet numbered rail on the right, the
 * current chapter in brass, each one a jump link. Phones: a hairline progress
 * bar across the top with the chapter name.
 */
export function ChapterRail({
  active,
  progress,
  onJump,
}: {
  active: number;
  progress: number;
  onJump: (index: number) => void;
}) {
  const current = CHAPTERS[active];
  return (
    <>
      <nav
        aria-label="Chapters"
        className="fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 md:block lg:right-8"
      >
        <ol className="flex flex-col items-end gap-3.5">
          {CHAPTERS.map((c, i) => {
            const on = i === active;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  aria-current={on ? 'step' : undefined}
                  className="home-focus group flex items-center gap-3 py-0.5 text-right"
                >
                  <span
                    className={
                      'text-[12px] tracking-wide transition-all duration-500 ' +
                      (on
                        ? 'translate-x-0 text-home-stone opacity-100'
                        : 'translate-x-1 text-home-stone-dim opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100')
                    }
                  >
                    {c.title}
                  </span>
                  <span
                    className={
                      'font-serif text-[12px] tabular-nums transition-colors duration-500 ' +
                      (on ? 'text-home-brass' : 'text-home-stone-dim/70 group-hover:text-home-stone')
                    }
                  >
                    {String(c.n).padStart(2, '0')}
                  </span>
                  <span
                    className={
                      'h-px transition-all duration-500 ' +
                      (on ? 'w-7 bg-home-brass' : 'w-3.5 bg-home-stone-dim/50 group-hover:w-5')
                    }
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="fixed inset-x-0 top-0 z-30 md:hidden" aria-hidden>
        <div className="h-[2px] bg-home-stone/10">
          <div
            className="h-full origin-left bg-home-brass"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </div>
      <p
        className="pointer-events-none fixed left-5 top-[60px] z-30 whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-home-stone-dim md:hidden"
        aria-live="polite"
      >
        <span className="font-serif text-home-brass">{String(current.n).padStart(2, '0')}</span>
        <span className="mx-2 opacity-50">·</span>
        {current.title}
      </p>
    </>
  );
}
