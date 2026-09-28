import { unzipSync, strFromU8 } from 'fflate';
import type { StudyBlock } from '@/data/studies';
import { BLANK } from './format';

/**
 * Read a study from a Word file (.docx), in the browser.
 *
 * What the study documents look like:
 *   * a title line — "3  THE IMAGE OF GOD" (number, then the title in capitals);
 *   * pages that each end with a "Page N of M" line (else Word page breaks);
 *   * blanks as runs of underscores (3 or more), sometimes in quotes;
 *   * section labels (Discover, Connect, Experience) and capitalised
 *     subheadings, which become headings;
 *   * "Submit Answers" where the content ends;
 *   * an answer table (a column headed "Answer"), one row per blank, in order.
 */

export interface ImportedStudy {
  number: number | null;
  title: string;
  tagline: string | null;
  pages: Array<{ blocks: StudyBlock[] }>;
  answers: string[];
  /** Blanks whose row in the answer table is empty: people answer in their own words. */
  open: boolean[];
  blanks: number;
  /** Things to check before publishing. */
  warnings: string[];
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const SECTIONS = new Set(['discover', 'connect', 'experience']);
const PAGE_LINE = /^\s*Page\s+(\d+)\s+of\s+(\d+)\s*$/i;
const SMALL = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'to', 'for', 'is', 'on']);

type Item = { kind: 'line'; text: string } | { kind: 'img'; src: string } | { kind: 'break' };

