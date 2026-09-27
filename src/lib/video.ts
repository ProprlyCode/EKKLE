/**
 * Turn a pasted YouTube or Vimeo link into a privacy-friendly embed URL.
 * Only recognised IDs are ever placed in an iframe; anything else → null
 * (the page then just offers the link).
 */
export function videoEmbedUrl(raw: string | null | undefined): string | null {
  let url: URL;
  try {
    url = new URL((raw ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\.|^m\./, '');

  let yt: string | null = null;
  if (host === 'youtu.be') yt = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') yt = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
      yt = m?.[1] ?? null;
    }
  }
  if (yt && /^[A-Za-z0-9_-]{6,20}$/.test(yt)) {
    return `https://www.youtube-nocookie.com/embed/${yt}`;
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = url.pathname.match(/(?:^|\/)(\d{5,12})(?:\/|$)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}

/** Only allow http(s) link destinations; add https:// if the scheme is missing. */
export function safeHref(url: string | null | undefined): string {
  const raw = (url ?? '').trim();
  if (!raw) return '#';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '#';
  return `https://${raw}`;
}
