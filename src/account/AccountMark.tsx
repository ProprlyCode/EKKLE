import { BrandName } from '@/components/BrandName';
import { useAccount } from './AccountProvider';
import { publicUrl } from './branding';

/** The account on this address, or null on ekkle.org. */
export function useBrandedAccount() {
  const state = useAccount();
  return state.status === 'account' ? state.account : null;
}

/**
 * The account's logo (its uploaded one, else Ekklē's mark). Logos come in all
 * shapes, so the height is fixed and the width follows.
 */
export function AccountLogo({
  className = 'h-14',
  uploadedOnly = false,
}: {
  className?: string;
  /** Show nothing rather than Ekklē's mark when the account has no logo. */
  uploadedOnly?: boolean;
}) {
  const account = useBrandedAccount();
  if (account?.logo_path)
    return (
      <img
        src={publicUrl(account.logo_path)}
        alt={account.name}
        className={`${className} w-auto max-w-[220px] object-contain`}
      />
    );
  if (uploadedOnly) return null;
  return <img src="/logo.png" alt="" className={`${className} w-auto`} />;
}

/** Footer line: the account's name with a quiet nod to Ekklē (or Ekklē alone). */
export function AccountFooter() {
  const account = useBrandedAccount();
  if (!account) return <BrandName className="font-serif text-sm font-medium text-muted" />;
  return (
    <span className="text-[13px] text-muted">
      <span className="font-serif font-medium">{account.name}</span>
      <span className="mx-1.5 opacity-60">·</span>
      with <BrandName className="font-serif" />
    </span>
  );
}
