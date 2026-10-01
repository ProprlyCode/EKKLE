/**
 * Situation link names (0049): the part after a member's link,
 * /r/david/grief. Lowercase letters, numbers and single hyphens, up to 30.
 */

export const LINK_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A link name from a situation's name ("Someone grieving" → "someone-grieving"). */
export function toLinkName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/, '');
}

export function isLinkName(s: string): boolean {
  return s.length <= 30 && LINK_NAME.test(s);
}

/** A member's link for a situation (null: their main link). */
export function situationUrl(mainUrl: string, slug: string | null): string {
  return slug ? `${mainUrl.replace(/\/+$/, '')}/${slug}` : mainUrl;
}
