import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { useAccount } from '@/account/AccountProvider';
import { env } from '@/lib/env';
import { useQrDataUrl } from '@/ui/QrCode';
import { Button } from '@/ui/Button';

/**
 * Wallet cards to print (N4): a US Letter sheet of eight business-card-sized
 * cards (3.5 × 2 in) — code, name, short message, ministry — with light cut
 * marks. Prints on its own, without the app around it.
 */
export default function WalletCards() {
  const { membership } = useSession();
  const account = useAccount();
  const ministry = account.status === 'account' ? account.account.name : null;
  const shareUrl = useMemo(() => {
    if (!membership) return '';
    return `${env.siteUrl || window.location.origin}/r/${membership.code_slug}`;
  }, [membership]);
  const qr = useQrDataUrl(shareUrl, 480);

  useEffect(() => {
    document.title = 'Wallet cards';
  }, []);

  if (!membership) return null;
  const shortUrl = shareUrl.replace(/^https?:\/\//, '');

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <style>{`@page { size: letter; margin: 0.5in 0.75in; }`}</style>
      <div className="mx-auto flex max-w-[7in] flex-col gap-4 px-4 py-6 print:hidden">
        <Link to="/app" className="text-[13px] text-muted hover:text-sage">
          ← Back
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl">Wallet cards</h1>
            <p className="mt-1 text-sm text-muted-strong">
              Eight cards to a Letter sheet. Print at 100% (no “fit to page”), then cut along the marks.
            </p>
          </div>
          <Button onClick={() => window.print()} disabled={!qr}>
            Print
          </Button>
        </div>
      </div>
      <div
        aria-label="Sheet of wallet cards"
        className="mx-auto grid w-[7in] grid-cols-2 border-l border-t border-dashed border-edge bg-white print:border-[#ccc]"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex h-[2in] w-[3.5in] items-center gap-[0.18in] border-b border-r border-dashed border-edge px-[0.22in] print:border-[#ccc]"
          >
            {qr ? (
              <img src={qr} alt={i === 0 ? `QR code linking to ${membership.name}` : ''} className="h-[1.4in] w-[1.4in] shrink-0" />
            ) : (
              <span className="h-[1.4in] w-[1.4in] shrink-0" />
            )}
            <div className="flex min-w-0 flex-col gap-[0.05in] text-left">
              <p className="font-serif text-[13pt] leading-tight text-sage">{membership.name}</p>
              {membership.short_message && (
                <p className="text-[8pt] leading-snug text-muted-strong">“{membership.short_message}”</p>
              )}
              {ministry && <p className="text-[7.5pt] uppercase tracking-eyebrow text-muted">{ministry}</p>}
              <p className="break-all text-[6.5pt] text-muted">{shortUrl}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
