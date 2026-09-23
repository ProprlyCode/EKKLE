import { useId, type ReactNode } from 'react';
import { NIGHT_PHONE } from './geometry';

/**
 * Painted-modern placeholder art for every layer of "Two lives, one thread",
 * shown until the photography from the film & photo brief arrives.
 *
 * Chiaroscuro rules: one warm light source per scene, figures as silhouettes
 * rimmed by that light, the rest in shadow, blur for a painted (not vector) feel.
 * A carries a rust scarf, B a sage one, so viewers can follow two lives.
 *
 * Each export is ONE layer (a transparent full-frame SVG) so the camera can move
 * layers at different depths, and so crossfades (A sits → A stands) animate a
 * layer's opacity on the compositor instead of repainting a whole painting.
 * Stage scenes are 1600×900 (16:9); the two-lives panels are 1000×1000.
 */

const RUST = '#a4593a';
const SAGE = '#7f8e6b';
const RIM = '#e6c793';

function useIds<T extends string>(...names: T[]): Record<T, string> {
  const base = 'j' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const out = {} as Record<T, string>;
  for (const n of names) out[n] = `${base}-${n}`;
  return out;
}
const url = (id: string) => `url(#${id})`;

function Svg({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
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
    <filter id={id} x={`-${spread}%`} y={`-${spread}%`} width={`${100 + spread * 2}%`} height={`${100 + spread * 2}%`}>
      <feGaussianBlur stdDeviation={amount} />
    </filter>
  );
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------------------------------------------------------------------------
// Figures (local coordinates; placed with a transform)
// ---------------------------------------------------------------------------

/** Seated, leaning in, facing +x; origin = the hip at table height. */
const SEATED =
  'M -40 10 C -50 -60 -44 -122 -16 -152 C -2 -164 26 -164 42 -150 C 56 -132 62 -102 60 -72 L 100 -40 L 104 -24 L 52 -28 C 46 -16 42 -4 40 10 Z';
const SEATED_SCARF = 'M -8 -152 C 6 -142 26 -142 38 -150 L 36 -138 C 22 -130 2 -130 -10 -140 Z';

/** Standing in a coat, bag on the shoulder; origin = between the feet. */
const STANDING =
  'M -30 -408 C -52 -402 -62 -380 -64 -350 L -74 -120 L -60 0 L -12 0 L -8 -130 L 8 -130 L 12 0 L 60 0 L 72 -120 L 62 -350 C 60 -380 50 -402 30 -408 Z';
const STANDING_SCARF = 'M -22 -412 C -8 -400 10 -400 24 -412 L 26 -396 C 10 -386 -10 -386 -24 -396 Z';

/** Walking mid-stride; origin = between the feet. */
const WALK_TORSO =
  'M -26 -366 C -44 -360 -52 -340 -52 -312 L -48 -190 L 48 -190 L 52 -312 C 52 -340 44 -360 26 -366 Z';
const WALK_LEGS = 'M -30 -196 L -70 -2 L -46 0 L -4 -170 Z M 8 -190 L 56 -4 L 80 0 L 32 -196 Z';
const WALK_ARM = 'M -44 -330 L -70 -210 L -56 -206 L -30 -310 Z';
const WALK_SCARF = 'M -20 -370 C -6 -358 10 -358 22 -370 L 24 -354 C 10 -344 -8 -344 -22 -354 Z';

function Seated({
  x,
  y,
  s = 1,
  facing = 1,
  fill,
  scarf,
  rim,
}: {
  x: number;
  y: number;
  s?: number;
  facing?: 1 | -1;
  fill: string;
  scarf: string;
  rim: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${facing * s} ${s})`}>
      <g fill="none" stroke={RIM} strokeOpacity={0.4} strokeWidth={4} filter={rim}>
        <path d={SEATED} />
        <circle cx={18} cy={-186} r={27} />
      </g>
      <path d={SEATED} fill={fill} />
      <circle cx={18} cy={-186} r={27} fill={fill} />
      <path d={SEATED_SCARF} fill={scarf} opacity={0.9} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Chapters 1–3 and 6: the café
// ---------------------------------------------------------------------------

/** The café room: backlit window, lamps, shelves, soft far customers. */
export function CafeBg({ golden = false }: { golden?: boolean }) {
  const id = useIds('wall', 'win', 'ray', 'floor', 'soft', 'haze', 'far', 'bokeh');
  const r = seeded(golden ? 12 : 5);
  const bokeh = Array.from({ length: 9 }, () => ({
    x: 540 + r() * 520,
    y: 150 + r() * 400,
    rad: 14 + r() * 26,
    o: 0.25 + r() * 0.35,
  }));
  const win = golden ? ['#f5c67f', '#e0955a', '#8a5a36'] : ['#f0d7a2', '#cfa56c', '#7c6040'];
  return (
    <Svg w={1600} h={900}>
      <defs>
        <linearGradient id={id.wall} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#221e1b" />
          <stop offset="1" stopColor="#191614" />
        </linearGradient>
        <linearGradient id={id.win} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={win[0]} />
          <stop offset="0.7" stopColor={win[1]} />
          <stop offset="1" stopColor={win[2]} />
        </linearGradient>
        <linearGradient id={id.ray} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={golden ? '#f3b872' : '#ecd09b'} stopOpacity={golden ? 0.34 : 0.24} />
          <stop offset="1" stopColor="#a9824c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id.floor} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f1b18" />
          <stop offset="1" stopColor="#12100e" />
        </linearGradient>
        <Blur id={id.soft} amount={1.5} spread={6} />
        <Blur id={id.haze} amount={30} />
        <Blur id={id.far} amount={5} spread={10} />
        <Blur id={id.bokeh} amount={9} />
      </defs>
      <rect width={1600} height={900} fill={url(id.wall)} />
      {/* the window and the street beyond it */}
      <rect x={520} y={110} width={560} height={490} fill={url(id.win)} />
      <g filter={url(id.bokeh)}>
        {bokeh.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.rad} fill="#fff1d2" opacity={b.o} />
        ))}
        <rect x={520} y={500} width={560} height={100} fill="#6d5236" opacity={0.55} />
      </g>
      <g fill="#1a1715" filter={url(id.soft)}>
        <rect x={508} y={98} width={584} height={20} />
        <rect x={508} y={592} width={584} height={22} />
        <rect x={508} y={98} width={20} height={516} />
        <rect x={1072} y={98} width={20} height={516} />
        <rect x={700} y={110} width={14} height={490} />
        <rect x={886} y={110} width={14} height={490} />
        <rect x={520} y={330} width={560} height={12} />
      </g>
      {/* light spilling into the room */}
      <ellipse cx={800} cy={360} rx={420} ry={300} fill="#a9824c" opacity={golden ? 0.3 : 0.2} filter={url(id.haze)} />
      <g fill={url(id.ray)} filter={url(id.haze)}>
        {golden ? (
          <>
            <polygon points="540,300 1080,300 760,900 60,900" />
            <polygon points="620,220 900,220 520,900 180,900" opacity={0.7} />
          </>
        ) : (
          <>
            <polygon points="560,600 1040,600 1260,900 380,900" />
            <polygon points="650,400 950,400 1100,900 520,900" opacity={0.6} />
          </>
        )}
      </g>
      {/* pendant lamps */}
      {[330, 1270].map((x) => (
        <g key={x}>
          <line x1={x} y1={0} x2={x} y2={170} stroke="#0f0d0c" strokeWidth={3} />
          <path d={`M ${x - 46} 205 Q ${x} 150 ${x + 46} 205 Z`} fill="#15120f" />
          <ellipse cx={x} cy={212} rx={70} ry={40} fill="#e9c88c" opacity={0.28} filter={url(id.haze)} />
          <ellipse cx={x} cy={207} rx={34} ry={5} fill="#f4dcae" opacity={0.7} />
        </g>
      ))}
      {/* shelves and a menu board */}
      <g filter={url(id.soft)}>
        {[300, 380, 460].map((y) => (
          <rect key={y} x={1180} y={y} width={380} height={6} fill="#3a322b" />
        ))}
        {[1200, 1250, 1320, 1390, 1450, 1510].map((x, i) => (
          <rect key={x} x={x} y={260 + (i % 3) * 80} width={26 + (i % 2) * 12} height={40} rx={5} fill="#2b2622" />
        ))}
        <rect x={90} y={220} width={210} height={200} fill="#1d1a17" />
        {[250, 280, 310, 340, 370].map((y) => (
          <rect key={y} x={112} y={y} width={120 + (y % 3) * 20} height={4} fill="#4a4036" opacity={0.6} />
        ))}
      </g>
      {/* far customers, out of focus */}
      <g fill="#171412" opacity={0.85} filter={url(id.far)}>
        <Seated x={230} y={720} s={0.62} fill="#171412" scarf="#171412" rim={url(id.far)} />
        <Seated x={1410} y={725} s={0.6} facing={-1} fill="#171412" scarf="#171412" rim={url(id.far)} />
        <ellipse cx={300} cy={735} rx={70} ry={12} />
        <ellipse cx={1340} cy={740} rx={70} ry={12} />
      </g>
      <rect y={700} width={1600} height={200} fill={url(id.floor)} />
      <ellipse cx={820} cy={800} rx={460} ry={60} fill="#a9824c" opacity={golden ? 0.24 : 0.16} filter={url(id.haze)} />
    </Svg>
  );
}

/** The table, the cups, and B (sage) facing A across it. */
export function CafeTable() {
  const id = useIds('top', 'fig', 'rim', 'soft', 'cup');
  return (
    <Svg w={1600} h={900}>
      <defs>
        <linearGradient id={id.top} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a3b2d" />
          <stop offset="1" stopColor="#1f1914" />
        </linearGradient>
        <linearGradient id={id.fig} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1916" />
          <stop offset="1" stopColor="#120f0d" />
        </linearGradient>
        <linearGradient id={id.cup} x1="0" x2="1">
          <stop offset="0" stopColor="#9c9184" />
          <stop offset="0.7" stopColor="#e9dfcf" />
          <stop offset="1" stopColor="#bfb3a3" />
        </linearGradient>
        <Blur id={id.rim} amount={2} spread={10} />
        <Blur id={id.soft} amount={1.2} spread={6} />
      </defs>
      <g filter={url(id.soft)}>
        <Seated x={910} y={650} facing={-1} fill={url(id.fig)} scarf={SAGE} rim={url(id.rim)} />
        <rect x={792} y={650} width={16} height={210} fill="#15110e" />
        <ellipse cx={800} cy={866} rx={74} ry={10} fill="#15110e" />
        <ellipse cx={800} cy={640} rx={180} ry={30} fill={url(id.top)} />
        <path d="M 622 636 Q 800 606 978 636" fill="none" stroke="#caa06a" strokeOpacity={0.5} strokeWidth={3} />
        {[748, 852].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={636} rx={30} ry={7} fill="#cfc4b3" />
            <path d={`M ${x - 16} 610 L ${x + 16} 610 L ${x + 12} 634 L ${x - 12} 634 Z`} fill={url(id.cup)} />
          </g>
        ))}
      </g>
    </Svg>
  );
}

/** A (rust), seated, leaning in across the table. */
export function CafeASeated() {
  const id = useIds('fig', 'rim', 'soft');
  return (
    <Svg w={1600} h={900}>
      <defs>
        <linearGradient id={id.fig} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1916" />
          <stop offset="1" stopColor="#120f0d" />
        </linearGradient>
        <Blur id={id.rim} amount={2} spread={10} />
        <Blur id={id.soft} amount={1.2} spread={6} />
      </defs>
      <g filter={url(id.soft)}>
        <Seated x={690} y={650} fill={url(id.fig)} scarf={RUST} rim={url(id.rim)} />
      </g>
    </Svg>
  );
}

/** A (rust), on their feet in a coat — the conversation is cut short. */
export function CafeAStanding() {
  const id = useIds('fig', 'rim', 'soft');
  return (
    <Svg w={1600} h={900}>
      <defs>
        <linearGradient id={id.fig} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1916" />
          <stop offset="1" stopColor="#100d0b" />
        </linearGradient>
        <Blur id={id.rim} amount={2} spread={10} />
        <Blur id={id.soft} amount={1.2} spread={6} />
      </defs>
      <g transform="translate(610 872)" filter={url(id.soft)}>
        <g fill="none" stroke={RIM} strokeOpacity={0.4} strokeWidth={4} filter={url(id.rim)}>
          <path d={STANDING} />
          <circle cx={0} cy={-440} r={28} />
        </g>
        <path d={STANDING} fill={url(id.fig)} />
        <circle cx={0} cy={-440} r={28} fill={url(id.fig)} />
        <path d={STANDING_SCARF} fill={RUST} opacity={0.9} />
        <line x1={-26} y1={-402} x2={42} y2={-246} stroke="#0c0a09" strokeWidth={5} />
        <rect x={30} y={-256} width={46} height={58} rx={6} fill="#14110f" />
      </g>
    </Svg>
  );
}

/** Near-camera shapes, heavily out of focus; they sweep past as the camera pushes in. */
export function CafeFg() {
  const id = useIds('blur');
  return (
    <Svg w={1600} h={900}>
      <defs>
        <Blur id={id.blur} amount={11} spread={20} />
      </defs>
      <g filter={url(id.blur)} fill="#0c0a09">
        {/* a plant, left */}
        <ellipse cx={60} cy={520} rx={90} ry={40} transform="rotate(-30 60 520)" />
        <ellipse cx={130} cy={620} rx={110} ry={42} transform="rotate(-12 130 620)" />
        <ellipse cx={40} cy={700} rx={100} ry={44} transform="rotate(20 40 700)" />
        <rect x={-40} y={740} width={260} height={200} />
        {/* a chair back, right */}
        <rect x={1400} y={560} width={26} height={360} />
        <rect x={1500} y={540} width={26} height={380} />
        <rect x={1390} y={560} width={150} height={24} />
        <rect x={1380} y={660} width={170} height={20} />
      </g>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Chapter 3: the code
// ---------------------------------------------------------------------------

/** Warm, out-of-focus café behind the close-up of the phones. */
export function ScanBg() {
  const id = useIds('bokeh', 'base');
  const r = seeded(21);
  const dots = Array.from({ length: 16 }, () => ({
    x: r() * 1600,
    y: r() * 900,
    rad: 30 + r() * 70,
    c: r() < 0.6 ? '#e7c38a' : '#c28c52',
    o: 0.08 + r() * 0.16,
  }));
  return (
    <Svg w={1600} h={900}>
      <defs>
        <radialGradient id={id.base} cx="0.5" cy="0.45" r="0.8">
          <stop offset="0" stopColor="#2e2620" />
          <stop offset="1" stopColor="#15120f" />
        </radialGradient>
        <Blur id={id.bokeh} amount={18} />
      </defs>
      <rect width={1600} height={900} fill={url(id.base)} />
      <g filter={url(id.bokeh)}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.rad} fill={d.c} opacity={d.o} />
        ))}
      </g>
    </Svg>
  );
}

/** A 21×21 code, drawn as modules (finder patterns + deterministic fill). */
function Code({ size }: { size: number }) {
  const n = 21;
  const m = size / n;
  const r = seeded(99);
  const cells: [number, number][] = [];
  const finder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const inFinder = (x: number, y: number) => {
    for (const [ox, oy] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ]) {
      const dx = x - ox;
      const dy = y - oy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        return ring === 3 || ring <= 1;
      }
    }
    return false;
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (finder(x, y) ? inFinder(x, y) : r() < 0.46) cells.push([x, y]);
    }
  return (
    <g fill="#1f2326">
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x * m} y={y * m} width={m + 0.3} height={m + 0.3} />
      ))}
    </g>
  );
}

/** A's hand holding out their phone, the Ekklē code on screen. */
export function ScanA() {
  const id = useIds('soft', 'glow');
  return (
    <Svg w={1600} h={900}>
      <defs>
        <Blur id={id.soft} amount={3} spread={10} />
        <Blur id={id.glow} amount={26} />
      </defs>
      <ellipse cx={660} cy={470} rx={150} ry={220} fill="#f3e6c8" opacity={0.12} filter={url(id.glow)} />
      <g filter={url(id.soft)}>
        <path d="M 470 900 C 500 760 560 660 600 600 L 690 640 C 650 720 600 820 590 900 Z" fill="#2a211b" />
        <path d="M 480 900 C 500 830 520 790 540 760 L 610 800 C 596 840 590 870 588 900 Z" fill={RUST} opacity={0.9} />
      </g>
      <g transform="translate(660 470) rotate(-8)">
        <rect x={-85} y={-170} width={170} height={340} rx={26} fill="#0e1011" />
        <rect x={-76} y={-158} width={152} height={316} rx={18} fill="#f3eee4" />
        <g transform="translate(-60 -86)">
          <Code size={120} />
        </g>
        <rect x={-44} y={52} width={88} height={6} rx={3} fill="#a9824c" opacity={0.8} />
        <rect x={-32} y={66} width={64} height={5} rx={2.5} fill="#8a8676" opacity={0.6} />
      </g>
      <g filter={url(id.soft)}>
        <ellipse cx={606} cy={600} rx={46} ry={26} fill="#3b2e25" transform="rotate(-30 606 600)" />
      </g>
    </Svg>
  );
}

/** B's hand and phone, camera open, arriving to scan. */
export function ScanB() {
  const id = useIds('soft');
  const c = 44; // viewfinder corner length
  return (
    <Svg w={1600} h={900}>
      <defs>
        <Blur id={id.soft} amount={3} spread={10} />
      </defs>
      <g filter={url(id.soft)}>
        <path d="M 1150 900 C 1110 770 1050 680 1010 620 L 930 670 C 970 740 1010 830 1020 900 Z" fill="#2a211b" />
        <path d="M 1140 900 C 1116 830 1096 790 1076 764 L 1010 806 C 1024 846 1030 876 1032 900 Z" fill={SAGE} opacity={0.9} />
      </g>
      <g transform="translate(960 480) rotate(10)">
        <rect x={-85} y={-170} width={170} height={340} rx={26} fill="#0e1011" />
        <rect x={-76} y={-158} width={152} height={316} rx={18} fill="#0b0d0e" />
        <g fill="none" stroke="#c9a56b" strokeWidth={4} strokeLinecap="round">
          <path d={`M -60 ${-80 + c} V -80 H ${-60 + c}`} />
          <path d={`M ${60 - c} -80 H 60 V ${-80 + c}`} />
          <path d={`M 60 ${40 - c} V 40 H ${60 - c}`} />
          <path d={`M ${-60 + c} 40 H -60 V ${40 - c}`} />
        </g>
      </g>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Chapters 4–5: two lives (square panels)
// ---------------------------------------------------------------------------

/** A's day: a cool street at dusk. */
export function DayBg() {
  const id = useIds('sky', 'street', 'soft', 'haze');
  const r = seeded(33);
  const blocks = Array.from({ length: 9 }, (_, i) => ({
    x: i * 118 - 20 + r() * 20,
    w: 90 + r() * 50,
    h: 180 + r() * 260,
  }));
  return (
    <Svg w={1000} h={1000}>
      <defs>
        <linearGradient id={id.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f3c46" />
          <stop offset="0.62" stopColor="#56646b" />
          <stop offset="1" stopColor="#3a444a" />
        </linearGradient>
        <linearGradient id={id.street} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#20282d" />
          <stop offset="1" stopColor="#13171a" />
        </linearGradient>
        <Blur id={id.soft} amount={1.6} spread={6} />
        <Blur id={id.haze} amount={24} />
      </defs>
      <rect width={1000} height={1000} fill={url(id.sky)} />
      <g filter={url(id.soft)}>
        {blocks.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={700 - b.h} width={b.w} height={b.h} fill="#252f37" />
            {Array.from({ length: 6 }, (_, k) => (
              <rect
                key={k}
                x={b.x + 14 + (k % 2) * 36}
                y={720 - b.h + 30 + Math.floor(k / 2) * 46}
                width={18}
                height={24}
                fill={(i + k) % 7 === 0 ? '#c9a56b' : '#9fb0b8'}
                opacity={(i + k) % 7 === 0 ? 0.6 : 0.16}
              />
            ))}
          </g>
        ))}
        <rect x={0} y={200} width={170} height={520} fill="#1b2329" />
      </g>
      <rect y={700} width={1000} height={300} fill={url(id.street)} />
      {[240, 820].map((x) => (
        <g key={x}>
          <rect x={x - 4} y={420} width={8} height={300} fill="#12171a" />
          <ellipse cx={x} cy={420} rx={60} ry={40} fill="#cdd8dc" opacity={0.3} filter={url(id.haze)} />
          <ellipse cx={x} cy={760} rx={70} ry={12} fill="#cdd8dc" opacity={0.12} filter={url(id.haze)} />
        </g>
      ))}
    </Svg>
  );
}

function Walker({ x, y, s = 1, phone = false }: { x: number; y: number; s?: number; phone?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {phone ? (
        <>
          <path d={STANDING} fill="#11151a" />
          <circle cx={0} cy={-440} r={28} fill="#11151a" />
          <path d={STANDING_SCARF} fill={RUST} opacity={0.9} />
        </>
      ) : (
        <>
          <path d={WALK_LEGS} fill="#11151a" />
          <path d={WALK_TORSO} fill="#11151a" />
          <path d={WALK_ARM} fill="#11151a" />
          <circle cx={0} cy={-395} r={25} fill="#11151a" />
          <path d={WALK_SCARF} fill={RUST} opacity={0.9} />
        </>
      )}
    </g>
  );
}

/** A walking on, carrying on with their day. */
export function DayAWalking() {
  const id = useIds('soft');
  return (
    <Svg w={1000} h={1000}>
      <defs>
        <Blur id={id.soft} amount={1.4} spread={8} />
      </defs>
      <g filter={url(id.soft)}>
        <Walker x={520} y={880} s={1.05} />
      </g>
    </Svg>
  );
}

/** A stopped, phone in hand, lit by it — B has reached back. */
export function DayAPhone() {
  const id = useIds('soft', 'glow');
  return (
    <Svg w={1000} h={1000}>
      <defs>
        <Blur id={id.soft} amount={1.4} spread={8} />
        <Blur id={id.glow} amount={16} />
      </defs>
      <g filter={url(id.soft)}>
        <Walker x={520} y={880} s={0.95} phone />
      </g>
      <ellipse cx={528} cy={468} rx={36} ry={40} fill="#f4e7c9" opacity={0.45} filter={url(id.glow)} />
      <rect x={532} y={560} width={28} height={50} rx={6} fill="#f7efdc" opacity={0.9} transform="rotate(-18 546 585)" />
      <ellipse cx={546} cy={585} rx={60} ry={60} fill="#f4e7c9" opacity={0.35} filter={url(id.glow)} />
    </Svg>
  );
}


/** B's night: one warm lamp, an armchair, a phone in hand. */
export function NightBg() {
  const id = useIds('wall', 'win', 'shade', 'cone', 'soft', 'haze', 'chair', 'fig', 'rim');
  return (
    <Svg w={1000} h={1000}>
      <defs>
        <linearGradient id={id.wall} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1916" />
          <stop offset="1" stopColor="#120f0d" />
        </linearGradient>
        <linearGradient id={id.win} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2432" />
          <stop offset="1" stopColor="#0e141c" />
        </linearGradient>
        <linearGradient id={id.shade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1d49c" />
          <stop offset="1" stopColor="#b98a50" />
        </linearGradient>
        <linearGradient id={id.cone} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0cf94" stopOpacity="0.32" />
          <stop offset="1" stopColor="#a9824c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id.chair} x1="0" x2="1">
          <stop offset="0" stopColor="#15110e" />
          <stop offset="0.8" stopColor="#2a221b" />
          <stop offset="1" stopColor="#5a4631" />
        </linearGradient>
        <linearGradient id={id.fig} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f1a16" />
          <stop offset="1" stopColor="#130f0c" />
        </linearGradient>
        <Blur id={id.soft} amount={1.5} spread={6} />
        <Blur id={id.haze} amount={30} />
        <Blur id={id.rim} amount={2} spread={10} />
      </defs>
      <rect width={1000} height={1000} fill={url(id.wall)} />
      {/* a night window, city lights far off */}
      <rect x={90} y={150} width={290} height={410} fill={url(id.win)} />
      {[
        [140, 480],
        [210, 500],
        [300, 470],
        [340, 520],
        [180, 440],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4} fill={i % 2 ? '#c9a56b' : '#8fa3b8'} opacity={0.6} filter={url(id.rim)} />
      ))}
      <g fill="#0d0b0a" filter={url(id.soft)}>
        <rect x={80} y={140} width={310} height={16} />
        <rect x={80} y={556} width={310} height={18} />
        <rect x={80} y={140} width={16} height={434} />
        <rect x={374} y={140} width={16} height={434} />
        <rect x={228} y={150} width={12} height={410} />
      </g>
      {/* the lamp */}
      <polygon points="780,330 900,330 1000,1000 560,1000" fill={url(id.cone)} filter={url(id.haze)} />
      <ellipse cx={840} cy={300} rx={170} ry={130} fill="#e9c88c" opacity={0.3} filter={url(id.haze)} />
      <rect x={836} y={320} width={8} height={580} fill="#0f0c0a" />
      <path d="M 790 240 L 890 240 L 910 330 L 770 330 Z" fill={url(id.shade)} filter={url(id.soft)} />
      <ellipse cx={840} cy={900} rx={60} ry={10} fill="#0f0c0a" />
      {/* the armchair */}
      <g filter={url(id.soft)} fill={url(id.chair)}>
        <path d="M 430 470 C 430 420 470 400 520 400 L 700 400 C 750 400 770 430 770 470 L 770 780 L 430 780 Z" />
        <rect x={400} y={610} width={70} height={210} rx={20} />
        <rect x={730} y={610} width={70} height={210} rx={20} />
        <rect x={420} y={760} width={380} height={70} rx={10} />
        <rect x={440} y={830} width={16} height={60} />
        <rect x={744} y={830} width={16} height={60} />
      </g>
      {/* B, reading */}
      <g filter={url(id.soft)}>
        <Seated x={560} y={742} s={1.18} fill={url(id.fig)} scarf={SAGE} rim={url(id.rim)} />
      </g>
      <ellipse cx={600} cy={1000} rx={420} ry={60} fill="#3a2d21" opacity={0.6} filter={url(id.haze)} />
    </Svg>
  );
}

/** The phone's glow on B's hands and face (its own layer so it can pulse). */
export function NightGlow() {
  const id = useIds('glow');
  return (
    <Svg w={1000} h={1000}>
      <defs>
        <Blur id={id.glow} amount={18} />
      </defs>
      <ellipse cx={590} cy={512} rx={40} ry={44} fill="#f4e7c9" opacity={0.4} filter={url(id.glow)} />
      <ellipse cx={NIGHT_PHONE.fx * 1000} cy={NIGHT_PHONE.fy * 1000} rx={70} ry={60} fill="#f6ecd6" opacity={0.5} filter={url(id.glow)} />
      <rect
        x={NIGHT_PHONE.fx * 1000 - 13}
        y={NIGHT_PHONE.fy * 1000 - 22}
        width={26}
        height={44}
        rx={5}
        fill="#faf3e3"
        transform={`rotate(-24 ${NIGHT_PHONE.fx * 1000} ${NIGHT_PHONE.fy * 1000})`}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Chapter 6: together
// ---------------------------------------------------------------------------

/** The two of them, heads bowed together over an open Bible. */
export function Together() {
  const id = useIds('fig', 'rim', 'soft', 'top', 'page', 'glow');
  return (
    <Svg w={1600} h={900}>
      <defs>
        <linearGradient id={id.fig} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#201a15" />
          <stop offset="1" stopColor="#120e0b" />
        </linearGradient>
        <linearGradient id={id.top} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a4430" />
          <stop offset="1" stopColor="#211912" />
        </linearGradient>
        <linearGradient id={id.page} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf1dc" />
          <stop offset="1" stopColor="#d9c4a0" />
        </linearGradient>
        <Blur id={id.rim} amount={2} spread={10} />
        <Blur id={id.soft} amount={1.2} spread={6} />
        <Blur id={id.glow} amount={20} />
      </defs>
      <g filter={url(id.soft)}>
        <Seated x={705} y={650} fill={url(id.fig)} scarf={RUST} rim={url(id.rim)} />
        <Seated x={895} y={650} facing={-1} fill={url(id.fig)} scarf={SAGE} rim={url(id.rim)} />
        <rect x={792} y={650} width={16} height={210} fill="#15110e" />
        <ellipse cx={800} cy={866} rx={74} ry={10} fill="#15110e" />
        <ellipse cx={800} cy={640} rx={180} ry={30} fill={url(id.top)} />
        {/* the open Bible */}
        <path d="M 800 628 C 780 618 752 616 732 622 L 738 644 C 758 640 782 642 800 650 Z" fill={url(id.page)} />
        <path d="M 800 628 C 820 618 848 616 868 622 L 862 644 C 842 640 818 642 800 650 Z" fill={url(id.page)} />
        <g stroke="#9b8563" strokeOpacity={0.5} strokeWidth={1.2}>
          {[0, 1, 2, 3].map((i) => (
            <line key={`l${i}`} x1={746} y1={627 + i * 4} x2={792} y2={630 + i * 4} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <line key={`r${i}`} x1={808} y1={630 + i * 4} x2={854} y2={627 + i * 4} />
          ))}
        </g>
        <path d="M 800 628 L 800 650" stroke="#7a6444" strokeWidth={2} />
      </g>
      <ellipse cx={800} cy={620} rx={120} ry={46} fill="#f8e4b6" opacity={0.3} filter={url(id.glow)} />
    </Svg>
  );
}
