import { useNavigate, useSearchParams } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';
import { Button } from '@/ui/Button';
import { Marker } from '@/ui/Card';

/**
 * Public seeker offer (/) — the warm front door. Free, personal Bible studies
 * and honest answers, shared by a real person. Brand-led, unhurried, no pressure.
 */
export default function Home() {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const navigate = useNavigate();

  // Every "start" path leads to the /offer email gate, which opens the studies
  // library — not straight into a member's QR flow. Carry any ?ref for attribution.
  function start() {
    navigate(ref ? `/offer?ref=${encodeURIComponent(ref)}` : '/offer');
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 pb-16 pt-16 text-center sm:pt-24">
        <div className="mb-5 flex flex-col items-center gap-3">
          <span className="eyebrow">gathered together</span>
          <Marker />
        </div>
        <h1 className="text-balance font-serif text-4xl leading-[1.15] text-sage sm:text-5xl">
          a real conversation about the things that matter
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-muted-strong">
          Free, personal Bible studies and honest answers to real questions —
          shared with you by someone who’d genuinely love to talk. No program, no
          pressure, no rush.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button onClick={start} className="px-6">
            Start a study
          </Button>
          <p className="text-[13px] text-muted">Begin anywhere. Stop anytime.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-edge/60 bg-card/60">
        <div className="mx-auto grid max-w-4xl gap-8 px-5 py-14 sm:grid-cols-3">
          {[
            {
              t: 'Start wherever you are',
              b: 'No church background needed. Come with your real questions, exactly as they are.',
            },
            {
              t: 'A real person, not a program',
              b: 'Someone here would love to walk through it with you — whenever you’re ready, never before.',
            },
            {
              t: 'Go at your own pace',
              b: 'Read a little, sit with it, come back. There’s no schedule and nothing to keep up with.',
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

      {/* Topics */}
      <section className="mx-auto max-w-4xl px-5 py-16">
        <div className="mb-8 text-center">
          <span className="eyebrow">questions worth asking</span>
          <h2 className="mt-2 font-serif text-2xl text-sage">Where would you like to begin?</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {TOPICS.map((t) => (
            <button
              key={t.title}
              onClick={start}
              className="rounded-card border border-edge bg-card p-6 text-left transition-colors hover:border-sage/40"
            >
              <h3 className="font-serif text-lg text-sage">{t.title}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-muted-strong">{t.blurb}</p>
              <span className="mt-3 inline-block text-[13px] text-sage">Start →</span>
            </button>
          ))}
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-edge/60">
        <div className="mx-auto max-w-2xl px-5 py-16 text-center">
          <h2 className="font-serif text-2xl leading-snug text-sage">
            Whenever you’re ready, the door is open
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-muted-strong">
            You won’t be signed up for anything or added to a list. Just a quiet
            place to explore, and a real person if you want one.
          </p>
          <div className="mt-7">
            <Button onClick={start} className="px-6">
              Start a study
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

// Static/curated for now; a topic-mapped library rides with Phase B.
const TOPICS = [
  {
    title: 'Is there hope when life is heavy?',
    blurb: 'For the seasons that feel like more than we can carry.',
  },
  {
    title: 'Why is there suffering?',
    blurb: 'An honest look at one of the hardest questions there is.',
  },
  {
    title: 'Who is Jesus, really?',
    blurb: 'Beyond what you may have heard — a chance to see for yourself.',
  },
  {
    title: 'What am I here for?',
    blurb: 'On meaning, purpose, and being genuinely known.',
  },
];
