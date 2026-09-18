import { cn } from '@/lib/cn';

/** Cream surface, soft tan border, no shadow — the committed flat depth strategy. */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card p-6', className)} {...props}>
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
