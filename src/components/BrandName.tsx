import { cn } from '@/lib/cn';

/**
 * Renders "Ekklē" with the macron drawn as a bar centered over the final e.
 * Font-independent — avoids relying on a precomposed ē glyph (which some fonts
 * position poorly). Sizes in em so it scales with whatever font-size is applied.
 */
export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn('whitespace-nowrap', className)}>
      Ekkl
      <span className="relative inline-block leading-none">
        e
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-current"
          style={{ width: '0.5em', height: '0.06em', bottom: '0.74em' }}
        />
      </span>
    </span>
  );
}
