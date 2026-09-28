import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { setMyPassword } from '@/data/auth';
import { deleteMyDetails } from '@/data/seeker';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';

/**
 * Seeker account (/space/account). The email that signs them in, an optional
 * password to set (magic link always works too), sign out, and delete their
 * details (N3).
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

      <DeleteDetails />
    </div>
  );
}

/**
 * Delete my details: their messages and conversation, name and email, study
 * progress and reminders — and their sign-in, with their Bible highlights,
 * notes and reading plans. Not undoable, so it asks first.
 */
function DeleteDetails() {
  const { signOut } = useSession();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteMyDetails();
      // The sign-in is already gone, so signing out may complain; that's fine.
      await signOut().catch(() => undefined);
      navigate('/space/deleted', { replace: true });
    } catch {
      setBusy(false);
      setError('We couldn’t delete your details just now. Please try again.');
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-edge/70 pt-6">
      <div>
        <h2 className="text-base">Delete my details</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-strong">
          Removes your name, email and messages, your study answers and reminders, and your Bible
          highlights, notes and reading plans. The person you’ve been talking with will no longer see
          your conversation. This can’t be undone.
        </p>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {asking ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void onDelete()} disabled={busy}>
            {busy ? 'Deleting…' : 'Yes, delete everything'}
          </Button>
          <Button variant="ghost" onClick={() => setAsking(false)} disabled={busy}>
            Keep my details
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="quiet" onClick={() => setAsking(true)}>
            Delete my details
          </Button>
        </div>
      )}
    </section>
  );
}

/** Where they land afterwards (signed out). */
export function DetailsDeleted() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6 text-center">
      <h1 className="font-serif text-2xl text-sage">Your details are deleted</h1>
      <p className="text-sm leading-relaxed text-muted-strong">
        Your name, email, messages and everything you saved here are gone. Thank you for spending
        time with us — you’re welcome back any time.
      </p>
      <Link to="/" className="text-[13px] text-muted underline-offset-2 hover:text-sage hover:underline">
        Close
      </Link>
    </main>
  );
}
