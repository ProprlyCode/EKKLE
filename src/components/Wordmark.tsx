import { appConfig } from '@/config/app';
import { BrandName } from './BrandName';
import { AccountLogo, useBrandedAccount } from '@/account/AccountMark';

/**
 * Ekklē wordmark (platform chrome): the logo mark above the name set in Fraunces
 * with the tagline. On an account's address, the account's logo and name.
 */
export function Wordmark({ withTagline = false }: { withTagline?: boolean }) {
  const account = useBrandedAccount();
  // On an account's address: its logo and name (Ekklē steps back).
  if (account)
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <AccountLogo className="h-14" />
        {!account.logo_path && (
          <span className="font-serif text-2xl font-medium tracking-tight text-sage">
            {account.name}
          </span>
        )}
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-2">
      <img src="/logo.png" alt="" width={56} height={56} className="h-14 w-14" />
      <BrandName className="font-serif text-2xl font-medium tracking-tight text-sage" />
      {withTagline && <span className="eyebrow">{appConfig.tagline}</span>}
    </div>
  );
}
