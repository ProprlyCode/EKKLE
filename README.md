[![CI](https://github.com/ProprlyCode/EKKLE/actions/workflows/ci.yml/badge.svg)](https://github.com/ProprlyCode/EKKLE/actions/workflows/ci.yml)

# Ekklē

A quiet platform for personal invitation and follow-through. A church member
shares a personalized link/QR code; the recipient walks through a short,
church-authored welcome sequence and — if they choose — connects back to the
same person who shared it. Success is real relationships, not time-in-app.

This is the **v1 pilot** build: single church, no multi-tenancy. See the build
plan for scope and sprints.

## Stack

- **Vite + React + TypeScript + Tailwind** (frontend)
- **Supabase** — Postgres, Auth (magic link), Row-Level Security, Realtime,
  Edge Functions, Storage
- **Vercel** (hosting)

## Architecture notes (for changeability)

- `src/config/app.ts` — single-tenant config + Phase B feature flags in one place.
- `src/data/*` — the only place that talks to Supabase. UI never imports the
  client directly, so backend/query changes stay contained.
- `src/lib/database.types.ts` — hand-authored to match migrations; regenerate
  with `supabase gen types typescript` once a project exists.
- DB status/role/event fields are `text` + CHECK constraints (not PG enums) so
  values are easy to change later. Every table carries `org_id` so multi-tenant
  later is a policy change, not a reshape.
- The anonymous recipient experience never gets direct table access — it goes
  through SECURITY DEFINER RPCs (added per sprint). Leaders get **metadata-only**
  visibility (no select on `messages`).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key

# with the Supabase CLI installed:
supabase start               # local Postgres + auth + studio
supabase db reset            # apply migrations + seed

npm run dev
```

Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`.

## Deployment

- Vercel project pointing at this repo; set `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`.
- SPA rewrite is configured in `vercel.json`.
- Secrets (service-role key, email provider key) live only in Supabase Edge
  Function secrets — never in the client bundle.
