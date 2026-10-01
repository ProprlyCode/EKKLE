import { useEffect, useState } from 'react';
import { copyFlowTemplate, ministryFlowTemplates, type FlowTemplate } from '@/data/situations';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Collapsible } from '@/ui/Collapsible';
import { ErrorNote } from '@/ui/states';
import { SequenceScreenContent } from '@/recipient/SequenceScreenContent';

/**
 * Content → Templates (0048): Ekklē's flows for everyday situations. "Use this
 * template" copies one into the ministry's flows to edit freely.
 */
export function TemplateGallery({ onOpen }: { onOpen: (flowId: string) => void }) {
  const [templates, setTemplates] = useState<FlowTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ministryFlowTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  if (!templates || templates.length === 0) return null;

  async function use(t: FlowTemplate) {
    setError(null);
    try {
      onOpen(await copyFlowTemplate(t.id));
    } catch {
      setError('Couldn’t copy that template. Please try again.');
    }
  }

  const groups: { label: string; list: FlowTemplate[] }[] = [
    { label: 'For members to share in person', list: templates.filter((t) => t.audience === 'personal') },
    { label: 'For posters, clothing and welcome tables', list: templates.filter((t) => t.audience === 'public') },
  ];

  return (
    <section aria-label="Templates" className="flex flex-col gap-3">
      <div>
        <h2 className="text-base">Templates</h2>
        <p className="mt-1 text-sm text-muted-strong">
          Flows written by Ekklē for everyday situations. Use one to start a flow of your own — then edit it however
          you like.
        </p>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {groups
        .filter((g) => g.list.length > 0)
        .map((g) => (
          <Card key={g.label} className="p-0">
            <Collapsible
              storageKey={`content.templates.${g.list[0]!.audience}`}
              defaultOpen={g.list[0]!.audience === 'personal'}
              title={<h3 className="text-[15px] font-medium text-sage">{g.label}</h3>}
              summary={`${g.list.length}`}
            >
              <ul className="divide-y divide-edge/70 border-t border-edge/70">
                {g.list.map((t) => (
                  <TemplateRow key={t.id} t={t} onUse={() => void use(t)} onOpen={onOpen} />
                ))}
              </ul>
            </Collapsible>
          </Card>
        ))}
    </section>
  );
}

function TemplateRow({ t, onUse, onOpen }: { t: FlowTemplate; onUse: () => void; onOpen: (id: string) => void }) {
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sage">{t.situation}</p>
          <p className="text-[13px] text-muted-strong">“{t.title}”</p>
          {t.when_to_use && <p className="mt-1 text-[13px] text-muted">{t.when_to_use}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" aria-expanded={previewing} onClick={() => setPreviewing((p) => !p)}>
            {previewing ? 'Hide preview' : 'Preview'}
          </Button>
          {t.copy_id ? (
            <Button size="sm" variant="quiet" onClick={() => onOpen(t.copy_id!)}>
              Open your copy
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                onUse();
              }}
            >
              Use this template
            </Button>
          )}
        </div>
      </div>
      {previewing && (
        <ol className="flex flex-col gap-3 rounded-lg border border-edge bg-canvas px-4 py-4" aria-label={`${t.situation} preview`}>
          {t.screens.map((s, i) => (
            <li key={i} className="border-b border-edge/60 pb-3 last:border-0 last:pb-0">
              <span className="eyebrow">screen {i + 1}</span>
              <SequenceScreenContent headline={s.headline} body={s.body} />
            </li>
          ))}
          {(t.connect.headline || t.connect.body) && (
            <li>
              <span className="eyebrow">ending</span>
              <p className="mt-1 font-serif text-lg text-sage">{t.connect.headline}</p>
              <p className="text-sm text-muted-strong">{t.connect.body}</p>
            </li>
          )}
        </ol>
      )}
    </li>
  );
}
