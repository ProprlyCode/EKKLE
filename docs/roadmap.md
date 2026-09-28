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
| Studies 2–27 | **In progress** — 20 of 27 imported; imported through the editor |
| N2 Follow-through | **Built** — nudges (24h / 48h), move one conversation |
| Bible reading plans | **Built** (0038) — Ekklē's four, ministries' own, read together, opt-in daily email |
| Faith in action prompts | **Built** (0039) — Ekklē's starting set (drafts to publish), ministries' own |
| Song on a study's Experience page | **Built** (0040) — audio only: SoundCloud link or uploaded file; ministries can swap |
| N3 Seeker experience | **Built** (0041) — installable; who-you're-talking-to card with photo; delete my details; weekly study reminder |
| N4 Leader & member tools | **Built** (0042) — outcomes (member, ministry, Ekklē team; 30/90 days/all time), wallet cards, reply box on phones |
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

## N3 — Seeker experience — built (0041, 28 Sep 2026)

Installable app (PWA): *built with Your space.* Decided: seekers delete their
own details; the study reminder is weekly; members own their photo and
leaders can remove it.

**1. Member photo**
- `users.photo` (a path in a new public `photos` bucket, `<org>/<uuid>.jpg`).
- Member QR page → "Your photo": upload (centre-cropped to a square in the
  browser, 400 px JPEG) or remove. Photos live in `photos/<membership id>/`.
  `set_my_photo(path | null)`.
- Leaders can remove a photo from the ministry's people list
  (`remove_member_photo(member)`), not upload one.

**2. "Who you're talking to" card**
- Shown above the message form on `/r/:slug` and in Your space → Messages
  before the first message: photo (or initials), name, the ministry's name,
  their short message, and two lines — "Your messages go to {name}, who'll
  reply personally" and "You can delete your details at any time in Your
  space → Account."
- `get_recipient_landing` and `seeker_connection` also return the photo.
- Replaces the small print under the form.

**3. Delete my details (self-serve)**
- Your space → Account → "Delete my details", with a confirm step.
- `delete_my_details()`: the same erasure as `erase_conversation` (messages
  removed, conversations closed, name/email cleared) plus the seeker's study
  progress, Bible highlights and notes, reading plans and reminders, then the
  sign-in itself. Signs them out to a short "Your details are deleted" page.
- As with a member's erase, the conversation leaves the member's inbox;
  leaders' views keep only counts.

**4. Weekly study reminder (opt-in)**
- In Your space → Studies: "Email me a reminder" → pick a day and time (in
  their time zone). Off by default; every email says how to stop it (Studies
  → Turn off) and links there.
- Sent only while there is a study to do (one in progress or the next one
  unlocked); stops once they've finished the series. Says which study and
  the page they're on, with a link straight back.
- `study_reminders (auth_uid, org_id, weekday, at, tz, last_sent_on)`;
  `private.study_reminders_due` on its own 15-minute job
  (`ekkle-study-reminders`); `notify` gains `kind: 'study'`.

**Tests:** pgTAP 19 (photo rules, delete removes everything, reminders due
only when a study is left); e2e: member adds a photo → seeker sees the card;
seeker deletes their details → the member sees it; reminder set/stop.

## N4 — Leader & member tools — built (0042, 28 Sep 2026)

- ~~Study editor~~ — *built (0034, below).*
- **Outcomes**, counts only, never message contents, for the last 30 or 90
  days or all time: opened a link → went through it → reached out → got a
  reply → connected ("we connected" check-in, once per person), plus people
  who started a study and studies completed (credited to the member whose
  link they arrived on). Each step shows its share of those who opened a
  link (hidden past 100%: people can also reach out without a link).
  - Leaders: Overview → the ministry and a row per member (`ministry_outcomes`).
  - Members: "What's come of your link" on their QR page (`my_outcomes`).
  - Ekklē team: Platform → Outcomes, every ministry and the total
    (`platform_outcomes`).
- **Wallet cards**: QR page → Print wallet cards — a Letter sheet of eight
  3.5 × 2 in cards (code, name, short message, ministry, link) with cut marks.
