import type { SeekerResource } from '@/data/resources';
import { safeHref, videoEmbedUrl } from '@/lib/video';

/**
 * One resource as a seeker sees it (also the leader editor's live preview).
 * Text is shown as text — never HTML — and a video is embedded only from a
 * recognised YouTube/Vimeo ID.
 */
export function ResourceView({ resource }: { resource: SeekerResource }) {
  const embed = resource.kind === 'video' ? videoEmbedUrl(resource.url) : null;
  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        {resource.topics.length > 0 && (
          <span className="eyebrow">{resource.topics.join(' · ')}</span>
        )}
        <h1 className="font-serif text-3xl leading-tight text-sage">
          {resource.title || 'Untitled'}
        </h1>
        {resource.blurb && (
          <p className="text-[17px] leading-relaxed text-muted-strong">{resource.blurb}</p>
        )}
      </header>

      {resource.kind === 'video' &&
        (embed ? (
          <div className="aspect-video overflow-hidden rounded-card border border-edge bg-ink">
            <iframe
              src={embed}
              title={resource.title}
              className="h-full w-full"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
            />
          </div>
        ) : (
          <p className="rounded-lg border border-edge bg-card px-4 py-3 text-sm text-muted">
            This video isn’t available right now.
          </p>
        ))}

      {resource.body.trim() && (
        <div className="whitespace-pre-wrap text-[17px] leading-relaxed text-ink/90">
          {resource.body}
        </div>
      )}

      {resource.kind === 'link' && resource.url && (
        <a
          href={safeHref(resource.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center justify-center self-start rounded-lg bg-sage px-5 text-sm font-medium text-canvas transition-colors hover:bg-sage-soft"
        >
          Open ↗
        </a>
      )}
    </article>
  );
}
