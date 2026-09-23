import { useId, type ReactNode } from 'react';

/**
 * Placeholder painterly art — one composition per image slot, shown until the real
 * images are uploaded (see images.ts). Same rules as the image manifest: dark
 * grounds, a single warm brass light source, classical architecture, figures
 * suggested by light and silhouette, and blur throughout so it reads as painted
 * rather than vector. Every composition keeps its subject in the middle third, so
 * the mobile portrait crop (xMidYMid slice) still holds it.
 */

const W = 1600;
const H = 900;

/** Collision-free SVG ids (ids are document-global; several SVGs share the page). */
function useIds<T extends string>(...names: T[]): Record<T, string> {
  const base = 'h' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const out = {} as Record<T, string>;
  for (const n of names) out[n] = `${base}-${n}`;
  return out;
}
const url = (id: string) => `url(#${id})`;

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

function Blur({ id, amount, spread = 30 }: { id: string; amount: number; spread?: number }) {
  return (
    <filter
      id={id}
      x={`-${spread}%`}
      y={`-${spread}%`}
      width={`${100 + spread * 2}%`}
      height={`${100 + spread * 2}%`}
    >
      <feGaussianBlur stdDeviation={amount} />
    </filter>
  );
}

/** Deterministic pseudo-random (so the art never shifts between renders). */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Column({
  x,
  w,
  top,
  bottom,
  shaft,
  stone,
  flutes = 5,
}: {
  x: number;
  w: number;
  top: number;
  bottom: number;
  shaft: string;
  stone: string;
  flutes?: number;
}) {
  const cap = 28;
  return (
    <g>
      <rect x={x - w * 0.72} y={top} width={w * 1.44} height={cap * 0.55} fill={stone} />
      <rect x={x - w * 0.6} y={top + cap * 0.55} width={w * 1.2} height={cap * 0.45} fill={stone} />
      <rect x={x - w / 2} y={top + cap} width={w} height={bottom - top - cap - 30} fill={shaft} />
      {Array.from({ length: flutes }, (_, i) => {
        const fx = x - w / 2 + (w / (flutes + 1)) * (i + 1);
        return (
          <line
            key={i}
            x1={fx}
            y1={top + cap + 8}
            x2={fx}
            y2={bottom - 38}
            stroke="#000"
            strokeOpacity={0.16}
            strokeWidth={2}
          />
        );
      })}
      <rect x={x - w * 0.66} y={bottom - 30} width={w * 1.32} height={30} fill={stone} />
    </g>
  );
}

/** A standing robed figure; (x, y) is the head's center. */
function robe(x: number, y: number, s = 1) {
  const p = (dx: number, dy: number) => `${x + dx * s} ${y + dy * s}`;
  return `M ${p(-11, 20)} C ${p(-30, 26)} ${p(-44, 40)} ${p(-46, 74)} L ${p(-62, 340)} L ${p(
    62,
    340,
  )} L ${p(46, 74)} C ${p(44, 40)} ${p(30, 26)} ${p(11, 20)} Z`;
}

/** A presenting arm reaching toward +x. */
function arm(x: number, y: number, reach: number) {
  const p = (dx: number, dy: number) => `${x + dx} ${y + dy}`;
  return `M ${p(30, 50)} C ${p(70, 46)} ${p(reach - 24, 56)} ${p(reach, 64)} L ${p(
    reach + 4,
    78,
  )} C ${p(reach - 26, 76)} ${p(72, 80)} ${p(36, 96)} Z`;
}

/** A cloak across the shoulders of the presented figure. */
function cloak(x: number, y: number, s = 1) {
  const p = (dx: number, dy: number) => `${x + dx * s} ${y + dy * s}`;
  return `M ${p(-18, 22)} C ${p(-52, 30)} ${p(-66, 60)} ${p(-70, 120)} C ${p(-40, 150)} ${p(
    30,
    156,
  )} ${p(74, 118)} C ${p(70, 60)} ${p(52, 30)} ${p(18, 22)} Z`;
}

/**
 * A small distant person for the crowd; (x, ground) is where they stand. Shoulders
 * then a near-straight robe — human, not a cone. `lean` tilts the head slightly.
 */
