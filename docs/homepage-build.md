# Ekklē homepage (ekkle.org/) — build doc

**"Two lives, one thread."** A layered-depth (2.5D) scroll journey in the editorial /
museum style (reference: persepolis.getty.edu). About two minutes of unhurried scroll.
Scroll is the camera: it pushes through a café, cuts to a QR scan, splits the screen
into two lives, dives into a phone, and ends with two people at one table over an open
Bible. **"Together, Behold Him."**

The throughline: people behold Jesus through relationship, and through relational
integrity with each individual. No crowds; always person to person. In the end, the
two of them behold him together.

- Code: `src/public/home/` (entry `Home.tsx`, everything else in `journey/`)
- Film & photo brief for the final footage: the Claude Doc "Ekklē — homepage film &
  photo brief" (shot IDs below refer to it)
- Waitlist: migration `supabase/migrations/0017_waitlist.sql`, data `src/data/waitlist.ts`

---

## The story (chapters)

The whole stage is **one GSAP timeline**, `T = 122` units long. Scroll scrubs it across
a `1600svh` track while a full-screen stage stays pinned (sticky).

| # | Chapter | Units | What happens | Words |
|---|---|---|---|---|
| 1 | A conversation | 0–16 | The camera pushes through the café toward Sam and Jordan at a table. The foreground rushes past. | Hero: "Empowering individuals to make connections — and grow them." / "It starts the way it always has: two people, one real conversation." |
| 2 | Cut short | 16–26 | Sam stands up with coat and bag. | "But Sam has to go, and the conversation isn't finished." |
| 3 | The code | 26–41.5 | Close on two hands: Sam's phone shows a code, and Jordan's phone slides in to scan it. There's a lock flash, and the thread is born. | **"The conversation doesn't have to end here."** / "Something as important as the gospel deserves personal accountability. What Sam shares carries Sam's name." |
| 4 | Two lives | 41.5–71 | The screen splits: Sam's cool dusk street, and Jordan's lamp-lit room that night. The thread spans the seam. The camera dives into Jordan's phone, where the real product screens play as you scroll. | "Sam goes through the rest of the day." / "That night, alone and unhurried, Jordan reads what Sam shared." / "A quiet place to explore, with someone to explore it with." |
| 5 | The thread holds | 71–88 | Jordan taps "Message Sam". The camera pulls back, Sam's phone lights up, and the thread travels back to Sam. | **"The reply goes back to Sam — not to a stranger."** / "Everything shared stays tied to the person who shared it, and open to more conversation." |
| 6 | Together | 88–112 | The same table days later, in golden light, with an open Bible between them. | "Days later: the same table, and an open Bible between them." / "This is relational integrity: faith shared person to person, and kept." / **"Together, Behold Him"** |
| 7 | Join | 112–122 | No cut: the camera eases back from the table, the room dims, and the invitation and form rise into the same frame. | **"Vindicating the character of God, one intentional conversation at a time."** / "Ekklē is a system for churches and individuals…" |

All copy lives in `journey/chapters.ts` (`COPY`, `SCREENS`, `MEMBER = 'Sam'`).

## How it's built

| File | Role |
|---|---|
| `Home.tsx` | The chrome (header, grain), the loader, Lenis (desktop only), `gsap.matchMedia` (desktop / phone), chapter-rail state and jumps. Under reduced motion it renders `JourneyStatic` instead. |
| `journey/Stage.tsx` | The track and the sticky stage. Every layer, caption and title is hooked with `data-j="…"`. DOM order is paint order. |
| `journey/timeline.ts` | `buildJourney()`: the master timeline, thread path math, the phone-dive math, and the ScrollTrigger. |
| `journey/art.tsx` | The painted placeholder layers. Each export is one transparent full-frame SVG, so layers move independently. |
| `journey/frame.tsx`, `geometry.ts` | `CoverFrame`: art sized like `object-fit: cover` via container-query units, so pinned points line up at any screen shape. `coverPoint()` does the same math in JS. |
| `journey/Phone.tsx` | B's phone with the real recipient screens. |
| `journey/Dust.tsx` | Canvas dust motes. The rAF loop pauses when off screen. |
| `journey/Loader.tsx` | The arch and thread draw themselves, then the name appears and a brass bar fills. Waits for fonts, 2.1 s minimum, 4 s maximum. Scroll is locked while it shows. |
| `journey/ChapterRail.tsx` | Desktop: a numbered rail on the right; click a chapter to jump to it. Phones: a hairline progress bar and the chapter name. |
| `journey/Invitation.tsx` | Chapter 7: `JoinContent` (headline, subline, waitlist form; rendered inside the stage as the last shot), `Footer`, and the still `Invitation` used under reduced motion. |
| `journey/JourneyStatic.tsx` | Reduced motion: the same art and every word, as still frames. |

