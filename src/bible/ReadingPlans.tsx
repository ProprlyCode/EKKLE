import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/ui/Button";
import { ErrorNote, Spinner } from "@/ui/states";
import {
  dayLabel,
  getPlan,
  listPlans,
  markDay,
  parseReadingId,
  readingLabel,
  setReminder,
  startPlan,
  stopPlan,
  type PlanDetail,
  type PlanSummary,
} from "./plans";

/**
 * Bible → Plans: reading plans to follow at your own pace (tick days off,
 * catch up any time — no streaks), ones the ministry is reading together, and
 * an optional daily email. `base` is '/space/bible' or '/app/bible'.
 */
export function PlanList({ base }: { base: string }) {
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listPlans()
      .then(setPlans)
      .catch(() => setError(true));
  }, []);

  const mine = plans?.filter((p) => p.mine) ?? [];
  const others = plans?.filter((p) => !p.mine) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to={base} className="text-[13px] text-muted hover:text-sage">
          ← Bible
        </Link>
        <h1 className="mt-2 font-serif text-2xl text-sage">Reading plans</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-muted-strong">
          A little each day, at your own pace. Miss a day? Just pick up where
          you left off.
        </p>
      </div>

      {error && <ErrorNote>Couldn’t load the plans.</ErrorNote>}
      {plans === null && !error && <Spinner />}

      {mine.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">your plans</span>
          {mine.map((p) => (
            <PlanCard key={p.id} plan={p} base={base} />
          ))}
        </section>
      )}
      {others.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">
            {mine.length ? "more plans" : "choose a plan"}
          </span>
          {others.map((p) => (
            <PlanCard key={p.id} plan={p} base={base} />
          ))}
        </section>
      )}
    </div>
  );
}

function PlanCard({ plan, base }: { plan: PlanSummary; base: string }) {
  return (
    <Link
      to={`${base}/plans/${plan.id}`}
      className="card flex flex-col gap-1 px-5 py-4 transition-colors hover:border-sage/40"
    >
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-serif text-lg text-sage">{plan.title}</span>
        {plan.together && (
          <span className="eyebrow text-[10px]">reading together</span>
        )}
      </span>
      {plan.description && (
        <span className="text-[14px] text-muted-strong">
          {plan.description}
        </span>
      )}
      <span className="text-[12px] text-muted">
        {plan.mine
          ? plan.mine.next_day
            ? `${plan.mine.done} of ${plan.days} days read · next: day ${plan.mine.next_day}`
            : `Finished — all ${plan.days} days read`
          : `${plan.days} days`}
      </span>
    </Link>
  );
}

