import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { homeImages, homeImageAlt, type HomeImageSlot } from './images';

const typeOf = (src: string) =>
  src.endsWith('.webp') ? 'image/webp' : src.endsWith('.png') ? 'image/png' : 'image/jpeg';

/**
 * One full-bleed painterly image slot. Renders the uploaded image (responsive:
 * mobile portrait crop under 768px) when the slot is configured in images.ts,
 * otherwise the placeholder art — both carry the same descriptive alt text.
 */
export function SceneImage({
  slot,
  placeholder,
  className,
  eager = false,
  decorative = false,
}: {
  slot: HomeImageSlot;
  placeholder: ReactNode;
  className?: string;
  eager?: boolean;
  /** A repeat of an image already described elsewhere — hide from assistive tech. */
  decorative?: boolean;
}) {
  const src = homeImages[slot];
  const alt = decorative ? '' : homeImageAlt[slot];

  if (!src) {
    return (
      <div
        className={cn('absolute inset-0', className)}
        {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': alt })}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <picture className={cn('absolute inset-0 block', className)}>
      {src.mobile && (
        <source media="(max-width: 767px)" srcSet={src.mobile} type={typeOf(src.mobile)} />
      )}
      {src.mobileFallback && (
        <source
          media="(max-width: 767px)"
          srcSet={src.mobileFallback}
          type={typeOf(src.mobileFallback)}
        />
      )}
      <source srcSet={src.desktop} type={typeOf(src.desktop)} />
      <img
        src={src.desktopFallback ?? src.desktop}
        alt={alt}
        aria-hidden={decorative || undefined}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="h-full w-full object-cover"
      />
    </picture>
  );
}
