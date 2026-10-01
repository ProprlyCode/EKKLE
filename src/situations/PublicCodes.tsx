import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { useSession } from '@/auth/SessionProvider';
import { isAccountAdmin } from '@/auth/roles';
import { env } from '@/lib/env';
import { deletePublicCode, publicCodes, savePublicCode, type PublicCode, type PublicCodes as List } from '@/data/publicCodes';
import { listApprovedSequences, type Sequence } from '@/data/sequences';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextInput } from '@/ui/Field';
import { ErrorNote, Spinner } from '@/ui/states';
import { isLinkName, toLinkName } from './linkName';

/**
 * Leadership → Public codes (0050): the ministry's own codes for posters,
 * clothing and welcome tables. They open a flow as the ministry (no member's
 * photo); messages go to the designated responder. Admins make them; Leaders
 * see them and how they're doing.
 */

type Draft = { id: string | null; name: string; code: string; sequenceId: string; active: boolean };

const codeUrl = (code: string) => `${env.siteUrl || window.location.origin}/c/${code}`;

export default function PublicCodes() {
  const { membership } = useSession();
  const admin = isAccountAdmin(membership?.role);
  const [list, setList] = useState<List | null>(null);
  const [flows, setFlows] = useState<Pick<Sequence, 'id' | 'title'>[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    publicCodes()
      .then(setList)
      .catch(() => setError('Couldn’t load the public codes.'));
  useEffect(() => {
    void load();
    listApprovedSequences()
      .then(setFlows)
      .catch(() => setFlows([]));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/leadership/content" className="text-[13px] text-muted hover:text-sage">
            ← Content
          </Link>
          <h1 className="mt-1 text-xl">Public codes</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-strong">
            Codes for posters, clothing and welcome tables. Anyone who scans one meets the flow you choose, from{' '}
            your ministry rather than a person
            {list?.responder ? (
              <>
                , and messages go to <span className="font-medium text-sage">{list.responder}</span>, your designated
                responder.
              </>
            ) : (
              '.'
            )}{' '}
            Leaders can move a conversation to someone else, as with any other.
          </p>
        </div>
        {admin && !editing && (
          <Button onClick={() => setEditing({ id: null, name: '', code: '', sequenceId: '', active: true })}>
            New public code
          </Button>
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-edge bg-card px-4 py-3 text-sm text-sage">
          {notice}
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}

      {editing && (
        <Editor
          draft={editing}
          flows={flows}
          onCancel={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setNotice(msg);
            void load();
          }}
        />
      )}

      {list === null ? (
        !error && <Spinner />
      ) : list.codes.length === 0 ? (
        !editing && (
          <Card>
            <p className="text-sm text-muted">
              No public codes yet.{' '}
              {admin ? 'Make one for a poster, a T-shirt or your welcome table.' : 'Your Admins can make them.'}
            </p>
          </Card>
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {list.codes.map((c) => (
            <CodeRow
              key={c.id}
              c={c}
              admin={admin}
              onEdit={() =>
                setEditing({ id: c.id, name: c.name, code: c.code, sequenceId: c.sequence_id ?? '', active: c.active })
              }
              onDeleted={(msg) => {
                setNotice(msg);
                void load();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

function CodeRow({
  c,
  admin,
  onEdit,
  onDeleted,
}: {
  c: PublicCode;
  admin: boolean;
  onEdit: () => void;
  onDeleted: (msg: string) => void;
}) {
  const url = codeUrl(c.code);

  async function downloadPng() {
    download(await QRCode.toDataURL(url, { width: 2048, margin: 2, errorCorrectionLevel: 'M' }), `${c.code}-qr.png`);
  }
  async function downloadSvg() {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
    const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    download(href, `${c.code}-qr.svg`);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  return (
    <li>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium text-sage">
              {c.name}
              {!c.active && <span className="eyebrow text-[10px]">Off</span>}
            </p>
            <p className="break-all text-[13px] text-muted-strong">{url.replace(/^https?:\/\//, '')}</p>
            <p className="text-[13px] text-muted">
              Opens “{c.flow ?? 'no published flow yet'}” · opened {c.opened} · wrote {c.wrote}
            </p>
          </div>
          {admin && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={onEdit}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Delete “${c.name}”? Anything printed with it will stop working.`))
                    void deletePublicCode(c.id).then(() => onDeleted(`“${c.name}” is deleted.`));
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/leadership/public-codes/${c.id}/poster`}
            className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-[13px] font-medium text-canvas hover:bg-accent-soft"
          >
            Print a poster
          </Link>
          <Button size="sm" variant="quiet" onClick={() => void downloadPng()}>
            Download QR (PNG)
          </Button>
          <Button size="sm" variant="quiet" onClick={() => void downloadSvg()}>
            Download QR (SVG, for printing on clothing)
          </Button>
        </div>
      </Card>
    </li>
  );
}

function Editor({
  draft,
  flows,
  onCancel,
  onSaved,
}: {
  draft: Draft;
  flows: Pick<Sequence, 'id' | 'title'>[];
  onCancel: () => void;
  onSaved: (msg: string) => void;
}) {
  const [d, setD] = useState<Draft>(draft);
  const [codeEdited, setCodeEdited] = useState(Boolean(draft.code));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeError = d.code && !isLinkName(d.code) ? 'Lowercase letters, numbers and hyphens (e.g. “lobby”).' : null;
  const ready = !!d.name.trim() && !!d.code && !codeError;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await savePublicCode({ id: d.id, name: d.name, code: d.code, sequenceId: d.sequenceId || null, active: d.active });
      onSaved(`“${d.name.trim()}” is saved. Its link is ${codeUrl(d.code).replace(/^https?:\/\//, '')}.`);
    } catch (err) {
      setBusy(false);
      const code = (err as { message?: string } | null)?.message;
      setError(code === 'code_taken' ? 'Another public code uses that link name.' : 'That didn’t save. Please try again.');
    }
  }

  return (
    <Card>
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4" aria-label="Public code">
        <h2 className="text-base">{d.id ? 'Edit public code' : 'New public code'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="Name"
            placeholder="e.g. Lobby poster"
            value={d.name}
            maxLength={60}
            required
            onChange={(e) => setD({ ...d, name: e.target.value, code: codeEdited ? d.code : toLinkName(e.target.value) })}
          />
          <TextInput
            label="Link name"
            value={d.code}
            maxLength={30}
            required
            error={codeError ?? undefined}
            hint={d.code ? codeUrl(d.code).replace(/^https?:\/\//, '') : undefined}
            onChange={(e) => {
              setCodeEdited(true);
              setD({ ...d, code: e.target.value.toLowerCase() });
            }}
          />
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted-strong">
          Opens this flow
          <select
            value={d.sequenceId}
            onChange={(e) => setD({ ...d, sequenceId: e.target.value })}
            className="rounded-lg border border-edge bg-canvas px-3 py-2 text-sm font-normal text-sage"
          >
            <option value="">Your first published flow</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
          <span className="text-[12px] font-normal text-muted">
            Tip: start from the poster, clothing or welcome table template in Content.
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm text-sage">
          <input
            type="checkbox"
            className="h-4 w-4 accent-sage"
            checked={d.active}
            onChange={(e) => setD({ ...d, active: e.target.checked })}
          />
          On (switch off to retire a code without deleting it)
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !ready}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
