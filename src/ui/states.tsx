import { cn } from '@/lib/cn';

/** Quiet spinner — sage ring, respects reduced motion via slow spin. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-edge border-t-sage',
        className,
      )}
    />
  );
}

/** Full-viewport centered loading, used while auth/membership settles. */
export function FullPageLoading() {
  return (
    <div className="flex min-h-full items-center justify-center py-24">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

/** Centered single-card layout for sign-in / onboarding / soft dead-ends. */
export function CenterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16">
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-edge px-6 py-12 text-center">
      <h3 className="text-base text-sage">{title}</h3>
      {note && <p className="max-w-sm text-sm text-muted-strong">{note}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-sage/20 bg-sage/5 px-3 py-2 text-[13px] text-muted-strong">
      {children}
    </p>
  );
}
