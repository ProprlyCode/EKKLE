import { useEffect, useState } from 'react';
import { getPilotOrg } from '@/data/organizations';
import { listMembers, type Member } from '@/data/members';
import {
  getPlatformOverview,
  setOrgSettings,
  regenerateJoinCode,
  type PlatformOverview,
  type Organization,
} from '@/data/platform';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput } from '@/ui/Field';
import { Spinner, ErrorNote } from '@/ui/states';

/**
 * Platform console (platform_admin only): a cross-cutting overview + the
 * platform/church settings the owner controls. Product UI (interface-design):
 * flat depth, weight+opacity hierarchy, one clear read per tile.
 */
export default function Console() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPlatformOverview(), getPilotOrg(), listMembers()])
      .then(([o, g, m]) => {
        setOverview(o);
        setOrg(g);
        setMembers(m);
      })
      .catch(() => setError('Couldn’t load the console.'));
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!overview || !org)
    return (
      <div className="py-16">
        <Spinner />
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl">Platform</h1>
        <p className="mt-1 text-sm text-muted-strong">
          Everything happening across {org.name}.
        </p>
      </div>

      {/* Overview tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="studies started" value={overview.started} />
        <Stat label="completed" value={overview.completed} />
        <Stat label="reached out" value={overview.messaged} />
        <Stat label="connections made" value={overview.checkins.yes} />
      </div>

      {/* Per-member */}
      <Card className="p-0">
        <div className="border-b border-edge/70 px-5 py-3">
          <span className="eyebrow">by member</span>
        </div>
        {overview.members.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No members yet.</p>
        ) : (
          <ul className="divide-y divide-edge/70">
            {overview.members.map((m) => (
              <li key={m.code_slug} className="flex items-center justify-between px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-sage">{m.name}</span>
                  <span className="text-[12px] text-muted">/r/{m.code_slug}</span>
                </span>
                <span className="flex gap-5 text-right text-[13px] text-muted-strong">
                  <MiniStat label="started" value={m.started} />
                  <MiniStat label="reached out" value={m.messaged} />
                  <MiniStat label="chats" value={m.conversations} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Settings org={org} members={members} onSaved={setOrg} />
    </div>
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col items-end">
      <span className="font-medium text-sage tabular-nums">{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </span>
  );
}

function Settings({
  org,
  members,
  onSaved,
}: {
  org: Organization;
  members: Member[];
  onSaved: (org: Organization) => void;
}) {
  const [name, setName] = useState(org.name);
  const [responder, setResponder] = useState(org.default_member_id ?? '');
  const [offerEnabled, setOfferEnabled] = useState(org.offer_enabled);
  const [joinCode, setJoinCode] = useState(org.join_code);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = await setOrgSettings({
        name,
        defaultMemberId: responder || null,
        offerEnabled,
      });
      onSaved(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch {
      setError('Couldn’t save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function regen() {
    if (!confirm('Regenerate the join code? The old one stops working.')) return;
    try {
      setJoinCode(await regenerateJoinCode());
    } catch {
      setError('Couldn’t regenerate the code.');
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-base">Settings</h2>
        <p className="mt-1 text-sm text-muted-strong">Platform controls for this church.</p>
      </div>

      <TextInput label="Church name" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-muted-strong">
          Designated responder
        </label>
        <select
          value={responder}
          onChange={(e) => setResponder(e.target.value)}
          className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-sm text-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40"
        >
          <option value="">First active member</option>
          {members
            .filter((m) => m.active)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        <p className="text-[12px] text-muted">
          Who home-page seekers reach when they didn’t come through a member’s link.
        </p>
      </div>

      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium text-sage">Offer page live</span>
          <span className="text-[12px] text-muted">Whether /offer is open to the public.</span>
        </span>
        <input
          type="checkbox"
          checked={offerEnabled}
          onChange={(e) => setOfferEnabled(e.target.checked)}
          className="h-5 w-5 accent-sage"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-muted-strong">Member join code</label>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-edge bg-canvas px-3 py-2 font-mono text-sm text-sage">
            {joinCode}
          </span>
          <Button variant="quiet" size="sm" onClick={regen}>
            Regenerate
          </Button>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {saved && <span className="text-[13px] text-muted">Saved</span>}
      </div>
    </Card>
  );
}
