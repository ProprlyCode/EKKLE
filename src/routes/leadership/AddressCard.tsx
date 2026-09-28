import { useEffect, useState, type FormEvent } from 'react';
import {
  addressAvailable,
  cancelAddressRequest,
  myAddressRequest,
  requestAddressChange,
  type AddressRequest,
} from '@/data/address';
import { accountUrl } from '@/account/address';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput, TextArea } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';

/**
 * Account → Address (Admins): the ministry's address, and a request for a new
 * one, which the Ekklē team approves (0043). Old addresses keep working.
 */
export function AddressCard({ subdomain }: { subdomain: string }) {
  const [state, setState] = useState<{ request: AddressRequest | null; previous: string[] } | null>(null);
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [free, setFree] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => myAddressRequest().then(setState).catch(() => setState({ request: null, previous: [] }));
  useEffect(() => {
    void load();
  }, []);

  const clean = name.trim().toLowerCase();
  const wellFormed = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(clean);

  // Is it free? Checked as they type.
  useEffect(() => {
    setFree(null);
    if (!wellFormed || clean === subdomain) return;
    const t = setTimeout(() => {
      addressAvailable(clean)
        .then(setFree)
        .catch(() => setFree(null));
    }, 300);
    return () => clearTimeout(t);
  }, [clean, wellFormed, subdomain]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestAddressChange(clean, note);
      setAsking(false);
      setName('');
      setNote('');
      await load();
    } catch (err) {
      setError(
        (err as { message?: string } | null)?.message === 'subdomain_taken'
          ? 'That address is taken. Try another.'
          : 'That didn’t send. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    setBusy(true);
    try {
      await cancelAddressRequest();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const req = state?.request ?? null;
  const pending = req?.status === 'pending';
  const hint = !clean
    ? 'Lowercase letters, numbers and dashes.'
    : !wellFormed
      ? 'Use lowercase letters, numbers and dashes (not at the start or end).'
      : clean === subdomain
        ? 'That’s your address now.'
        : free === null
          ? 'Checking…'
          : free
            ? `${clean}.ekkle.org is free.`
            : `${clean}.ekkle.org is taken.`;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base">Address</h2>
        <p className="mt-1 text-sm text-muted-strong">
          Your ministry is at{' '}
          <a href={accountUrl({ subdomain })} className="text-sage underline-offset-2 hover:underline">
            {subdomain}.ekkle.org
          </a>
          . A new address is set by the Ekklē team on request.
        </p>
        {state && state.previous.length > 0 && (
          <p className="mt-1 text-[13px] text-muted">
            Earlier addresses, which still lead here: {state.previous.map((p) => `${p}.ekkle.org`).join(', ')}
          </p>
        )}
      </div>

      {pending && req ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-edge bg-canvas px-4 py-3 text-sm">
          <span className="text-muted-strong">
            You asked for <span className="font-medium text-sage">{req.subdomain}.ekkle.org</span>. The Ekklē team
            will email you when it’s decided.
          </span>
          <Button variant="ghost" size="sm" onClick={() => void onCancel()} disabled={busy}>
            Cancel request
          </Button>
        </div>
      ) : (
        <>
          {req?.status === 'declined' && (
            <p className="rounded-lg border border-edge bg-canvas px-4 py-3 text-[13px] text-muted-strong">
              Your request for {req.subdomain}.ekkle.org wasn’t approved{req.reason ? `: “${req.reason}”` : '.'}
            </p>
          )}
          {asking ? (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <TextInput
                label="New address"
                value={name}
                onChange={(e) => setName(e.target.value)}
                hint={hint}
                autoComplete="off"
                spellCheck={false}
              />
              <TextArea
                label="Note for the Ekklē team (optional)"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="text-[12px] leading-relaxed text-muted">
                Your current address will keep working and lead to the new one, so printed codes and shared links
                still work. Everyone signs in once more at the new address.
              </p>
              {error && <ErrorNote>{error}</ErrorNote>}
              <div className="flex gap-2">
                <Button type="submit" disabled={busy || !free}>
                  {busy ? 'Sending…' : 'Send request'}
                </Button>
                <Button variant="ghost" onClick={() => setAsking(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <Button variant="quiet" onClick={() => setAsking(true)}>
                Request a new address
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
