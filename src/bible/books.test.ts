import { describe, expect, it } from 'vitest';
import { BOOKS, findBook, findReferences, formatReference } from './books';

describe('books', () => {
  it('has the 66 books and 1,189 chapters', () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS.reduce((n, b) => n + b.chapters, 0)).toBe(1189);
  });

  it('knows books by their usual names', () => {
    expect(findBook('Gen.')?.id).toBe('GEN');
    expect(findBook('1 John')?.id).toBe('1JN');
    expect(findBook('I Samuel')?.id).toBe('1SA');
    expect(findBook('Song of Solomon')?.id).toBe('SNG');
    expect(findBook('Psalm')?.id).toBe('PSA');
    expect(findBook('Nope')).toBeNull();
  });
});

describe('references in text', () => {
  it('finds the references a study writes', () => {
    const found = findReferences('Compare Genesis 1:27 and 1 John 4:16 to discover why. See also Rom. 5:8-10.');
    expect(found.map((f) => formatReference(f.ref))).toEqual(['Genesis 1:27', '1 John 4:16', 'Romans 5:8–10']);
    expect(found[1].text).toBe('1 John 4:16');
  });

  it('takes a whole chapter only when the book is written out', () => {
    expect(findReferences('Read Psalm 23 tonight.').map((f) => formatReference(f.ref))).toEqual(['Psalms 23']);
    expect(findReferences('I am 5 years old')).toEqual([]);
  });

  it('ignores chapters that do not exist', () => {
    expect(findReferences('Jude 3:4')).toEqual([]);
  });
});
