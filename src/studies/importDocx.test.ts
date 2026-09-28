import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { importDocx, markBlanks } from './importDocx';
import { pageToText, textToBlocks } from './format';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const p = (...lines: string[]) =>
  `<w:p>${lines.map((l, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r><w:t xml:space="preserve">${l}</w:t></w:r>`).join('')}</w:p>`;
const row = (...cells: string[]) => `<w:tr>${cells.map((c) => `<w:tc>${p(c)}</w:tc>`).join('')}</w:tr>`;

function docx(body: string): Uint8Array {
  return zipSync({
    'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`),
  });
}

describe('importDocx', () => {
  it('reads the title, pages, blanks and answer table', () => {
    const s = importDocx(
      docx(
        p('7  THE TEST STUDY', 'Discover', 'A tagline line.', 'A HEADING', 'God “_____” the world and ____ it.', 'Page 1 of 2') +
          p('Second page with ______.') +
          p('Submit Answers', '80%') +
          `<w:tbl>${row('Submitted', 'Answer')}${row('', 'loved')}${row('', 'saved')}${row('', 'all')}</w:tbl>`,
      ),
    );
    expect(s.number).toBe(7);
    expect(s.title).toBe('The Test Study');
    expect(s.tagline).toBe('A tagline line.');
    expect(s.pages).toHaveLength(2);
    expect(s.pages[0].blocks).toEqual([
      { t: 'h', text: 'Discover' },
      { t: 'p', text: 'A tagline line.' },
      { t: 'h', text: 'A HEADING' },
      { t: 'p', text: 'God {{}} the world and {{}} it.' },
    ]);
    expect(s.blanks).toBe(3);
    expect(s.answers).toEqual(['loved', 'saved', 'all']);
    expect(s.warnings).toEqual([]);
  });

  it('splits at page breaks when there are no page lines, and warns about missing answers', () => {
    const s = importDocx(
      docx(p('One ____') + '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' + p('Two')),
      '9 - Plain Study.docx',
    );
    expect(s.title).toBe('Plain Study');
    expect(s.pages).toHaveLength(2);
    expect(s.answers).toEqual(['']);
    expect(s.warnings[0]).toMatch(/No answer table/);
  });

  it('marks blanks, dropping quotes around them', () => {
    expect(markBlanks('a “_____” b ___ c').text).toBe('a {{}} b {{}} c');
  });
});

describe('page text', () => {
  it('round-trips headings, blanks and images', () => {
    const images: string[] = [];
    const blocks = [
      { t: 'h' as const, text: 'Discover' },
      { t: 'img' as const, src: 'data:image/png;base64,AA' },
      { t: 'p' as const, text: 'God is {{}}.' },
    ];
    const text = pageToText(blocks, images);
    expect(text).toBe('# Discover\n\n[image 1]\n\nGod is _____.');
    expect(textToBlocks(text, images)).toEqual(blocks);
  });
});
