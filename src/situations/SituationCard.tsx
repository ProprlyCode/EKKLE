import { useState, type FormEvent } from 'react';
import { useSession } from '@/auth/SessionProvider';
import { env } from '@/lib/env';
import { setFlowSituation } from '@/data/situations';
import type { Sequence } from '@/data/sequences';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextInput } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';
import { isLinkName, toLinkName } from './linkName';

/**
 * A flow's situation (0049): a short name members see under their code
 * ("Over coffee"), the link name added to their link (/r/david/coffee), and
 * whether it's offered to members.
 */
export function SituationCard({ sequence, published }: { sequence: Sequence; published: boolean }) {
  const { membership } = useSession();
  const [name, setName] = useState(sequence.situation ?? '');
  const [slug, setSlug] = useState(sequence.situation_slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(sequence.situation_slug));
  const [offered, setOffered] = useState(sequence.offered);
  const [saved, setSaved] = useState({
    name: sequence.situation ?? '',
    slug: sequence.situation_slug ?? '',
    offered: sequence.offered,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const trimmed = name.trim();
  const slugError = trimmed && !isLinkName(slug) ? 'Lowercase letters, numbers and hyphens (e.g. “over-coffee”).' : null;
  const dirty = trimmed !== saved.name || (trimmed !== '' && (slug !== saved.slug || offered !== saved.offered));
  const origin = env.siteUrl || window.location.origin;
  const example = `${origin}/r/${membership?.code_slug ?? 'name'}/${slug || '…'}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (slugError) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await setFlowSituation(sequence.id, trimmed, slug, trimmed ? offered : false);
      setSaved({ name: trimmed, slug: trimmed ? slug : '', offered: trimmed ? offered : false });
      if (!trimmed) {
        setSlug('');
        setOffered(false);
      }
      setNotice(
        !trimmed
          ? 'This flow is no longer a situation.'
          : offered
            ? published
              ? `Members now see “${trimmed}” under their code.`
              : `Saved. Members will see “${trimmed}” once this flow is published.`
            : 'Saved. Switch on “Offer to members” when you’re ready.',
      );
    } catch (err) {
      const code = (err as { message?: string } | null)?.message;
      setError(
        code === 'slug_taken'
          ? 'Another flow already uses that link name. Choose a different one.'
          : code === 'invalid_slug'
            ? 'That link name won’t work. Use lowercase letters, numbers and hyphens.'
            : 'That didn’t save. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4" aria-label="Situation">
        <div>
          <h2 className="text-base">Situation</h2>
          <p className="mt-1 text-[13px] text-muted-strong">
            Offer this flow for a particular moment. Members tap it under their code, and their link opens this flow
            instead — still connecting to them.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="Situation name"
            placeholder="e.g. Over coffee"
            value={name}
            maxLength={40}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(toLinkName(e.target.value));
            }}
            hint="What members see on the button. Leave blank for a regular flow."
          />
          <TextInput
            label="Link name"
            value={slug}
            maxLength={30}
            disabled={!trimmed}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase());
            }}
            error={slugError ?? undefined}
            hint={trimmed ? example : undefined}
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-sage">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-sage"
            checked={offered}
            disabled={!trimmed}
            onChange={(e) => setOffered(e.target.checked)}
          />
          <span>
            Offer to members as a situation
            {offered && !published && (
              <span className="block text-[13px] text-muted">Members see it once this flow is published.</span>
            )}
          </span>
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        {notice && (
          <p role="status" className="text-[13px] text-sage">
            {notice}
          </p>
        )}
        <Button type="submit" size="sm" variant="quiet" className="self-start" disabled={!dirty || busy || !!slugError}>
          Save situation
        </Button>
      </form>
    </Card>
  );
}
