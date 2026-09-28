/**
 * The 66 books (Protestant canon), their chapter counts, and the names people
 * write them by — for the Bible reader and for turning references in studies
 * ("Gen. 1:27", "1 John 4:16", "Rom 5:8") into links.
 */

export interface Book {
  /** Stable id, used in URLs and file names ("GEN", "1JN"). */
  id: string;
  name: string;
  chapters: number;
  /** Other ways it's written (lowercase, no dots). */
  aliases: string[];
  testament: 'OT' | 'NT';
}

const B = (id: string, name: string, chapters: number, aliases: string[], testament: 'OT' | 'NT'): Book => ({
  id,
  name,
  chapters,
  aliases,
  testament,
});

export const BOOKS: Book[] = [
  B('GEN', 'Genesis', 50, ['gen', 'ge', 'gn'], 'OT'),
  B('EXO', 'Exodus', 40, ['exod', 'exo', 'ex'], 'OT'),
  B('LEV', 'Leviticus', 27, ['lev', 'le', 'lv'], 'OT'),
  B('NUM', 'Numbers', 36, ['num', 'nu', 'nm'], 'OT'),
  B('DEU', 'Deuteronomy', 34, ['deut', 'deu', 'dt'], 'OT'),
  B('JOS', 'Joshua', 24, ['josh', 'jos'], 'OT'),
  B('JDG', 'Judges', 21, ['judg', 'jdg', 'jg'], 'OT'),
  B('RUT', 'Ruth', 4, ['ruth', 'ru', 'rth'], 'OT'),
  B('1SA', '1 Samuel', 31, ['1 sam', '1sam', '1 sa', '1sa', 'i samuel', 'first samuel'], 'OT'),
  B('2SA', '2 Samuel', 24, ['2 sam', '2sam', '2 sa', '2sa', 'ii samuel', 'second samuel'], 'OT'),
  B('1KI', '1 Kings', 22, ['1 kgs', '1kgs', '1 ki', '1ki', 'i kings', 'first kings'], 'OT'),
  B('2KI', '2 Kings', 25, ['2 kgs', '2kgs', '2 ki', '2ki', 'ii kings', 'second kings'], 'OT'),
  B('1CH', '1 Chronicles', 29, ['1 chron', '1 chr', '1chr', '1 ch', 'i chronicles', 'first chronicles'], 'OT'),
  B('2CH', '2 Chronicles', 36, ['2 chron', '2 chr', '2chr', '2 ch', 'ii chronicles', 'second chronicles'], 'OT'),
  B('EZR', 'Ezra', 10, ['ezra', 'ezr'], 'OT'),
  B('NEH', 'Nehemiah', 13, ['neh', 'ne'], 'OT'),
  B('EST', 'Esther', 10, ['esth', 'est', 'es'], 'OT'),
  B('JOB', 'Job', 42, ['job', 'jb'], 'OT'),
  B('PSA', 'Psalms', 150, ['psalm', 'ps', 'psa', 'pss', 'psalms'], 'OT'),
  B('PRO', 'Proverbs', 31, ['prov', 'pro', 'prv', 'pr'], 'OT'),
  B('ECC', 'Ecclesiastes', 12, ['eccl', 'eccles', 'ecc', 'ec', 'qoh'], 'OT'),
  B('SNG', 'Song of Songs', 8, ['song of solomon', 'song', 'sos', 'song of sol', 'canticles'], 'OT'),
  B('ISA', 'Isaiah', 66, ['isa', 'is'], 'OT'),
  B('JER', 'Jeremiah', 52, ['jer', 'je', 'jr'], 'OT'),
  B('LAM', 'Lamentations', 5, ['lam', 'la'], 'OT'),
  B('EZK', 'Ezekiel', 48, ['ezek', 'eze', 'ezk'], 'OT'),
  B('DAN', 'Daniel', 12, ['dan', 'da', 'dn'], 'OT'),
  B('HOS', 'Hosea', 14, ['hos', 'ho'], 'OT'),
  B('JOL', 'Joel', 3, ['joel', 'jl'], 'OT'),
  B('AMO', 'Amos', 9, ['amos', 'am'], 'OT'),
  B('OBA', 'Obadiah', 1, ['obad', 'ob'], 'OT'),
  B('JON', 'Jonah', 4, ['jonah', 'jnh'], 'OT'),
  B('MIC', 'Micah', 7, ['mic', 'mc'], 'OT'),
  B('NAM', 'Nahum', 3, ['nah', 'na'], 'OT'),
  B('HAB', 'Habakkuk', 3, ['hab', 'hb'], 'OT'),
  B('ZEP', 'Zephaniah', 3, ['zeph', 'zep', 'zp'], 'OT'),
  B('HAG', 'Haggai', 2, ['hag', 'hg'], 'OT'),
  B('ZEC', 'Zechariah', 14, ['zech', 'zec', 'zc'], 'OT'),
  B('MAL', 'Malachi', 4, ['mal', 'ml'], 'OT'),
  B('MAT', 'Matthew', 28, ['matt', 'mat', 'mt'], 'NT'),
  B('MRK', 'Mark', 16, ['mark', 'mrk', 'mk', 'mr'], 'NT'),
  B('LUK', 'Luke', 24, ['luke', 'luk', 'lk'], 'NT'),
  B('JHN', 'John', 21, ['john', 'jhn', 'jn'], 'NT'),
  B('ACT', 'Acts', 28, ['acts', 'act', 'ac'], 'NT'),
  B('ROM', 'Romans', 16, ['rom', 'ro', 'rm'], 'NT'),
  B('1CO', '1 Corinthians', 16, ['1 cor', '1cor', '1 co', 'i corinthians', 'first corinthians'], 'NT'),
  B('2CO', '2 Corinthians', 13, ['2 cor', '2cor', '2 co', 'ii corinthians', 'second corinthians'], 'NT'),
  B('GAL', 'Galatians', 6, ['gal', 'ga'], 'NT'),
  B('EPH', 'Ephesians', 6, ['eph', 'ephes'], 'NT'),
  B('PHP', 'Philippians', 4, ['phil', 'php', 'pp'], 'NT'),
  B('COL', 'Colossians', 4, ['col', 'co'], 'NT'),
  B('1TH', '1 Thessalonians', 5, ['1 thess', '1 thes', '1thess', '1 th', 'i thessalonians', 'first thessalonians'], 'NT'),
  B('2TH', '2 Thessalonians', 3, ['2 thess', '2 thes', '2thess', '2 th', 'ii thessalonians', 'second thessalonians'], 'NT'),
  B('1TI', '1 Timothy', 6, ['1 tim', '1tim', '1 ti', 'i timothy', 'first timothy'], 'NT'),
  B('2TI', '2 Timothy', 4, ['2 tim', '2tim', '2 ti', 'ii timothy', 'second timothy'], 'NT'),
  B('TIT', 'Titus', 3, ['titus', 'tit'], 'NT'),
  B('PHM', 'Philemon', 1, ['philem', 'phm', 'phlm'], 'NT'),
  B('HEB', 'Hebrews', 13, ['heb'], 'NT'),
  B('JAS', 'James', 5, ['jas', 'jm'], 'NT'),
  B('1PE', '1 Peter', 5, ['1 pet', '1pet', '1 pe', '1pe', 'i peter', 'first peter'], 'NT'),
  B('2PE', '2 Peter', 3, ['2 pet', '2pet', '2 pe', '2pe', 'ii peter', 'second peter'], 'NT'),
  B('1JN', '1 John', 5, ['1 jn', '1jn', '1 jhn', '1 joh', 'i john', 'first john'], 'NT'),
  B('2JN', '2 John', 1, ['2 jn', '2jn', '2 jhn', 'ii john', 'second john'], 'NT'),
  B('3JN', '3 John', 1, ['3 jn', '3jn', '3 jhn', 'iii john', 'third john'], 'NT'),
  B('JUD', 'Jude', 1, ['jude', 'jud'], 'NT'),
  B('REV', 'Revelation', 22, ['rev', 're', 'rv', 'revelations', 'the revelation'], 'NT'),
];