export function isHeading(line: string): boolean {
  const t = line.trim().replace(/:$/, '');
  if (!t) return false;
  if (SECTIONS.has(t.toLowerCase())) return true;
  // A capitalised subheading: "WHY THE BIBLE?", "A PERCEPTUAL FALL".
  return t.length <= 60 && /[A-Z]/.test(t) && !/[a-z]/.test(t) && !/_{3,}/.test(t);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Blanks become the reader's blank token; quotes hugging a blank go. */
export function markBlanks(text: string): { text: string; count: number } {
  let count = 0;
  const out = text
    .replace(/[“"]\s*_{3,}\s*[”"]/g, BLANK)
    .replace(/_{3,}/g, BLANK)
    .replace(/[ \t]{2,}/g, ' ');
  count = out.split(BLANK).length - 1;
  return { text: out.trim(), count };
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function cellText(tc: Element): string {
  return Array.from(tc.getElementsByTagNameNS(W, 't'))
    .map((t) => t.textContent ?? '')
    .join('')
    .trim();
}

export function importDocx(data: Uint8Array, fileName = ''): ImportedStudy {
  const files = unzipSync(data);
  const docXml = files['word/document.xml'];
  if (!docXml) throw new Error('not_a_docx');
  const doc = new DOMParser().parseFromString(strFromU8(docXml), 'application/xml');

  // Images: relationship id → data URL.
  const rels = new Map<string, string>();
  const relXml = files['word/_rels/document.xml.rels'];
  if (relXml) {
    const relDoc = new DOMParser().parseFromString(strFromU8(relXml), 'application/xml');
    for (const rel of Array.from(relDoc.getElementsByTagName('Relationship'))) {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target') ?? '';
      const path = target.startsWith('/') ? target.slice(1) : `word/${target}`;
      const bytes = files[path];
      if (id && bytes) {
        const ext = (path.split('.').pop() ?? 'png').toLowerCase().replace('jpg', 'jpeg');
        rels.set(id, `data:image/${ext};base64,${toBase64(bytes)}`);
      }
    }
  }

  // Flatten the body into lines, images and page breaks; read the answer table.
  const items: Item[] = [];
  let answers: string[] | null = null;

  function paragraph(p: Element) {
    let line = '';
    const flush = () => {
      if (line.trim()) items.push({ kind: 'line', text: line.trim() });
      line = '';
    };
    const pPr = p.getElementsByTagNameNS(W, 'pageBreakBefore')[0];
    if (pPr) items.push({ kind: 'break' });
    const walk = (el: Element) => {
      for (const child of Array.from(el.children)) {
        const name = child.localName;
        if (name === 'pPr' || name === 'rPr' || name === 'delText' || name === 'Fallback') continue;
        if (name === 't') line += child.textContent ?? '';
        else if (name === 'tab') line += ' ';
        else if (name === 'br' || name === 'cr') {
          flush();
          if (child.getAttributeNS(W, 'type') === 'page') items.push({ kind: 'break' });
        } else if (name === 'blip') {
          const src = rels.get(child.getAttributeNS(R, 'embed') ?? '');
          if (src) {
            flush();
            items.push({ kind: 'img', src });
          }
        } else walk(child);
      }
    };
    walk(p);
    flush();
  }

  function table(tbl: Element) {
    const rows = Array.from(tbl.getElementsByTagNameNS(W, 'tr'));
    if (!rows.length) return;
    const head = Array.from(rows[0].getElementsByTagNameNS(W, 'tc')).map(cellText);
    const col = head.findIndex((h) => /^answers?$/i.test(h));
    if (col < 0 || answers) return;
    answers = rows.slice(1).map((tr) => {
      const cell = tr.getElementsByTagNameNS(W, 'tc')[col];
      return cell ? cellText(cell) : '';
    });
  }

  const walkBody = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (child.localName === 'p') paragraph(child);
      else if (child.localName === 'tbl') table(child);
      else if (child.localName === 'sdt' || child.localName === 'sdtContent') walkBody(child);
    }
  };
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (body) walkBody(body);

  // Pages: "Page N of M" lines where the document has them, else page breaks.
  const byPageLines = items.some((i) => i.kind === 'line' && PAGE_LINE.test(i.text));
  const pages: Array<{ blocks: StudyBlock[] }> = [];
  let cur: StudyBlock[] = [];
  let number: number | null = null;
  let title: string | null = null;
  let tagline: string | null = null;
  let seenSection = false;
  let blanks = 0;
  const closePage = () => {
    if (cur.length) pages.push({ blocks: cur });
    cur = [];
  };

  for (const item of items) {
    if (item.kind === 'break') {
      if (!byPageLines) closePage();
      continue;
    }
    if (item.kind === 'img') {
      cur.push({ t: 'img', src: item.src });
      continue;
    }
    const text = item.text;
    if (/^submit answers/i.test(text)) break;
    if (PAGE_LINE.test(text)) {
      closePage();
      continue;
    }
    if (title === null) {
      const m = /^(\d+)\s*[-–.:]?\s+(.+)$/.exec(text);
      if (m && !/[a-z]/.test(m[2])) {
        number = Number(m[1]);
        title = titleCase(m[2].trim());
        continue; // shown in the reader's header
      }
    }
    if (isHeading(text)) {
      if (SECTIONS.has(text.trim().replace(/:$/, '').toLowerCase())) seenSection = true;
      cur.push({ t: 'h', text: text.trim() });
      continue;
    }
    if (tagline === null && seenSection) tagline = text;
    const marked = markBlanks(text);
    blanks += marked.count;
    cur.push({ t: 'p', text: marked.text });
  }
  closePage();

  if (title === null) {
    const base = fileName.replace(/\.docx$/i, '').replace(/^\d+\s*[-–_.]*\s*/, '').replace(/_/g, ' ').trim();
    title = base ? titleCase(base) : 'Untitled study';
    const n = /^(\d+)/.exec(fileName);
    if (n) number = Number(n[1]);
  }

  const warnings: string[] = [];
  const answerTable = answers as string[] | null;
  const found: string[] = [...(answerTable ?? [])];
  while (found.length > blanks && found[found.length - 1] === '') found.pop();
  if (!pages.length) warnings.push('No pages were found.');
  if (answerTable === null && blanks > 0) warnings.push('No answer table was found — add the answers below.');
  else if (found.length !== blanks)
    warnings.push(`The document has ${blanks} blanks and ${found.length} answers — check them below.`);
  const list = Array.from({ length: blanks }, (_, i) => found[i] ?? '');
  const open = Array.from({ length: blanks }, (_, i) => answerTable !== null && i < found.length && !found[i]);

  return { number, title, tagline, pages, answers: list, open, blanks, warnings };
}
