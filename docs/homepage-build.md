# Ekklē homepage (ekkle.org/) — build doc

The cinematic "Ecce Homo" marketing home. This doc holds the **source brief** (Jonathan's,
verbatim in substance), the **resolved decisions**, the **final copy**, and the **image
manifest** (what to upload, sizes, formats). It's the single reference for the homepage.

- Code: `src/public/home/` (entry `Home.tsx`, scenes in `scenes/`, motion in `motion.ts`)
- Images config: `src/public/home/images.ts` — set a slot's path once its file is uploaded
- Image files: `public/home/`
- Waitlist: migration `supabase/migrations/0017_waitlist.sql`, data `src/data/waitlist.ts`

---

## Resolved decisions

| Brief item | Decision |
|---|---|
| `[OPEN]` framework | In-app React route (`/`), GSAP + ScrollTrigger in `useLayoutEffect`, Lenis smooth scroll. Homepage is code-split so product routes never load the animation libraries. |
| Palette | Agora palette, **homepage only**, blended with Ekklē's sage/cream where it harmonizes: sage as a second green depth tone beside juniper; the Scene 5 product card uses the real product surfaces (cream card, sage/Fraunces headline) with a brass Continue button. Tokens are scoped to `.home-root` and never leak into the app. |
| Imagery | Jonathan supplies the painterly images (manifest below). Until each lands, its slot renders a CSS/SVG chiaroscuro placeholder (architecture, figures as silhouette, light shaft, grain) so the page is complete and testable. Dropping an image in is a one-line change in `images.ts`. |
| `[OPEN]` Scene 5 screens | Acknowledge → Connect (screens 1 and 4 of the drafted arc). |
| `[OPEN]` primary CTA | **Join the waitlist** only (no competing verb). |
| `[OPEN]` submissions | Supabase `waitlist` table via the anon `join_waitlist` RPC (name, email, ministry). Deny-by-default RLS, insert-only. |
| Scenes | 7, as proposed. |
| Mobile | **Craft-preserving, not a generic fallback** (see below). |

### Mobile (<768px) — intentional, art-directed
We drop only the expensive *mechanic* (long scroll-pins, scrubbed 3D perspective), never the
art direction:
- Every scene keeps full-bleed chiaroscuro imagery, grain, and large display type.
- Scene 1 settles in with a slow push (scale) instead of pointer parallax.
- Scene 3 **still performs the cold → warm pivot** as a scroll-linked reveal (desaturation
  lifts, brass light bleeds in, the image settles from 1.06 → 1.0) — just unpinned.
- Scene 5's demo stays fully interactive and keeps its pin (it's tap-driven).
- On-enter motion uses real `transform` (rise + slight scale), plus a light parallax on
  the imagery — not bare opacity fades.

### Reduced motion
With `prefers-reduced-motion`: no smooth scroll, no pins, no scrubs, no parallax, no 3D.
Every scene is a simple opacity fade-in; Scene 3 shows its warm end-state; Scene 5 still
works by tap with instant screen changes and no auto-advance.

---

## Final copy (all editable in the scene files)
Jonathan's essential lines are used verbatim; the rest is drafted from the brief.

- **S1 Threshold (hook):** Empowering individuals to make connections and grow them
- **S2 (positioning):** a system for churches and individuals to do ministry in a more
  personal way — *affirmative positioning instead of the brief's "name the problem" beat,
  since the supplied copy is affirmative; easily reverted.*
- **S3 Behold:** the single held word "Behold." late in the scrub (remove to let the image
  carry it alone).
- **S4 How it works:** 1 Share your code. · 2 They behold it, on their own. · 3 You follow
  up — personally.
- **S5 Demo:** the real Acknowledge + Connect screen copy; a one-line frame above the card:
  "What someone sees when you share with them".
- **S6 Integrity** (each its own full-viewport beat, in order — the long line is split
  into two beats to honor the ~12-words-at-once rule):
  1. Relational integrity on display between individuals
  2. Sharing something as important as the gospel needs personal accountability.
  3. Everything you share is uniquely tied to you, and available for further conversation
     with you
  4. Vindicating the character of God, one intentional conversation at a time
- **S7 Invitation:** a quiet place to explore — together · button **Join the waitlist**

---

## Image manifest (upload to `public/home/`)

Reference mood: **Ciseri, *Ecce Homo* (1871)** — for chiaroscuro balcony/threshold staging
only, not to be reproduced.

**Rules for every image**
- One warm **brass** light source (≈ `#A9824C`); everything else falls to near-`#232A2E`
  shadow.
- Figures suggested by light and silhouette — reverent, not illustrative or cartoonish.
- Leave a low-contrast **safe zone** where text sits (noted per image).
- **Format:** WebP (quality ≈ 80) + a JPG fallback of the same crop. Logo: SVG preferred,
  or PNG-24 with transparency.