Rules we keep:
- Only `transform` and `opacity` are animated (plus the thread's stroke-dashoffset).
- Each depth and each state is its own layer, so crossfades stay on the compositor.
- **Phones get the same journey, not a fallback.**
  - The split stacks top/bottom.
  - The scan hands are pulled toward the centre.
  - The chapter 3 title sits low so it clears the phones.
  - Scrub is tighter.
  - Scrolling is native (no Lenis).

**To retime anything:** edit the unit positions in `timeline.ts`. Chapter starts are `CHAPTERS[].at` in `chapters.ts`, and the rail follows them. To make the whole journey longer or shorter, change `TRACK_VH`.

## Graphics manifest (every image the homepage needs)

The story art is currently code-drawn placeholders. Each placeholder layer gets
replaced by a real image. The scroll timing, copy and motion stay the same.

### Rules for every file

- **Layers stack like a stage set.** Every layer in a scene is exported on the **same
  canvas size with the same framing**, as if shot from one locked camera. A
  transparent layer is the full canvas with everything except its subject
  transparent. Never crop it to the subject.
- **Formats to deliver:**
  - Opaque scenes: **JPG** (quality 90+) or PNG.
  - Transparent layers: **PNG-24 with alpha**.
  - I convert and compress everything to WebP/AVIF for the site, so send masters.
- **Two shapes for wide scenes.** Desktop is **16:9**. Phones need their own
  **9:16** version, recomposed with the subjects centred. (On a phone, a 16:9 image
  only shows its middle quarter.)
- **Resolution:**
  - Wide scenes: 2560×1440 for desktop and 1080×1920 for phone.
  - Layers the camera pushes into: 3200×1800 for desktop and 1350×2400 for phone.
  - Two-lives panels: square, 2400×2400.
- **People stay the same across every scene:**
  - **Sam** (the one who shares): a **rust** scarf or accent.
  - **Jordan** (the one who receives): a **sage** scarf or accent.
  - Nobody looks at the camera.
- **Light arc:** warm window light in the café; cool dusk in Sam's day; one warm
  lamp in Jordan's night; golden hour in the reunion.
- **Keep quiet zones for text** (darker, low detail):
  - Captions: the bottom-left third.
  - Titles: the centre of the frame in scenes 2, 3 and 4.
- **Motion headroom.** Keep ~10% margin around subjects that move (noted per layer).

### Scene 1 — the café (chapters 1–2): 5 layers × 2 shapes = 10 files

| # | File | Contents | Type | Desktop | Phone |
|---|---|---|---|---|---|
| 1 | `cafe-bg` | Café interior, **no Sam or Jordan** (clean plate). Window light, lamps, shelves; any other patrons small, distant and soft. | Opaque JPG | 2560×1440 | 1080×1920 |
| 2 | `cafe-table` | The table with two cups, and **Jordan seated** on the right side, facing Sam's chair. | PNG alpha | 3200×1800 | 1350×2400 |
| 3 | `cafe-sam-seated` | **Sam seated** on the left, leaning in, mid-conversation. | PNG alpha | 3200×1800 | 1350×2400 |
| 4 | `cafe-sam-standing` | **Sam standing** in the same spot: coat on, bag on shoulder, about to leave. Crossfades with #3, so match position exactly. | PNG alpha | 3200×1800 | 1350×2400 |
| 5 | `cafe-fg` | A soft, out-of-focus foreground element at the frame edges (plant, chair back, counter edge). The camera rushes past it. | PNG alpha | 2560×1440 | 1080×1920 |

Camera: the background scales to 1.2× and #2–#4 scale to 1.5×, centred on the table,
so keep the table and both people near the centre.

### Scene 2 — the scan (chapter 3): 3 layers × 2 shapes = 6 files

| # | File | Contents | Type | Desktop | Phone |
|---|---|---|---|---|---|
| 6 | `scan-bg` | Close-up background: café bokeh, no people or hands. | Opaque JPG | 2560×1440 | 1080×1920 |
| 7 | `scan-sam-hand` | **Sam's hand** (rust sleeve) holding up a phone. The **screen shows the code**, either composited by you with the screen PNG I'll supply (#18), or left blank white for me to overlay. Left of centre. | PNG alpha | 2560×1440 | 1080×1920 |
| 8 | `scan-jordan-hand` | **Jordan's hand** (sage sleeve) holding a phone in camera mode, aimed at Sam's screen. Right of centre. It slides in from the right, so keep the hand whole within the frame. | PNG alpha | 2560×1440 | 1080×1920 |

On phones the two phones must both fit in the 9:16 frame, close together.

### Scene 3 — two lives (chapters 4–5): 5 layers, square

Each panel is half the screen: side by side on desktop, stacked on phones. One
square image covers both, so keep subjects in the **centre 60%**.

| # | File | Contents | Type | Size |
|---|---|---|---|---|
| 9 | `day-bg` | City street at dusk, cool light, no Sam (clean plate). | Opaque JPG | 2400×2400 |
| 10 | `day-sam-walking` | **Sam walking** through the day, bag on shoulder. It drifts sideways about 14% of the width, so give it room. | PNG alpha | 2400×2400 |
| 11 | `day-sam-phone` | **Sam stopped**, looking down at a lit phone (the reply has arrived). Same position as #10. | PNG alpha | 2400×2400 |
| 12 | `night-bg` | **Jordan at night**, in an armchair by one warm lamp, reading a phone. The camera dives into this phone at up to 4.6× zoom, so tell me where the phone sits (it may soften in the zoom; that's fine). | Opaque JPG | 2400×2400 |
| 13 | `night-glow` | *(Optional)* A light-only pass: the phone's glow on Jordan's face and hands, for a gentle pulse when Jordan replies. | PNG alpha | 2400×2400 |

The phone screens themselves are live code. No graphic is needed.

### Scene 4 — together (chapters 6–7): 2 layers × 2 shapes = 4 files

| # | File | Contents | Type | Desktop | Phone |
|---|---|---|---|---|---|
| 14 | `tog-bg` | **The same café, golden hour**, clean plate. It's also the background behind the waitlist form (dimmed) and on the reduced-motion page. | Opaque JPG | 2560×1440 | 1080×1920 |
| 15 | `tog-people` | **Sam and Jordan at the same table**, days later, leaning in over an **open Bible**, with cups. Warm, unposed. | PNG alpha | 3200×1800 | 1350×2400 |

The camera pushes to 1.34× into the pair, then pulls back for the invitation, so keep
heads and the Bible well inside the centre.

### Brand and sharing: 3 files

| # | File | Contents | Type | Size |
|---|---|---|---|---|
| 16 | `logo-mark` | The Ekklē mark, light version for dark backgrounds (cream `#F1ECE1` or brass `#A9824C`). Used in the loader and header. Built from strokes (not filled outlines), so the loader can draw it. | SVG | vector |
| 17 | `og-image` | The link preview for texts and social (the café or the together scene, plus the wordmark). Keep text inside the centre 1000×500. | JPG | 1200×630 |
| 18 | `scan-screen` | *(I supply this.)* The Ekklē code screen, for compositing onto Sam's phone in #7. | PNG | 1170×2532 |

### Totals

- **15 art layers**, which is **26 files** once phone versions are counted (#1–15).
- **2 brand files** (#16–17).
- **1 file from me** (#18).

Optional: #13. Not needed: steam, dust, the gold thread, grain, the loader animation
and the phone UI are all code.

### When files arrive

1. Put the masters in `public/home/` (names above, suffixed `-d` / `-m` for the
   desktop and phone versions).
2. I swap each placeholder in `journey/art.tsx` for `<picture>` sources.
3. I re-measure the anchor points from the real art: the thread endpoints
   (`SCAN_A`, `SCAN_B`, `DAY_A`), Jordan's phone (`NIGHT_PHONE`), and the steam over
   the cups.

## Checks

- `npx tsc --noEmit`, `npx eslint src/public/home`, `npx vite build`.
- Record desktop (1440×900) and phone (390×844) runs by stepping scroll through the
  chapters. Confirm:
  - the thread endpoints land on A and B's phone;
  - the dive centres on B's phone;
  - titles clear the subjects.
- Reduced motion: all copy is present as still frames, and the waitlist works.