export const BOOK_BY_ID: Record<string, Book> = Object.fromEntries(BOOKS.map((b) => [b.id, b]));

// Every way a book is written → the book. Longest names first, so "1 John"
// wins over "John" and "Song of Songs" over "Song".
const NAMES: Array<[string, Book]> = BOOKS.flatMap((b) =>
  [b.name.toLowerCase(), ...b.aliases].map((n) => [n, b] as [string, Book]),
).sort((a, b) => b[0].length - a[0].length);

export function findBook(name: string): Book | null {
  const n = name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  return NAMES.find(([alias]) => alias === n)?.[1] ?? null;
}

export interface Reference {
  book: Book;
  chapter: number;
  /** First verse (null: the whole chapter). */
  verse: number | null;
  /** Last verse of a range (null: a single verse). */
  toVerse: number | null;
}

export function formatReference(r: Reference): string {
  let s = `${r.book.name} ${r.chapter}`;
  if (r.verse) s += `:${r.verse}`;
  if (r.verse && r.toVerse && r.toVerse > r.verse) s += `–${r.toVerse}`;
  return s;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "1 John 4:16", "Gen. 1:27", "Romans 5:8-10", "Psalm 23".
const REF = new RegExp(
  `\\b(${NAMES.map(([n]) => escape(n).replace(/ /g, '\\.?\\s+')).join('|')})\\.?\\s+(\\d{1,3})(?::(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3}))?)?`,
  'gi',
);

export interface ReferenceMatch {
  ref: Reference;
  index: number;
  length: number;
  text: string;
}

/** Scripture references in a piece of text, for making them tappable. */
export function findReferences(text: string): ReferenceMatch[] {
  const out: ReferenceMatch[] = [];
  for (const m of text.matchAll(REF)) {
    const book = findBook(m[1]);
    if (!book) continue;
    const chapter = Number(m[2]);
    const verse = m[3] ? Number(m[3]) : null;
    if (chapter < 1 || chapter > book.chapters) continue;
    // A bare chapter needs the book written out ("Psalm 23", "Job 3"), not an
    // abbreviation that could be an ordinary word ("am 5", "is 2").
    const written = m[1].replace(/\./g, '').toLowerCase();
    if (!verse && written !== book.name.toLowerCase() && written.length < 5) continue;
    out.push({
      ref: { book, chapter, verse, toVerse: m[4] ? Number(m[4]) : null },
      index: m.index ?? 0,
      length: m[0].length,
      text: m[0],
    });
  }
  return out;
}