- **Weight:** aim for ≤ 400 KB per file.
- **Crops:** a **desktop landscape** and a **mobile portrait** version of each full-bleed
  image. Keep the subject inside the middle third horizontally so both crops hold.

| # | File names | Scene | Content | Desktop | Mobile | Light / notes |
|---|---|---|---|---|---|---|
| 1 | `hero.webp` `hero.jpg` · `hero-mobile.webp` `hero-mobile.jpg` | S1 | Dark classical columns/archway; a single shaft of brass light falling through it. **No figure.** | 2560×1440 | 1080×1920 | Light from upper-left. Keep the lower-center dim — the headline sits there. |
| 2 | `status-quo.*` · `status-quo-mobile.*` | S2 | The same architectural language, but **cold, desaturated, no brass**; a crowd as indistinct silhouettes in the distance. | 2560×1440 | 1080×1920 | Flat, cool light. Emotionally muted. Center kept quiet for the line of text. |
| 3 | `behold.*` · `behold-mobile.*` | S3 (key image) | A threshold/balcony with drapery; **one figure turning to present another** (the *ecce homo* gesture); the presented figure is the one lit. | 2560×1600 | 1080×1920 | **Neutral to slightly cool** base light, coming from **one side (right)** — the page adds the warm brass bleed from that side and shifts cold → warm. Figures mid-frame with room around them: the image is scaled 0.9 → 1.05 → 1.0 and must not crop faces. |
| 4 | `sanctuary.*` · `sanctuary-mobile.*` | S4, S5, S7 | The same architectural language fully resolved **warm/brass**; no prominent figures. A backdrop that reads behind text. | 2560×1440 | 1080×1920 | Warm glow, low-contrast center. Reused across three scenes (dimmed differently in each). Scene 6 uses a painted CSS ground instead, so it needs no image. |
| 5 | `logo-light.svg` (or `.png`) | Header | The Ekklē archway mark in **cream `#F1ECE1`** (or brass) on transparent, for dark grounds. | 512×512 | — | Must read clearly on `#232A2E`. Until supplied, the header shows the "Ekklē" wordmark in type. |

**Optional (not blocking)**
- `behold-warm.*` — a fully brass-lit end-state of image 3, if you'd rather supply the warm
  version than have the page tint it.
- `columns-layer.png` — a transparent foreground column/balustrade silhouette for extra
  parallax depth in Scene 1.

### How an uploaded image goes live
Put the files in `public/home/`, then fill the slot in `src/public/home/images.ts`, e.g.

```ts
hero: { desktop: '/home/hero.webp', desktopFallback: '/home/hero.jpg',
        mobile: '/home/hero-mobile.webp', mobileFallback: '/home/hero-mobile.jpg' },
```

The placeholder art disappears for that slot; motion, overlays, and alt text are unchanged.

---

## Verification
- `npm run build` (typecheck + build) green.
- Desktop (≥ 768px): S3 pins and scrubs cold → warm; S4 reveals three beats in a pin; S5
  advances on tap and releases the pin when finished, and auto-advances once after ~4s of
  dwell; S7 submits to the waitlist (row appears in Supabase `waitlist`).
- Reduced motion: plain fades, no pins, S5 still works by tap.
- Mobile (< 768px): no scrubbed 3D or long pins; the pivot still reads; S5 still pins and
  works by tap.
- Final type (Source Serif 4 / Inter), imagery, and motion are judged in a real browser /
  Vercel preview — the build sandbox can't load Google Fonts or show scroll motion.

---

## Source brief (Jonathan)

> Pasted as the build brief. It specifies structure, motion, pacing, and interaction logic
> precisely enough that the output shouldn't default to generic scroll-fade patterns.
> `[OPEN]` items were resolved above.

### 0. Premise (not on the page)
Ekklē lets a believer share a personal code/link. The recipient goes through a short,
church-authored sequence — not a resource dump — and if they're interested, they're
connected back to the same person who shared it, not a stranger. The homepage's job is to
make a skeptical church leader feel the weight and warmth of that idea before they've read
a single paragraph of explanation. No feature list. No objection-handling copy. Intrigue,
then one clear action: join the waitlist or book a call.

Emotional throughline: **"Ecce Homo" — behold the man.** Not as a literal Bible
illustration, but as the shape of the experience: someone is presented, someone else
beholds them, and something changes in that moment of seeing. The app recreates that
moment between two ordinary people, one-on-one, over and over.

### 1. Visual system
**Palette (Agora direction — do not substitute):** `--stone #F1ECE1` base light ·
`--stone-dim #C8BFA9` muted support/dividers · `--brass #A9824C` single warm accent, used
sparingly (CTA, key underlines, light-source glow) · `--juniper #38493E` secondary dark for
depth/shadow tones, never a large flat fill · `--ink #232A2E` near-black, primary dark
background and text.

