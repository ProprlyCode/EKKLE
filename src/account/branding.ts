import { supabase } from '@/lib/supabase';

/**
 * An account's branding (docs/tenancy.md, phase 2): its name, logo and accent
 * colour, applied to every page on its address. The calm Ekklē layout stays;
 * only the accent (buttons, active tabs, highlights), the logo, the page title
 * and the home-screen app's name and icon change.
 */

export interface Branding {
  name: string;
  accent_color: string | null;
  logo_path: string | null;
}

/** Ekklē's sage — the accent when an account hasn't picked one. */
export const DEFAULT_ACCENT = '#3f4a3a';
/** The page background every accent must read against. */
const PAGE = '#f4f1ea';
/** WCAG AA for normal text; the database enforces the same (0024). */
export const MIN_CONTRAST = 4.5;

export const BRANDING_BUCKET = 'branding';

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast of a colour against the page (text on it, and it on the page). */
export function contrastOnPage(hex: string): number {
  if (!isHex(hex)) return 0;
  return (luminance(PAGE) + 0.05) / (luminance(hex.toLowerCase()) + 0.05);
}

/** A slightly lighter shade for hover. */
function soften([r, g, b]: [number, number, number]): [number, number, number] {
  const mix = (c: number) => Math.round(c + (255 - c) * 0.12);
  return [mix(r), mix(g), mix(b)];
}

export function publicUrl(path: string): string {
  return supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Icons are generated beside the logo when it's uploaded (see iconsFromLogo). */
export function iconPath(logoPath: string, size: 192 | 512): string {
  return logoPath.replace(/\/[^/]+$/, `/icon-${size}.png`);
}

/** Sets the accent on the page (the `accent` colour in tailwind.config.ts). */
export function applyAccent(accent: string | null) {
  const hex = accent && isHex(accent) ? accent : DEFAULT_ACCENT;
  const rgb = channels(hex);
  const root = document.documentElement.style;
  root.setProperty('--accent', rgb.join(' '));
  root.setProperty('--accent-soft', soften(rgb).join(' '));
}

function setHead(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

let manifestUrl: string | null = null;

/**
 * Brands the whole page for an account: accent, title, and the home-screen
 * app (name and icon — the manifest for Android/desktop, the Apple tags for
 * iPhone). Without a logo the app keeps Ekklē's icon but takes the name.
 */
export function applyBranding(b: Branding) {
  applyAccent(b.accent_color);
  document.title = b.name;

  const origin = window.location.origin;
  const icons = b.logo_path
    ? [
        { src: publicUrl(iconPath(b.logo_path, 192)), sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: publicUrl(iconPath(b.logo_path, 512)), sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: publicUrl(iconPath(b.logo_path, 512)), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]
    : [
        { src: `${origin}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${origin}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `${origin}/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ];
  const manifest = {
    id: `${origin}/space`,
    name: b.name,
    short_name: b.name.length > 14 ? b.name.slice(0, 13).trimEnd() + '…' : b.name,
    description: 'Your conversation, studies and resources, kept together.',
    start_url: `${origin}/space`,
    scope: `${origin}/`,
    display: 'standalone',
    background_color: PAGE,
    theme_color: PAGE,
    icons,
  };
  if (manifestUrl) URL.revokeObjectURL(manifestUrl);
  manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
  const link = (rel: string) => () => Object.assign(document.createElement('link'), { rel });
  setHead('link[rel="manifest"]', link('manifest'), 'href', manifestUrl);
  setHead(
    'link[rel="apple-touch-icon"]',
    link('apple-touch-icon'),
    'href',
    b.logo_path ? publicUrl(iconPath(b.logo_path, 512)) : '/apple-touch-icon.png',
  );
  setHead(
    'meta[name="apple-mobile-web-app-title"]',
    () => Object.assign(document.createElement('meta'), { name: 'apple-mobile-web-app-title' }),
    'content',
    b.name,
  );
}

// ---------------------------------------------------------------- uploading

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('unreadable_image'));
    img.src = url;
  });
}

/** A square app icon: the logo centred on the card colour, inside the safe zone. */
async function renderIcon(img: HTMLImageElement, size: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fdfcf8';
  ctx.fillRect(0, 0, size, size);
  const w = img.naturalWidth || size;
  const h = img.naturalHeight || size;
  const box = size * 0.66; // inside the maskable safe zone (80%)
  const scale = Math.min(box / w, box / h);
  ctx.drawImage(img, (size - w * scale) / 2, (size - h * scale) / 2, w * scale, h * scale);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('icon_failed'))), 'image/png'),
  );
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/**
 * Uploads a logo and the app icons made from it into the account's folder,
 * under a fresh version so browsers and home screens pick up the change.
 * Returns the logo's path, for set_account_branding.
 */
export async function uploadLogo(orgId: string, file: File): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new Error('unsupported_type');
  if (file.size > 2 * 1024 * 1024) throw new Error('too_large');
  const img = await loadImage(file);
  const dir = `${orgId}/${Date.now()}`;
  const bucket = supabase.storage.from(BRANDING_BUCKET);
  const put = async (path: string, body: Blob, contentType: string) => {
    const { error } = await bucket.upload(path, body, { contentType, cacheControl: '31536000' });
    if (error) throw error;
  };
  const [i192, i512] = await Promise.all([renderIcon(img, 192), renderIcon(img, 512)]);
  const logoPath = `${dir}/logo.${ext}`;
  await put(logoPath, file, file.type);
  await put(`${dir}/icon-192.png`, i192, 'image/png');
  await put(`${dir}/icon-512.png`, i512, 'image/png');
  return logoPath;
}

export async function saveBranding(input: Branding): Promise<Branding> {
  const { data, error } = await supabase.rpc('set_account_branding', {
    p_name: input.name,
    p_accent_color: input.accent_color,
    p_logo_path: input.logo_path,
  });
  if (error) throw error;
  return data as unknown as Branding;
}
