import { useEffect, useState } from 'react';
import {
  getSequence,
  readConnect,
  type SequenceScreen,
  type ConnectConfig,
} from '@/data/sequences';
import { SequenceScreenContent } from './SequenceScreenContent';
import { Spinner } from '@/ui/states';

/**
 * A read-only preview of a flow exactly as a recipient walks it — screens, then
 * the connect ending with its CTAs. Used from the member dashboard so a member
 * can see a flow before choosing it, and reusable anywhere a preview helps.
 */
export default function FlowPreview({
  sequenceId,
  title,
  onClose,
}: {
  sequenceId: string;
  title: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<
    { screens: SequenceScreen[]; connect: ConnectConfig } | null | undefined
  >(undefined);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let active = true;
    getSequence(sequenceId)
      .then((r) => {
        if (!active) return;
        setData(r ? { screens: r.screens, connect: readConnect(r.sequence) } : null);
      })
      .catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, [sequenceId]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = data ? data.screens.length + 1 : 0; // + connect ending
  const onConnect = data ? step >= data.screens.length : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-sage/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-edge bg-canvas shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-edge/70 px-4 py-3">
          <span className="eyebrow">Preview · {title}</span>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="text-muted transition-colors hover:text-sage"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          {data === undefined && (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6" />
            </div>
          )}
          {data === null && (
            <p className="py-16 text-center text-sm text-muted">
              Couldn’t load this flow to preview.
            </p>
          )}
          {data && !onConnect && (
            <SequenceScreenContent
              headline={data.screens[step]?.headline ?? ''}
              body={data.screens[step]?.body ?? ''}
            />
          )}
          {data && onConnect && <ConnectPreview connect={data.connect} />}
        </div>

        {data && (
          <div className="flex items-center justify-between border-t border-edge/70 px-4 py-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="text-[13px] text-muted transition-colors enabled:hover:text-sage disabled:opacity-30"
            >
              Back
            </button>
            <span className="text-[12px] tabular-nums text-muted">
              {Math.min(step + 1, total)} of {total}
            </span>
            {step < total - 1 ? (
              <button
                onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
                className="text-[13px] text-sage transition-colors hover:text-sage-soft"
              >
                Next
              </button>
            ) : (
              <button onClick={onClose} className="text-[13px] text-sage hover:text-sage-soft">
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectPreview({ connect }: { connect: ConnectConfig }) {
  const headline = connect.headline?.trim() || 'someone here would love to talk';
  const body =
    connect.body?.trim() ||
    'A short, warm invitation to connect appears here — no pressure, no script.';
  const ctas =
    connect.ctas.length > 0
      ? connect.ctas
      : [{ label: 'Message', kind: 'message' as const, url: null }];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-3xl leading-tight text-sage">{headline}</h1>
        <p className="whitespace-pre-wrap text-[17px] leading-relaxed text-muted-strong">
          {body}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {ctas.map((cta, i) => (
          <span
            key={i}
            className={
              'inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-medium ' +
              (i === 0 ? 'bg-sage text-canvas' : 'border border-edge text-sage')
            }
          >
            {cta.label || (cta.kind === 'link' ? 'Open' : 'Message')}
          </span>
        ))}
        <p className="mt-1 text-center text-[12px] text-muted">
          Buttons are just for preview here.
        </p>
      </div>
    </div>
  );
}
