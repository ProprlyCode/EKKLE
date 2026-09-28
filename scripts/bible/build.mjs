// Builds the built-in Bible's static text: public/bible/<translation>/<BOOK>.json,
// one file per book — an array of chapters, each an array of verse strings.
//
// Source (public domain): scrollmapper/bible_databases, formats/json/{BSB,KJV}.json
//   curl -o /tmp/BSB.json https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/BSB.json
//   curl -o /tmp/KJV.json https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json
//   node scripts/bible/build.mjs /tmp/BSB.json bsb /tmp/KJV.json kjv
//
// BSB: Berean Standard Bible, public domain since 30 April 2023.
// KJV: King James Version (1769), public domain (outside the UK).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Canonical order (66 books), matching src/bible/books.ts ids and chapter counts.
const IDS = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');
const CHAPTERS = [50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22];

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const [file, code] = [args[i], args[i + 1]];
  const { books } = JSON.parse(readFileSync(file, 'utf8'));
  if (books.length !== 66) throw new Error(`${file}: expected 66 books, got ${books.length}`);
  mkdirSync(`public/bible/${code}`, { recursive: true });
  let verses = 0;
  books.forEach((book, b) => {
    if (book.chapters.length !== CHAPTERS[b]) {
      throw new Error(`${code} ${book.name}: expected ${CHAPTERS[b]} chapters, got ${book.chapters.length}`);
    }
    const chapters = book.chapters.map((c) => {
      const out = [];
      for (const v of c.verses) out[v.verse - 1] = String(v.text).replace(/\s+/g, ' ').trim();
      verses += c.verses.length;
      return Array.from(out, (t) => t ?? '');
    });
    writeFileSync(`public/bible/${code}/${IDS[b]}.json`, JSON.stringify(chapters));
  });
  console.log(`${code}: 66 books, ${verses} verses`);
}
