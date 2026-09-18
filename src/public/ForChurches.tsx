import { Link } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';
import { Marker } from '@/ui/Card';

/**
 * Church-adoption page (/for-churches) — for leaders deciding whether to trust
 * and adopt the platform. Considered, trustworthy, reverent per the brand guide.
 */
export default function ForChurches() {
  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-5 pb-14 pt-16 text-center sm:pt-24">
        <div className="mb-5 flex flex-col items-center gap-3">
          <span className="eyebrow">for churches</span>
          <Marker />
        </div>
        <h1 className="text-balance font-serif text-4xl leading-[1.15] text-sage sm:text-5xl">
          personal evangelism, without the awkward hand-off
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-muted-strong">
          Ekklē gives every member a personal way to invite someone in — and keeps
          the relationship with the person who actually built it, not a random staff
          member. You stay in support, not in the middle.
        </p>
        <div className="mt-8">
          <a
            href="mailto:hello@ekkle.org?subject=Ekkl%C4%93%20for%20our%20church"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-sage px-6 text-sm font-medium text-canvas transition-colors hover:bg-sage-soft"
          >
            Start a conversation
          </a>
        </div>
      </section>

      <section className="border-y border-edge/60 bg-card/60">
        <div className="mx-auto grid max-w-4xl gap-8 px-5 py-14 sm:grid-cols-3">
          {[
            {
              t: 'Your people, their relationships',
              b: 'Members share a personal link. When someone responds, it goes back to that member — the connection stays theirs.',
            },
            {
              t: 'You author the welcome',
              b: 'Leaders write the guided flows and where they lead. Draft in private, publish when it’s ready.',
            },
            {
              t: 'Built to point offline',
              b: 'No engagement games or retention tricks. Success is real conversations and in-person life together.',
            },
          ].map((c) => (
            <div key={c.t} className="flex flex-col gap-2">
              <Marker />
              <h3 className="font-serif text-lg text-sage">{c.t}</h3>
              <p className="text-[15px] leading-relaxed text-muted-strong">{c.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h2 className="font-serif text-2xl leading-snug text-sage">
          Bring it to your church
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-muted-strong">
          We’re partnering with a small number of churches to start. If that’s you,
          we’d love to talk.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <a
            href="mailto:hello@ekkle.org?subject=Ekkl%C4%93%20for%20our%20church"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-sage px-6 text-sm font-medium text-canvas transition-colors hover:bg-sage-soft"
          >
            Start a conversation
          </a>
          <Link to="/" className="text-[13px] text-muted transition-colors hover:text-sage">
            ← Back to the home page
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