**Type:** Display/headline `Source Serif 4` weight 600, generous size (clamp 32–64px),
tight line-height (1.05–1.15). Body/UI `Inter` 400/500, short lines (max ~50 characters);
most text on the page is treated as display type. No all-caps labels, no tracked-out
eyebrows, no numbered "01/02/03" markers unless a scene is literally a sequence.

**Painterly / classical treatment (the aesthetic backbone):** chiaroscuro lighting — dark
grounds, one deliberate warm brass light source per scene, everything else in shadow
toward ink. Architectural motifs from classical/renaissance painting — columns, archways,
balustrades, drapery folds — as soft painterly gradients and layered silhouettes, never
flat vector icons. A subtle canvas/grain overlay (~4–6% opacity) on full-bleed sections.
Figures suggested through light and silhouette rather than literal illustration.

### 2. Scroll architecture & tech
Mixed mechanic per scene: normal reveal-on-scroll for transitions, pinned scrollytelling
for conceptual beats, one fully scroll-scrubbed sequence for the emotional pivot (Scene 3).
Motion register bold and cinematic: parallax depth layers, 3D perspective transforms,
scroll-scrubbed opacity/scale/position tied directly to scroll progress. Stack: GSAP +
ScrollTrigger, Lenis smooth scroll. Performance: animate only `transform` and `opacity`;
`will-change` only on actively animating layers; debounce resize/refresh. Global
reduced-motion fallback to simple fades (no pin/parallax/3D; Scene 5 still works by tap).
Global mobile rule (<768px): no pinning / horizontal / 3D; stacked sections with a single
fade+slide — *superseded by the craft-preserving mobile decision above.*

### 3. Scenes
1. **Threshold (hero)** — establish the painterly world and the tension (about to behold
   something). One line ≤8 words. Full-bleed dark chiaroscuro, columns/archway, one shaft
   of brass light, grain, no figure. Idle pointer/gyro parallax only (±8px, 2 layers);
   headline rises in on load (0.8s, `translateY(24px)→0`, `power2.out`). Exit cue: a thin
   brass line/chevron that pulse-fades, no "scroll to explore" text.
2. **The status quo** — name the impersonal way the gospel usually gets shared, without
   arguing. ≤12 words. Desaturated, flatter light, no brass; a crowd as distant
   silhouettes. Standard reveal: `start "top 80%" → end "top 40%"`, scrub, fade + slide
   from y:40.
3. **Behold (the pivot)** — fully scroll-scrubbed. One figure turns to present another;
   the palette shifts cold → warm through the scene. No copy, or a single held word.
   Pinned composition scrubbing through three states: 0–33% cold, distant (scale 0.9,
   rotateX 4deg); 33–66% warm light bleeds in from one side (radial overlay 0 → 0.6),
   camera pushes in (0.9 → 1.05); 66–100% full brass glow, figures clear, scale settles to
   1.0, rotateX 0. `pin: true, scrub: 1, start: "top top", end: "+=150%"`.
4. **How it works** — share your code → they behold the sequence, on their own → you
   follow up personally. Three lines ≤6 words; numbering is earned here. Pinned, warm
   background continuing from Scene 3; each line takes a third of `+=100%` and reveals
   with a perspective tilt (`rotateY(-15deg) → 0`, opacity 0 → 1).
5. **Interactive sequence preview (the real demo)** — pin on enter; a mock phone/card
   styled like the real recipient view; two of the four screens; a visible "Continue"
   cross-fades between them (opacity, 400ms); after tapping through both, release the pin
   (no scrolling required to unlock); if the visitor only scrolls, auto-advance once after
   ~4s dwell, then release. The card carries the product aesthetic (stone surface, ink
   text, brass Continue) inside the dark page. Mobile: same interaction, full-width.
6. **Relational integrity** — 2–3 drafted lines, one at a time, each its own
   full-viewport segment; dark ground, brass light, painterly texture; opacity tied
   directly to scroll position (fade in centered on enter, out on exit).
7. **Invitation to leaders (CTA)** — the one ask, quiet not salesy. One short line + one
   button. Returns to the full brass/warm palette (bookend with Scene 3). Still — no
   parallax or 3D. Minimal form: name + email + church/ministry name.

### 4. Global rules
Never more than ~12 words of display copy visible at once. One bold element per scene —
Scene 3 is the most elaborate; everything else is visibly quieter. Visible focus states on
the CTA and demo tap targets; reduced motion respected; descriptive alt text on all
painterly imagery. No stock AI-page tells: no tracked-out all-caps eyebrows, no middle-dot
metadata strings, no identical rounded-card grid, no single-word italic/color accent
inside a headline.