function Person({ x, ground, h, lean }: { x: number; ground: number; h: number; lean: number }) {
  const r = h * 0.085;
  const neck = ground - h + r * 2.2;
  const s = (dx: number) => x + dx * h;
  return (
    <g>
      <circle cx={x + lean * h * 0.03} cy={ground - h + r} r={r} />
      <path
        d={`M ${s(-0.06)} ${neck} L ${s(0.06)} ${neck} Q ${s(0.16)} ${neck + h * 0.04} ${s(0.15)} ${
          neck + h * 0.2
        } L ${s(0.16)} ${ground} L ${s(-0.16)} ${ground} L ${s(-0.15)} ${neck + h * 0.2} Q ${s(
          -0.16,
        )} ${neck + h * 0.04} ${s(-0.06)} ${neck} Z`}
      />
    </g>
  );
}

/** Left curtain: sweeps in to a tie-back, then flares out behind the balustrade. */
const CURTAIN =
  'M -40 -20 L 330 -20 C 318 110 290 250 236 372 C 226 396 226 414 238 440 C 262 500 286 560 300 640 L -40 640 Z';
const CURTAIN_FOLDS = [
  'M 60 -20 C 66 140 84 280 150 396 C 120 470 96 560 84 640',
  'M 150 -20 C 162 130 182 260 206 386 C 196 470 180 560 170 640',
  'M 250 -20 C 250 110 238 240 222 380',
];

function baluster(x: number) {
  return `M ${x - 10} 606 C ${x - 18} 624 ${x - 5} 646 ${x - 13} 690 L ${x + 13} 690 C ${
    x + 5
  } 646 ${x + 18} 624 ${x + 10} 606 Z`;
}

// Static, precomputed scatter (crowds, dust).
const COLONNADE_X = [80, 260, 440, 620, 800, 980, 1160, 1340, 1520];
const BALUSTERS = Array.from({ length: 31 }, (_, i) => 14 + i * 52);

/**
 * The Scene 2 crowd, scattered in depth: nearer people stand lower and taller.
 * Irregular spacing (small clusters and gaps) so it reads as people, not a fence.
 */
function crowd(seed: number, count: number, groundMin: number, groundMax: number) {
  const r = seeded(seed);
  let x = 0;
  const people = Array.from({ length: count }, () => {
    x += 14 + r() * (r() < 0.25 ? 70 : 34); // mostly close, the odd gap
    const depth = r(); // 0 far … 1 near
    const ground = groundMin + depth * (groundMax - groundMin);
    return { x, ground, h: 36 + depth * 34 + r() * 8, lean: r() - 0.5 };
  });
  const span = x || 1;
  return people
    .map((p) => ({ ...p, x: 30 + (p.x / span) * (W - 60) })) // fit the frame
    .sort((a, b) => a.ground - b.ground); // paint far → near
}
const CROWD_FAR = crowd(7, 58, 690, 722);
const CROWD_NEAR = crowd(19, 20, 740, 790);
const HEADS = (() => {
  const r = seeded(31);
  return Array.from({ length: 11 }, (_, i) => ({
    x: 40 + i * 152 + (r() - 0.5) * 50,
    y: 868 + r() * 22,
    r: 26 + r() * 9,
  }));
})();
const MOTES = (() => {
  const r = seeded(3);
  return Array.from({ length: 16 }, () => {
    const y = 290 + r() * 560;
    const k = (y - 250) / 650;
    const left = 700 + 40 * k;
    const right = 880 + 380 * k;
    return { x: left + r() * (right - left), y, rad: 1 + r() * 1.7, o: 0.22 + r() * 0.45 };
  });
})();

// ---------------------------------------------------------------------------
// Scene 1 — Threshold: two depth layers (far wall + arch / near columns + shaft)
// ---------------------------------------------------------------------------

