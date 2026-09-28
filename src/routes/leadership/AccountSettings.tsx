import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSession } from '@/auth/SessionProvider';
import { useAccount, useUpdateAccount } from '@/account/AccountProvider';
import { accountUrl } from '@/account/address';
import {
  contrastOnPage,
  DEFAULT_ACCENT,
  isHex,
  MIN_CONTRAST,
  publicUrl,
  saveBranding,
  uploadLogo,
} from '@/account/branding';
import { Card } from '@/ui/Card';
import { MinistrySettings } from './MinistrySettings';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { ErrorNote, FullPageLoading } from '@/ui/states';

/** Readable on the page (≥ 4.5:1), and calm next to the Ekklē layout. */
const SWATCHES: Array<{ hex: string; name: string }> = [
  { hex: '#3f4a3a', name: 'Sage (Ekklē)' },
  { hex: '#1f5130', name: 'Forest' },
  { hex: '#0f5257', name: 'Teal' },
  { hex: '#1e3a5f', name: 'Navy' },
  { hex: '#1d4ed8', name: 'Blue' },
  { hex: '#5b3fa0', name: 'Violet' },
  { hex: '#6b2d5c', name: 'Plum' },
  { hex: '#8a1c1c', name: 'Burgundy' },
  { hex: '#7a4a1f', name: 'Umber' },
  { hex: '#334155', name: 'Slate' },
];

const LOGO_TYPES = 'image/png,image/jpeg,image/webp,image/svg+xml';

/**
 * Leadership → Account: the account's name, logo and accent colour, shown on
 * every page of its address and on people's home screens (docs/tenancy.md).
 */
