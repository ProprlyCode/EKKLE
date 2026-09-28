import { useEffect, useRef, type FormEvent } from 'react';
import { Button } from '@/ui/Button';

/**
 * The reply box for a conversation (N4): pinned to the bottom of the screen
 * above the phone's keyboard, growing with what's typed (up to six lines),
 * with a large Send button. Ctrl/⌘+Enter sends. When the keyboard opens, the
 * newest message is brought back into view.
 *
 * `aboveNav`: leave room for a fixed tab bar under it on phones (Your space).
 */
export function ReplyBox({
  value,
  onChange,
  onSend,
  sending,
  placeholder,
  bottomRef,
  aboveNav = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
  /** The end of the message list, scrolled into view as the keyboard opens. */
  bottomRef?: React.RefObject<HTMLElement>;
  aboveNav?: boolean;
}) {
  const area = useRef<HTMLTextAreaElement>(null);

  // Grow with the text.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  // The keyboard opening shrinks the visual viewport: keep the newest message in view.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !bottomRef) return;
    const onResize = () => {
      if (document.activeElement === area.current) bottomRef.current?.scrollIntoView({ block: 'end' });
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [bottomRef]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (value.trim() && !sending) onSend();
  }

  return (
    <form
      onSubmit={submit}
      className={
        'sticky z-[5] -mx-5 flex items-end gap-2 border-t border-edge/70 bg-canvas/95 px-5 py-3 backdrop-blur sm:bottom-0 ' +
        (aboveNav
          ? 'bottom-[calc(3.75rem+env(safe-area-inset-bottom))]'
          : 'bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]')
      }
    >
      <textarea
        ref={area}
        rows={1}
        aria-label="Reply"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        className="min-h-[44px] flex-1 resize-none rounded-xl border border-edge bg-card px-3.5 py-2.5 text-[16px] leading-snug text-sage placeholder:text-muted focus:border-sage/50 focus:outline-none sm:text-[15px]"
      />
      <Button type="submit" className="h-11 shrink-0 px-5" disabled={sending || !value.trim()}>
        {sending ? 'Sending…' : 'Send'}
      </Button>
    </form>
  );
}
