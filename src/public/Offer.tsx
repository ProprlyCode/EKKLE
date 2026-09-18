import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { registerOfferLead } from '@/data/recipient';
import { BrandName } from '@/components/BrandName';
import { Marker } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';

/**
 * /offer — a standalone one-page conversion landing. No header nav, no other
 * links: just the offer and an email gate that opens the studies. Brand-led
 * (marketing), attributed via ?ref=<member> when present.
 */
export default function Offer() {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const slug = await registerOfferLead({ ref, firstName, email });
      if (slug) navigate(`/r/${slug}`);
      else {
        setSubmitting(false);
        setError('We couldn’t start just now. Please try again.');
      }
    } catch {
      setSubmitting(false);
      setError('We couldn’t start just now. Please try again.');
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt="" width={44} height={44} className="h-11 w-11" />
          <span className="eyebrow">free bible studies</span>
          <Marker />
        </div>

        <h1 className="text-center font-serif text-3xl leading-tight text-sage sm:text-4xl">
          discover the Bible for yourself
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-center text-[16px] leading-relaxed text-muted-strong">
          Short, guided studies you can do at your own pace — no cost, no church
          background needed, and a real person if you ever want one. Enter your
          email to begin.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          <TextInput
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <TextInput
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={submitting || !firstName || !email} className="w-full">
            {submitting ? 'One moment…' : 'Begin the studies'}
          </Button>
          <p className="text-center text-[12px] leading-relaxed text-muted">
            No cost and no spam. Your email just keeps your place and lets someone
            reply if you reach out. Unsubscribe anytime.
          </p>
        </form>
      </div>

      <footer className="py-6 text-center">
        <BrandName className="font-serif text-sm font-medium text-muted" />
      </footer>
    </div>
  );
}
