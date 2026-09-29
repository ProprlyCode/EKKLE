import { useEffect, useState } from 'react';
import { faithPrompts, PROMPT_KINDS, type Prompt, type PromptKind } from '@/data/prompts';
import { Card } from '@/ui/Card';

/**
 * Faith in action, beside the member's code: this week's prompt (the same
 * for everyone in the ministry) and more ideas to browse — everyday moments,
 * ways to share the code, conversation starters.
 */
export function FaithInAction() {
  const [data, setData] = useState<{ this_week: Prompt | null; prompts: Prompt[] } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    faithPrompts()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data?.this_week) return null;

  return (
    <Card className="flex flex-col gap-3" role="region" aria-label="Faith in action">
      <span className="eyebrow">faith in action · this week</span>
      <p className="font-serif text-lg leading-snug text-sage">{data.this_week.body}</p>
      <span className="text-[12px] text-muted">{PROMPT_KINDS[data.this_week.kind]}</span>
      {data.prompts.length > 1 && (
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="self-start text-[13px] text-sage underline decoration-sage/30 underline-offset-2 hover:decoration-sage"
        >
          {open ? 'Fewer ideas' : 'More ideas'}
        </button>
      )}
      {open &&
        (Object.keys(PROMPT_KINDS) as PromptKind[]).map((kind) => {
          const list = data.prompts.filter((p) => p.kind === kind);
          if (!list.length) return null;
          return (
            <section key={kind} className="flex flex-col gap-2 border-t border-edge/70 pt-3">
              <h3 className="text-[13px] font-medium text-muted-strong">{PROMPT_KINDS[kind]}</h3>
              <ul className="flex flex-col gap-2">
                {list.map((p) => (
                  <li key={p.id} className="text-[15px] leading-relaxed text-sage">
                    {p.body}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </Card>
  );
}
