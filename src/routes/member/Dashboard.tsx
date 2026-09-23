import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/auth/SessionProvider';
import { updateMyProfile, setActiveSequence } from '@/data/members';
import { listApprovedSequences, type Sequence } from '@/data/sequences';
import { env } from '@/lib/env';
import { appConfig } from '@/config/app';
import { QrImage, useQrDataUrl } from '@/ui/QrCode';
import { Card, Marker } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { TextInput, TextArea } from '@/ui/Field';
import { ErrorNote } from '@/ui/states';
import FlowPreview from '@/recipient/FlowPreview';

/**
 * Member home. The focal element is the keepsake card — the thing a member is
 * proud to hold up in person. Everything else (editing, copy/download) is
 * demoted around it.
 */
export default function MemberDashboard() {
  const { membership, refreshMembership } = useSession();

  const shareUrl = useMemo(() => {
    if (!membership) return '';
    const origin = env.siteUrl || window.location.origin;
    return `${origin}/r/${membership.code_slug}`;
  }, [membership]);

  if (!membership) return null;

  return (
    <div className="flex flex-col gap-8">
      <KeepsakeCard
        name={membership.name}
        message={membership.short_message}
        shareUrl={shareUrl}
      />
      <FlowPicker
        activeSequenceId={membership.active_sequence_id}
        onChange={async (sequenceId) => {
          await setActiveSequence(sequenceId);
          await refreshMembership();
        }}
      />
      <ProfileEditor
        key={membership.id}
        initialName={membership.name}
        initialMessage={membership.short_message}
        onSave={async (fields) => {
          await updateMyProfile(membership.id, fields);
          await refreshMembership();
        }}
      />
    </div>
  );
}

function KeepsakeCard({
  name,
  message,
  shareUrl,
}: {
  name: string;
  message: string;
  shareUrl: string;
}) {
  const dataUrl = useQrDataUrl(shareUrl, 640);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the link is visible below to copy by hand */
    }
  }

  function download() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `ekkle-${name.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.click();
  }

  return (
    <section aria-label="Your code to share" className="flex flex-col items-center gap-5">
      {/* The framed keepsake — ringed in space, letterpress feel */}
      <div className="w-full max-w-sm rounded-2xl border border-edge bg-card p-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex flex-col items-center gap-2">
            <span className="eyebrow">{appConfig.tagline}</span>
            <Marker />
          </div>
          <QrImage value={shareUrl} size={240} alt={`QR code linking to ${name}`} />
          <div className="flex flex-col gap-1">
            <p className="font-serif text-xl font-medium text-sage">{name}</p>
            {message && (
              <p className="text-sm leading-relaxed text-muted-strong">“{message}”</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2">
        <div className="flex gap-2">
          <Button variant="quiet" size="sm" className="flex-1" onClick={copyLink}>
            {copied ? 'Link copied' : 'Copy link'}
          </Button>
          <Button
            variant="quiet"
            size="sm"
            className="flex-1"
            onClick={download}
            disabled={!dataUrl}
          >
            Download
          </Button>
        </div>
        <p className="break-all text-center text-[12px] text-muted">{shareUrl}</p>
      </div>
    </section>
  );
}

function FlowPicker({
  activeSequenceId,
  onChange,
}: {
  activeSequenceId: string | null;
  onChange: (sequenceId: string | null) => Promise<void>;
}) {
  const [flows, setFlows] = useState<Pick<Sequence, 'id' | 'title'>[]>([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    listApprovedSequences()
      .then(setFlows)
      .catch(() => setFlows([]));
  }, []);

  // Only a meaningful choice when there's more than one published flow.
  if (flows.length < 2) return null;

  async function select(value: string) {
    setSaving(true);
    try {
      await onChange(value || null);
    } finally {
      setSaving(false);
    }
  }

  // No explicit pick yet → the first published flow is the effective default.
  const effectiveId = activeSequenceId ?? flows[0]?.id ?? null;

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-base">Which invitation your code shares</h2>
        <p className="mt-1 text-sm text-muted-strong">
          Choose the flow people see when they open your code. Preview any of them first.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {flows.map((f) => {
          const active = f.id === effectiveId;
          return (
            <li
              key={f.id}
              className={
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ' +
                (active ? 'border-sage/50 bg-sage/[0.04]' : 'border-edge')
              }
            >
              <span
                aria-hidden
                className={
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ' +
                  (active ? 'border-sage' : 'border-edge')
                }
              >
                {active && <span className="h-2 w-2 rounded-full bg-sage" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-sage">{f.title}</span>
              <button
                onClick={() => setPreview({ id: f.id, title: f.title })}
                className="shrink-0 text-[13px] text-muted transition-colors hover:text-sage"
              >
                Preview
              </button>
              {!active && (
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={saving}
                  onClick={() => void select(f.id)}
                >
                  Use this
                </Button>
              )}
              {active && (
                <span className="shrink-0 text-[12px] uppercase tracking-eyebrow text-muted">
                  Active
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {preview && (
        <FlowPreview
          sequenceId={preview.id}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      )}
    </Card>
  );
}

function ProfileEditor({
  initialName,
  initialMessage,
  onSave,
}: {
  initialName: string;
  initialMessage: string;
  onSave: (fields: { name: string; short_message: string }) => Promise<void>;
}) {
  const cap = appConfig.limits.shortMessageMaxLength;
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState(initialMessage);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name !== initialName || message !== initialMessage;
  const remaining = cap - message.length;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await onSave({ name: name.trim(), short_message: message });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch {
      setError('Couldn’t save just now. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base">How you appear</h2>
        <p className="mt-1 text-sm text-muted-strong">
          Your name and a short, personal note — this is what someone sees first.
        </p>
      </div>
      <TextInput
        label="Display name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextArea
        label="Short message"
        rows={2}
        maxLength={cap}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        hint={`${remaining} character${remaining === 1 ? '' : 's'} left`}
        placeholder="Thought of you — no pressure at all."
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-[13px] text-muted">Saved</span>}
      </div>
    </Card>
  );
}
