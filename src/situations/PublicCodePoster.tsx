import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAccount } from '@/account/AccountProvider';
import { AccountLogo } from '@/account/AccountMark';
import { publicCodes, type PublicCode } from '@/data/publicCodes';
import { env } from '@/lib/env';
import { useQrDataUrl } from '@/ui/QrCode';
import { Button } from '@/ui/Button';
import { Spinner } from '@/ui/states';

/**
 * A public code as a Letter-size poster (0050): the ministry's logo and name,
 * the flow's first headline, a large code and the link. Prints on its own.
 */
export default function PublicCodePoster() {
  const { id } = useParams();
  const account = useAccount();
  const ministry = account.status === 'account' ? account.account.name : '';
  const [code, setCode] = useState<PublicCode | null | undefined>(undefined);
  const url = code ? `${env.siteUrl || window.location.origin}/c/${code.code}` : '';
  const qr = useQrDataUrl(url, 1200);

  useEffect(() => {
    publicCodes()
      .then((l) => setCode(l.codes.find((c) => c.id === id) ?? null))
      .catch(() => setCode(null));
  }, [id]);

  useEffect(() => {
    if (code) document.title = `${code.name} — poster`;
  }, [code]);

  if (code === undefined) return <Spinner />;
  if (code === null) return <p className="p-6 text-sm text-muted">That code isn’t here any more.</p>;

  const headline = code.first_screen?.headline?.trim() || 'you’re welcome here';

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <style>{`@page { size: letter; margin: 0.6in; }`}</style>
      <div className="mx-auto flex max-w-[7.3in] flex-col gap-4 px-4 py-6 print:hidden">
        <Link to="/leadership/public-codes" className="text-[13px] text-muted hover:text-sage">
          ← Public codes
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl">Poster: {code.name}</h1>
            <p className="mt-1 text-sm text-muted-strong">Letter size. Print at 100% for the sharpest code.</p>
          </div>
          <Button onClick={() => window.print()} disabled={!qr}>
            Print
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto pb-6 print:overflow-visible print:pb-0">
        <article
          aria-label="Poster"
          className="mx-auto flex h-[9.8in] w-[7.3in] flex-col items-center justify-between border border-edge bg-white px-[0.6in] py-[0.7in] text-center print:border-0"
        >
          <div className="flex flex-col items-center gap-3">
            <AccountLogo className="h-14" uploadedOnly />
            <p className="text-[15px] uppercase tracking-eyebrow text-muted-strong">{ministry}</p>
          </div>
          <h2 className="font-serif text-[44px] leading-tight text-sage first-letter:uppercase">{headline}</h2>
          {qr && <img src={qr} alt={`QR code for ${url}`} className="h-[3.8in] w-[3.8in]" />}
          <div className="flex flex-col gap-1">
            <p className="text-[18px] text-sage">Scan with your phone’s camera</p>
            <p className="text-[13px] text-muted-strong">No app or sign-up needed · {url.replace(/^https?:\/\//, '')}</p>
          </div>
        </article>
      </div>
    </div>
  );
}
