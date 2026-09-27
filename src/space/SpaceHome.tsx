import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSeekerConnection, type SeekerConnection } from '@/data/seeker';
import { listStudies, type StudySummary } from '@/data/studies';
import { listSeekerResources, type SeekerResourceSummary } from '@/data/resources';
import { Spinner } from '@/ui/states';

/**
 * Your space — home (/space). The seeker's own place: the person they're
 * talking with, where they are in the studies, and what's next. Everything
 * here is theirs; nothing is forced. A few resources close the page.
 */
export default function SpaceHome() {
  const [convo, setConvo] = useState<SeekerConnection | null | undefined>(undefined);
  const [studies, setStudies] = useState<StudySummary[] | null | undefined>(undefined);
  const [resources, setResources] = useState<SeekerResourceSummary[]>([]);

  useEffect(() => {
    let active = true;
    getSeekerConnection()
      .then((c) => active && setConvo(c))
      .catch(() => active && setConvo(null));
    listStudies()
      .then((s) => active && setStudies(s))
      .catch(() => active && setStudies(null));
    listSeekerResources()
      .then((r) => active && setResources(r))
      .catch(() => undefined); // optional on Home
    return () => {
      active = false;
    };
  }, []);

  if (convo === undefined || studies === undefined)
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );

  const member = convo?.member ?? null;
  const messages = convo?.messages ?? [];
  const last = messages[messages.length - 1];
  const waitingOnThem = last?.sender_type === 'recipient';

  const list = studies ?? [];
  const resume = list.find((s) => !s.locked && !s.completed);
  const done = list.filter((s) => s.completed).length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <span className="eyebrow">your space</span>
        <h1 className="font-serif text-3xl leading-tight text-sage">Welcome</h1>
        <p className="text-[15px] leading-relaxed text-muted-strong">
          Your conversation and your studies, kept together — on any device.
        </p>
      </header>

      {member && (
        <Link
          to="/space/messages"
          className="card group flex flex-col gap-2 px-5 py-5 transition-colors hover:border-sage/40"
        >
          <span className="eyebrow">your conversation</span>
          <span className="font-serif text-xl text-sage">{member.name}</span>
          <span className="line-clamp-2 text-[15px] leading-relaxed text-muted-strong">
            {last
              ? `${last.sender_type === 'member' ? `${member.name}: ` : 'You: '}${last.body}`
              : `Say hello whenever you’re ready — ${member.name} will reply personally.`}
          </span>
          <span className="text-[13px] text-muted">
            {last
              ? waitingOnThem
                ? `${member.name} will reply here, and we’ll email you when they do.`
                : 'Open the conversation'
              : 'Start the conversation'}
          </span>
        </Link>
      )}

      {list.length > 0 && (
        <Link
          to={resume ? `/space/studies/${resume.id}` : '/space/studies'}
          className="card group flex flex-col gap-2 px-5 py-5 transition-colors hover:border-sage/40"
        >
          <span className="eyebrow">{resume?.started ? 'continue your study' : 'your studies'}</span>
          <span className="font-serif text-xl text-sage">
            {resume ? resume.title : 'Every study complete'}
          </span>
          <span className="text-[13px] text-muted">
            {done} of {list.length} complete
            {resume ? (resume.started ? ` · page ${resume.last_page}` : ' · start when you’re ready') : ''}
          </span>
        </Link>
      )}

      {resources.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">for the journey</span>
            <Link to="/space/resources" className="text-[13px] text-muted hover:text-sage">
              All resources →
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {resources.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link
                  to={`/space/resources/${r.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-card px-4 py-3 text-[15px] text-sage transition-colors hover:border-sage/40"
                >
                  <span className="truncate">{r.title}</span>
                  <span aria-hidden className="text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
