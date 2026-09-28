import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextArea, TextInput } from '@/ui/Field';
import { ErrorNote, Spinner } from '@/ui/states';
import {
  dayLabel,
  deletePlan,
  endTogether,
  parseDayLine,
  planForEditing,
  planLibrary,
  savePlan,
  startTogether,
  type LibraryPlan,
} from './plans';

const today = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd, local

/**
 * Reading plans for Admins and Leaders (Resources → Reading plans): Ekklē's
 * plans and the ministry's own; read one together from a date; write your
 * own. On ekkle.org (`bank`) the Ekklē team keeps Ekklē's plans.
 */
export function PlanLibrary({ base, bank }: { base: string; bank: boolean }) {
  const [plans, setPlans] = useState<LibraryPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState<{ id: string; date: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function refresh() {
    try {
      setPlans(await planLibrary());
    } catch {
      setError('Couldn’t load the plans.');
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch {
      setError('That didn’t work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!bank && (
            <Link to="/leadership/resources" className="text-[13px] text-muted hover:text-sage">
              ← Resources
            </Link>
          )}
          <h1 className="mt-1 font-serif text-2xl text-sage">Reading plans</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-strong">
            {bank
              ? 'Ekklē’s plans — everyone can follow them in the Bible tab. Ministries can add their own.'
              : 'Everyone can follow these in the Bible tab. Read one together as a ministry, or write your own.'}
          </p>
        </div>
        <Link to={`${base}/new`}>
          <Button size="sm">New plan</Button>
        </Link>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {plans === null ? (
        !error && <Spinner />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-edge/70">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sage">{p.title}</span>
                      <span className="eyebrow text-[10px]">{p.source === 'ekkle' ? 'Ekklē' : 'Your ministry'}</span>
                      {p.status === 'draft' && <span className="eyebrow text-[10px]">Draft</span>}
                    </span>
                    <span className="block text-[12px] text-muted">
                      {p.days} days
                      {p.together &&
                        ` · reading together since ${p.together.start_on} · ${p.together.readers} reading along`}
                    </span>
                  </span>
                  {!bank &&
                    p.status === 'published' &&
                    (p.together ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void act(() => endTogether(p.together!.group_id))}
                      >
                        Stop reading together
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setStarting({ id: p.id, date: today() })}>
                        Read together…
                      </Button>
                    ))}
                  {p.editable && (
                    <>
                      <Link to={`${base}/${p.id}`} className="text-[13px] text-sage underline-offset-2 hover:underline">
                        Edit
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(p.id)}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
                {starting?.id === p.id && (
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-strong">
                    <label className="flex items-center gap-2">
                      Starting
                      <input
                        type="date"
                        value={starting.date}
                        onChange={(e) => setStarting({ ...starting, date: e.target.value })}
                        className="rounded-md border border-edge bg-canvas px-2 py-1 text-sage"
                      />
                    </label>
                    <Button
                      size="sm"
                      disabled={busy || !starting.date}
                      onClick={() => void act(() => startTogether(p.id, starting.date)).then(() => setStarting(null))}
                    >
                      Start reading together
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setStarting(null)}>
                      Cancel
                    </Button>
                    <span className="w-full text-[12px] text-muted">
                      Everyone in your ministry sees it in the Bible tab and can read along. They see how many are
                      reading — never who.
                    </span>
                  </div>
                )}
                {deleting === p.id && (
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-strong">
                    <span>Delete “{p.title}”? Anyone following it loses their place.</span>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void act(() => deletePlan(p.id)).then(() => setDeleting(null))}
                    >
                      Delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Write a plan: one line per day ("John 1; Psalm 23"). */
export function PlanEditor({ base }: { base: string }) {
  const { planId = 'new' } = useParams();
  const isNew = planId === 'new';
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState('');
  const [draft, setDraft] = useState(false);
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    planForEditing(planId)
      .then((p) => {
        setTitle(p.title);
        setDescription(p.description ?? '');
        setLines(p.days.map(dayLabel).join('\n'));
        setDraft(p.status === 'draft');
        setLoaded(true);
      })
      .catch(() => setError('This plan can’t be edited here.'));
  }, [planId, isNew]);

  const parsed = useMemo(
    () =>
      lines
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => parseDayLine(l)),
    [lines],
  );
  const problems = parsed.map((p, i) => (typeof p === 'string' ? `Day ${i + 1}: ${p}` : null)).filter(Boolean);
  const days = parsed.filter((p): p is string[] => typeof p !== 'string');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (problems.length || !days.length || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await savePlan(isNew ? null : planId, { title, description, days, status: draft ? 'draft' : 'published' });
      navigate(base);
    } catch {
      setSaving(false);
      setError('Couldn’t save the plan. Please try again.');
    }
  }

  if (!loaded) return error ? <ErrorNote>{error}</ErrorNote> : <Spinner />;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <Link to={base} className="text-[13px] text-muted hover:text-sage">
          ← Reading plans
        </Link>
        <h1 className="mt-1 font-serif text-2xl text-sage">{isNew ? 'New reading plan' : 'Edit reading plan'}</h1>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Card className="flex flex-col gap-4">
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advent" />
        <TextInput
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          hint="One line on what it is."
        />
        <TextArea
          label="Days"
          value={lines}
          onChange={(e) => setLines(e.target.value)}
          rows={12}
          className="font-mono text-[13px]"
          hint="One line per day. Separate passages with “;” — e.g. “Luke 1:1-38; Psalm 23” or “Genesis 1-3”."
        />
        <p className="text-[13px] text-muted" role="status">
          {problems.length ? problems[0] : `${days.length} ${days.length === 1 ? 'day' : 'days'}`}
        </p>
        <label className="flex items-center gap-2 text-[13px] text-muted-strong">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} className="h-4 w-4 accent-sage" />
          Keep as a draft (nobody sees it yet)
        </label>
      </Card>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !title.trim() || !days.length || problems.length > 0}>
          {saving ? 'Saving…' : 'Save plan'}
        </Button>
        <Link to={base}>
          <Button variant="ghost">Cancel</Button>
        </Link>
      </div>
    </form>
  );
}
