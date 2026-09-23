import type { CSSProperties, ReactNode } from 'react';

/**
 * A box with the art's aspect ratio that covers its container (like
 * object-fit: cover), centered. Its parent must be `.j-cq` (a size container),
 * so the frame can size itself with container-query units in pure CSS.
 *
 * Everything drawn in or pinned to the art uses the frame's percentages, so it
 * lines up with the painting at every screen shape — desktop, phone, split panel.
 */
export function CoverFrame({
  aspect,
  children,
  className = '',
}: {
  aspect: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`j-cover ${className}`} style={{ '--a': aspect } as CSSProperties}>
      {children}
    </div>
  );
}

/** Stage scenes are 16:9; the two-lives panels are square. */
export const WIDE = 16 / 9;
export const SQUARE = 1;

/** An element pinned to a point on the art, e.g. steam over a cup. */
export function ArtPin({
  fx,
  fy,
  children,
  className = '',
}: {
  fx: number;
  fy: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`absolute ${className}`}
      style={{ left: `${fx * 100}%`, top: `${fy * 100}%`, transform: 'translate(-50%, -100%)' }}
    >
      {children}
    </div>
  );
}
