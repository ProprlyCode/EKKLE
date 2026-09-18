import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { sendMagicLink } from '@/data/auth';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { Marker } from '@/ui/Card';
import { CenterLayout, ErrorNote, FullPageLoading } from '@/ui/states';

/**
 * Magic-link sign-in. Focal element: the single email field + one action. Once
 * sent, the screen becomes a calm "check your inbox" confirmation — no dead end.
 */
export default function SignIn() {
  const { ready, configured, session } = useSession();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
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

  async function onSubmit(e: FormEvent) {
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

  return (
    <CenterLayout>
      <Wordmark withTagline />
      <div className="card w-full px-6 py-8">
        {status === 'sent' ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Marker />
            <h1 className="text-lg">Check your inbox</h1>
            <p className="text-sm leading-relaxed text-muted-strong">
              We sent a sign-in link to <span className="text-sage">{email}</span>.
              Open it on this device to continue.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatus('idle')}
              className="mt-1"
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          </form>
        )}
      </div>
    </CenterLayout>
  );
}
