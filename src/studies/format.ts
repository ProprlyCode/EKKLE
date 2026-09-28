import type { StudyBlock } from '@/data/studies';

/**
 * A study page as editable text, and back:
 *   # A heading
 *   A paragraph, one per line, with _____ for each blank
 *   [image 1]
 */

export const BLANK = '{{}}';
const SHOWN_BLANK = '_____';

export function countBlanks(blocks: StudyBlock[]): number {
  return blocks.reduce((n, b) => n + (b.t === 'p' ? b.text.split(BLANK).length - 1 : 0), 0);
}

/** `images` collects every image across the study; pages refer to them by number. */
export function pageToText(blocks: StudyBlock[], images: string[]): string {
  return blocks
    .map((b) => {
      if (b.t === 'h') return `# ${b.text}`;
      if (b.t === 'img') {
        let i = images.indexOf(b.src);
        if (i < 0) i = images.push(b.src) - 1;
        return `[image ${i + 1}]`;
      }
      return b.text.split(BLANK).join(SHOWN_BLANK);
    })
    .join('\n\n');
}

export function textToBlocks(text: string, images: string[]): StudyBlock[] {
  const blocks: StudyBlock[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const img = /^\[image (\d+)\]$/i.exec(line);
    if (img && images[Number(img[1]) - 1]) {
      blocks.push({ t: 'img', src: images[Number(img[1]) - 1] });
    } else if (line.startsWith('#')) {
      const h = line.replace(/^#+\s*/, '');
      if (h) blocks.push({ t: 'h', text: h });
    } else {
      blocks.push({ t: 'p', text: line.replace(/_{3,}/g, BLANK) });
    }
  }
  return blocks;
}
