import { useEffect, useState } from 'react';
import { decideAddressRequest, platformAddressRequests, type PlatformAddressRequest } from '@/data/address';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';

/**
 * Platform → Accounts: address change requests (0043). Owners and Admins
 * approve or decline; Support can see them. Approving moves the ministry at
 * once; its old address keeps leading there.
 */
export function AddressRequests({ canManage, onDecided }: { canManage: boolean; onDecided: (msg: string) => void }) {
  const [list, setList] = useState<PlatformAddressRequest[] | null>(null);
  const load = () => platformAddressRequests().then(setList).catch(() => setList([]));
  useEffect(() => {
    void load();
  }, []);

  if (!list || list.length === 0) return null;
  const pending = list.filter((r) => r.status === 'pending');
  const decided = list.filter((r) => r.status !== 'pending').slice(0, 5);

  return (
    <Card className="p-0" role="region" aria-label="Address requests">
      <div className="flex items-center justify-between border-b border-edge/70 px-5 py-3">
        <span className="eyebrow">address requests</span>
        {pending.length > 0 && <span className="text-[13px] text-muted">{pending.length} waiting</span>}
      </div>
      <ul className="divide-y divide-edge/70">
        {pending.map((r) => (
          <PendingRow
            key={r.id}
            req={r}
            canManage={canManage}
            onDone={(msg) => {
              void load();
              onDecided(msg);
            }}
          />
        ))}
        {decided.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[13px]">
            <span className="text-muted-strong">
              {r.ministry}: {r.from_subdomain} → {r.subdomain}
            </span>
            <span className="text-muted">
              {r.status === 'approved' ? 'Approved' : `Declined${r.reason ? ` — “${r.reason}”` : ''}`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PendingRow({
  req,
  canManage,
  onDone,
}: {
  req: PlatformAddressRequest;
  canManage: boolean;
  onDone: (msg: string) => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      await decideAddressRequest(req.id, approve, why);
      onDone(
        approve
          ? `${req.ministry} is now at ${req.subdomain}. Its old address still leads there.`
          : `The request from ${req.ministry} is declined.`,
      );
    } catch (err) {
      setBusy(false);
      setError(
        (err as { message?: string } | null)?.message === 'subdomain_taken'
          ? 'That address was taken in the meantime — decline it with a note.'
          : 'That didn’t save. Try again.',
      );
    }
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-sage">{req.ministry}</p>
          <p className="text-muted-strong">
            {req.from_subdomain}.ekkle.org → <span className="font-medium text-sage">{req.subdomain}.ekkle.org</span>
          </p>
          <p className="text-[12px] text-muted">
            Asked by {req.requested_by ?? 'an Admin'} · {new Date(req.created_at).toLocaleDateString()}
          </p>
          {req.note && <p className="mt-1 text-[13px] text-muted-strong">“{req.note}”</p>}
        </div>
        {canManage && !declining && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void decide(true)} disabled={busy}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeclining(true)} disabled={busy}>
              Decline
            </Button>
          </div>
        )}
      </div>
      {declining && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <TextInput label="Why (sent to them, optional)" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={500} />
          </div>
          <Button size="sm" onClick={() => void decide(false)} disabled={busy}>
            Decline request
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeclining(false)}>
            Back
          </Button>
        </div>
      )}
      {error && <p className="text-[13px] text-muted-strong">{error}</p>}
    </li>
  );
}
