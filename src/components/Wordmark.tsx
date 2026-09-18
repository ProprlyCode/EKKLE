import { appConfig } from '@/config/app';

/**
 * Ekklē wordmark (platform chrome). Placeholder until Jonathan provides the
 * final logo asset — swapping it is a one-file change. Set in Fraunces per the
 * brand guide; the macron over the ē is the distinctive mark.
 */
export function Wordmark({ withTagline = false }: { withTagline?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-serif text-2xl font-medium tracking-tight text-sage">
        {appConfig.brandName}
      </span>
      {withTagline && <span className="eyebrow">{appConfig.tagline}</span>}
    </div>
  );
}
