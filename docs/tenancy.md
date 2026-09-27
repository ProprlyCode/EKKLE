# Accounts on their own addresses (plan — Sep 2026)

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

1. **Accounts by address** — subdomain per account, address → account lookup,
   ekkle.org as platform-only, redirects for old links, all public lookups
   scoped to the account. Staging gets `*.staging.ekkle.org`.
2. **Branding** — name, logo upload, accent colour; per-account app icon/name;
   emails in the account's name.
3. **Custom domains** — connect / verify / remove from account settings.
4. **Platform console** — create accounts, pick their subdomain, see them all;
   "find your church" on ekkle.org.

## Open

- Storyline's subdomain (e.g. `storyline.ekkle.org`).
- Jonathan's personal ministry as its own account (planned earlier) — create
  it in phase 4.
- Visit us card (on hold) fits here once accounts have types (church,
  personal ministry…).
