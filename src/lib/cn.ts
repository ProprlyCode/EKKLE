/** Minimal className joiner — avoids a dependency for simple conditional classes. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
