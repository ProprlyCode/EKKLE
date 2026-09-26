import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { sendMagicLink, signInWithPassword, sendPasswordReset } from '@/data/auth';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { Marker } from '@/ui/Card';
import { CenterLayout, ErrorNote, FullPageLoading } from '@/ui/states';
import { EmailCode } from '@/ui/EmailCode';

/**
 * Sign-in. Magic link is the default for everyone; a quiet "use a password"
 * path is available for admins (they set a password in Supabase). Members never
 * need it.
 */
export default function SignIn() {
  const { ready, configured, session } = useSession();
  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [sentKind, setSentKind] = useState<'link' | 'reset'>('link');
  const [error, setError] = useState<string | null>(null);

  if (!configured)
    return (
      <CenterLayout>
        <Wordmark withTagline />
        <ErrorNote>Not connected to its database yet.</ErrorNote>
      </CenterLayout>
    );
  if (!ready) return <FullPageLoading />;
  if (session) return <Navigate to="/app" replace />;

  async function onMagicSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus('sending');
    try {
      await sendMagicLink(email);
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError('That didn’t send. Check the address and try again.');
    }
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus('sending');
    try {
      await signInWithPassword(email, password);
      // Session updates via the auth listener → redirect happens above.
    } catch {
      setStatus('idle');
      setError('That didn’t work. Check your email and password.');
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
      await sendPasswordReset(email, 'admin');
      setSentKind('reset');
      setStatus('sent');
    } catch {
      setStatus('idle');
      setError('We couldn’t send that. Check the address and try again.');
    }
  }

  return (
    <CenterLayout>
      <Wordmark withTagline />
      <div className="card w-full px-6 py-8">
        {status === 'sent' ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Marker />
            <h1 className="text-lg">Check your inbox</h1>
            <p className="text-sm leading-relaxed text-muted-strong">
              {sentKind === 'reset' ? (
                <>
                  We sent a password-reset link to{' '}
                  <span className="text-sage">{email}</span>. Open it to choose a new
                  password.
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
            <Button variant="ghost" size="sm" onClick={() => setStatus('idle')} className="mt-1">
              Use a different email
            </Button>
          </div>
        ) : mode === 'magic' ? (
          <form onSubmit={onMagicSubmit} className="flex flex-col gap-4">
            <div>
              <h1 className="text-lg">Sign in</h1>
              <p className="mt-1 text-sm text-muted-strong">
                We’ll email you a link — no password to remember.
              </p>
            </div>
            <TextInput
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@church.org"
            />
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button type="submit" disabled={status === 'sending' || !email}>
              {status === 'sending' ? 'Sending…' : 'Email me a link'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setError(null);
              }}
              className="text-center text-[12px] text-muted transition-colors hover:text-sage"
            >
              Use a password instead
            </button>
          </form>
        ) : (
          <form onSubmit={onPasswordSubmit} className="flex flex-col gap-4">
            <div>
              <h1 className="text-lg">Sign in with a password</h1>
              <p className="mt-1 text-sm text-muted-strong">For admin accounts.</p>
            </div>
            <TextInput
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextInput
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button type="submit" disabled={status === 'sending' || !email || !password}>
              {status === 'sending' ? 'Signing in…' : 'Sign in'}
            </Button>
            <div className="flex items-center justify-between text-[12px] text-muted">
              <button
                type="button"
                onClick={() => {
                  setMode('magic');
                  setError(null);
                }}
                className="transition-colors hover:text-sage"
              >
                Use a magic link instead
              </button>
              <button
                type="button"
                onClick={onForgot}
                className="transition-colors hover:text-sage"
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}
      </div>
    </CenterLayout>
  );
}
