import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sendStudyMagicLink } from '@/data/auth';
import { BrandName } from '@/components/BrandName';
import { Marker } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';
import { EmailCode } from '@/ui/EmailCode';

/**
 * /offer — a standalone one-page conversion landing. No header nav, no other
 * links: just the offer and an email gate. Submitting sends a verification link;
 * clicking it lands them in their studies. Attributed via ?ref=<member>.
 */
export default function Offer() {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Verify before access: send a sign-in link (carrying name + attribution),
      // which lands them in /studies once confirmed.
      await sendStudyMagicLink({ email, firstName, ref });
      setSent(true);
    } catch {
      setSubmitting(false);
      setError('We couldn’t start just now. Please try again.');
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-full flex-col bg-canvas">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12 text-center">
          <div className="mb-8 flex flex-col items-center gap-3">
            <img src="/logo.png" alt="" width={44} height={44} className="h-11 w-11" />
            <Marker />
          </div>
          <h1 className="font-serif text-3xl leading-tight text-sage">Check your email</h1>
          <p className="mx-auto mt-4 max-w-sm text-[16px] leading-relaxed text-muted-strong">
            We sent a link and a 6-digit code to <span className="text-sage">{email}</span>.
            Open the link, or enter the code here, and your studies will be ready.
          </p>
          <EmailCode email={email} onVerified={() => navigate('/studies')} />
          <p className="mt-6 text-[13px] text-muted">
            Didn’t get it? Check spam, or{' '}
            <button
              onClick={() => {
                setSent(false);
                setSubmitting(false);
              }}
              className="text-sage underline-offset-2 hover:underline"
            >
              try another email
            </button>
            .
          </p>
        </div>
        <footer className="py-6 text-center">
          <BrandName className="font-serif text-sm font-medium text-muted" />
        </footer>
      </div>
    );
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
            {submitting ? 'Sending…' : 'Email me a link to begin'}
          </Button>
          <p className="text-center text-[12px] leading-relaxed text-muted">
            We’ll email you a link to start. No cost and no spam — your email keeps
            your place and lets someone reply if you reach out. Unsubscribe anytime.
          </p>
        </form>
      </div>

      <footer className="py-6 text-center">
        <BrandName className="font-serif text-sm font-medium text-muted" />
      </footer>
    </div>
  );
}
