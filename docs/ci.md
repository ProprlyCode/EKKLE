# CI and deploys

Everything lives in `.github/workflows/ci.yml`. Pushes to `main` are the only
way anything reaches production.

## What runs

| Job | When | What it proves |
|---|---|---|
| App checks | every push / PR | typecheck, lint, unit tests (`npm test`), production build |
| Migrations apply cleanly | every push / PR | a fresh Postgres 17 applies every migration + seed; SQL lint; **database security tests** (`supabase/tests/`, pgTAP) |
| End-to-end | every push / PR | Playwright drives the real app against a full local Supabase: waitlist, recipient → member → reply, seeker sign-up → Study 1 |
| Staging | `main`, after all three pass | same commit → staging database (migrations + demo seed + demo logins) and **staging.ekkle.org**, then smoke tests there (`e2e-staging/`) as real personas |
| Deploy migrations | `main`, after staging passes | `supabase db push` to the live project |
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
`STAGING_DB_PASSWORD` + `STAGING_DEMO_PASSWORD` (staging; until both exist the
staging job skips with a notice), and `RESEND_API_KEY` (optional — turns email
on: see below).

## Staging (staging.ekkle.org)

A full copy of the app on its own Supabase project (`ekkle-staging`,
`twxosrcbxidqmbjlzkga`) with **demo data only** — a banner says so, and search
engines are told not to index it. Vercel's *Preview* environment variables
point at it (`VITE_APP_ENV=staging` turns the banner on); *Production* keeps
the live database. Every push to `main` refreshes it before production.

Demo logins (password = `STAGING_DEMO_PASSWORD`), made by
`scripts/staging/personas.mjs`:

| Login | Who |
|---|---|
| `leader@demo.ekkle.org` | Sarah — church leadership |
| `member@demo.ekkle.org` | David — member (`/r/david`) |
| `admin@demo.ekkle.org` | platform admin (`/platform`) |
| `seeker@demo.ekkle.org` | a seeker (`/studies`, "I have a password") |

A seeker with no account is just anyone opening `/offer` or `/r/david`.
Staging sign-in email uses Supabase's built-in sender (a few per hour), so
prefer the password logins there.

## Email

With `RESEND_API_KEY` set, the deploy-db job also deploys the notification
functions (`supabase/functions/notify*`), gives them their secrets, writes the
trigger config (migration 0019) and points Supabase Auth at Resend with the
sign-in template (`supabase/templates/sign_in.html`: link + 6-digit code).
Without it, email is simply off and everything else still works.
