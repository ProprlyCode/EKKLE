import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sendStudyMagicLink, signInWithPassword, sendPasswordReset } from '@/data/auth';
import { BrandName } from '@/components/BrandName';
import { Marker } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';
import { EmailCode } from '@/ui/EmailCode';

/**
 * Seeker sign-in — the gate on /studies for returning study-takers. Magic link
 * by default; a quiet password path for anyone who set one. Standalone and
 * brand-led (no nav), a sibling of /offer. Attribution ?ref is carried through.
 */
export default function SeekerSignIn() {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [sentKind, setSentKind] = useState<'link' | 'reset'>('link');
  const [error, setError] = useState<string | null>(null);

  async function onMagic(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus('sending');
    try {
      await sendStudyMagicLink({ email, ref });
      setSentKind('link');
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError('We couldn’t send that just now. Please try again.');
    }
  }

  async function onForgot() {
    if (!email) {
      setError('Enter your email first, then choose “Forgot password.”');
      return;
    }
    setError(null);
    setStatus('sending');
    try {
      await sendPasswordReset(email, 'seeker');
      setSentKind('reset');
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError('We couldn’t send that just now. Please try again.');
    }
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus('sending');
    try {
      await signInWithPassword(email, password);
      // On success the auth state changes and the gate renders the dashboard.
    } catch {
      setStatus('idle');
      setError('That email and password didn’t match.');
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt="" width={44} height={44} className="h-11 w-11" />
          <span className="eyebrow">your studies</span>
          <Marker />
        </div>

        {status === 'sent' ? (
          <div className="text-center">
            <h1 className="font-serif text-2xl leading-tight text-sage">Check your email</h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted-strong">
              {sentKind === 'reset' ? (
                <>
                  We sent a password-reset link to <span className="text-sage">{email}</span>.
                  Open it to choose a new password.
                </>
              ) : (
                <>
                  We sent a sign-in link and a 6-digit code to{' '}
                  <span className="text-sage">{email}</span>. Open the link, or enter the
                  code here.
                </>
              )}
            </p>
            {sentKind === 'link' && <EmailCode email={email} />}
            <button
              onClick={() => setStatus('idle')}
              className="mt-6 text-[13px] text-muted underline-offset-2 hover:text-sage hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-center font-serif text-3xl leading-tight text-sage">
              welcome back
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-center text-[15px] leading-relaxed text-muted-strong">
              Sign in to pick up your studies right where you left off.
            </p>

            {mode === 'magic' ? (
              <form onSubmit={onMagic} className="mt-8 flex flex-col gap-4">
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
                <Button type="submit" disabled={status === 'sending' || !email} className="w-full">
                  {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
                </Button>
              </form>
            ) : (
              <form onSubmit={onPassword} className="mt-8 flex flex-col gap-4">
                <TextInput
                  label="Email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <TextInput
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {error && <ErrorNote>{error}</ErrorNote>}
                <Button
                  type="submit"
                  disabled={status === 'sending' || !email || !password}
                  className="w-full"
                >
                  {status === 'sending' ? 'Signing in…' : 'Sign in'}
                </Button>
                <button
                  type="button"
                  onClick={onForgot}
                  className="text-center text-[13px] text-muted underline-offset-2 hover:text-sage hover:underline"
                >
                  Forgot password?
                </button>
              </form>
            )}

            <button
              onClick={() => {
                setMode(mode === 'magic' ? 'password' : 'magic');
                setError(null);
              }}
              className="mx-auto mt-5 block text-[13px] text-muted underline-offset-2 hover:text-sage hover:underline"
            >
              {mode === 'magic' ? 'I have a password' : 'Email me a link instead'}
            </button>

            <p className="mt-8 text-center text-[13px] text-muted">
              New here?{' '}
              <a href="/offer" className="text-sage underline-offset-2 hover:underline">
                Start the studies
              </a>
            </p>
          </>
        )}
      </div>

      <footer className="py-6 text-center">
        <BrandName className="font-serif text-sm font-medium text-muted" />
      </footer>
    </div>
  );
}
