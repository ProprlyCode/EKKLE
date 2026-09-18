import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Renders a QR code for a URL as a crisp PNG data URL. Kept as a small hook +
 * component so the member dashboard can both show it and offer a download using
 * the same generated image.
 */
export function useQrDataUrl(value: string, size = 320) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!value) {
      setDataUrl(null);
      return;
    }
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        // Sage on cream — stays on-brand and scans reliably (high contrast).
        dark: '#3F4A3A',
        light: '#FDFCF8',
      },
    })
      .then((url) => active && setDataUrl(url))
      .catch(() => active && setDataUrl(null));
    return () => {
      active = false;
    };
  }, [value, size]);

  return dataUrl;
}

export function QrImage({
  value,
  size = 320,
  alt,
}: {
  value: string;
  size?: number;
  alt: string;
}) {
  const dataUrl = useQrDataUrl(value, size);
  if (!dataUrl) {
    return (
      <div
        className="animate-pulse rounded-lg bg-canvas"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return <img src={dataUrl} width={size} height={size} alt={alt} className="rounded-lg" />;
}
