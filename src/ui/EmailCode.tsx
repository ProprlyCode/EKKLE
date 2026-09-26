import { useState, type FormEvent } from 'react';
import { verifyEmailCode } from '@/data/auth';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';

/**
 * "Or enter the code" — shown under every "Check your email" message. The
 * sign-in email carries both a link and a 6-digit code; the code lets people
 * finish signing in right where they are (in-app browsers, another device).
 * On success the auth state changes and the caller's page moves on.
 */
export function EmailCode({ email, onVerified }: { email: string; onVerified?: () => void }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus('checking');
    try {
      await verifyEmailCode(email, code);
      onVerified?.();
    } catch {
      setStatus('idle');
      setError('That code didn’t work. Check it, or send a new email.');
    }
  }

  const digits = code.replace(/\s/g, '');
  return (
    <form onSubmit={onSubmit} className="mx-auto mt-6 flex w-full max-w-xs flex-col gap-3 text-left">
      <TextInput
        label="Or enter the code from the email"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={9}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="6-digit code"
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" disabled={status === 'checking' || digits.length < 6}>
        {status === 'checking' ? 'Checking…' : 'Continue'}
      </Button>
    </form>
  );
}
