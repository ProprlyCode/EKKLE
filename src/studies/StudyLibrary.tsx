import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStudies, type StudySummary } from '@/data/studies';
import { Spinner } from '@/ui/states';

/**
 * The studies library — opened after the /offer email gate. A quiet, brand-led
 * list of studies that unlock in order: the next opens once the previous is
 * finished. Church-owned warmth, no platform chrome.
 */
export default function StudyLibrary() {
  const [studies, setStudies] = useState<StudySummary[] | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let active = true;
    listStudies()
      .then((s) => active && setStudies(s))
      .catch(() => active && setStudies(null));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto flex min-h-full max-w-xl flex-col px-5 py-12">
        <header className="flex flex-col gap-2 pb-8">
          <span className="eyebrow">at your own pace</span>
          <h1 className="font-serif text-3xl leading-tight text-sage">
            Bible studies
          </h1>
          <p className="max-w-md text-[15px] leading-relaxed text-muted-strong">
            A short series you can walk through one study at a time. Each one opens
            up as you finish the last — there’s no rush.
          </p>
        </header>

        {studies === undefined && (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        )}

        {studies === null && (
          <p className="py-16 text-center text-sm text-muted">
            We couldn’t load the studies just now. Please try again in a moment.
          </p>
        )}

        {studies && studies.length === 0 && (
          <p className="py-16 text-center text-sm text-muted">
            No studies here yet — check back soon.
          </p>
        )}

        {studies && studies.length > 0 && (
          <ol className="flex flex-col gap-3">
            {studies.map((s, i) => (
              <StudyRow key={s.id} study={s} index={i} />
            ))}
          </ol>
        )}
      </div>
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
        <span className="block truncate font-serif text-lg text-sage">
          {study.title}
        </span>
        {study.tagline && (
          <span className="mt-0.5 block truncate text-[13px] text-muted">
            {study.tagline}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[12px] uppercase tracking-eyebrow text-muted">
        {study.completed ? 'Done' : study.locked ? 'Locked' : 'Open'}
      </span>
    </div>
  );

  if (study.locked) {
    return (
      <li className="card cursor-default px-5 py-4 opacity-60">{inner}</li>
    );
  }
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
