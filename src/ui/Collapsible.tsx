import { useId } from 'react';
import { useOpen } from './useOpen';

/**
 * Collapsible sections for long lists (studies, prompts, series). A header
 * button shows the title and a short summary ("10 studies · 3 drafts") and
 * opens or closes the list. The choice is remembered on this device when a
 * `storageKey` is given (a convenience only — it falls back to the default).
 */

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={'h-4 w-4 shrink-0 text-muted transition-transform duration-150 ' + (open ? 'rotate-90' : '')}
    >
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The header button on its own, for headers that also hold other actions. */
export function DisclosureButton({
  open,
  onToggle,
  controls,
  children,
  summary,
  className = '',
}: {
  open: boolean;
  onToggle: () => void;
  controls: string;
  children: React.ReactNode;
  summary?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      data-disclosure
      className={'flex min-w-0 flex-1 items-center gap-2 text-left ' + className}
    >
      <Chevron open={open} />
      <span className="min-w-0 flex-1">{children}</span>
      {summary && <span className="shrink-0 text-[13px] text-muted">{summary}</span>}
    </button>
  );
}

/** A whole collapsible section: a header row and the list under it. */
export function Collapsible({
  title,
  summary,
  defaultOpen = false,
  storageKey,
  headerClassName = 'px-5 py-3',
  children,
}: {
  title: React.ReactNode;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  headerClassName?: string;
  children: React.ReactNode;
}) {
  const [open, toggle] = useOpen(storageKey, defaultOpen);
  const id = useId();
  return (
    <div>
      <div className={'flex items-center ' + headerClassName}>
        <DisclosureButton open={open} onToggle={toggle} controls={id} summary={summary}>
          {title}
        </DisclosureButton>
      </div>
      <div id={id} hidden={!open}>
        {open && children}
      </div>
    </div>
  );
}

/** Open/closed state for a section whose header also holds other actions. */
export function Fold({
  storageKey,
  defaultOpen,
  children,
}: {
  storageKey: string;
  defaultOpen: boolean;
  children: (open: boolean, toggle: () => void, id: string) => React.ReactNode;
}) {
  const [open, toggle] = useOpen(storageKey, defaultOpen);
  const id = useId();
  return <>{children(open, toggle, id)}</>;
}
