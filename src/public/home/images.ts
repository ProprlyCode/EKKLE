/**
 * Homepage image slots. Each is `null` until Jonathan uploads the painterly image
 * (see docs/homepage-build.md → Image manifest). While null, the slot renders its
 * CSS/SVG placeholder art; filling it in swaps the real image in with no other
 * change — motion, overlays and alt text stay the same.
 *
 * Files live in /public/home/, so paths are like '/home/hero.webp'.
 */

export interface HomeImageSources {
  /** Desktop landscape crop (WebP). */
  desktop: string;
  /** JPG fallback of the desktop crop. */
  desktopFallback?: string;
  /** Mobile portrait crop (WebP). */
  mobile?: string;
  /** JPG fallback of the mobile crop. */
  mobileFallback?: string;
}

export type HomeImageSlot = 'hero' | 'statusQuo' | 'behold' | 'sanctuary';

export const homeImages: Record<HomeImageSlot, HomeImageSources | null> = {
  hero: null,
  statusQuo: null,
  behold: null,
  sanctuary: null,
};

/** Light (cream/brass) Ekklē mark for dark grounds — '/home/logo-light.svg'. */
export const homeLogoLight: string | null = null;

/** Descriptive alt text — describes the scene, never just "hero image". */
export const homeImageAlt: Record<HomeImageSlot, string> = {
  hero: 'A dark classical archway between columns, a single shaft of warm light falling through it onto the floor.',
  statusQuo:
    'The same colonnade in cold, flat light, a crowd standing far off in indistinct silhouette.',
  behold:
    'On a draped balcony, one figure turns and gestures toward another, who stands in the light while the crowd below looks on.',
  sanctuary: 'A warm sanctuary, its arches glowing with brass-colored light.',
};
