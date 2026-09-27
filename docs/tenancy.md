# Accounts on their own addresses (Sep 2026)

Every church or ministry account lives at its own address. Seekers, members
and leaders never need to see ekkle.org.

| Address | What lives there |
|---|---|
| `<account>.ekkle.org` — automatic | Everything for that account: member links `/r/<name>`, `/offer`, Your space `/space`, the members' & leaders' app `/app` |
| `space.theirchurch.org` — optional | The same, on their own domain (they add one DNS record) |
| `ekkle.org` | Ekklē itself: the homepage story, For churches, the waitlist, the platform console, and "find your church" sign-in |

## Decisions (Jonathan)

- Accounts use an Ekklē subdomain, or connect their own domain — their choice.
- All four areas move: Your space, member links, offer page, and the app.
- ekkle.org becomes marketing + platform only.
- Each account shows its own name, logo and accent colour.

## How it works

**Which account am I on?** The site reads the address it was opened on and
looks the account up (`<slug>.ekkle.org`, or a connected custom domain). On
ekkle.org itself there is no account: only the Ekklē pages exist there.

**Data stays inside the account.** Every public lookup (member link, offer,
Your space, resources, studies) is checked against the account of the address
it came from — a member link from one church can't be opened on another's.
A person can have a space with more than one church; each address shows only
that church's space.

**Sign-in** stays one Ekklē login per email, but a session belongs to the
address it was made on. Sign-in links and codes in emails always point back to
the account's own address; emails come from "<Church name> via Ekklē".

**Existing links keep working.** Printed QR codes and links on ekkle.org
(`/r/…`, `/offer`, `/space`, `/app`) redirect to the right account's address.

**Branding.** Leaders set name, logo (uploaded) and an accent colour in their
account settings. The accent is checked for readable contrast; the calm Ekklē
layout stays. The installable app (home-screen icon/name) uses the account's
logo and name.

**Custom domains.** In account settings a leader enters their domain; Ekklē
adds it to hosting and shows the one DNS record to create, then confirms when
it's live (SSL is automatic). Sign-in is allowed on it automatically.

## Build phases (each through CI → staging → production)

1. **Accounts by address** — *built.* Subdomain per account (0023),
   address → account lookup, ekkle.org as platform-only, redirects for old
   links, public lookups scoped by the request's Origin. Hosting: `*.ekkle.org`
   on the live project; `*.staging.ekkle.org` aliased to each staging build.
   Locally, accounts are `http://<sub>.localhost:5173`.
2. **Branding** — *built.* Leaders → Account (0024): name, logo upload (PNG,
   JPG, WebP or SVG, ≤ 2 MB, public `branding` bucket, own folder only) and an
   accent colour that must reach 4.5:1 contrast with the page (checked in the
   page and in the database). The accent drives buttons, active tabs and
   highlights (`accent` in tailwind.config.ts, sage by default); the logo
   shows in the headers of the front door, offer, member links, Your space and
   the app. The home-screen app takes the account's name and icons generated
   from the logo at upload. Notification emails come from
   "<Account> via Ekklē". (Sign-in codes are sent by Supabase Auth, still as
   Ekklē — until phase 2b.)
2b. **Sign-in emails in the account's name** — *built.* Supabase Auth's Send
   Email Hook hands every sign-in email (code + link, password reset, invite)
   to our `send-auth-email` function. It finds the account from the address
   the person started on and sends through Resend as "<Account> via Ekklē",
   with the account's logo and colour; the link returns to that address.
   CI turns it on (staging first, smoke-tested with Resend's test inbox) when
   RESEND_API_KEY is set. Locally it stays off, so tests read the email from
   Mailpit.
3. **Custom domains** — *on hold (optional, later).* Connect / verify /
   remove from account settings; subdomains only (e.g. space.theirchurch.org,
   one CNAME). Because sign-in emails build their own links (2b), a custom
   domain won't need adding to Supabase's redirect list: the app asks for the
   account's ekkle.org subdomain and the hook links to the custom domain.
   Open: where the Vercel token lives (a Supabase function vs a scheduled
   GitHub sync). Later still: sending from the church's own domain (verified
   in Resend).
4. **Platform console** — create accounts, pick their subdomain, see them all;
   "find your church" on ekkle.org.

## Open

- Jonathan's test account "Storyline" is now his personal ministry at
  `jonathan.ekkle.org` (kind: personal ministry); rename it in Account.
- Visit us card (on hold) fits here once accounts have types (church,
  personal ministry…).
