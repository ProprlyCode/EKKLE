import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { setMyPassword } from '@/data/auth';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { CenterLayout, ErrorNote, FullPageLoading } from '@/ui/states';

/**
 * Set a new password from a reset email. Clicking the emailed link establishes
 * a short-lived recovery session; here they choose a new password. `?src` steers
 * where they continue (admin area vs studies). Shared by admins and seekers.
 */
export default function ResetPassword() {
  const { ready, session } = useSession();
  const [params] = useSearchParams();
  const src = params.get('src') === 'seeker' ? 'seeker' : 'admin';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <FullPageLoading />;

  // No recovery session → the link is missing, invalid, or expired.
  if (!session)
    return (
      <CenterLayout>
        <Wordmark withTagline />
        <div className="card w-full px-6 py-8 text-center">
          <h1 className="text-lg">This link has expired</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-strong">
            Password-reset links can only be used once and expire quickly. Request a
            fresh one and try again.
          </p>
          <Link
            to={src === 'seeker' ? '/studies' : '/sign-in'}
            className="mt-4 inline-block text-sm text-sage underline-offset-2 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </CenterLayout>
    );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Those passwords don’t match.');
      return;
    }
    setStatus('saving');
    try {
      await setMyPassword(password);
      setStatus('done');
    } catch {
      setStatus('idle');
      setError('We couldn’t update it. The link may have expired — request a new one.');
    }
  }

  if (status === 'done')
    return (
      <CenterLayout>
        <Wordmark withTagline />
        <div className="card w-full px-6 py-8 text-center">
          <h1 className="text-lg">Password updated</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-strong">
            You’re all set. You can use your new password to sign in from now on.
          </p>
          <Button
            className="mt-5"
            onClick={() => navigate(src === 'seeker' ? '/studies' : '/app', { replace: true })}
          >
            Continue
          </Button>
        </div>
      </CenterLayout>
    );

  return (
    <CenterLayout>
      <Wordmark withTagline />
      <div className="card w-full px-6 py-8">
        <div className="mb-4">
          <h1 className="text-lg">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-strong">
            Pick something at least 8 characters long.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextInput
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextInput
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={status === 'saving' || !password || !confirm}>
            {status === 'saving' ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </div>
    </CenterLayout>
  );
}
