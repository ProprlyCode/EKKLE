# Roadmap — seeker & member improvements (approved Sep 2026)

Approved by Jonathan. Built in order, one sprint at a time, each shipped through
CI (checks → migrations → site). Seeker item "age question at sign-up" is **on
hold** pending a decision; Tailwind 4 is **on hold**.

## Decisions

| Topic | Decision |
|---|---|
| Email | **Resend**, sending from ekkle.org (Jonathan sets up the account + DNS) |
| Studies 2–27 | Jonathan gathers them in the Study 1 format; converted with `scripts/convert_study.py` |
| "Who you're talking to" card | Optional member **photo** + name + church (initials when no photo) |
| Unanswered messages | Nudge the member at **24h**; metadata-only leader alert at **48h** |

## N1 — Notifications (first)

Nothing emails anyone today: the code in `supabase/functions/notify*` has never
been deployed, and sign-in emails use Supabase's built-in, rate-limited sender.

- CI deploys Edge Functions (`notify`, `notify-report`) and sets their secrets.
- Database triggers (a migration) call them on new messages / new reports.
- Seeker is emailed when the member replies (with a link back into the
  conversation); member is emailed when a seeker writes; leaders get the
  metadata-only first-message and incident-report notes.
- Supabase Auth sends through Resend SMTP (no more rate limit).
- **6-digit sign-in code** alongside the magic link (studies + member sign-in),
  so sign-in works inside Instagram/Facebook/in-app browsers.
- Tests: e2e for code sign-in; pgTAP for the trigger wiring.

**Jonathan:** Resend account → add domain `ekkle.org` → add the DNS records it
lists → create an API key → add GitHub secret `RESEND_API_KEY`. Then paste
Resend's SMTP details into Supabase → Auth → SMTP.

## N2 — Follow-through

- Unanswered-message nudges: 24h email to the member, 48h metadata-only alert to
  the church's leaders (scheduled with `pg_cron`).
- Leaders can **reassign** a conversation to another member; the seeker is told
  who they're now talking with; the history moves with it.
- Seeker can **resume a conversation on any device**: once they've given their
  email, the same email sign-in (link or code) reopens it.

## N3 — Seeker experience

- "Who you're talking to" card before writing: photo (optional upload in the
  member profile, Supabase Storage), name, church, and one line on what happens
  when you send and how to delete your details.
- Installable app (PWA): add to home screen, opens straight to studies /
  conversation.
- Opt-in study reminders (email; never on by default).

## N4 — Leader & member tools

- Study editor for leaders (create/edit studies and pages, fill-in blanks,
  live preview, draft/approved) — replaces SQL seeding.
- Outcomes view: codes shared → flows finished → conversations → met in person
  → studies started/completed, per church and per member.
- Member help: printable / wallet QR card, a few conversation starters, a
  better mobile inbox.

## N5 — Studies 2–27 (when the source files are ready)

Convert with the existing converter, seed via migration, proof in the reader.

## Then: multi-church (C1–C4)

As already planned: path-based tenancy (`ekkle.org/c/<slug>`), gated church
sign-up, church owners manage admins, per-church branding, platform console.

## On hold

- Seeker age question at sign-up (needs a policy decision).
- Tailwind 4 (browser support for seekers on older phones).
