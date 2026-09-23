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

The whole stage is **one GSAP timeline**, `T = 114` units long. Scroll scrubs it across
a `1500svh` track while a full-screen stage stays pinned (sticky).

| # | Chapter | Units | What happens | Words |
|---|---|---|---|---|
| 1 | A conversation | 0–16 | The camera pushes through the café toward two people at a table. The foreground plant and chair rush past. | Hero: "Empowering individuals to make connections and grow them" / "It starts the way it always has — two people, one real conversation." |
| 2 | Cut short | 16–26 | A stands up with coat and bag. | "But life interrupts." |
| 3 | The code | 26–38 | Close on two hands: A's phone shows a code, and B's phone slides in to scan it. There's a lock flash, and the thread is born. | **"Continue the conversation."** |
| 4 | Two lives | 38–64 | The screen splits: A in a cool dusk street, B in a warm lamp-lit room that night. The thread spans the seam. Then the camera dives into B's phone, where the real product screens play as you scroll. | "One goes back to an ordinary day." / "The other reads it that night — unhurried, alone." |
| 5 | The thread holds | 64–76 | B taps "Message Sam" and it sends. The camera pulls back, A's phone lights up, and the thread travels back from B to A. | **"Back to the same person — not a stranger."** |
| 6 | Together | 76–114 | The same table days later, in golden light, with an open Bible between them. Warmth grows. Then the integrity lines, one at a time, and the positioning line. | "Days later…" / **"Together, Behold Him"** / 4 integrity lines / "Ekklē is a system for churches and individuals to do ministry in a more personal way." |
| 7 | Join | after | Still: the café at its warmest, one line, and the waitlist form. | "A quiet place to explore — together." |

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
| `journey/Invitation.tsx` | Chapter 7: the waitlist form and footer. |
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

## Swapping in the real footage (layer asset list)

Each placeholder layer is replaced by a still or clip from the shoot. Stills and clips
can drop into the same `<Layer>` slots (an `<img>` or a muted, inline, looping
`<video>`), and the timeline stays unchanged.

**Formats:**
- Stills: WebP at q≈80, with a JPG fallback.
- Cut-out layers: PNG-24 or WebP with alpha.
- Clips: MP4 (H.264) plus WebM, ≤6 s loops, no audio.
- Size: ≤400 KB per still where possible.

**Shapes:**
- Wide scenes are 16:9 at 2560×1440, and need a matching **9:16 phone crop (1080×1920)**.
- Split panels are square (1600×1600), and need a phone crop at 1080×960.

| Layer (`data-j`) | Brief shot | Content | Shape | Notes |
|---|---|---|---|---|
| `cafe-bg` | 1.1 | Busy café, **clean plate** (no A/B), window light | 16:9 | Background depth. Scaled 1 → 1.2. |
| `cafe-a-seated` | 1.2 | A seated, leaning in (rust scarf), cut-out | 16:9 | Must register with the table plate. |
| `cafe-table` | 1.2 | Table, two cups, B seated (sage scarf), cut-out | 16:9 | Steam can stay CSS. |
| `cafe-fg` | 1.3 | Out-of-focus foreground (plant/chair edge), cut-out | 16:9 | Rushes past the lens. |
| `cafe-a-standing` | 2.1 | A standing in coat with bag, cut-out, same framing | 16:9 | Crossfades with seated. |
| `scan-bg` | 3.1 | Café bokeh, no people | 16:9 | |
| `scan-a` | 3.2 | A's hand and phone, **screen dark or green** | 16:9 | We comp the real code UI. |
| `scan-b` | 3.2 | B's hand and phone, camera view, cut-out | 16:9 | Slides in. |
| `day-bg` | 4.1 | Dusk street, clean plate | square | |
| `day-a-walk` / `day-a-phone` | 4.1 / 5.2 | A walking; A glancing at a lit phone | square | Two states, same framing. |
| `night-bg` | 4.2 | B in armchair by a lamp, reading a phone | square | Phone position = `NIGHT_PHONE` in `geometry.ts` (update to match). |
| `night-glow` | 4.2 | Phone-glow pass on B's face | square | Or keep CSS. |
| (phone UI) | — | Real product screens, rendered in code | — | No footage needed. |
| `tog-bg` | 6.1 | Same café, golden hour, clean plate | 16:9 | Also used behind Join. |
| `tog-people` | 6.1 | A and B together over an open Bible, cut-out | 16:9 | Scaled 1 → 1.34. |

When the real stills land:
1. Put them in `public/home/`.
2. Replace the matching art component inside the `<Layer>` in `Stage.tsx` (and in `JourneyStatic.tsx`).
3. Update the thread anchors in `timeline.ts` (`SCAN_A`, `SCAN_B`, `DAY_A`) and `NIGHT_PHONE` to the new art's pixel positions, as fractions.

## Checks

- `npx tsc --noEmit`, `npx eslint src/public/home`, `npx vite build`.
- Record desktop (1440×900) and phone (390×844) runs by stepping scroll through the
  chapters. Confirm:
  - the thread endpoints land on A and B's phone;
  - the dive centres on B's phone;
  - titles clear the subjects.
- Reduced motion: all copy is present as still frames, and the waitlist works.
