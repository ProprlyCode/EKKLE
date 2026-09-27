import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listSeekerResources, type SeekerResourceSummary } from '@/data/resources';
import { Spinner } from '@/ui/states';

const KIND: Record<SeekerResourceSummary['kind'], string> = {
  text: 'Reading',
  video: 'Video',
  link: 'Link',
};

/** Your space → Resources (/space/resources): the church's published library. */
export default function ResourcesLibrary() {
  const [items, setItems] = useState<SeekerResourceSummary[] | null | undefined>(undefined);
  const [topic, setTopic] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listSeekerResources()
      .then((r) => active && setItems(r))
      .catch(() => active && setItems(null));
    return () => {
      active = false;
    };
  }, []);

  if (items === undefined)
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );

  if (items === null)
    return (
      <p className="py-20 text-center text-sm text-muted">
        We couldn’t load resources just now. Please refresh in a moment.
      </p>
    );

  const topics = [...new Set(items.flatMap((r) => r.topics))].sort();
  const shown = topic ? items.filter((r) => r.topics.includes(topic)) : items;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="eyebrow">resources</span>
        <h1 className="font-serif text-3xl leading-tight text-sage">For the journey</h1>
        <p className="text-[15px] leading-relaxed text-muted-strong">
          Reading, videos and links the church has chosen — at your own pace.
        </p>
      </header>

      {topics.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Topics">
          {[null, ...topics].map((t) => (
            <button
              key={t ?? 'all'}
              onClick={() => setTopic(t)}
              aria-pressed={topic === t}
              className={
                'rounded-full border px-3 py-1 text-[13px] transition-colors ' +
                (topic === t
                  ? 'border-sage bg-sage text-canvas'
                  : 'border-edge text-muted-strong hover:border-sage/50')
              }
            >
              {t ?? 'All'}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-sm leading-relaxed text-muted-strong">
            Nothing here just yet — check back soon.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((r) => (
            <li key={r.id}>
              <Link
                to={`/space/resources/${r.id}`}
                className="card flex flex-col gap-1 px-5 py-4 transition-colors hover:border-sage/40"
              >
                <span className="text-[12px] uppercase tracking-wide text-muted">{KIND[r.kind]}</span>
                <span className="font-serif text-lg text-sage">{r.title}</span>
                {r.blurb && (
                  <span className="text-[14px] leading-relaxed text-muted-strong">{r.blurb}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