export default function AccountSettings() {
  const { membership } = useSession();
  const state = useAccount();
  const updateAccount = useUpdateAccount();
  const account = state.status === 'account' ? state.account : null;

  const [name, setName] = useState('');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!account) return;
    setName(account.name);
    setAccent(account.accent_color ?? DEFAULT_ACCENT);
    setLogoPath(account.logo_path);
    // Only when the account itself changes, not on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  useEffect(() => () => void (logoPreview && URL.revokeObjectURL(logoPreview)), [logoPreview]);

  if (!account || !membership) return <FullPageLoading />;

  const hex = accent.trim().toLowerCase();
  const contrast = contrastOnPage(hex);
  const readable = isHex(hex) && contrast >= MIN_CONTRAST;
  const shownLogo = logoPreview ?? (logoPath ? publicUrl(logoPath) : null);
  const valid = name.trim().length > 0 && readable;

  function touch() {
    setSaved(false);
    setError(null);
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    touch();
    if (!LOGO_TYPES.split(',').includes(file.type)) {
      setError('Logos can be PNG, JPG, WebP or SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('That logo is over 2 MB — please use a smaller file.');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function removeLogo() {
    touch();
    setLogoFile(null);
    setLogoPreview(null);
    setLogoPath(null);
  }

  async function save() {
    if (!account || !membership) return;
    setBusy(true);
    touch();
    try {
      const path = logoFile ? await uploadLogo(membership.org_id, logoFile) : logoPath;
      const next = await saveBranding({
        name: name.trim(),
        accent_color: hex === DEFAULT_ACCENT ? null : hex,
        logo_path: path,
      });
      setLogoPath(next.logo_path);
      setLogoFile(null);
      setLogoPreview(null);
      updateAccount({ ...account, ...next });
      setSaved(true);
    } catch {
      setError('Couldn’t save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // The preview wears the chosen accent (the `accent` colour reads these).
  const [r, g, b] = readable
    ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    : [63, 74, 58];
  const previewStyle = { '--accent': `${r} ${g} ${b}` } as CSSProperties;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl">Account</h1>
        <p className="mt-1 text-sm text-muted-strong">
          How your ministry appears at{' '}
          <a href={accountUrl(account)} className="text-sage underline-offset-2 hover:underline">
            {new URL(accountUrl(account)).host}
          </a>{' '}
          and on people’s home screens.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <Card className="flex flex-col gap-6">
          <TextInput
            label="Name"
            value={name}
            onChange={(e) => {
              touch();
              setName(e.target.value);
            }}
            hint="Shown on your pages, the home-screen app and emails."
          />

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-muted-strong">Logo</span>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-edge bg-canvas p-2">
                {shownLogo ? (
                  <img src={shownLogo} alt="Your logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[12px] text-muted">No logo</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="quiet" size="sm" onClick={() => fileRef.current?.click()}>
                  {shownLogo ? 'Replace' : 'Upload logo'}
                </Button>
                {shownLogo && (
                  <Button variant="ghost" size="sm" onClick={removeLogo}>
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={LOGO_TYPES}
                className="sr-only"
                aria-label="Logo file"
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
            <p className="text-[12px] text-muted">
              PNG, JPG, WebP or SVG, up to 2 MB. A transparent background works best; it also
              becomes the home-screen icon.
            </p>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-[13px] font-medium text-muted-strong">Accent colour</legend>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((s) => (
                <button
                  key={s.hex}
                  type="button"
                  title={s.name}
                  aria-label={s.name}
                  aria-pressed={hex === s.hex}
                  onClick={() => {
                    touch();
                    setAccent(s.hex);
                  }}
                  className={
                    'h-8 w-8 rounded-full ring-offset-2 ring-offset-card transition-shadow ' +
                    (hex === s.hex ? 'ring-2 ring-sage' : 'hover:ring-1 hover:ring-edge')
                  }
                  style={{ backgroundColor: s.hex }}
                />
              ))}
            </div>
            <div className="flex items-end gap-3">
              <input
                type="color"
                aria-label="Pick any colour"
                value={isHex(hex) ? hex : DEFAULT_ACCENT}
                onChange={(e) => {
                  touch();
                  setAccent(e.target.value);
                }}
                className="h-10 w-12 cursor-pointer rounded-lg border border-edge bg-canvas p-1"
              />
              <div className="w-32">
                <TextInput
                  label="Hex"
                  value={accent}
                  onChange={(e) => {
                    touch();
                    setAccent(e.target.value);
                  }}
                />
              </div>
            </div>
            <p className={'text-[12px] ' + (readable ? 'text-muted' : 'text-sage')} role="status">
              {!isHex(hex)
                ? 'Enter a colour like #1d4ed8.'
                : readable
                  ? `Reads clearly (contrast ${contrast.toFixed(1)}:1).`
                  : `Too light to read on your pages (contrast ${contrast.toFixed(1)}:1 — needs ${MIN_CONTRAST}:1). Try a darker shade.`}
            </p>
          </fieldset>

          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={busy || !valid}>
              {busy ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          <span className="eyebrow">preview</span>
          <div style={previewStyle} className="flex flex-col gap-5 rounded-card border border-edge bg-canvas px-5 py-6">
            {shownLogo ? (
              <img src={shownLogo} alt="" className="h-10 w-auto max-w-[160px] self-start object-contain" />
            ) : (
              <img src="/logo.png" alt="" className="h-10 w-10" />
            )}
            <div className="flex flex-col gap-1">
              <span className="eyebrow">welcome</span>
              <span className="font-serif text-2xl leading-tight text-sage">
                {name.trim() || 'Your name'}
              </span>
            </div>
            <span className="inline-flex h-10 items-center justify-center rounded-lg bg-accent text-sm font-medium text-canvas">
              Start free Bible studies
            </span>
            <div className="flex gap-4 border-t border-edge pt-3 text-[13px]">
              <span className="border-b-2 border-accent pb-1 font-medium text-sage">Messages</span>
              <span className="pb-1 text-muted">Studies</span>
            </div>
          </div>
        </div>
      </div>

      <MinistrySettings orgId={account.id} />
    </div>
  );
}
