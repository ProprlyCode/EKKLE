import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { gettingStarted, hideStarted, type StartArea, type StartState } from '@/data/gettingStarted';

/**
 * "Get started" (0044): a short checklist card. Steps tick themselves off as
 * people do them; each links to where it's done. Hidden once everything's
 * done, or when they choose to hide it.
 */
type Step = { key: string; label: string; to?: string; hash?: string; note?: string };

const STEPS: Record<StartArea, { title: string; intro: string; steps: Step[] }> = {
  admin: {
    title: 'Set up your ministry',
    intro: 'A few things to do first. Each one ticks itself off.',
    steps: [
      { key: 'brand', label: 'Add your logo and colour', to: '/leadership/account' },
      { key: 'invite_leader', label: 'Invite a Leader or another Admin', to: '/leadership/people' },
      { key: 'preview_intro', label: 'Look over your introduction', to: '/leadership/content' },
      { key: 'invite_members', label: 'Invite your members, or share the join code', to: '/leadership/people' },
    ],
  },
  member: {
    title: 'Get started',
    intro: 'Four small steps to be ready when a conversation opens up.',
    steps: [
      { key: 'photo', label: 'Add your photo', hash: 'your-photo' },
      { key: 'message', label: 'Write your short message', hash: 'how-you-appear' },
      { key: 'share', label: 'Share your code with someone', hash: 'your-code' },
      { key: 'cards', label: 'Print wallet cards to carry', to: '/app/wallet-cards' },
    ],
  },
  seeker: {
    title: 'Getting started',
    intro: 'Your messages, studies and Bible live here. A few places to begin:',
    steps: [
      { key: 'study', label: 'Start your first study', to: '/space/studies' },
      { key: 'bible', label: 'Open the Bible', to: '/space/bible' },
      { key: 'reminder', label: 'Set a weekly study reminder', to: '/space/studies' },
      { key: 'install', label: 'Add Your space to your home screen', note: 'See below for how' },
    ],
  },
};

export function GetStarted({ area }: { area: StartArea }) {
  const [state, setState] = useState<StartState | null>(null);

  useEffect(() => {
    let active = true;
    gettingStarted(area)
      .then((s) => active && setState(s))
      .catch(() => active && setState(null));
    return () => {
      active = false;
    };
  }, [area]);

  const def = STEPS[area];
  if (!state || state.dismissed) return null;
  const done = def.steps.filter((s) => state.steps[s.key]).length;
  if (done === def.steps.length) return null;

  async function hide() {
    setState((s) => (s ? { ...s, dismissed: true } : s));
    await hideStarted(area).catch(() => undefined);
  }

  return (
    <section aria-label={def.title} className="card flex flex-col gap-4 px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base">{def.title}</h2>
          <p className="mt-1 text-[13px] text-muted-strong">{def.intro}</p>
        </div>
        <span className="shrink-0 text-[13px] tabular-nums text-muted">
          {done} of {def.steps.length}
        </span>
      </div>
      <ol className="flex flex-col gap-1">
        {def.steps.map((s) => {
          const ticked = !!state.steps[s.key];
          const body = (
            <>
              <span
                aria-hidden
                className={
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ' +
                  (ticked ? 'bg-accent text-canvas' : 'border border-edge')
                }
              >
                {ticked ? '✓' : ''}
              </span>
              <span className={ticked ? 'text-muted line-through decoration-edge' : 'text-sage'}>{s.label}</span>
              <span className="sr-only">{ticked ? '(done)' : '(to do)'}</span>
              {!ticked && s.note && <span className="text-[12px] text-muted">· {s.note}</span>}
            </>
          );
          const cls = 'flex items-center gap-3 rounded-lg px-2 py-2 text-[14px]';
          return (
            <li key={s.key}>
              {ticked || (!s.to && !s.hash) ? (
                <div className={cls}>{body}</div>
              ) : s.to ? (
                <Link to={s.to} className={`${cls} hover:bg-sage/[0.04]`}>
                  {body}
                </Link>
              ) : (
                <a
                  href={`#${s.hash}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(s.hash!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`${cls} hover:bg-sage/[0.04]`}
                >
                  {body}
                </a>
              )}
            </li>
          );
        })}
      </ol>
      <button onClick={() => void hide()} className="self-start text-[12px] text-muted hover:text-sage">
        Hide this
      </button>
    </section>
  );
}
