# Ekklē — interface design system

Locked direction for the **church-side product UI** (member dashboard, leadership
builders, inbox, tracking). The **recipient QR experience** is intentionally
separate and brand-guide-led (reverent, content-first), not governed by this file.

## Direction & feel
Editorial and unhurried — reads like a quiet publication, not a SaaS dashboard.
Warm, reverent, trustworthy to church leadership. One clear focal element per
screen. Audience is volunteers/leaders, not power users → clarity over density.

## Depth strategy (committed — do not mix)
**Flat: borders + surface-color shifts. No drop shadows.** Separation comes from
soft tan borders (`--color-edge`) and whisper-quiet cream/off-white surface steps
(canvas → card). Matches the brand's printed, flat warmth.

## Color (from brand guide — the palette IS the world)
- Canvas (page): `#F4F1EA` warm off-white
- Card surface: `#FDFCF8` soft cream
- Border: `#E4DFD1` muted tan
- Primary text / dark accent: `#3F4A3A` deep sage (the single accent — used with restraint)
- Muted text: `#8A8676` / strong `#6B6754`
- ~60/30/10: mostly canvas+card neutral, sage as the scarce accent for the one action per view.

## Typography
- Headlines/wordmark: **Fraunces** 500, optical sizing on; slightly tight tracking at large sizes.
- Body/UI: **Inter** 400/500.
- Eyebrow labels: Inter, uppercase, tracking `0.14em`, muted.
- Hierarchy via **weight + opacity**, not size alone. Type scale ratio ~1.25 on a 15px base.

## Spacing & density
- Base unit **4px**; use multiples only. Airy: card padding 24px; section gaps 24–32px.
- Symmetric padding. Group related items tightly, then real air between groups.

## Navigation
- **Top wordmark + 2–3 quiet text tabs**, content centered like a page. **Mobile-first**:
  tabs collapse to a simple bottom or wrapped row on narrow screens; no left sidebar.
- Tabs by role — member: `Your code · Messages`; leadership adds `Content · People · Signals`.

## Radius scale
- Inputs/buttons: 8px · cards: 12px (`rounded-card`) · large surfaces/modals: 16px.
- Concentric: nested radius = outer − padding.

## Signature elements
- The **macron accent** (the line over ē) recurs as a thin marker/divider.
- The member's **share-your-code screen = a framed keepsake card** (QR + name + 60-char
  message composed like letterpress), the focal element ringed in space — never a plain control row.

## Component patterns (fill in as they're built, 2+ uses)
- `Button primary` — sage fill, cream text, 8px radius, 14px/500, ~40px h, `:active` scale 0.97.
- `Button quiet` — transparent, sage text, hover = faint sage tint.
- `Card` — cream surface, 1px tan border, 12px radius, 24px padding, no shadow.
- (extend here as extracted)

## Motion
- Subtle only. Durations <300ms; ease-out `cubic-bezier(0.23,1,0.32,1)`; press `scale(0.97)`.
- Animate transform/opacity only. Respect `prefers-reduced-motion`.

## States are mandatory
Every interactive element: default/hover/active/focus/disabled. Every data view:
loading/empty/error. Focus rings visible (sage, low-opacity ring).
