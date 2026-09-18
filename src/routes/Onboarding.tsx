import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '@/auth/SessionProvider';
import { claimMembership } from '@/data/members';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { CenterLayout, ErrorNote, FullPageLoading } from '@/ui/states';

/**
 * First-run onboarding. Invited people (matched by email) are linked
 * automatically and never see the form. Everyone else joins with the shared
 * code + a display name.
 */
export default function Onboarding() {
  const { ready, session, membership, refreshMembership } = useSession();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Try an invite link first (empty code + name → invite path only).
  useEffect(() => {
    let active = true;
    if (!session) return;
    claimMembership('', '')
      .then(async () => {
        if (!active) return;
        await refreshMembership();
        navigate('/app', { replace: true });
      })
      .catch(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, [session, refreshMembership, navigate]);

  if (!ready) return <FullPageLoading />;
  if (!session) return <Navigate to="/sign-in" replace />;
  if (membership) return <Navigate to="/app" replace />;
  if (checking) return <FullPageLoading />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await claimMembership(code, name);
      await refreshMembership();
      navigate('/app', { replace: true });
    } catch (err) {
      setSubmitting(false);
      const message = err instanceof Error ? err.message : '';
      setError(
        message.includes('invalid_join_code')
          ? 'That join code isn’t right. Check with whoever invited you.'
          : 'Something went wrong. Please try again.',
      );
    }
  }

  return (
    <CenterLayout>
      <Wordmark withTagline />
      <div className="card w-full px-6 py-8">
        <div className="mb-4">
          <h1 className="text-lg">Set up your space</h1>
          <p className="mt-1 text-sm text-muted-strong">
            A couple of details and you’re in.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextInput
            label="Your name"
            hint="Shown to people you share with."
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. David"
          />
          <TextInput
            label="Join code"
            hint="From your church leader."
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. GATHER"
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={submitting || !name || !code}>
            {submitting ? 'Setting up…' : 'Continue'}
          </Button>
        </form>
      </div>
    </CenterLayout>
  );
}
