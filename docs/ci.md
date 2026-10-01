# CI and deploys

Everything lives in `.github/workflows/ci.yml`. Pushes to `main` are the only
way anything reaches production.

## What runs

| Job | When | What it proves |
|---|---|---|
| App checks | every push / PR | typecheck, lint, unit tests (`npm test`, no database settings — keep tested code free of the Supabase client), production build, Edge Functions load |
| Migrations apply cleanly | every push / PR | a fresh Postgres 17 applies every migration + seed; SQL lint; **database security tests** (`supabase/tests/`, pgTAP) |
| End-to-end | every push / PR | Playwright drives the real app against a full local Supabase: waitlist, recipient → member → reply, seeker sign-up → Study 1 |
| Staging | `main`, after all three pass | same commit → staging database (migrations + demo seed + demo logins) and **staging.ekkle.org**, then smoke tests there (`e2e-staging/`) as real personas |
| Deploy migrations | `main`, after staging passes | `supabase db push` to the live project |
| Deploy site | `main`, after the migrations | Vercel builds **exactly the tested commit** via its API, CI waits until it's live |
| Alert | `main` | opens (or comments on) a "CI is failing on main" issue assigned to the owner; closes it when green |

If any check fails, nothing deploys. Vercel's own auto-deploy for `main` is
off (`vercel.json`), so nothing skips the line.

- **Edge Functions load** (App checks): each function in `supabase/functions`
  is loaded with Deno (`deno install --entrypoint`), so a file that can't be
  parsed or an import that can't be found fails here, before any deploy —
  rather than at the production "Deploy migrations" step.

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
on: see below), and `ESV_API_KEY` (optional — turns the ESV on in the Bible:
the `bible-esv` function is deployed to staging and production with it; without
it the Bible offers BSB and KJV only).

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
| `leader@demo.ekkle.org` | Demo leader — a Leader of the demo ministry |
| `member@demo.ekkle.org` | David — a Member (`/r/david`) |
| `admin@demo.ekkle.org` | the demo ministry's Admin, and the Ekklē team's Owner on `staging.ekkle.org/platform` |
| `seeker@demo.ekkle.org` | a seeker (`/studies`, "I have a password") |

A seeker with no account is just anyone opening `/offer` or `/r/david`.
Sign-in email on staging goes through the same Send Email Hook as production
(`send-auth-email`, sent as "<Account> via Ekklē"); a smoke test sends one to
Resend's test inbox (`delivered@resend.dev`). Notification functions are
production-only for now.

How it's wired:
- **Database:** `supabase db push --include-seed` through the project's IPv4
  pooler (GitHub runners have no IPv6).
- **Site:** a Vercel *preview* deploy of the commit, then `staging.ekkle.org`
  is aliased to it. The domain is not a project domain (that would follow
  production); its SSL certificate was issued once in Vercel and auto-renews.
- **Access:** Vercel's login wall is off for previews, so staging is public
  (demo data only, `X-Robots-Tag: noindex` from `vercel.json`).
- **Token:** one Supabase access token with full permissions
  (`SUPABASE_ACCESS_TOKEN`) serves staging and production.

## Email

With `RESEND_API_KEY` set, the deploy-db job also deploys the notification
functions (`supabase/functions/notify*`), gives them their secrets, writes the
trigger config (migration 0019) and points Supabase Auth at Resend with the
sign-in template (`supabase/templates/sign_in.html`: link + 6-digit code).
It also deploys `send-auth-email` and turns on Supabase Auth's Send Email Hook,
so sign-in emails are sent in each account's name with its logo and colour
(the SMTP template stays as the fallback if the hook is ever switched off).
The hook's signing secret is derived from the project's service-role key, so
every deploy sets the same value on both sides. Without `RESEND_API_KEY`,
email is simply off and everything else still works.

## CAPTCHA (Cloudflare Turnstile)

Sign-in requests (email link or code, password, forgot password, invitations)
carry a Turnstile token (`src/lib/captcha.ts`). Production only:

- **Site key** (public): Vercel → Environment Variables →
  `VITE_TURNSTILE_SITE_KEY`, type Config, Production only. Unset (local, CI)
  means no check, and staging builds (`VITE_APP_ENV=staging`) skip it even if
  the key is there, so the tests and staging's persona sign-ins run without one.
- **Secret key**: Supabase (production) → Authentication → Attack Protection →
  Enable Captcha protection → Turnstile. Never in the repo, GitHub or Vercel.
  Switch it on only once a build with the site key is live; turning it off
  restores sign-in at once.
- Most people see nothing; a small "One quick check" card appears only when
  Cloudflare wants a tap.
