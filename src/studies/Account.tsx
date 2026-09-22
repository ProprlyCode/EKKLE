import { useState, type FormEvent } from 'react';
import { useSession } from '@/auth/SessionProvider';
import { setMyPassword } from '@/data/auth';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';

/**
 * Seeker account (/studies/account). The email that signs them in, an optional
 * password to set (magic link always works too), and sign out.
 */
export default function Account() {
  const { session, signOut } = useSession();
  const email = session?.user?.email ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSetPassword(e: FormEvent) {
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
      setStatus('saved');
      setPassword('');
      setConfirm('');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('idle');
      setError('We couldn’t save that just now. Please try again.');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <span className="eyebrow">your account</span>
        <h1 className="font-serif text-3xl leading-tight text-sage">Account</h1>
      </header>

      <section className="card flex flex-col gap-1 px-5 py-5">
        <span className="text-[13px] font-medium text-muted-strong">Signed in as</span>
        <span className="text-sage">{email || '—'}</span>
      </section>

      <section className="card flex flex-col gap-4 px-5 py-5">
        <div>
          <h2 className="text-base">Set a password</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-strong">
            Optional. You can always sign in with an email link — a password just
            lets you sign in without checking your inbox.
          </p>
        </div>
        <form onSubmit={onSetPassword} className="flex flex-col gap-4">
          <TextInput
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextInput
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={status === 'saving' || !password || !confirm}>
              {status === 'saving' ? 'Saving…' : 'Save password'}
            </Button>
            {status === 'saved' && <span className="text-[13px] text-muted">Saved</span>}
          </div>
        </form>
      </section>

      <div>
        <Button variant="quiet" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
