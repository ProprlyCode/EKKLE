import { describe, expect, it } from 'vitest';
import { safeHref, videoEmbedUrl } from './video';

describe('videoEmbedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=7_CGP-12AE0', 'https://www.youtube-nocookie.com/embed/7_CGP-12AE0'],
    ['https://youtu.be/7_CGP-12AE0?t=3', 'https://www.youtube-nocookie.com/embed/7_CGP-12AE0'],
    ['https://m.youtube.com/shorts/abcDEF12345', 'https://www.youtube-nocookie.com/embed/abcDEF12345'],
    ['https://vimeo.com/123456789', 'https://player.vimeo.com/video/123456789'],
    ['https://player.vimeo.com/video/123456789', 'https://player.vimeo.com/video/123456789'],
  ])('%s', (input, expected) => {
    expect(videoEmbedUrl(input)).toBe(expected);
  });

  it.each([
    'https://example.com/watch?v=7_CGP-12AE0',
    'javascript:alert(1)',
    'https://www.youtube.com/watch?v="><script>',
    'not a url',
    '',
    null,
  ])('rejects %s', (input) => {
    expect(videoEmbedUrl(input)).toBeNull();
  });
});

describe('safeHref', () => {
  it('keeps http(s), adds https to bare hosts, blocks other schemes', () => {
    expect(safeHref('https://a.org/x')).toBe('https://a.org/x');
    expect(safeHref('a.org')).toBe('https://a.org');
    expect(safeHref('javascript:alert(1)')).toBe('#');
    expect(safeHref('')).toBe('#');
  });
});
