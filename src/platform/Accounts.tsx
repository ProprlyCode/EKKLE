import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { accountUrl } from '@/account/address';
import {
  createAccount,
  isSubdomainAvailable,
  listPlatformAccounts,
  reason,
  sendInvitation,
  setAccountStatus,
  type NewAccount,
  type PlatformAccount,
} from '@/data/platformTeam';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { EmptyState, ErrorNote, Spinner } from '@/ui/states';
import { usePlatformRole } from './PlatformGate';

const KIND: Record<PlatformAccount['kind'], string> = {
  church: 'Church',
  personal_ministry: 'Personal ministry',
};

/** "Grace Chapel" → "grace-chapel" (a suggestion; they can edit it). */
function suggestSubdomain(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Platform → Accounts: every ministry on Ekklē, with metadata only — team size,
 * seekers, studies, conversations. Never message contents, never seekers'
 * names or emails (docs/accounts-and-roles.md). Owners and Admins create
 * accounts (inviting the first Admin) and suspend them; Support only views.
 */
export default function Accounts() {
  const role = usePlatformRole();
  const canManage = role === 'owner' || role === 'admin';
  const [params, setParams] = useSearchParams();
  const [accounts, setAccounts] = useState<PlatformAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const creating = params.get('new') === '1';

  async function refresh() {
    try {
      setAccounts(await listPlatformAccounts());
    } catch {
      setError('Couldn’t load the accounts.');
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  const totals = accounts?.reduce(
    (t, a) => ({
      seekers: t.seekers + a.seekers,
      conversations: t.conversations + a.conversations,
      connections: t.connections + a.connections,
    }),
    { seekers: 0, conversations: 0, connections: 0 },
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl">Accounts</h1>
          <p className="mt-1 text-sm text-muted-strong">
            Every church and ministry on Ekklē. Numbers only — conversations stay private.
          </p>
        </div>
        {canManage && !creating && (
          <Button onClick={() => setParams({ new: '1' })}>New account</Button>
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-edge bg-card px-4 py-3 text-sm text-sage">
          {notice}
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}

      {creating && canManage && (
        <NewAccountForm
          prefill={{
            name: params.get('name') ?? '',
            adminName: params.get('admin') ?? '',
            adminEmail: params.get('email') ?? '',
          }}
          onCancel={() => setParams({})}
          onCreated={(msg) => {
            setParams({});
            setNotice(msg);
            void refresh();
          }}
        />
      )}

      {accounts === null && !error ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : accounts && accounts.length === 0 ? (
        <EmptyState title="No accounts yet" note="Ministry accounts will appear here." />
      ) : accounts && totals ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="accounts" value={accounts.length} />
            <Stat label="people exploring" value={totals.seekers} />
            <Stat label="conversations" value={totals.conversations} />
            <Stat label="connections made" value={totals.connections} />
          </div>
          <Card className="p-0">
            <ul className="divide-y divide-edge/70">
              {accounts.map((a) => (
                <AccountRow
                  key={a.id}
                  account={a}
                  canManage={canManage}
                  onChanged={(msg) => {
                    setNotice(msg);
                    void refresh();
                  }}
                  onError={setError}
                />
              ))}
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function AccountRow({
  account: a,
  canManage,
  onChanged,
  onError,
}: {
  account: PlatformAccount;
  canManage: boolean;
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const url = accountUrl(a);
  const suspended = a.status === 'suspended';

  async function toggle() {
    const next = suspended ? 'active' : 'suspended';
    if (next === 'suspended' && !confirm(`Pause ${a.name}? Its address goes offline for everyone until you reactivate it.`))
      return;
    setBusy(true);
    try {
      await setAccountStatus(a.id, next);
      onChanged(next === 'suspended' ? `${a.name} is paused.` : `${a.name} is active again.`);
    } catch {
      onError('Couldn’t change that account.');
    } finally {
      setBusy(false);
    }
  }

  async function resend(email: string) {
    setBusy(true);
    try {
      await sendInvitation(email, accountUrl(a, '/app'));
      onChanged(`Invitation sent again to ${email}.`);
    } catch {
      onError('Couldn’t send the invitation. Try again in a minute.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-sage">{a.name}</span>
            <span className="eyebrow text-[10px]">{KIND[a.kind]}</span>
            {suspended && <span className="text-[11px] font-medium text-sage">paused</span>}
            {a.admins === 0 && a.invited_admins.length === 0 && (
              <span className="text-[11px] text-sage">no admin</span>
            )}
          </span>
          <a href={url} className="text-[13px] text-muted underline-offset-2 hover:text-sage hover:underline">
            {new URL(url).host}
          </a>
        </span>
        <span className="flex gap-5 text-right text-[13px] text-muted-strong">
          <Mini label="team" value={a.team} />
          <Mini label="exploring" value={a.seekers} />
          <Mini label="studies" value={a.studies_started} />
          <Mini label="chats" value={a.conversations} />
        </span>
      </div>
      {(a.invited_admins.length > 0 || canManage) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
          {a.invited_admins.map((email) => (
            <span key={email} className="flex items-center gap-2">
              Admin invited: {email}
              {canManage && (
                <button onClick={() => resend(email)} disabled={busy} className="text-sage underline-offset-2 hover:underline">
                  Resend
                </button>
              )}
            </span>
          ))}
          {canManage && (
            <button onClick={toggle} disabled={busy} className="ml-auto text-muted hover:text-sage">
              {suspended ? 'Reactivate' : 'Pause account'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function NewAccountForm({
  prefill,
  onCancel,
  onCreated,
}: {
  prefill: { name: string; adminName: string; adminEmail: string };
  onCancel: () => void;
  onCreated: (msg: string) => void;
}) {
  const [form, setForm] = useState<NewAccount>({
    name: prefill.name,
    kind: 'church',
    subdomain: suggestSubdomain(prefill.name),
    adminName: prefill.adminName,
    adminEmail: prefill.adminEmail,
  });
  const [addressEdited, setAddressEdited] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Is the address free? (Checked as it changes.)
  useEffect(() => {
    if (!form.subdomain) return setAvailable(null);
    let live = true;
    const t = setTimeout(() => {
      isSubdomainAvailable(form.subdomain)
        .then((ok) => live && setAvailable(ok))
        .catch(() => live && setAvailable(null));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [form.subdomain]);

  const address = form.subdomain ? new URL(accountUrl({ subdomain: form.subdomain, custom_domain: null })).host : '';
  const valid = form.name.trim() && form.adminEmail.trim() && available === true;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const account = await createAccount(form);
      let msg = `${form.name.trim()} is ready at ${address}.`;
      try {
        await sendInvitation(form.adminEmail, accountUrl(account, '/app'));
        msg += ` We emailed ${form.adminEmail.trim()} an invitation to be its Admin.`;
      } catch {
        msg += ` The invitation email didn’t send — use “Resend” on the account.`;
      }
      onCreated(msg);
    } catch (err) {
      setBusy(false);
      const r = reason(err);
      setError(
        r.includes('address_taken')
          ? 'That address is taken — try another.'
          : r.includes('invalid_address')
            ? 'Addresses use lowercase letters, numbers and dashes.'
            : r.includes('invalid_email')
              ? 'Check the admin’s email address.'
              : 'Couldn’t create the account. Please try again.',
      );
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-base">New account</h2>
        <p className="mt-1 text-sm text-muted-strong">
          It starts with the standard welcome flow; its Admin gets an email invitation.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextInput
          label="Name"
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            setForm((f) => ({ ...f, name, subdomain: addressEdited ? f.subdomain : suggestSubdomain(name) }));
          }}
          placeholder="Grace Chapel"
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-medium text-muted-strong">Kind</legend>
          <div className="flex gap-2">
            {(['church', 'personal_ministry'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={form.kind === k}
                onClick={() => setForm((f) => ({ ...f, kind: k }))}
                className={
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors ' +
                  (form.kind === k
                    ? 'border-accent bg-accent text-canvas'
                    : 'border-edge text-muted-strong hover:border-sage/50')
                }
              >
                {KIND[k]}
              </button>
            ))}
          </div>
        </fieldset>
        <TextInput
          label="Address"
          value={form.subdomain}
          onChange={(e) => {
            setAddressEdited(true);
            setForm((f) => ({ ...f, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }));
          }}
          hint={
            !form.subdomain
              ? 'Lowercase letters, numbers and dashes.'
              : available === false
                ? `${address} isn’t available.`
                : available
                  ? `${address} is available.`
                  : address
          }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="First admin’s name"
            value={form.adminName}
            onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
          />
          <TextInput
            label="First admin’s email"
            type="email"
            value={form.adminEmail}
            onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
          />
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={busy || !valid}>
            {busy ? 'Creating…' : 'Create and invite'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-edge bg-card px-4 py-4">
      <div className="font-serif text-2xl font-medium text-sage tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-muted">{label}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col items-end">
      <span className="font-medium text-sage tabular-nums">{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </span>
  );
}