- **Reply box on phones** (member and seeker threads): pinned to the bottom,
  grows with the text, 16 px so phones don't zoom, keeps the newest message in
  view when the keyboard opens; Ctrl/⌘+Enter sends.
- Conversation starters: covered by Faith in action (0039).

## N5 — Studies 2–27 (in progress)

Import in Platform → Studies → Import from Word, check, preview, publish. Lock
the series once all 27 are in. (20 of 27 imported, 28 Sep 2026.)

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

**Bible reading plans** — *built (0038, see below).* In the Bible tab, for people exploring and the team.
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

## Reading plans (Sep 2026)

- *Built (0038).* Bible → Plans (Your space and the app). Ekklē's four
  plans — John in 21 days, the Gospels in 90 days (Luke 1 over two days),
  Psalms & Proverbs in 30 days, the Bible in a year (all 1,189 chapters) —
  generated by `scripts/bible/plans.mjs`. Tick days off in any order; today's
  reading is the first day not yet read; no streaks.
- Today's reading opens in the Bible with "Day N of your reading plan — Mark
  day N read". Your space Home shows plans in progress.
- **Read together:** Resources → Reading plans (Admins and Leaders) → "Read
  together…" from a date. People see the day the group is on and how many are
  reading along — a count, never names. Stop any time; readers keep their
  progress.
- **Own plans:** "New plan" — one line per day ("Luke 1:1-38; Psalm 23",
  "Genesis 1-3"), draft or published. The Ekklē team keeps Ekklē's plans in
  Platform → Plans.
- **Daily email:** off unless turned on, at a time the person picks in their
  own time zone; a job every 15 minutes sends the next unread day once a day
  (`notify`, kind `reading`), and stops when the plan is finished.

## Song on a study's Experience page — built (0040), audio only

*Built:* each study can carry a song, set in the study editor ("Song for the
Experience section") by whoever keeps the study: a **SoundCloud link** (its
slim audio player — full songs, licensing handled by SoundCloud) or an
**uploaded audio file** (MP3/M4A/AAC/OGG/WAV, up to 20 MB, public `songs`
bucket; only recordings the uploader has the rights to). When someone reaches
the Experience section, "Listen while you reflect ▶" appears; nothing plays
until they tap, and the player stays with them through the section. A
ministry can keep Ekklē's song, use its own, or offer none (Resources → Bible
studies → Song). YouTube was ruled out: no video wanted, and YouTube's terms
don't allow hiding the player.

### Earlier design notes

The idea: when someone reaches a study's *Experience* section, a song chosen
for that study plays while they reflect.

- **Where it lives:** one song per study (set in the study editor: a link,
  plus title and artist shown as a credit). It appears where the Experience
  section starts and keeps playing while they page through Experience.
- **No autoplay with sound:** browsers block it without a tap, and it would be
  jarring. A quiet "Listen while you reflect ▶" card; once tapped, a small
  player stays at the bottom until they leave the study. Remember "don't offer
  songs" per person.
- **Source — embed, don't host.** A YouTube (or YouTube Music) embed plays
  the full song for everyone and the platform handles the licensing. Spotify
  and Apple Music embeds play only 30-second previews unless the listener is
  signed in to them. Hosting MP3s needs streaming rights for each song (CCLI's
  streaming licence covers a church's own services, not an app like this), so
  avoid uploads unless a song is the ministry's own.
- **Things to decide:** YouTube only, or YouTube + Spotify? One song per
  study, or per Experience page? Can a ministry swap the song for its own
  choice? (No lyrics on screen — they're copyrighted separately.)
- **Build size:** small — a `song` field on studies (url, title, artist),
  a field in the editor, and the player card in the reader.

## Faith in action (Sep 2026)

- *Built (0039).* Beside each member's code (the Your code tab): **this
  week's** prompt — the same for everyone in the ministry, turning over each
  Monday — and "More ideas" to browse, in three kinds: everyday moments,
  sharing your code, conversation starters.
- Ekklē's starting set (24 prompts, drafted by Claude) arrives as **drafts**:
  the Ekklē team edits and publishes them in Platform → Prompts. A ministry's
  Admins and Leaders add their own in Resources → Faith in action.