export function PlanPage({ base }: { base: string }) {
  const { planId = "" } = useParams();
  const navigate = useNavigate();
  const area = base.startsWith("/app") ? "app" : "space";
  const [plan, setPlan] = useState<PlanDetail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function refresh() {
    try {
      setPlan(await getPlan(planId));
    } catch {
      setPlan(null);
    }
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch {
      setError("That didn’t work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (plan === undefined) return <Spinner />;
  if (plan === null)
    return (
      <div className="flex flex-col gap-3">
        <ErrorNote>This plan isn’t available.</ErrorNote>
        <Link to={`${base}/plans`} className="text-sm text-sage underline">
          All plans
        </Link>
      </div>
    );

  const done = new Set(plan.mine?.done_days ?? []);
  const next = plan.days.find((d) => !done.has(d.day)) ?? null;
  // Around where they are (or the group is), unless they ask for every day.
  const focus = plan.mine
    ? (next?.day ?? plan.days.length)
    : (plan.together?.day ?? 1);
  const visible = showAll
    ? plan.days
    : plan.days.filter((d) => d.day >= focus - 2 && d.day <= focus + 6);
  const openHref = (reading: string, day: number) => {
    const r = parseReadingId(reading);
    return r
      ? `${base}/${r.book.id}/${r.chapter}?plan=${plan.id}&day=${day}`
      : base;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={`${base}/plans`}
          className="text-[13px] text-muted hover:text-sage"
        >
          ← Reading plans
        </Link>
        <h1 className="mt-2 font-serif text-2xl text-sage">{plan.title}</h1>
        {plan.description && (
          <p className="mt-1 text-[15px] leading-relaxed text-muted-strong">
            {plan.description}
          </p>
        )}
        <p className="mt-1 text-[13px] text-muted">
          {plan.mine
            ? `${done.size} of ${plan.days.length} days read`
            : `${plan.days.length} days`}
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {plan.together && (
        <div className="rounded-lg border border-sage/20 bg-sage/5 px-4 py-3 text-[14px] text-muted-strong">
          Your ministry is reading this together — the group is on day{" "}
          {Math.min(plan.together.day, plan.days.length)}
          {plan.together.readers > 0 &&
            ` · ${plan.together.readers} ${plan.together.readers === 1 ? "person" : "people"} reading along`}
          .
        </div>
      )}

      {!plan.mine ? (
        <div className="flex flex-wrap gap-2">
          {plan.together && (
            <Button
              onClick={() => void act(() => startPlan(plan.id, true, area))}
              disabled={busy}
            >
              Read along together
            </Button>
          )}
          <Button
            variant={plan.together ? "quiet" : "primary"}
            onClick={() => void act(() => startPlan(plan.id, false, area))}
            disabled={busy}
          >
            {plan.together ? "Start on my own" : "Start this plan"}
          </Button>
        </div>
      ) : next ? (
        <section
          className="card flex flex-col gap-3 px-5 py-4"
          aria-label="Today’s reading"
        >
          <span className="eyebrow">today’s reading · day {next.day}</span>
          <ul className="flex flex-wrap gap-2">
            {next.readings.map((r) => (
              <li key={r}>
                <Link
                  to={openHref(r, next.day)}
                  className="inline-block rounded-lg border border-edge bg-canvas px-3 py-1.5 font-serif text-[16px] text-sage hover:border-sage/40"
                >
                  {readingLabel(r)}
                </Link>
              </li>
            ))}
          </ul>
          <div>
            <Button
              size="sm"
              onClick={() => void act(() => markDay(plan.id, next.day, true))}
              disabled={busy}
            >
              Mark day {next.day} read
            </Button>
          </div>
        </section>
      ) : (
        <p className="rounded-lg border border-sage/20 bg-sage/5 px-4 py-3 text-[14px] text-muted-strong">
          You’ve read every day of this plan.
        </p>
      )}

      {plan.mine && <Reminder plan={plan} busy={busy} act={act} />}

      <section className="flex flex-col gap-2">
        <span className="eyebrow">days</span>
        <ol className="flex flex-col divide-y divide-edge/70 rounded-card border border-edge bg-card">
          {visible.map((d) => (
            <li key={d.day} className="flex items-center gap-3 px-4 py-2.5">
              {plan.mine ? (
                <input
                  type="checkbox"
                  checked={done.has(d.day)}
                  onChange={(e) =>
                    void act(() => markDay(plan.id, d.day, e.target.checked))
                  }
                  disabled={busy}
                  aria-label={`Day ${d.day} read`}
                  className="h-4 w-4 shrink-0 accent-sage"
                />
              ) : null}
              <span className="w-14 shrink-0 text-[12px] tabular-nums text-muted">
                Day {d.day}
              </span>
              <Link
                to={openHref(d.readings[0], d.day)}
                className="min-w-0 flex-1 truncate text-[15px] text-sage hover:underline"
              >
                {dayLabel(d.readings)}
              </Link>
            </li>
          ))}
        </ol>
        {plan.days.length > visible.length && (
          <button
            onClick={() => setShowAll(true)}
            className="self-start text-[13px] text-sage underline-offset-2 hover:underline"
          >
            Show all {plan.days.length} days
          </button>
        )}
      </section>

      {plan.mine && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          {confirmStop ? (
            <>
              <span>Stop this plan? Your ticks are cleared.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void act(() => stopPlan(plan.id)).then(() =>
                    navigate(`${base}/plans`),
                  )
                }
              >
                Stop
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmStop(false)}
              >
                Keep reading
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmStop(true)}
            >
              Stop this plan
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** The optional daily email: off unless they turn it on, at a time they choose. */
function Reminder({
  plan,
  busy,
  act,
}: {
  plan: PlanDetail;
  busy: boolean;
  act: (fn: () => Promise<void>) => Promise<void>;
}) {
  const on = !!plan.mine?.remind_at;
  const [time, setTime] = useState(
    (plan.mine?.remind_at ?? "07:00").slice(0, 5),
  );
  return (
    <section className="card flex flex-col gap-3 px-5 py-4 text-[14px]">
      <span>
        <span className="block font-medium text-sage">Daily email</span>
        <span className="text-[13px] text-muted">
          {on
            ? `Today’s reading arrives each day at ${time}.`
            : "Off. Get each day’s reading by email, at a time you choose."}
        </span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px] text-muted-strong">
          At
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Email time"
            className="rounded-md border border-edge bg-canvas px-2 py-1 text-sage"
          />
        </label>
        {on ? (
          <>
            <Button
              size="sm"
              variant="quiet"
              disabled={busy}
              onClick={() => void act(() => setReminder(plan.id, time))}
            >
              Save time
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void act(() => setReminder(plan.id, null))}
            >
              Turn off
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            disabled={busy || !time}
            onClick={() => void act(() => setReminder(plan.id, time))}
          >
            Turn on
          </Button>
        )}
      </div>
    </section>
  );
}
