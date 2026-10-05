import { cn } from '@/lib/cn';

/** Cream surface, soft tan border, no shadow — the committed flat depth strategy. */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    // A padding class passed in replaces the default (cn doesn't merge classes).
    <div className={cn('card', /(^|\s)p-\d/.test(className ?? '') ? null : 'p-6', className)} {...props}>
      {children}
    </div>
  );
}

/** A thin sage marker echoing the macron over the ē — the recurring signature. */
export function Marker({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block h-[2px] w-8 rounded-full bg-sage/70', className)}
    />
  );
}
