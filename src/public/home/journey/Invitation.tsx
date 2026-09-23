import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { joinWaitlist } from '@/data/waitlist';
import { BrandName } from '@/components/BrandName';
import { COPY } from './chapters';
import { CoverFrame, WIDE } from './frame';
import { CafeBg } from './art';

/**
 * Chapter 7 — the one ask, after the story ends. Still and quiet: the café in
 * its warmest light, one line, and "Join the waitlist".
 */
export function Invitation() {
  return (
    <section id="join" data-j="join" className="relative flex min-h-[100svh] flex-col overflow-hidden">
      <div className="j-cq absolute inset-0" aria-hidden>
        <CoverFrame aspect={WIDE}>
          <CafeBg golden />
        </CoverFrame>
      </div>
      <div className="absolute inset-0 bg-home-ink/55" aria-hidden />
      <div className="home-scrim absolute inset-0 scale-125" aria-hidden />
      <div className="home-vignette absolute inset-0" aria-hidden />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-6 py-24">
        <h2 className="home-display max-w-[16ch] text-center text-[clamp(2rem,4.6vw,3.75rem)] text-home-stone">
          {COPY.join}
        </h2>
        <WaitlistForm />
      </div>

      <footer className="relative z-10 flex items-center justify-between gap-4 px-6 pb-8 text-[13px] text-home-stone-dim md:px-10">
        <BrandName className="font-serif text-base text-home-stone" />
        <nav className="flex items-center gap-6">
          <Link to="/for-churches" className="home-focus transition-colors hover:text-home-stone">
            For churches
          </Link>
          <Link to="/sign-in" className="home-focus transition-colors hover:text-home-stone">
            Sign in
          </Link>
        </nav>
      </footer>
    </section>
  );
}

function WaitlistForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ministry, setMinistry] = useState('');
  const [trap, setTrap] = useState(''); // honeypot — real people never fill it
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (trap) {
      setStatus('done');
      return;
    }
    setStatus('sending');
    try {
      await joinWaitlist({ name, email, ministry });
      setStatus('done');
    } catch (err) {
      setStatus('idle');
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg.includes('invalid_email')
          ? 'Please check your email address.'
          : 'That didn’t go through. Please try again in a moment.',
      );
    }
  }

  if (status === 'done') {
    return (
      <p
        role="status"
        className="home-display max-w-[22ch] text-center text-[clamp(1.25rem,2.2vw,1.625rem)] text-home-stone"
      >
        Thank you — you’re on the list. We’ll be in touch.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl border border-home-stone/10 bg-home-ink/60 p-6 backdrop-blur-[2px] md:p-8"
    >
      <Field label="Your name" value={name} onChange={setName} autoComplete="name" required />
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        inputMode="email"
        required
      />
      <Field
        label="Church or ministry"
        value={ministry}
        onChange={setMinistry}
        autoComplete="organization"
      />
      {/* honeypot, hidden from people and assistive tech */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
        <label>
          Leave this empty
          <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-center text-[14px] text-home-stone">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending' || !name.trim() || !email.trim()}
        className="home-focus mt-2 h-12 rounded-xl bg-home-brass px-6 text-[15px] font-medium text-home-ink transition-colors hover:bg-[#b8915a] disabled:opacity-60"
      >
        {status === 'sending' ? 'Joining…' : 'Join the waitlist'}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  inputMode,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: 'email' | 'text';
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-home-stone-dim">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
        className="home-focus h-12 appearance-none rounded-xl border border-home-stone-dim/35 bg-home-ink/55 px-4 text-[15px] text-home-stone placeholder:text-home-stone-dim/60 focus:border-home-brass/70 focus:outline-none"
      />
    </label>
  );
}
