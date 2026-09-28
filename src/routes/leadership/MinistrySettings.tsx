import { useEffect, useState } from 'react';
import { getOrganization } from '@/data/organizations';
import { listMembers, setJoinEnabled, type Member } from '@/data/members';
import { regenerateJoinCode, setOrgSettings, type Organization } from '@/data/platform';
import { accountUrl } from '@/account/address';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { ErrorNote, Spinner } from '@/ui/states';

/**
 * Account → Settings (Admins): who home-page seekers reach, whether the offer
 * page is open, and the join code (on/off, regenerate).
 */
export function MinistrySettings({ orgId }: { orgId: string }) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [responder, setResponder] = useState('');
  const [offerEnabled, setOfferEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getOrganization(orgId), listMembers(orgId)])
      .then(([o, m]) => {
        setOrg(o);
        setMembers(m);
        setResponder(o.default_member_id ?? '');
        setOfferEnabled(o.offer_enabled);
      })
      .catch(() => setError('Couldn’t load the settings.'));
  }, [orgId]);

  if (!org)
    return error ? (
      <ErrorNote>{error}</ErrorNote>
    ) : (
      <div className="py-6">
        <Spinner />
      </div>
    );

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // The name is edited above (branding); '' keeps it as it is.
      setOrg(await setOrgSettings({ name: '', defaultMemberId: responder || null, offerEnabled }));
      setSaved(true);
    } catch {
      setError('Couldn’t save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function regen() {
    if (!org || !confirm('Make a new join code? The old one stops working.')) return;
    try {
      const code = await regenerateJoinCode();
      setOrg({ ...org, join_code: code });
    } catch {
      setError('Couldn’t make a new code.');
    }
  }

  async function toggleJoin() {
    if (!org) return;
    const next = !org.join_enabled;
    setOrg({ ...org, join_enabled: next }); // flip now; undo if it doesn't save
    try {
      await setJoinEnabled(next);
    } catch {
      setOrg((o) => (o ? { ...o, join_enabled: !next } : o));
      setError('Couldn’t change the join code.');
    }
  }

  const joinLink = accountUrl({ subdomain: org.subdomain, custom_domain: org.custom_domain }, '/welcome');

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-base">Settings</h2>
        <p className="mt-1 text-sm text-muted-strong">For this ministry’s Admins.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="responder" className="text-[13px] font-medium text-muted-strong">
          Designated responder
        </label>
        <select
          id="responder"
          value={responder}
          onChange={(e) => {
            setResponder(e.target.value);
            setSaved(false);
          }}
          className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
        >
          <option value="">First active member</option>
          {members
            .filter((m) => m.active && m.auth_uid)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        <p className="text-[12px] text-muted">
          Who seekers reach when they didn’t come through someone’s link.
        </p>
      </div>

      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium text-sage">Offer page open</span>
          <span className="text-[12px] text-muted">Whether /offer (free Bible studies) is open to the public.</span>
        </span>
        <input
          type="checkbox"
          checked={offerEnabled}
          onChange={(e) => {
            setOfferEnabled(e.target.checked);
            setSaved(false);
          }}
          className="h-5 w-5 accent-sage"
        />
      </label>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-edge pt-4">
        <div className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-sage">Join code</span>
            <span className="text-[12px] text-muted">
              Lets people add themselves as Members. Invitations work either way.
            </span>
          </span>
          <input
            type="checkbox"
            aria-label="Join code on"
            checked={org.join_enabled}
            onChange={toggleJoin}
            className="h-5 w-5 accent-sage"
          />
        </div>
        {org.join_enabled && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-edge bg-canvas px-3 py-2 font-mono text-sm text-sage">
              {org.join_code}
            </span>
            <Button variant="quiet" size="sm" onClick={regen}>
              New code
            </Button>
            <span className="text-[12px] text-muted">Share with {new URL(joinLink).host} → sign in → enter the code.</span>
          </div>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
    </Card>
  );
}
