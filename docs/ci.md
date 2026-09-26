# CI and deploys

Everything lives in `.github/workflows/ci.yml`. Pushes to `main` are the only
way anything reaches production.

## What runs

| Job | When | What it proves |
|---|---|---|
| App checks | every push / PR | typecheck, lint, unit tests (`npm test`), production build |
| Migrations apply cleanly | every push / PR | a fresh Postgres 17 applies every migration + seed; SQL lint; **database security tests** (`supabase/tests/`, pgTAP) |
| End-to-end | every push / PR | Playwright drives the real app against a full local Supabase: waitlist, recipient → member → reply, seeker sign-up → Study 1 |
| Deploy migrations | `main`, after all three pass | `supabase db push` to the live project |
| Deploy site | `main`, after the migrations | Vercel builds **exactly the tested commit** via its API, CI waits until it's live |
| Alert | `main` | opens (or comments on) a "CI is failing on main" issue assigned to the owner; closes it when green |

If any check fails, nothing deploys. Vercel's own auto-deploy for `main` is
off (`vercel.json`), so nothing skips the line.

## Day to day

- **Database changes:** add the next numbered file in `supabase/migrations/`
  (e.g. `0019_something.sql`). Never edit the live database by hand — CI applies
  it. Keep a migration compatible with the site that's live while it deploys.
- **Run locally:** `npm run typecheck && npm run lint && npm test`.
  End-to-end needs a local Supabase: `supabase start`, build with its URL/anon
  key, then `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run test:e2e`.
- **Dependencies:** Dependabot opens PRs every Monday (minor/patch grouped).
  CI runs on them; merge when green.

## Secrets (repo → Settings → Secrets and variables → Actions)

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN` (Ekkle team),
and `RESEND_API_KEY` (optional — turns email on: see below).

## Email

With `RESEND_API_KEY` set, the deploy-db job also deploys the notification
functions (`supabase/functions/notify*`), gives them their secrets, writes the
trigger config (migration 0019) and points Supabase Auth at Resend with the
sign-in template (`supabase/templates/sign_in.html`: link + 6-digit code).
Without it, email is simply off and everything else still works.
