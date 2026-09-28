# Roadmap — seeker & member improvements (approved Sep 2026)

Approved by Jonathan. Built in order, one sprint at a time, each shipped through
CI (checks → migrations → site). Seeker item "age question at sign-up" is **on
hold** pending a decision; Tailwind 4 is **on hold**.

## Where we are (28 Sep 2026)

| Area | Status |
|---|---|
| N1 Notifications | **Built** — emails through Resend, sign-in code + link, sign-in emails in the account's name |
| Your space | **Built** — Home, Messages, Studies, Bible, Resources, Account; installable |
| Accounts on their own addresses | **Built** — subdomains, branding (tenancy.md phases 1–2b) |
| Roles & platform console | **Built** — steps 1–3 (accounts-and-roles.md); remove people |
| Study bank · study editor | **Built** — shared bank, series, Word import, answers after submitting |
| Built-in Bible | **Built** — BSB, KJV, ESV; search, highlights, notes, study references |
| Studies 2–27 | **In progress** — 6 of 27 in hand; imported through the editor |
| N2 Follow-through | **Built** — nudges (24h / 48h), move one conversation |
| Bible reading plans · Faith in action prompts | Agreed — next to plan (see "Next ideas") |
| N3 Seeker experience | Partly — installable done; "who you're talking to" card, reminders left |
| N4 Leader & member tools | Partly — study editor done; outcomes view, member help left |
| Address change requests | Not started (roles step 4) |
| Self-serve ministry sign-up + approval | Later (roles step 5) |
| Custom domains · Visit us card · age question · Tailwind 4 | On hold |

## Decisions

| Topic | Decision |
|---|---|
| Email | **Resend**, sending from ekkle.org (Jonathan sets up the account + DNS) |
| Studies 2–27 | Jonathan gathers them in the Study 1 format and imports them in Platform → Studies (Word import, 0034); `scripts/convert_study.py` is no longer needed |
| "Who you're talking to" card | Optional member **photo** + name + church (initials when no photo) |
| Unanswered messages | Nudge the member at **24h**; metadata-only leader alert at **48h** |

## N1 — Notifications — built

*Built:* `notify`, `notify-report` and `send-auth-email` are deployed by CI;
sign-in emails go through the Send Email Hook and Resend (tenancy.md 2b). The
original plan:

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

## Your space (seekers) — built (Sep 2026)

One gated home for everyone reached through Ekklē, at `ekkle.org/space`
(signed out → sign-in, then back to the page they asked for).