export function ThresholdFar() {
  const id = useIds('bg', 'beyond', 'wall', 'soft', 'haze');
  const cx = 800;
  const r = 180;
  const spring = 380;
  const hole = `M ${cx - r} ${H} V ${spring} A ${r} ${r} 0 0 1 ${cx + r} ${spring} V ${H} Z`;
  return (
    <Svg>
      <defs>
        <radialGradient id={id.bg} cx="0.4" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#4d3f2a" />
          <stop offset="0.35" stopColor="#2c302b" />
          <stop offset="0.7" stopColor="#1f2426" />
          <stop offset="1" stopColor="#15181a" />
        </radialGradient>
        <linearGradient id={id.beyond} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9b97f" />
          <stop offset="0.45" stopColor="#a9824c" />
          <stop offset="1" stopColor="#3b3326" />
        </linearGradient>
        <linearGradient id={id.wall} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#141719" />
          <stop offset="0.42" stopColor="#22272a" />
          <stop offset="0.5" stopColor="#2b2d29" />
          <stop offset="0.58" stopColor="#22272a" />
          <stop offset="1" stopColor="#131618" />
        </linearGradient>
        <Blur id={id.soft} amount={1.4} spread={5} />
        <Blur id={id.haze} amount={32} />
      </defs>
      <rect width={W} height={H} fill={url(id.bg)} />
      {/* the lit world beyond the arch */}
      <rect x={cx - r - 20} y={spring - r - 20} width={r * 2 + 40} height={H} fill={url(id.beyond)} />
      <g filter={url(id.soft)} opacity={0.55}>
        {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
          <rect key={i} x={cx + i * 48 - 8} y={522} width={16} height={240} fill="#6b5a3e" />
        ))}
        <rect x={cx - r} y={504} width={r * 2} height={18} fill="#6b5a3e" />
      </g>
      <rect x={cx - r} y={760} width={r * 2} height={140} fill="#4a3f2e" opacity={0.7} />
      {/* the wall, with the arch cut through it */}
      <path
        d={`M0 0 H${W} V${H} H0 Z ${hole}`}
        fillRule="evenodd"
        fill={url(id.wall)}
        filter={url(id.soft)}
      />
      <path
        d={`M ${cx - r - 26} ${H} V ${spring} A ${r + 26} ${r + 26} 0 0 1 ${cx + r + 26} ${spring} V ${H}`}
        fill="none"
        stroke="#3a372f"
        strokeWidth={16}
        opacity={0.8}
        filter={url(id.soft)}
      />
      <g filter={url(id.soft)} opacity={0.9}>
        <rect x={cx - r - 150} y={120} width={70} height={H - 120} fill="#262a29" />
        <rect x={cx + r + 80} y={120} width={70} height={H - 120} fill="#1f2325" />
      </g>
      <ellipse cx={cx} cy={spring} rx={260} ry={300} fill="#a9824c" opacity={0.18} filter={url(id.haze)} />
    </Svg>
  );
}

export function ThresholdNear() {
  const id = useIds('shaftL', 'shaftR', 'beam', 'soft', 'beamBlur', 'haze');
  return (
    <Svg>
      <defs>
        <linearGradient id={id.shaftL} x1="0" x2="1">
          <stop offset="0" stopColor="#101315" />
          <stop offset="0.55" stopColor="#1d2123" />
          <stop offset="0.86" stopColor="#4a4233" />
          <stop offset="1" stopColor="#23272a" />
        </linearGradient>
        <linearGradient id={id.shaftR} x1="0" x2="1">
          <stop offset="0" stopColor="#23272a" />
          <stop offset="0.14" stopColor="#4a4233" />
          <stop offset="0.45" stopColor="#1d2123" />
          <stop offset="1" stopColor="#101315" />
        </linearGradient>
        <linearGradient id={id.beam} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6c98f" stopOpacity="0.36" />
          <stop offset="0.6" stopColor="#c9a56b" stopOpacity="0.15" />
          <stop offset="1" stopColor="#a9824c" stopOpacity="0.05" />
        </linearGradient>
        <Blur id={id.soft} amount={1.2} spread={5} />
        <Blur id={id.beamBlur} amount={18} />
        <Blur id={id.haze} amount={26} />
      </defs>
      {/* the shaft of light falling through the arch */}
      <polygon points="700,250 880,250 1260,900 740,900" fill={url(id.beam)} filter={url(id.beamBlur)} />
      <ellipse cx={1000} cy={880} rx={320} ry={50} fill="#a9824c" opacity={0.26} filter={url(id.haze)} />
      {MOTES.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r={m.rad} fill="#efdcb2" opacity={m.o} />
      ))}
      <g filter={url(id.soft)}>
        <Column x={230} w={150} top={-30} bottom={H} shaft={url(id.shaftL)} stone="#1a1d1f" />
        <Column x={1370} w={150} top={-30} bottom={H} shaft={url(id.shaftR)} stone="#1a1d1f" />
      </g>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Scene 2 — the same architecture, cold and flat; a crowd far off
