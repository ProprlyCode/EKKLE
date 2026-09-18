import { appConfig } from '@/config/app';

/**
 * Ekklē wordmark (platform chrome): the logo mark above the name set in Fraunces
 * with the tagline. Uses the provided logo asset as-is.
 */
export function Wordmark({ withTagline = false }: { withTagline?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <img src="/logo.webp" alt="" width={56} height={56} className="h-14 w-14" />
      <span className="font-serif text-2xl font-medium tracking-tight text-sage">
        {appConfig.brandName}
      </span>
      {withTagline && <span className="eyebrow">{appConfig.tagline}</span>}
    </div>
  );
}
