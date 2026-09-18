/**
 * The visual of a single sequence screen as a recipient sees it. Shared by the
 * live recipient experience and the leadership builder's preview so the preview
 * is exactly what recipients get.
 */
export function SequenceScreenContent({
  headline,
  body,
}: {
  headline: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-serif text-3xl leading-tight text-sage">
        {headline || 'Headline'}
      </h1>
      <p className="whitespace-pre-wrap text-[17px] leading-relaxed text-muted-strong">
        {body || 'Body text appears here.'}
      </p>
    </div>
  );
}