// ---------------------------------------------------------------------------

export function ColonnadeArt() {
  const id = useIds('bg', 'col', 'ground', 'soft', 'haze', 'crowd');
  return (
    <Svg>
      <defs>
        <linearGradient id={id.bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3130" />
          <stop offset="0.55" stopColor="#212729" />
          <stop offset="1" stopColor="#181c1e" />
        </linearGradient>
        <linearGradient id={id.col} x1="0" x2="1">
          <stop offset="0" stopColor="#262c2b" />
          <stop offset="0.5" stopColor="#353d3a" />
          <stop offset="1" stopColor="#242a29" />
        </linearGradient>
        <linearGradient id={id.ground} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262b2a" />
          <stop offset="1" stopColor="#15181a" />
        </linearGradient>
        <Blur id={id.soft} amount={1.6} spread={5} />
        <Blur id={id.haze} amount={30} />
        <Blur id={id.crowd} amount={1.5} spread={5} />
      </defs>
      <rect width={W} height={H} fill={url(id.bg)} />
      <g filter={url(id.soft)}>
        <rect x={-20} y={118} width={W + 40} height={22} fill="#303735" />
        <rect x={-20} y={140} width={W + 40} height={34} fill="#2a302f" />
      </g>
      <g filter={url(id.soft)} opacity={0.9}>
        {COLONNADE_X.map((x) => (
          <Column key={x} x={x} w={64} top={174} bottom={700} shaft={url(id.col)} stone="#2e3533" flutes={3} />
        ))}
      </g>
      <rect y={700} width={W} height={200} fill={url(id.ground)} />
      <rect x={-100} y={560} width={W + 200} height={200} fill="#c8bfa9" opacity={0.06} filter={url(id.haze)} />
      <g fill="#7f8680" opacity={0.2} filter={url(id.crowd)}>
        {CROWD_FAR.map((c, i) => (
          <Person key={i} {...c} />
        ))}
      </g>
      <g fill="#6c736d" opacity={0.17} filter={url(id.crowd)}>
        {CROWD_NEAR.map((c, i) => (
          <Person key={i} {...c} />
        ))}
      </g>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Scene 3 — Behold: a draped balcony; one figure presents another, who is lit;
// the crowd below (and the viewer) beholds. Neutral base light from the right;
// the page's overlays do the cold → warm shift.
// ---------------------------------------------------------------------------

export function BeholdArt() {
  const id = useIds('bg', 'col', 'drape', 'fig', 'figLit', 'rail', 'bal', 'soft', 'haze', 'rim');
  const A = { x: 690, y: 300 }; // the one presenting
  const B = { x: 905, y: 286 }; // the one presented
  return (
    <Svg>
      <defs>
        <radialGradient id={id.bg} cx="0.78" cy="0.38" r="0.95">
          <stop offset="0" stopColor="#4a473e" />
          <stop offset="0.35" stopColor="#2c302d" />
          <stop offset="0.7" stopColor="#1e2224" />
          <stop offset="1" stopColor="#15181a" />
        </radialGradient>
        <linearGradient id={id.col} x1="0" x2="1">
          <stop offset="0" stopColor="#141719" />
          <stop offset="0.6" stopColor="#262a28" />
          <stop offset="0.88" stopColor="#4b4739" />
          <stop offset="1" stopColor="#262a28" />
        </linearGradient>
        <linearGradient id={id.drape} x1="0" x2="1">
          <stop offset="0" stopColor="#121815" />
          <stop offset="0.55" stopColor="#25342b" />
          <stop offset="0.85" stopColor="#3a4d41" />
          <stop offset="1" stopColor="#22302a" />
        </linearGradient>
        <linearGradient id={id.fig} x1="0" x2="1">
          <stop offset="0" stopColor="#121415" />
          <stop offset="0.7" stopColor="#22251f" />
          <stop offset="1" stopColor="#4a4436" />
        </linearGradient>
        <linearGradient id={id.figLit} x1="0" x2="1">
          <stop offset="0" stopColor="#17191a" />
          <stop offset="0.55" stopColor="#2e2f29" />
          <stop offset="0.85" stopColor="#6f6550" />
          <stop offset="1" stopColor="#a18f6c" />
        </linearGradient>
        <linearGradient id={id.rail} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4538" />
          <stop offset="0.25" stopColor="#2c2f2b" />
          <stop offset="1" stopColor="#1b1e1f" />
        </linearGradient>
        <linearGradient id={id.bal} x1="0" x2="1">
          <stop offset="0" stopColor="#151819" />
          <stop offset="0.6" stopColor="#262a28" />
          <stop offset="0.9" stopColor="#3d3a31" />
          <stop offset="1" stopColor="#22262a" />
        </linearGradient>
        <Blur id={id.soft} amount={1.3} spread={8} />
        <Blur id={id.haze} amount={44} />
        <Blur id={id.rim} amount={1.8} spread={8} />
      </defs>
      <rect width={W} height={H} fill={url(id.bg)} />
      <g filter={url(id.soft)}>
        <Column x={380} w={110} top={-30} bottom={640} shaft={url(id.col)} stone="#1e2123" />
        <Column x={1225} w={110} top={-30} bottom={640} shaft={url(id.col)} stone="#1e2123" />
      </g>
      {/* light gathering on the one who is presented */}
      <ellipse cx={B.x + 20} cy={420} rx={180} ry={300} fill="#d9cfb8" opacity={0.14} filter={url(id.haze)} />
      {/* the one presenting, turned toward the other, arm extended */}
      <g filter={url(id.soft)} fill={url(id.fig)}>
        <path d={robe(A.x, A.y)} />
        <ellipse cx={A.x + 5} cy={A.y} rx={17} ry={21} />
        <path d={arm(A.x, A.y, 128)} />
        <ellipse cx={A.x + 136} cy={A.y + 72} rx={9} ry={7} fill="#3a3a33" />
      </g>
      {/* the one presented — in the light, head a little bowed */}
      <g filter={url(id.soft)} fill={url(id.figLit)}>
        <path d={robe(B.x, B.y, 1.08)} />
        <path d={cloak(B.x, B.y, 1.08)} opacity={0.92} />
        <ellipse cx={B.x + 3} cy={B.y + 4} rx={18} ry={22} transform={`rotate(14 ${B.x} ${B.y})`} />
      </g>
      <path
        d={robe(B.x, B.y, 1.08)}
        fill="none"
        stroke="#e6dac0"
        strokeOpacity={0.3}
        strokeWidth={3}
        filter={url(id.rim)}
      />
      {/* tied-back curtains framing the balcony (right = left, mirrored) */}
      {[false, true].map((mirrored) => (
        <g
          key={String(mirrored)}
          filter={url(id.soft)}
          transform={mirrored ? `translate(${W} 0) scale(-1 1)` : undefined}
        >
          <path d={CURTAIN} fill={url(id.drape)} />
          <g fill="none" strokeLinecap="round">
            <g stroke="#0e1310" strokeOpacity={0.4} strokeWidth={6}>
              {CURTAIN_FOLDS.map((d) => (
                <path key={d} d={d} transform="translate(14 0)" />
              ))}
            </g>
            <g stroke="#8a9a80" strokeOpacity={0.14} strokeWidth={8}>
              {CURTAIN_FOLDS.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          </g>
          {/* the tie-back */}
          <ellipse cx={232} cy={406} rx={36} ry={9} fill="#6b5a3e" opacity={0.85} transform="rotate(-16 232 406)" />
        </g>
      ))}
      {/* the balustrade in front of them */}
      <g filter={url(id.soft)}>
        <rect x={-20} y={582} width={W + 40} height={24} fill={url(id.rail)} />
        {BALUSTERS.map((x) => (
          <path key={x} d={baluster(x)} fill={url(id.bal)} />
        ))}
        <rect x={-20} y={690} width={W + 40} height={18} fill="#22262a" />
        <rect x={-20} y={708} width={W + 40} height={200} fill="#16191b" />
      </g>
      {/* the crowd below, beholding */}
      <g fill="#0d1011" filter={url(id.soft)}>
        {HEADS.map((h, i) => (
          <g key={i}>
            <ellipse cx={h.x} cy={h.y} rx={h.r * 0.85} ry={h.r} />
            <ellipse cx={h.x} cy={h.y + h.r * 2.3} rx={h.r * 2.1} ry={h.r * 1.4} />
          </g>
        ))}
      </g>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Scenes 4–7 — the sanctuary, resolved warm; a backdrop that reads behind text
// ---------------------------------------------------------------------------

export function SanctuaryArt() {
  const id = useIds('bg', 'beyond', 'wall', 'floor', 'colL', 'colR', 'soft', 'haze', 'ray');
  const arches = [
    { x: 470, w: 210 },
    { x: 800, w: 250 },
    { x: 1130, w: 210 },
  ];
  const spring = 330;
  const bottom = 760;
  const holes = arches
    .map(
      (a) =>
        `M ${a.x - a.w / 2} ${bottom} V ${spring} A ${a.w / 2} ${a.w / 2} 0 0 1 ${a.x + a.w / 2} ${spring} V ${bottom} Z`,
    )
    .join(' ');
  return (
    <Svg>
      <defs>
        <radialGradient id={id.bg} cx="0.5" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#7d6139" />
          <stop offset="0.3" stopColor="#463c2c" />
          <stop offset="0.62" stopColor="#282b27" />
          <stop offset="1" stopColor="#181b1d" />
        </radialGradient>
        <linearGradient id={id.beyond} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcbc86" />
          <stop offset="0.5" stopColor="#a98352" />
          <stop offset="1" stopColor="#4a3d2b" />
        </linearGradient>
        <linearGradient id={id.wall} x1="0" x2="1">
          <stop offset="0" stopColor="#15181a" />
          <stop offset="0.5" stopColor="#2a2a24" />
          <stop offset="1" stopColor="#15181a" />
        </linearGradient>
        <linearGradient id={id.floor} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3226" />
          <stop offset="1" stopColor="#16191a" />
        </linearGradient>
        <linearGradient id={id.colL} x1="0" x2="1">
          <stop offset="0" stopColor="#101315" />
          <stop offset="0.6" stopColor="#1f2220" />
          <stop offset="0.88" stopColor="#6a5537" />
          <stop offset="1" stopColor="#2a2723" />
        </linearGradient>
        <linearGradient id={id.colR} x1="0" x2="1">
          <stop offset="0" stopColor="#2a2723" />
          <stop offset="0.12" stopColor="#6a5537" />
          <stop offset="0.4" stopColor="#1f2220" />
          <stop offset="1" stopColor="#101315" />
        </linearGradient>
        <Blur id={id.soft} amount={1.3} spread={5} />
        <Blur id={id.haze} amount={30} />
        <Blur id={id.ray} amount={16} />
      </defs>
      <rect width={W} height={H} fill={url(id.bg)} />
      <rect x={200} y={140} width={1200} height={640} fill={url(id.beyond)} />
      <path
        d={`M0 0 H${W} V${bottom} H0 Z ${holes}`}
        fillRule="evenodd"
        fill={url(id.wall)}
        filter={url(id.soft)}
      />
      <g fill="none" stroke="#5c4b33" strokeOpacity={0.55} strokeWidth={12} filter={url(id.soft)}>
        {arches.map((a) => (
          <path
            key={a.x}
            d={`M ${a.x - a.w / 2 - 18} ${bottom} V ${spring} A ${a.w / 2 + 18} ${a.w / 2 + 18} 0 0 1 ${
              a.x + a.w / 2 + 18
            } ${spring} V ${bottom}`}
          />
        ))}
      </g>
      <rect y={bottom} width={W} height={H - bottom} fill={url(id.floor)} />
      {arches.map((a) => (
        <ellipse key={a.x} cx={a.x} cy={800} rx={a.w * 0.75} ry={24} fill="#c9a56b" opacity={0.2} filter={url(id.haze)} />
      ))}
      <g fill="#e0c08a" filter={url(id.ray)}>
        <polygon points="760,340 840,340 1010,900 590,900" opacity={0.08} />
        <polygon points="730,360 770,360 640,900 520,900" opacity={0.05} />
        <polygon points="830,360 870,360 1080,900 960,900" opacity={0.05} />
      </g>
      <ellipse cx={800} cy={420} rx={380} ry={260} fill="#a9824c" opacity={0.16} filter={url(id.haze)} />
      <g filter={url(id.soft)}>
        <Column x={110} w={140} top={-30} bottom={H} shaft={url(id.colL)} stone="#1a1c1c" />
        <Column x={1490} w={140} top={-30} bottom={H} shaft={url(id.colR)} stone="#1a1c1c" />
      </g>
    </Svg>
  );
}