- **Home** — their person (last message), where they are in the studies.
- **Messages** — the conversation with the member who shared (or the church's
  designated responder if they came in without a member's link).
- **Studies** — the library and reader (moved from `/studies`; old links
  redirect).
- **Resources** — church-approved reading / video (YouTube, Vimeo) / links,
  by topic. Leaders manage them at Leadership → Resources (live preview,
  draft/published); seekers see only their church's published ones.
- **Account** — email, password, delete-my-data, sign out.
- **Installable** — an app manifest + icons; Home offers "Add to home screen"
  (the browser's prompt on Android/Chrome, Share → Add to Home Screen on
  iPhone). It opens straight to Your space. No service worker (no offline
  cache to go stale).

From a member's link: the first message sends instantly, then "Keep this
conversation" emails a code; confirming it opens Your space → Messages with
the conversation already there (any device, verified email). Skipping keeps
them on the link. Revisiting the link while signed in → "Continue in your
space". Reply emails link to Your space.

On hold: **Visit us** card (must fit different account owners — church,
personal ministry — think through first). Later: Your person photo card,
email preferences.

## N2 — Follow-through (built, 0035)

*Already covered elsewhere:* resuming on any device (Your space), and handing a
removed person's conversations to a teammate (0032).

*Built (0035):* a job every 15 minutes (pg_cron) finds people whose last
message has gone unanswered — the member is emailed at 24 hours, the
ministry's Admins and Leaders get a metadata-only note at 48 hours, once per
wait (waits older than a week when it shipped were skipped). Overview →
Conversations lists every conversation (metadata only, waiting ones first)
with **Move to…**: the history moves, the person exploring sees "You're now
talking with …" in the conversation (no email), and the new member sees who
passed it on. Fixed with it: Your space now follows a conversation that moved
(also after Remove).

- Unanswered-message nudges: 24h email to the member, 48h metadata-only alert to
  the church's leaders (scheduled with `pg_cron`).
- Leaders can **reassign** a conversation to another member; the seeker is told
  who they're now talking with; the history moves with it.
- Seeker can **resume a conversation on any device**: once they've given their
  email, the same email sign-in (link or code) reopens it.

## N3 — Seeker experience (installable: built with Your space)

- "Who you're talking to" card before writing: photo (optional upload in the
  member profile, Supabase Storage), name, church, and one line on what happens
  when you send and how to delete your details.
- Installable app (PWA): add to home screen, opens straight to studies /
  conversation.
- Opt-in study reminders (email; never on by default).

## N4 — Leader & member tools

- ~~Study editor~~ — *built (0034, below).*
- Outcomes view: codes shared → flows finished → conversations → met in person
  → studies started/completed, per church and per member.
- Member help: printable / wallet QR card, a few conversation starters, a
  better mobile inbox.

## N5 — Studies 2–27 (in progress)

Import in Platform → Studies → Import from Word, check, preview, publish. Lock
the series once all 27 are in. (6 of 27 in hand, Sep 2026.)

## Multi-church — built differently than first planned

Instead of paths (`ekkle.org/c/<slug>`), each ministry has its own address
(`<ministry>.ekkle.org`) — see tenancy.md. Ministry roles, the platform console
and branding are built (accounts-and-roles.md steps 1–3). Left: address change
requests (step 4) and self-serve sign-up with approval (step 5, later).

## On hold

- Seeker age question at sign-up (needs a policy decision).
- Tailwind 4 (browser support for seekers on older phones).

## Bible study bank (Sep 2026)

- *Built (0031).* Ekklē keeps a shared bank of studies (`studies.org_id` null);
  every ministry gets them, next to any of its own. In Resources → Bible
  studies, Admins and Leaders choose which studies their seekers get, set the
  unlock order and preview each study exactly as seekers see it (nothing
  saved). New bank studies appear for everyone, on, at the end. Seekers keep
  their own Studies tab, which follows the ministry's choice and order.
- Fixed with it: a seeker's next study now stays locked until the one before
  is finished (it unlocked as soon as the previous one was listed).
- *Next:* the study editor — built (0034, below).

## Built-in Bible (Sep 2026)

- *Built (0033).* A Bible tab in Your space and in the app (for the team):
  read by book and chapter, search, highlight verses (four colours) and keep
  notes, and a Notes list. Scripture references in studies are tappable and
  open the passage, with "Open in the Bible".
- Translations: **BSB** (default) and **KJV** are public domain and served as
  static files (`public/bible/<t>/<BOOK>.json`, built by
  `scripts/bible/build.mjs` from scrollmapper/bible_databases). **ESV** comes
  live from api.esv.org through the `bible-esv` edge function (key server-side,
  signed-in users only, 20 requests a minute each) and appears once
  `ESV_API_KEY` is set.
- ESV terms: non-commercial, never stored (the database keeps only references
  — `bible_marks`, `bible_state`), copyright notice shown under ESV text.

## Next ideas (agreed Sep 2026, to plan in detail)

**Bible reading plans** — in the Bible tab, for people exploring and the team.
- Plans come from Ekklē (a starting set, e.g. John in 21 days, the Gospels in
  90 days, the Bible in a year) and ministries add their own, like the study
  bank.
- Simple: today's passage opens in the Bible; tick it off; catch up any time;
  no streaks.
- *Read it together:* a ministry starts a plan for its people; each reader sees
  that others are reading along (a count, never names or scores).
- Opt-in daily email with today's reading (never on by default; one tap to stop).

**Faith in action** — on the member's QR page (their code and share link).
- A "This week" prompt beside the code, plus a list to browse: everyday
  moments, ways to share the code, conversation starters.
- Ekklē writes a starting set; a ministry's Admins and Leaders add their own.

## Study editor (Sep 2026)

- *Built (0034).* Studies belong to **series**. Ekklē's series are the shared
  bank, kept by the Ekklē team's Owners and Admins (Platform → Studies); a
  ministry's Admins and Leaders keep their own (Resources → Bible studies →
  "Write or import your own studies"). A **locked** series is finished: its
  studies can't be edited and nothing is added to it (locking needs every
  draft published or discarded first).
- **Import from Word** (one or many .docx at once, read in the browser): the
  title line ("3  THE IMAGE OF GOD"), pages split at "Page N of M" lines (else
  Word page breaks), underscores → blanks (quotes around them dropped),
  Discover/Connect/Experience and capitalised lines → headings, images kept,
  "Submit Answers" ends the content, and the table with an "Answer" column
  gives one answer per blank. Warnings when blanks and answers don't match.
- **Editor:** each page as text (`# heading`, `_____` blank, `[image 1]`), the
  answer for each blank beside its page, add / join / remove pages, preview in
  the real reader, and **draft → publish** (every blank needs an answer).
  People keep their progress; the editor warns that moved blanks can shift it.
- **People** see their answers beside the intended ones once they submit a
  study (never before). Studies unlock one after another within a series, and
  are numbered within it; the Studies tab groups them by series.
