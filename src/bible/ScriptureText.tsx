import { createContext, Fragment, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { findReferences, formatReference, type Reference } from './books';
import { ESV_COPYRIGHT, getChapter, getPlace, TRANSLATIONS, type Translation } from './data';
import { Spinner } from '@/ui/states';

/** Where "Open in the Bible" goes: Your space's Bible, or the members' app's. */
export const BibleBase = createContext('/space/bible');

/**
 * Text with its Scripture references ("Genesis 1:27", "1 John 4:16") made
 * tappable: each opens the passage right there, in the reader's translation.
 */
export function ScriptureText({ text }: { text: string }) {
  const [open, setOpen] = useState<Reference | null>(null);
  const found = findReferences(text);
  if (found.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let at = 0;
  found.forEach((f, i) => {
    if (f.index > at) parts.push(<Fragment key={`t${i}`}>{text.slice(at, f.index)}</Fragment>);
    parts.push(
      <button
        key={`r${i}`}
        type="button"
        onClick={() => setOpen(f.ref)}
        className="text-sage underline decoration-accent/50 decoration-1 underline-offset-2 hover:decoration-accent"
      >
        {f.text}
      </button>,
    );
    at = f.index + f.length;
  });
  if (at < text.length) parts.push(<Fragment key="end">{text.slice(at)}</Fragment>);

  return (
    <>
      {parts}
      {open && <PassageSheet reference={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function PassageSheet({ reference, onClose }: { reference: Reference; onClose: () => void }) {
  const base = useContext(BibleBase);
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [verses, setVerses] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getPlace()
      .then((p) => p?.translation ?? 'bsb')
      .catch(() => 'bsb' as Translation)
      .then(async (t) => {
        if (!live) return;
        setTranslation(t);
        try {
          const v = await getChapter(t, reference.book, reference.chapter);
          if (live) setVerses(v);
        } catch {
          // The ESV can be unavailable; fall back to the BSB.
          const v = await getChapter('bsb', reference.book, reference.chapter).catch(() => null);
          if (!live) return;
          if (v) {
            setTranslation('bsb');
            setVerses(v);
          } else setFailed(true);
        }
      });
    return () => {
      live = false;
    };
  }, [reference]);

  const from = reference.verse ?? 1;
  const to = reference.verse ? (reference.toVerse ?? reference.verse) : (verses?.length ?? 1);
  const shown = verses?.slice(from - 1, to).map((t, i) => [from + i, t] as const) ?? [];

  return (
    <span className="fixed inset-0 z-40 flex items-end justify-center bg-sage/20 sm:items-center" onClick={onClose}>
      <span
        role="dialog"
        aria-label={formatReference(reference)}
        onClick={(e) => e.stopPropagation()}
        className="block max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-edge bg-card p-5 text-left shadow-lg sm:rounded-2xl"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="font-serif text-lg text-sage">{formatReference(reference)}</span>
          {translation && <span className="eyebrow">{TRANSLATIONS[translation].short}</span>}
        </span>
        <span className="mt-3 block font-serif text-[17px] leading-relaxed text-sage">
          {failed ? (
            <span className="text-sm text-muted">Couldn’t open this passage just now.</span>
          ) : verses === null ? (
            <Spinner />
          ) : (
            shown.map(([n, t]) => (
              <Fragment key={n}>
                <sup className="mr-0.5 font-sans text-[11px] text-muted">{n}</sup>
                {t}{' '}
              </Fragment>
            ))
          )}
        </span>
        {translation === 'esv' && verses && (
          <span className="mt-3 block text-[11px] leading-relaxed text-muted">{ESV_COPYRIGHT}</span>
        )}
        <span className="mt-4 flex items-center justify-between">
          <Link
            to={`${base}/${reference.book.id}/${reference.chapter}`}
            className="text-sm text-sage underline decoration-sage/30 underline-offset-2 hover:decoration-sage"
          >
            Open in the Bible
          </Link>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-sage">
            Close
          </button>
        </span>
      </span>
    </span>
  );
}
