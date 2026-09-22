import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { listStudies, type StudySummary } from '@/data/studies';
import { Spinner } from '@/ui/states';

/**
 * The student dashboard (/studies) — a signed-in home: resume where you left
 * off, see your progress, and browse the whole series with its lock state.
 * Brand-led (Fraunces/Inter, sage on canvas, cream cards).
 */
export default function StudyDashboard() {
  const location = useLocation();
  const justCompleted = (location.state as { completed?: string } | null)?.completed;
  const [studies, setStudies] = useState<StudySummary[] | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    listStudies()
      .then((s) => active && setStudies(s))
      .catch(() => active && setStudies(null));
    return () => {
      active = false;
    };
  }, []);

  if (studies === undefined)
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );

  if (studies === null)
    return (
      <p className="py-20 text-center text-sm text-muted">
        We couldn’t load your studies just now. Please refresh in a moment.
      </p>
    );

  const total = studies.length;
  const done = studies.filter((s) => s.completed).length;
  // Resume = the first unlocked, not-yet-completed study (started or not).
  const resume = studies.find((s) => !s.locked && !s.completed);
  const allDone = total > 0 && done === total;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <span className="eyebrow">your studies</span>
        <h1 className="font-serif text-3xl leading-tight text-sage">Welcome back</h1>
      </header>

      {total === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-sm leading-relaxed text-muted-strong">
            No studies are available just yet — check back soon.
          </p>
        </div>
      ) : (
        <>
          {/* Progress */}
          <section className="card flex flex-col gap-3 px-5 py-5">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">your progress</span>
              <span className="text-[13px] tabular-nums text-muted">
                {done} of {total} complete
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-edge">
              <div
                className="h-full rounded-full bg-sage transition-[width] duration-500"
                style={{ width: `${total ? (done / total) * 100 : 0}%` }}
              />
            </div>
          </section>

          {/* Resume / finished */}
          {resume ? (
            <section className="rounded-card border border-sage/30 bg-sage/[0.04] px-5 py-5">
              <span className="eyebrow">continue</span>
              <h2 className="mt-1 font-serif text-xl text-sage">{resume.title}</h2>
              {resume.tagline && (
                <p className="mt-1 text-[14px] leading-relaxed text-muted-strong">
                  {resume.tagline}
                </p>
              )}
              <Link
                to={`/studies/${resume.id}`}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-sage px-5 text-sm font-medium text-canvas transition-colors hover:bg-sage-soft"
              >
                {resume.started ? 'Continue study' : 'Start study'}
              </Link>
            </section>
          ) : allDone ? (
            <section className="rounded-card border border-sage/30 bg-sage/[0.04] px-5 py-6 text-center">
              <span aria-hidden className="mx-auto mb-2 block h-[2px] w-8 rounded-full bg-sage/70" />
              <h2 className="font-serif text-xl text-sage">You’ve finished the series</h2>
              <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-muted-strong">
                Every study is complete. Thank you for walking through all of it —
                there’s always someone here if you’d like to talk.
              </p>
            </section>
          ) : null}

          {justCompleted && (
            <p className="rounded-lg border border-sage/20 bg-sage/5 px-4 py-3 text-center text-[13px] text-muted-strong">
              Study complete — the next one is unlocked below.
            </p>
          )}

          {/* Full list */}
          <section className="flex flex-col gap-3">
            <span className="eyebrow">all studies</span>
            <ol className="flex flex-col gap-3">
              {studies.map((s, i) => (
                <StudyRow key={s.id} study={s} index={i} />
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

function StudyRow({ study, index }: { study: StudySummary; index: number }) {
  const label = study.number ?? index + 1;
  const inner = (
    <div className="flex items-center gap-4">
      <span
        className={
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-serif text-lg ' +
          (study.completed
            ? 'bg-sage text-canvas'
            : study.locked
              ? 'border border-edge text-muted'
              : 'border border-sage/40 text-sage')
        }
        aria-hidden
      >
        {study.completed ? '✓' : study.locked ? '🔒' : label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-lg text-sage">{study.title}</span>
        {study.tagline && (
          <span className="mt-0.5 block truncate text-[13px] text-muted">{study.tagline}</span>
        )}
      </span>
      <span className="shrink-0 text-[12px] uppercase tracking-eyebrow text-muted">
        {study.completed
          ? 'Done'
          : study.locked
            ? 'Locked'
            : study.started
              ? 'In progress'
              : 'Open'}
      </span>
    </div>
  );

  if (study.locked) return <li className="card cursor-default px-5 py-4 opacity-60">{inner}</li>;
  return (
    <li>
      <Link
        to={`/studies/${study.id}`}
        className="card block px-5 py-4 transition-colors hover:border-sage/40 hover:bg-sage/[0.03]"
      >
        {inner}
      </Link>
    </li>
  );
}
