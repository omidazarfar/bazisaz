import type { Sprite } from './sprites';

/**
 * The library's pictures, drawn in the glossy style of mobile games: each
 * shape lit from above with a gradient, outlined in a deeper tone of its own
 * colour rather than one ink for everything, given a shine where the light
 * catches it, and big bright eyes on anything alive. Magic things glow.
 *
 * Every drawing is an SVG body built by a function, with its gradients and
 * effects declared alongside it, so each picture stands on its own.
 */

// ── Colours ───────────────────────────────────────────────────────────────

function rgb(c: string): number[] {
  const hex = c.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((d) => d + d).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
function mix(colour: string, toward: string, share: number): string {
  const [a, b] = [rgb(colour), rgb(toward)];
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * share).toString(16).padStart(2, '0')).join('')}`;
}
const light = (c: string, k = 0.4) => mix(c, '#ffffff', k);
const dark = (c: string, k = 0.4) => mix(c, '#000000', k);

// ── The kit: gradients and effects for one drawing ─────────────────────────

type Stop = [number, string, number?];

interface Kit {
  /** Lit from above: lighter at the top, the colour in the middle, deeper at the bottom. */
  lin: (c: string, top?: number, bottom?: number) => string;
  /** Lit from above sideways, for upright cylinders like pipes. */
  side: (c: string) => string;
  /** A ball lit from the upper left. */
  sphere: (c: string, cx?: number, cy?: number) => string;
  grad: (stops: Stop[], x1?: number, y1?: number, x2?: number, y2?: number) => string;
  radial: (stops: Stop[], cx?: number, cy?: number, r?: number) => string;
  /** A soft glow around what it is applied to. */
  glow: (blur?: number) => string;
  /** A small soft shadow under what it is applied to, for icons and lettering. */
  drop: () => string;
  /** Any other definition (a pattern); returns its id. */
  def: (make: (id: string) => string) => string;
}

function draw(paint: (k: Kit) => string): string {
  let n = 0;
  const defs: string[] = [];
  const id = () => `a${n++}`;
  const stops = (list: Stop[]) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('');
  const k: Kit = {
    lin: (c, top = 0.42, bottom = 0.3) => k.grad([[0, light(c, top)], [0.5, c], [1, dark(c, bottom)]]),
    side: (c) => k.grad([[0, dark(c, 0.2)], [0.3, light(c, 0.45)], [0.55, c], [1, dark(c, 0.35)]], 0, 0, 1, 0),
    sphere: (c, cx = 0.36, cy = 0.3) => k.radial([[0, light(c, 0.6)], [0.45, c], [1, dark(c, 0.38)]], cx, cy, 0.8),
    grad: (list, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => {
      const g = id();
      defs.push(`<linearGradient id="${g}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`);
      return `url(#${g})`;
    },
    radial: (list, cx = 0.5, cy = 0.5, r = 0.5) => {
      const g = id();
      defs.push(`<radialGradient id="${g}" cx="${cx}" cy="${cy}" r="${r}" fx="${cx}" fy="${cy}">${stops(list)}</radialGradient>`);
      return `url(#${g})`;
    },
    glow: (blur = 3) => {
      const f = id();
      defs.push(`<filter id="${f}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${blur}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
      return `url(#${f})`;
    },
    drop: () => {
      const f = id();
      defs.push(`<filter id="${f}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2.5" stdDeviation="1.6" flood-color="#000" flood-opacity="0.35"/></filter>`);
      return `url(#${f})`;
    },
    def: (make) => {
      const d = id();
      defs.push(make(d));
      return d;
    },
  };
  const body = paint(k);
  return `<defs>${defs.join('')}</defs>${body}`;
}

// ── Pieces ─────────────────────────────────────────────────────────────────

/** An outline in a deeper tone of the shape's own colour. */
const ol = (c: string, w = 4) => `stroke="${dark(c, 0.55)}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
/** A highlight where the light catches a glossy surface. */
const shine = (k: Kit, x: number, y: number, rx: number, ry: number, rot = -20, a = 0.85) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="${k.grad([[0, '#ffffff', a], [1, '#ffffff', 0]])}"/>`;
/** A four-pointed sparkle. */
const glint = (x: number, y: number, s: number, c = '#ffffff') =>
  `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="${c}"/>`;
/** A big bright cartoon eye looking slightly to the right. */
const eye = (k: Kit, x: number, y: number, r: number, iris = '#3a7bd5') =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${k.grad([[0, '#ffffff'], [1, '#d9e3ee']])}" stroke="#1f2a37" stroke-width="${Math.max(2, r * 0.22)}"/>` +
  `<circle cx="${x + r * 0.18}" cy="${y + r * 0.08}" r="${r * 0.62}" fill="${k.radial([[0, light(iris, 0.35)], [0.7, iris], [1, dark(iris, 0.45)]], 0.45, 0.35, 0.6)}"/>` +
  `<circle cx="${x + r * 0.2}" cy="${y + r * 0.1}" r="${r * 0.32}" fill="#0d1117"/>` +
  `<circle cx="${x - r * 0.02}" cy="${y - r * 0.2}" r="${r * 0.22}" fill="#ffffff"/><circle cx="${x + r * 0.38}" cy="${y + r * 0.32}" r="${r * 0.1}" fill="#ffffff"/>`;
/** An angry eye: the same, with a lid cutting across it. */
const angry = (k: Kit, x: number, y: number, r: number, iris: string, left: boolean) =>
  eye(k, x, y, r, iris) + `<path d="M${x - r * 1.2} ${y - r * (left ? 1.15 : 0.35)}L${x + r * 1.2} ${y - r * (left ? 0.35 : 1.15)}L${x + r * 1.2} ${y - r * 1.6}L${x - r * 1.2} ${y - r * 1.6}Z" fill="#1f2a37"/>`;
const blush = (x: number, y: number, rx = 8, ry = 5) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#ff6b8a" fill-opacity="0.45"/>`;
const smile = (x: number, y: number, w: number) =>
  `<path d="M${x - w} ${y}Q${x} ${y + w * 1.1} ${x + w} ${y}Q${x} ${y + w * 0.45} ${x - w} ${y}Z" fill="#8a1f33" stroke="#1f2a37" stroke-width="3" stroke-linejoin="round"/><path d="M${x - w * 0.45} ${y + w * 0.55}Q${x} ${y + w * 0.95} ${x + w * 0.45} ${y + w * 0.55}Q${x} ${y + w * 0.4} ${x - w * 0.45} ${y + w * 0.55}Z" fill="#ff7a8a"/>`;

/** A round glossy game button that stands up off the screen, with a white icon on it. */
const button = (c: string, icon: (k: Kit) => string) =>
  draw((k) =>
    `<circle cx="50" cy="55" r="43" fill="${dark(c, 0.5)}"/>` +
    `<circle cx="50" cy="49" r="43" fill="${k.lin(c, 0.35, 0.18)}" stroke="${dark(c, 0.6)}" stroke-width="4"/>` +
    `<path d="M14 42Q16 12 50 10Q84 12 86 42Q68 32 50 32Q32 32 14 42Z" fill="${k.grad([[0, '#ffffff', 0.7], [1, '#ffffff', 0.08]])}"/>` +
    `<g filter="${k.drop()}">${icon(k)}</g>`,
  );
const WHITE = 'fill="#ffffff" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"';

// ── Characters ─────────────────────────────────────────────────────────────

const bird = (wingY: number) =>
  draw((k) =>
    `<path d="M18 50 2 40 8 56 2 70 18 62Z" fill="${k.lin('#ff9f1c')}" ${ol('#ff9f1c', 3)}/>` +
    `<ellipse cx="58" cy="54" rx="44" ry="40" fill="${k.sphere('#ffcd38')}" ${ol('#f0a500')}/>` +
    `<ellipse cx="64" cy="72" rx="26" ry="15" fill="#fff4cc" fill-opacity="0.8"/>` +
    shine(k, 42, 28, 20, 9) +
    `<path d="M94 46Q122 50 98 59Z" fill="${k.lin('#ff8a1f')}" ${ol('#ff8a1f', 3)}/><path d="M94 58Q114 62 97 68Z" fill="${k.lin('#e8650f')}" ${ol('#e8650f', 3)}/>` +
    eye(k, 80, 38, 13, '#2d7ff9') +
    blush(76, 60) +
    `<ellipse cx="42" cy="${wingY}" rx="23" ry="14" transform="rotate(-18 42 ${wingY})" fill="${k.lin('#ffb020')}" ${ol('#e08a00', 3.5)}/>` +
    shine(k, 36, wingY - 5, 10, 4, -18, 0.7),
  );

const hero = (left: [number, number], right: [number, number]) =>
  draw((k) => {
    const foot = ([x, y]: [number, number]) => `<rect x="${x}" y="${y}" width="24" height="17" rx="8.5" fill="${k.lin('#2b59c3')}" ${ol('#2b59c3', 3.5)}/>`;
    return (
      foot(left) + foot(right) +
      `<rect x="12" y="8" width="76" height="82" rx="34" fill="${k.lin('#35c9e8', 0.4, 0.32)}" ${ol('#169ac0', 4.5)}/>` +
      `<rect x="28" y="56" width="44" height="28" rx="14" fill="#ffffff" fill-opacity="0.22"/>` +
      shine(k, 32, 22, 15, 8) +
      eye(k, 36, 42, 11.5, '#3b2a6b') + eye(k, 64, 42, 11.5, '#3b2a6b') +
      smile(50, 62, 9) + blush(25, 58) + blush(75, 58) +
      `<path d="M46 9Q50 -1 60 5" fill="none" stroke="#169ac0" stroke-width="4" stroke-linecap="round"/>`
    );
  });

const robot = (left: [number, number], right: [number, number]) =>
  draw((k) => {
    const glow = k.glow(2.5);
    const foot = ([x, y]: [number, number]) => `<rect x="${x}" y="${y}" width="24" height="16" rx="6" fill="${k.lin('#5b6b80')}" ${ol('#5b6b80', 3)}/>`;
    return (
      foot(left) + foot(right) +
      `<path d="M50 16V7" stroke="#8a99ab" stroke-width="4"/><circle cx="50" cy="6" r="5" fill="#ff4d5e" filter="${glow}"/>` +
      `<rect x="16" y="15" width="68" height="44" rx="14" fill="${k.lin('#d6e0ea', 0.5, 0.25)}" ${ol('#8a99ab', 4)}/>` +
      `<rect x="24" y="24" width="52" height="24" rx="11" fill="${k.grad([[0, '#1d3b66'], [1, '#0b1730']])}" stroke="#0b1730" stroke-width="2"/>` +
      `<circle cx="38" cy="36" r="5.5" fill="#5ff2ff" filter="${glow}"/><circle cx="62" cy="36" r="5.5" fill="#5ff2ff" filter="${glow}"/>` +
      shine(k, 34, 22, 14, 4, -8, 0.7) +
      `<rect x="40" y="58" width="20" height="6" fill="#8a99ab"/>` +
      `<rect x="22" y="62" width="56" height="30" rx="10" fill="${k.lin('#7b5cff')}" ${ol('#7b5cff', 4)}/>` +
      `<circle cx="50" cy="76" r="6" fill="#ffd54a" filter="${glow}"/>` +
      shine(k, 36, 68, 10, 4, -8, 0.6)
    );
  });

// ── The library ────────────────────────────────────────────────────────────

const TILE_COLOURS = ['#eee4da', '#ede0c8', '#f2b179', '#f59563', '#f67c5f', '#f65e3b', '#edcf72', '#edcc61', '#edc850', '#edc53f', '#edc22e'];
const NUMBER_TILES: Sprite[] = TILE_COLOURS.map((colour, level) => {
  const number = String(2 ** (level + 1));
  const size = number.length > 3 ? 30 : number.length > 2 ? 38 : 48;
  return {
    id: `n-${number}`, name: `کاشی ${number}`, category: 'board' as const, width: 100, height: 100,
    body: draw((k) =>
      `<rect x="5" y="8" width="90" height="88" rx="16" fill="${dark(colour, 0.35)}"/>` +
      `<rect x="5" y="4" width="90" height="88" rx="16" fill="${k.lin(colour, 0.35, 0.15)}" ${ol(colour, 3)}/>` +
      `<rect x="13" y="9" width="74" height="20" rx="10" fill="#ffffff" fill-opacity="0.32"/>` +
      `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="${size}" fill="${level < 2 ? '#5d4d3f' : '#ffffff'}" filter="${k.drop()}">${number}</text>`,
    ),
  };
});

/** A tile of a board: a raised rounded square. */
const tile = (k: Kit, inner = '') =>
  `<rect x="5" y="8" width="90" height="88" rx="18" fill="#b8c3cf"/><rect x="5" y="4" width="90" height="88" rx="18" fill="${k.lin('#f4f7fb', 0.6, 0.1)}" ${ol('#c3cdd8', 3)}/>${inner}`;

/**
 * Grass on earth, the top of a platform or of the ground. A seamless one has
 * no ends, so copies of it side by side join without a line between them.
 */
const grassy = (k: Kit, w: number, h: number, grassDepth: number, round: number, seamless = false) => {
  if (seamless) {
    const pebbles = Array.from({ length: Math.round(w / 40) }, (_, i) => {
      const x = (i * 97) % (w - 40) + 20;
      const y = grassDepth + 14 + ((i * 53) % (h - grassDepth - 26));
      return `<ellipse cx="${x}" cy="${y}" rx="${6 + (i % 3) * 3}" ry="${4 + (i % 2) * 2}" fill="${i % 2 ? '#6b4029' : '#b48a66'}" fill-opacity="0.75"/>`;
    }).join('');
    const period = w / Math.round(w / 24);
    const wave = Array.from({ length: Math.round(w / period) + 1 }, (_, i) => `L${(i * period).toFixed(1)} ${grassDepth + (i % 2 ? 8 : 0)}`).join('');
    const blades = Array.from({ length: Math.round(w / 16) }, (_, i) => {
      const x = 8 + i * 16;
      return `<path d="M${x} 9Q${x + 2} 1 ${x + 5} 7" fill="none" stroke="#9be86f" stroke-width="2.5" stroke-linecap="round"/>`;
    }).join('');
    return (
      `<rect x="0" y="4" width="${w}" height="${h - 4}" fill="${k.grad([[0, '#9a6440'], [1, '#4e2f1c']])}"/>` +
      `<path d="M0 ${h * 0.7}H${w}" stroke="#4a2c1a" stroke-width="2" stroke-opacity="0.35"/>` + pebbles +
      `<path d="M0 4H${w}V${grassDepth}${wave.split('L').filter(Boolean).reverse().map((p) => `L${p}`).join('')}Z" fill="${k.lin('#6fd24f', 0.3, 0.25)}"/>` +
      `<path d="M0 4H${w}" stroke="#3c9a34" stroke-width="5"/>` +
      `<rect x="0" y="8" width="${w}" height="5" fill="#c8f7a0" fill-opacity="0.6"/>` + blades
    );
  }
  const pebbles = Array.from({ length: Math.round(w / 40) }, (_, i) => {
    const x = (i * 97) % (w - 20) + 10;
    const y = grassDepth + 8 + ((i * 53) % Math.max(6, h - grassDepth - 18));
    return `<ellipse cx="${x}" cy="${y}" rx="${5 + (i % 3) * 2}" ry="${3 + (i % 2) * 2}" fill="${i % 2 ? '#6b4029' : '#b48a66'}" fill-opacity="0.8"/>`;
  }).join('');
  const wave = Array.from({ length: Math.ceil(w / 24) + 1 }, (_, i) => `${i * 24},${grassDepth + (i % 2 ? 7 : 0)}`).join(' ');
  const blades = Array.from({ length: Math.round(w / 14) }, (_, i) => {
    const x = 6 + i * 14;
    return `<path d="M${x} 6Q${x + 2} ${-2} ${x + 5} 4" fill="none" stroke="#9be86f" stroke-width="2.5" stroke-linecap="round"/>`;
  }).join('');
  return (
    `<rect x="2" y="4" width="${w - 4}" height="${h - 6}" rx="${round}" fill="${k.grad([[0, '#9a6440'], [1, '#5e3a24']])}" ${ol('#7a4a2e', 3.5)}/>` +
    pebbles +
    `<path d="M2 ${4 + round}Q2 4 ${2 + round} 4H${w - 2 - round}Q${w - 2} 4 ${w - 2} ${4 + round}V${grassDepth}L${wave.split(' ').reverse().join(' L')}Z" fill="${k.lin('#6fd24f', 0.3, 0.25)}" ${ol('#3c9a34', 3)}/>` +
    `<rect x="${round / 2 + 4}" y="7" width="${w - round - 8}" height="5" rx="2.5" fill="#c8f7a0" fill-opacity="0.7"/>` +
    blades
  );
};

function character(id: string, name: string, width: number, height: number, body: string, strides?: string[]): Sprite {
  const pose = (transform: string) => `<g transform="${transform}">${body}</g>`;
  return {
    id, name, category: 'character', width, height, body,
    move: strides ?? [pose('translate(4 -1) rotate(5 50 80) scale(.96 .98)'), pose('translate(0 4) rotate(-4 50 80) scale(1 .94)')],
    jump: pose('translate(6 -1) rotate(-8 50 48) scale(.9 .92)'),
    hurt: pose('translate(0 14) rotate(-12 50 70) scale(.95 .81)') + glint(86, 17, 11, '#ffd84a') + glint(73, 9, 5),
  };
}

const cat = draw((k) =>
  `<path d="M16 44 12 6l32 18Z" fill="${k.lin('#ff9f43')}" ${ol('#d9741a')}/><path d="M94 44l4-38-32 18Z" fill="${k.lin('#ff9f43')}" ${ol('#d9741a')}/>` +
  `<path d="M20 34 18 16l16 10Z" fill="#ffb3c1"/><path d="M90 34l2-18-16 10Z" fill="#ffb3c1"/>` +
  `<ellipse cx="55" cy="58" rx="45" ry="38" fill="${k.sphere('#ffa94d')}" ${ol('#d9741a')}/>` +
  `<path d="M47 22l3 12M55 20v13M63 22l-3 12" stroke="#d9741a" stroke-width="4" stroke-linecap="round"/>` +
  shine(k, 34, 36, 14, 7) +
  eye(k, 38, 54, 10, '#2fbf71') + eye(k, 72, 54, 10, '#2fbf71') +
  `<path d="M50 68h10l-5 6z" fill="#ff6f91" stroke="#1f2a37" stroke-width="2" stroke-linejoin="round"/><path d="M55 74v4m0 0q-7 6-13 0m13 0q7 6 13 0" fill="none" stroke="#1f2a37" stroke-width="2.5" stroke-linecap="round"/>` +
  `<path d="M30 70H12M30 76l-16 4M80 70h18M80 76l16 4" stroke="#7a4a2e" stroke-width="2" stroke-linecap="round"/>` +
  blush(30, 66) + blush(80, 66),
);

const knight = draw(k =>
  `<path d="M26 77l-8 26h20l10-22 9 22h21l-9-28" fill="${k.lin('#485774')}" ${ol('#485774')}/>
   <path d="M22 48l-9 42 63-3-8-38" fill="${k.lin('#c94054')}" ${ol('#982d43')}/>
   <rect x="27" y="53" width="45" height="35" rx="13" fill="${k.lin('#a2b5d3')}" ${ol('#74829d')}/>
   <path d="M45 24Q42 1 70 4L59 19Z" fill="${k.lin('#ff545d')}" ${ol('#b63846')}/>
   <rect x="20" y="17" width="59" height="46" rx="21" fill="${k.lin('#acc2df')}" ${ol('#71839f')}/>
   <path d="M32 37l43-5-2 17-36 5z" fill="#253952"/><path d="M44 38v9m11-11v9m10-12v10" stroke="#9be8fa" stroke-width="4"/>
   <path d="M78 72l10-40 6-8 2 11-12 39z" fill="${k.lin('#d9edff')}" ${ol('#7487a8',2)}/><path d="M73 67l18 5" stroke="#eab44e" stroke-width="6"/>`
);

function pack(id: string, name: string, category: Sprite['category'], paint: (k: Kit) => string): Sprite {
  return { id, name, category, width: 100, height: 100, body: draw(paint) };
}

const packArt = [
  pack('dungeon-stone', 'سنگ قلعه', 'dungeon', k => `<rect x="4" y="15" width="92" height="70" rx="10" fill="${k.lin('#758099')}" ${ol('#53566d')}/><path d="M5 48h90M37 16v32m29 0v36" stroke="#46485c" stroke-width="5"/>${shine(k,23,23,13,3)}`),
  pack('torch', 'مشعل', 'dungeon', k => `<path d="M40 52h19l-5 42h-9z" fill="${k.side('#925432')}" ${ol('#825336')}/><path d="M49 5q5 19 14 23l3-13q21 38-14 44Q20 55 35 32z" fill="${k.lin('#ff8a21')}" ${ol('#d65922')}/><path d="M49 27q18 21 4 27-16-3-4-27" fill="#fff397"/><rect x="34" y="54" width="32" height="9" rx="4" fill="${k.lin('#8393a7')}"/>`),
  pack('skeleton', 'اسکلت', 'dungeon', k => `<path d="M50 51v26m-18-17 18 6 18-6m-32 11 14 4 13-4m-14 7-15 15m16-15 14 15M32 60 21 76m46-16 13 15" stroke="#decfb0" stroke-width="8" stroke-linecap="round"/><path d="M23 32q0-27 28-27t27 27q0 16-14 18l-4 8H41l-4-8q-14-3-14-18z" fill="${k.sphere('#f4e5c8')}" ${ol('#ae9b83')}/><ellipse cx="39" cy="33" rx="8" ry="9" fill="#413b56"/><ellipse cx="63" cy="33" rx="8" ry="9" fill="#413b56"/><path d="m51 41-4 7h8z" fill="#554355"/>`),
  pack('chest', 'صندوق گنج', 'dungeon', k => `<rect x="7" y="29" width="86" height="56" rx="12" fill="${k.lin('#97522c')}" ${ol('#754524')}/><path d="M8 51q0-30 18-30h48q17 0 18 30z" fill="${k.lin('#d58137')}" ${ol('#815330')}/><path d="M23 24v55m54-55v55" stroke="#edb746" stroke-width="8"/><rect x="42" y="44" width="16" height="19" rx="4" fill="#ffda62"/><circle cx="50" cy="52" r="3"/>`),
  pack('space-ship', 'سفینه', 'space', k => `<path d="M36 66 13 81l8-25 17-13m26 23 23 15-8-25-17-13" fill="${k.lin('#6566e4')}" ${ol('#4a4f9b')}/><path d="M39 73l11 23 12-23" fill="#ffad38"/><path d="M50 5q25 22 20 64l-9 9H39l-9-9Q25 28 50 5z" fill="${k.lin('#bce3ee')}" ${ol('#53709c')}/><ellipse cx="50" cy="40" rx="12" ry="16" fill="${k.sphere('#3eb6f3')}" ${ol('#396aad')}/>`),
  pack('asteroid', 'سیارک', 'space', k => `<path d="m12 28 22-16 31-5 22 24 7 27-16 26-38 7-30-23z" fill="${k.sphere('#948299')}" ${ol('#6d627c')}/><g fill="#62586f"><ellipse cx="35" cy="37" rx="11" ry="8"/><circle cx="66" cy="58" r="13"/><circle cx="35" cy="70" r="5"/></g>`),
  pack('alien', 'موجود فضایی', 'space', k => `<path d="M14 52q-6-40 36-41t36 41Q70 81 50 92 27 79 14 52Z" fill="${k.sphere('#80d86a')}" ${ol('#4a915c')}/>${eye(k,34,46,13,'#945ad8')}${eye(k,66,46,13,'#945ad8')}${smile(50,68,6)}`),
  pack('mushroom', 'قارچ', 'forest', k => `<path d="M41 48h19l9 39q-19 10-39-1z" fill="${k.lin('#ead5b2')}" ${ol('#b19579')}/><path d="M5 57Q24-8 64 14q18 8 31 42-39 13-90 1z" fill="${k.lin('#ed534a')}" ${ol('#ad4239')}/><g fill="#ffedd8"><ellipse cx="34" cy="36" rx="8" ry="5"/><circle cx="61" cy="27" r="4"/><ellipse cx="71" cy="46" rx="10" ry="6"/></g>`),
  pack('log', 'کنده‌ی درخت', 'forest', k => `<path d="M18 34l60-17q16 1 17 25t-10 25L25 85z" fill="${k.lin('#936036')}" ${ol('#734427')}/><path d="m32 44 52-17m-50 34 54-17" stroke="#683e29" stroke-width="4"/><ellipse cx="23" cy="60" rx="18" ry="25" fill="${k.lin('#e2ad72')}" ${ol('#925938')}/><ellipse cx="23" cy="60" rx="9" ry="15" fill="none" stroke="#a87043" stroke-width="3"/>`),
  pack('fox', 'روباه', 'forest', k => `<path d="m11 52 1-42 27 16q12-4 23 0l26-16 1 43-15 23-24 15-25-16z" fill="${k.sphere('#ef863b')}" ${ol('#ad5c32')}/><path d="m20 20 2 21 10-11m46-10-10 10 11 11" fill="#693b3c"/><path d="M14 54q23 1 36 17 14-16 36-17-14 27-36 36-23-10-36-36" fill="#fff0d7"/>${eye(k,35,48,8)}${eye(k,65,48,8)}<path d="M43 68h14l-7 8z" fill="#35303b"/>`),
];

export const ART_SPRITES: Sprite[] = [
  // ── Characters ──
  { id: 'bird', name: 'پرنده', category: 'character', width: 120, height: 100, body: bird(62), frames: [bird(42)] },
  character('hero', 'آدمک', 100, 110, hero([20, 89], [56, 89]), [hero([12, 87], [62, 91]), hero([28, 91], [50, 87])]),
  character('robot', 'ربات', 100, 110, robot([22, 90], [54, 90]), [robot([14, 88], [60, 91]), robot([30, 91], [48, 88])]),
  character('cat', 'گربه', 110, 100, cat),
  character('knight', 'شوالیه', 100, 110, knight),
  ...packArt,
  {
    id: 'ball', name: 'توپ', category: 'character', width: 100, height: 100,
    body: draw((k) =>
      `<circle cx="50" cy="50" r="44" fill="${k.sphere('#ff4d5e')}" ${ol('#c41c33')}/>` +
      `<path d="M8 44Q50 70 92 44L91 60Q50 86 9 60Z" fill="${k.lin('#ffffff', 0.2, 0.15)}" stroke="#c41c33" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<circle cx="50" cy="66" r="6" fill="#ffd23f" stroke="#c41c33" stroke-width="2"/>` +
      shine(k, 34, 26, 18, 9) + glint(70, 24, 6),
    ),
  },
  {
    id: 'rocket', name: 'موشک', category: 'character', width: 80, height: 130,
    body: draw((k) =>
      `<path d="M26 98Q40 140 54 98Z" fill="${k.radial([[0, '#fff6a8'], [0.45, '#ffb020'], [1, '#ff4d1f', 0]], 0.5, 0.1, 0.9)}" filter="${k.glow(3)}"/>` +
      `<path d="M14 92 4 118l22-10ZM66 92l10 26-22-10Z" fill="${k.lin('#ff4d5e')}" ${ol('#c41c33', 3.5)}/>` +
      `<path d="M40 6q32 34 23 96H17Q8 40 40 6z" fill="${k.side('#e9eef5')}" ${ol('#8fa3b8', 4)}/>` +
      `<path d="M40 6q13 14 19 30H21Q27 20 40 6z" fill="${k.lin('#ff4d5e')}" ${ol('#c41c33', 3)}/>` +
      `<circle cx="40" cy="56" r="13" fill="#b9c6d3" ${ol('#8fa3b8', 3)}/><circle cx="40" cy="56" r="9" fill="${k.radial([[0, '#b8f3ff'], [0.6, '#2fa9e0'], [1, '#13537a']], 0.35, 0.3, 0.8)}"/>` +
      shine(k, 36, 52, 5, 2.5, -30, 0.9) +
      `<rect x="20" y="82" width="40" height="7" rx="3.5" fill="#ff4d5e" fill-opacity="0.9"/>` +
      shine(k, 28, 46, 4, 16, 5, 0.6),
    ),
  },
  {
    id: 'car', name: 'ماشین', category: 'character', width: 140, height: 80,
    body: draw((k) => {
      const wheel = (x: number) => `<circle cx="${x}" cy="58" r="16" fill="${k.radial([[0, '#4a525c'], [1, '#14181d']], 0.4, 0.35, 0.7)}" stroke="#0b0d10" stroke-width="3"/><circle cx="${x}" cy="58" r="7.5" fill="${k.lin('#e3e9ef')}" stroke="#8a99ab" stroke-width="2"/>`;
      return (
        `<path d="M8 56V40q0-9 10-9h15l15-21h44l17 21h15q10 0 10 10v15z" fill="${k.lin('#ff3b47', 0.38, 0.32)}" ${ol('#b3121f', 4)}/>` +
        `<path d="M54 15h32l11 16H45z" fill="${k.grad([[0, '#d9f4ff'], [1, '#4aa6d6']])}" stroke="#2b6f97" stroke-width="2.5" stroke-linejoin="round"/>` +
        `<path d="M58 18l8 0-10 12h-6z" fill="#ffffff" fill-opacity="0.6"/>` +
        `<rect x="16" y="35" width="108" height="5" rx="2.5" fill="#ffffff" fill-opacity="0.45"/>` +
        `<circle cx="126" cy="44" r="4" fill="#fff6a8" filter="${k.glow(2)}"/>` +
        wheel(38) + wheel(104)
      );
    }),
  },
  {
    id: 'fish', name: 'ماهی', category: 'character', width: 130, height: 90,
    body: draw((k) =>
      `<path d="M36 46 6 16v60z" fill="${k.lin('#ff8c2b')}" ${ol('#c75b10')}/>` +
      `<path d="M60 14q14-14 30 4" fill="${k.lin('#ffb347')}" ${ol('#c75b10', 3)}/>` +
      `<ellipse cx="76" cy="46" rx="48" ry="34" fill="${k.sphere('#ff9a3c')}" ${ol('#c75b10')}/>` +
      `<ellipse cx="80" cy="62" rx="30" ry="12" fill="#fff1d6" fill-opacity="0.65"/>` +
      `<path d="M56 30q8 16 0 32M66 26q8 20 0 40" fill="none" stroke="#e0701f" stroke-width="3" stroke-opacity="0.7" stroke-linecap="round"/>` +
      shine(k, 70, 26, 18, 7) +
      eye(k, 100, 40, 10, '#1f6fd6') + `<path d="M112 56q6 2 6 6" fill="none" stroke="#7a2e0f" stroke-width="3" stroke-linecap="round"/>`,
    ),
  },

  // ── Enemies and hazards ──
  {
    id: 'slime', name: 'لجن', category: 'enemy', width: 110, height: 80,
    body: draw((k) =>
      `<path d="M6 74Q2 10 55 8t49 66q-8 4-14-2-6 6-12 0-8 6-14 0-8 6-14 0-8 6-14 0-8 6-14 0Q10 78 6 74z" fill="${k.radial([[0, '#b6f7a0'], [0.5, '#4cd964'], [1, '#1f8a3a']], 0.4, 0.3, 0.8)}" ${ol('#1f8a3a', 4)}/>` +
      shine(k, 34, 24, 16, 7) + `<circle cx="80" cy="28" r="4" fill="#ffffff" fill-opacity="0.7"/>` +
      angry(k, 38, 44, 10, '#e03131', true) + angry(k, 72, 44, 10, '#e03131', false) +
      `<path d="M46 62q9 6 18 0" fill="none" stroke="#14532d" stroke-width="3.5" stroke-linecap="round"/><path d="M50 63l3 5 3-4" fill="#ffffff"/>`,
    ),
  },
  {
    id: 'ghost', name: 'روح', category: 'enemy', width: 100, height: 110,
    body: draw((k) =>
      `<path d="M12 102V50Q12 10 50 10t38 40v52l-13-11-12 11-13-11-13 11-12-11z" fill="#cfc4ff" fill-opacity="0.5" filter="${k.glow(5)}"/>` +
      `<path d="M12 102V50Q12 10 50 10t38 40v52l-13-11-12 11-13-11-13 11-12-11z" fill="${k.grad([[0, '#ffffff'], [1, '#d7cffb']])}" ${ol('#8f7fd6', 3.5)}/>` +
      shine(k, 34, 26, 14, 7) +
      `<ellipse cx="36" cy="50" rx="8" ry="11" fill="#1f1640"/><ellipse cx="64" cy="50" rx="8" ry="11" fill="#1f1640"/>` +
      `<circle cx="34" cy="46" r="3" fill="#ffffff"/><circle cx="62" cy="46" r="3" fill="#ffffff"/>` +
      `<ellipse cx="50" cy="74" rx="8" ry="6" fill="#1f1640"/>` + blush(26, 64) + blush(74, 64),
    ),
  },
  {
    id: 'bat', name: 'خفاش', category: 'enemy', width: 150, height: 80,
    body: draw((k) =>
      `<path d="M56 30 8 10q4 26 22 34-10 8-6 22 18-12 34-8zM94 30l48-20q-4 26-22 34 10 8 6 22-18-12-34-8z" fill="${k.lin('#7d4ee6', 0.3, 0.35)}" ${ol('#3d1f8a', 3.5)}/>` +
      `<path d="M50 36 22 22M50 44 30 52M100 36l28-14M100 44l20 8" stroke="#3d1f8a" stroke-width="2.5" stroke-opacity="0.6" stroke-linecap="round"/>` +
      `<path d="M58 22 54 6l14 10M92 22l4-16-14 10" fill="${k.lin('#8f5ff0')}" ${ol('#3d1f8a', 3)}/>` +
      `<circle cx="75" cy="42" r="28" fill="${k.sphere('#8f5ff0')}" ${ol('#3d1f8a', 3.5)}/>` +
      shine(k, 64, 26, 10, 5) +
      `<circle cx="65" cy="40" r="6" fill="#ff3b47" filter="${k.glow(2)}"/><circle cx="85" cy="40" r="6" fill="#ff3b47" filter="${k.glow(2)}"/>` +
      `<path d="M66 54l3 9 4-8 4 8 3-9z" fill="#ffffff" stroke="#3d1f8a" stroke-width="1.5" stroke-linejoin="round"/>`,
    ),
  },
  {
    id: 'spikeball', name: 'گوی خاردار', category: 'enemy', width: 100, height: 100,
    body: draw((k) =>
      `<path d="M50 2l8 20 18-12-2 22 22 2-14 16 14 16-22 2 2 22-18-12-8 20-8-20-18 12 2-22-22-2 14-16L4 34l22-2-2-22 18 12z" fill="${k.lin('#aab6c4', 0.4, 0.4)}" ${ol('#4b5868', 3.5)}/>` +
      `<circle cx="50" cy="50" r="24" fill="${k.sphere('#6d7b8c')}" ${ol('#3b4654', 3)}/>` +
      angry(k, 42, 50, 6, '#ff3b47', true) + angry(k, 58, 50, 6, '#ff3b47', false) +
      shine(k, 40, 36, 9, 4),
    ),
  },
  {
    id: 'spikes', name: 'تیغ', category: 'enemy', width: 200, height: 50,
    body: draw((k) => {
      const spikes = Array.from({ length: 9 }, (_, i) => {
        const x = 4 + i * 21.5;
        return `<path d="M${x} 42L${x + 11} 4L${x + 11} 42Z" fill="${k.lin('#eef3f8', 0.5, 0.1)}"/><path d="M${x + 11} 4L${x + 22} 42H${x + 11}Z" fill="${k.lin('#8a99ab', 0.1, 0.3)}"/><path d="M${x} 42L${x + 11} 4L${x + 22} 42" fill="none" ${ol('#5b6b80', 2.5)}/>`;
      }).join('');
      return spikes + `<rect x="2" y="40" width="196" height="9" rx="3" fill="${k.lin('#5b6b80')}" ${ol('#3b4654', 2.5)}/>`;
    }),
  },
  {
    id: 'bomb', name: 'بمب', category: 'enemy', width: 100, height: 110,
    body: draw((k) =>
      `<path d="M60 26q4-14 20-14" fill="none" stroke="#7a5230" stroke-width="5" stroke-linecap="round"/>` +
      `<g filter="${k.glow(3)}"><path d="M82 2l4 8 8-2-4 8 6 6-9 1-1 9-6-7-8 4 3-9-7-5 9-2z" fill="#ffd23f"/></g>${glint(84, 12, 4)}` +
      `<rect x="40" y="20" width="22" height="16" rx="4" fill="${k.lin('#9aa7b6')}" ${ol('#4b5868', 3)}/>` +
      `<circle cx="50" cy="66" r="38" fill="${k.radial([[0, '#5a6577'], [0.5, '#2a313d'], [1, '#0d1015']], 0.35, 0.3, 0.8)}" stroke="#05070a" stroke-width="3"/>` +
      shine(k, 36, 48, 16, 8, -30, 0.75) + glint(30, 44, 4),
    ),
  },
  {
    id: 'ufo', name: 'بشقاب‌پرنده', category: 'enemy', width: 140, height: 90,
    body: draw((k) =>
      `<path d="M40 46q0-38 30-38t30 38z" fill="${k.grad([[0, '#d6fbff', 0.9], [1, '#4fd1e8', 0.75]])}" stroke="#2b8fa8" stroke-width="3"/>` +
      `<ellipse cx="70" cy="36" rx="10" ry="12" fill="${k.sphere('#7be07b')}"/><circle cx="66" cy="34" r="3" fill="#0d1117"/><circle cx="74" cy="34" r="3" fill="#0d1117"/>` +
      shine(k, 58, 20, 8, 4) +
      `<ellipse cx="70" cy="54" rx="64" ry="21" fill="${k.lin('#9b6bff', 0.35, 0.35)}" ${ol('#4b23a8', 3.5)}/>` +
      `<ellipse cx="70" cy="49" rx="54" ry="7" fill="#ffffff" fill-opacity="0.3"/>` +
      `<g filter="${k.glow(2.5)}"><circle cx="30" cy="58" r="5" fill="#ffe066"/><circle cx="70" cy="64" r="5" fill="#ffe066"/><circle cx="110" cy="58" r="5" fill="#ffe066"/></g>`,
    ),
  },
  {
    id: 'cactus', name: 'کاکتوس', category: 'enemy', width: 90, height: 130,
    body: draw((k) =>
      `<path d="M32 126V30q0-22 14-22t14 22v96zM32 80H18q-12 0-12-14V44q0-8 7-8t7 8v18h12zM60 94h12q12 0 12-14V62q0-8-7-8t-7 8v14H60z" fill="${k.side('#3fae49')}" ${ol('#1f6b2a', 3.5)}/>` +
      `<path d="M46 16v104M38 30v90M54 30v90" stroke="#7ddc7f" stroke-width="2" stroke-opacity="0.55"/>` +
      `<path d="M30 50l-5-2M62 46l5-2M30 70l-5 1M62 74l5 1M30 96l-5-1M62 106l5 1M12 50l-4-2M84 70l4-2" stroke="#e9f7d0" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="46" cy="9" r="7" fill="${k.sphere('#ff6fa5')}" ${ol('#c2185b', 2)}/>`,
    ),
  },

  // ── Prizes and things ──
  {
    id: 'coin', name: 'سکه', category: 'item', width: 100, height: 100,
    body: draw((k) =>
      `<circle cx="50" cy="50" r="44" fill="${k.lin('#ffcf33', 0.45, 0.3)}" ${ol('#b8860b', 4)}/>` +
      `<circle cx="50" cy="50" r="33" fill="${k.grad([[0, '#f2a900'], [1, '#ffe27a']])}" stroke="#d99a00" stroke-width="3"/>` +
      `<path d="M50 30l6 12 13 2-9.5 9 2.5 13-12-6.5-12 6.5 2.5-13-9.5-9 13-2z" fill="${k.lin('#fff3b0', 0.5, 0.15)}" stroke="#d99a00" stroke-width="2" stroke-linejoin="round"/>` +
      shine(k, 34, 24, 16, 7) + glint(72, 26, 7),
    ),
  },
  {
    id: 'star', name: 'ستاره', category: 'item', width: 100, height: 100,
    body: draw((k) =>
      `<path d="M50 5l13.5 28 31 4.5-22.5 21.5 5.5 31L50 75 22.5 90l5.5-31L5.5 37.5l31-4.5z" fill="${k.lin('#ffd23f', 0.45, 0.25)}" ${ol('#d98e04', 4)}/>` +
      `<path d="M50 5v70l27.5 15-5.5-31L94.5 37.5l-31-4.5z" fill="#e69500" fill-opacity="0.28"/>` +
      shine(k, 40, 34, 10, 5, -20, 0.8) + glint(70, 22, 7),
    ),
  },
  {
    id: 'gem', name: 'الماس', category: 'item', width: 100, height: 100,
    body: draw(() =>
      `<path d="M26 12h48l20 26-44 52L6 38z" fill="#22a9d6"/>` +
      `<path d="M26 12h48l-10 26H36z" fill="#a5f3ff"/><path d="M26 12 36 38H6z" fill="#64dcf2"/><path d="M74 12l20 26H64z" fill="#3ec3e8"/>` +
      `<path d="M6 38h30l14 52z" fill="#3cc0e6"/><path d="M36 38h28L50 90z" fill="#7fe6f7"/><path d="M64 38h30L50 90z" fill="#1689b8"/>` +
      `<path d="M26 12h48l20 26-44 52L6 38z" fill="none" stroke="#0f6f99" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M6 38h88M26 12l10 26 14 52 14-52 10-26" fill="none" stroke="#0f6f99" stroke-width="1.8" stroke-opacity="0.6"/>` +
      glint(40, 24, 7) + glint(76, 50, 4),
    ),
  },
  {
    id: 'heart', name: 'قلب', category: 'item', width: 100, height: 90,
    body: draw((k) =>
      `<path d="M50 84Q6 52 6 30 6 8 28 8q14 0 22 14Q58 8 72 8q22 0 22 22 0 22-44 54z" fill="${k.radial([[0, '#ff8fa0'], [0.5, '#ff3b5c'], [1, '#b3122f']], 0.35, 0.3, 0.8)}" ${ol('#a10f2b', 4)}/>` +
      shine(k, 28, 24, 12, 7, -30) + glint(74, 24, 5),
    ),
  },
  {
    id: 'key', name: 'کلید', category: 'item', width: 130, height: 60,
    body: draw((k) =>
      `<path d="M56 24h66v14h-12v12H98V38H86v10H74V38H56z" fill="${k.lin('#ffcf33')}" ${ol('#b8860b', 3.5)}/>` +
      `<circle cx="32" cy="30" r="24" fill="${k.sphere('#ffd23f')}" ${ol('#b8860b', 3.5)}/>` +
      `<circle cx="29" cy="30" r="8" fill="#a07000" fill-opacity="0.35" stroke="#b8860b" stroke-width="3"/>` +
      shine(k, 24, 16, 10, 5) + `<rect x="60" y="26" width="58" height="4" rx="2" fill="#fff4b0" fill-opacity="0.8"/>`,
    ),
  },
  {
    id: 'apple', name: 'سیب', category: 'item', width: 90, height: 100,
    body: draw((k) =>
      `<path d="M46 28V10" stroke="#6b4423" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M48 16q14-14 30-6-10 16-30 6z" fill="${k.lin('#5fd35f')}" ${ol('#2f8a35', 3)}/>` +
      `<path d="M46 28q-14-10-28 0T6 60q4 30 26 34 8 2 14-2 6 4 14 2 22-4 26-34 2-22-12-32t-28 0z" fill="${k.radial([[0, '#ff8a8a'], [0.5, '#ff2d48'], [1, '#a5112a']], 0.35, 0.3, 0.85)}" ${ol('#9b0f26', 4)}/>` +
      shine(k, 26, 40, 9, 14, 20) + glint(66, 40, 5),
    ),
  },
  {
    id: 'flag', name: 'پرچم پایان', category: 'item', width: 90, height: 130,
    body: draw((k) => {
      const checks = k.def((id) => `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#ffffff"/><rect width="8" height="8" fill="#1f2a37"/><rect x="8" y="8" width="8" height="8" fill="#1f2a37"/></pattern>`);
      return (
        `<path d="M24 12q16-6 30 0t32 0v40q-16 6-32 0t-30 0z" fill="url(#${checks})" stroke="#1f2a37" stroke-width="3" stroke-linejoin="round"/>` +
        `<path d="M24 12q16-6 30 0t32 0v40q-16 6-32 0t-30 0z" fill="${k.grad([[0, '#ffffff', 0.35], [0.5, '#ffffff', 0], [1, '#000000', 0.2]], 0, 0, 1, 0)}"/>` +
        `<rect x="17" y="8" width="7" height="116" rx="3.5" fill="${k.side('#c3cdd8')}" stroke="#5b6b80" stroke-width="2.5"/>` +
        `<circle cx="20.5" cy="8" r="7" fill="${k.sphere('#ffd23f')}" stroke="#b8860b" stroke-width="2.5"/>` +
        `<ellipse cx="20" cy="124" rx="16" ry="5" fill="${k.lin('#8a99ab')}" stroke="#5b6b80" stroke-width="2.5"/>`
      );
    }),
  },
  {
    id: 'bullet', name: 'تیر', category: 'item', width: 70, height: 30,
    body: draw((k) =>
      `<path d="M24 5h16q24 0 26 10-2 10-26 10H24z" fill="${k.lin('#e8813c', 0.45, 0.3)}" ${ol('#9c4512', 3)}/>` +
      `<rect x="5" y="5" width="22" height="20" rx="3" fill="${k.lin('#ffcf55', 0.45, 0.3)}" ${ol('#a0761a', 3)}/>` +
      `<rect x="8" y="8" width="52" height="4" rx="2" fill="#ffffff" fill-opacity="0.55"/>`,
    ),
  },
  {
    id: 'shield', name: 'سپر', category: 'item', width: 90, height: 100,
    body: draw((k) =>
      `<path d="M45 4 84 17v31q0 32-39 48Q6 80 6 48V17z" fill="${k.lin('#dfe6ee', 0.5, 0.3)}" ${ol('#6d7b8c', 3.5)}/>` +
      `<path d="M45 14 74 24v24q0 24-29 37Q16 72 16 48V24z" fill="${k.lin('#2f7cf6', 0.35, 0.35)}" stroke="#1546a0" stroke-width="2.5"/>` +
      `<path d="M45 30l5 10 11 1.5-8 7.5 2 11-10-5.5-10 5.5 2-11-8-7.5 11-1.5z" fill="${k.lin('#ffd23f')}" stroke="#b8860b" stroke-width="2" stroke-linejoin="round"/>` +
      shine(k, 30, 26, 10, 6, -25, 0.7),
    ),
  },
  {
    id: 'candy', name: 'آب‌نبات', category: 'item', width: 100, height: 80,
    body: draw((k) =>
      `<path d="M28 40 4 18v44zM72 40l24-22v44z" fill="${k.lin('#ff8cc6')}" ${ol('#c2185b', 3)}/>` +
      `<circle cx="50" cy="40" r="28" fill="${k.sphere('#ff4f9a')}" ${ol('#c2185b', 3.5)}/>` +
      `<path d="M30 30q20-12 40 6M26 46q24 8 46-8M34 62q14-4 30-20" fill="none" stroke="#ffffff" stroke-width="5" stroke-opacity="0.85" stroke-linecap="round"/>` +
      shine(k, 40, 24, 10, 5) + glint(66, 22, 5),
    ),
  },

  // ── Board games ──
  {
    id: 'card', name: 'پشت کارت', category: 'board', width: 100, height: 100,
    body: draw((k) =>
      `<rect x="5" y="8" width="90" height="88" rx="16" fill="#3a1f8a"/>` +
      `<rect x="5" y="4" width="90" height="88" rx="16" fill="${k.lin('#7b4fe0', 0.3, 0.3)}" ${ol('#3a1f8a', 3)}/>` +
      `<rect x="15" y="14" width="70" height="68" rx="10" fill="none" stroke="#ffd23f" stroke-width="3"/>` +
      `<path d="M50 26 66 48 50 70 34 48z" fill="${k.lin('#ffd23f')}" stroke="#b8860b" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<circle cx="22" cy="21" r="3" fill="#ffd23f"/><circle cx="78" cy="21" r="3" fill="#ffd23f"/><circle cx="22" cy="75" r="3" fill="#ffd23f"/><circle cx="78" cy="75" r="3" fill="#ffd23f"/>` +
      `<rect x="13" y="8" width="74" height="12" rx="6" fill="#ffffff" fill-opacity="0.22"/>`,
    ),
  },
  {
    id: 'ring', name: 'قاب انتخاب', category: 'board', width: 100, height: 100,
    body: draw((k) =>
      `<rect x="9" y="9" width="82" height="82" rx="18" fill="none" stroke="#ffd23f" stroke-width="9" filter="${k.glow(3)}"/>` +
      `<rect x="9" y="9" width="82" height="82" rx="18" fill="none" stroke="#fff6c2" stroke-width="3"/>`,
    ),
  },
  { id: 'tile-empty', name: 'خانه‌ی خالی', category: 'board', width: 100, height: 100, body: draw((k) => tile(k)) },
  {
    id: 'tile-x', name: 'ضربدر', category: 'board', width: 100, height: 100,
    body: draw((k) => tile(k, `<g filter="${k.drop()}"><path d="M28 26 72 70M72 26 28 70" stroke="${k.lin('#ff4d5e', 0.3, 0.2)}" stroke-width="15" stroke-linecap="round"/><path d="M30 26 70 66" stroke="#ffffff" stroke-opacity="0.35" stroke-width="4" stroke-linecap="round"/></g>`)),
  },
  {
    id: 'tile-o', name: 'دایره', category: 'board', width: 100, height: 100,
    body: draw((k) => tile(k, `<g filter="${k.drop()}"><circle cx="50" cy="48" r="23" fill="none" stroke="${k.lin('#2f7cf6', 0.35, 0.25)}" stroke-width="14"/><path d="M34 36q8-10 22-9" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="4" stroke-linecap="round"/></g>`)),
  },
  ...NUMBER_TILES,

  // ── Ground and platforms ──
  { id: 'platform', name: 'سکوی چمنی', category: 'ground', width: 240, height: 60, body: draw((k) => grassy(k, 240, 60, 22, 14)) },
  {
    id: 'ground', name: 'زمین بلند', category: 'ground', width: 720, height: 160,
    body: draw((k) => grassy(k, 720, 160, 36, 4, true)),
  },
  {
    id: 'stone', name: 'بلوک سنگی', category: 'ground', width: 100, height: 100,
    body: draw((k) =>
      `<rect x="3" y="3" width="94" height="94" rx="10" fill="${k.lin('#a9b4c0', 0.3, 0.3)}" ${ol('#55606d', 3.5)}/>` +
      `<path d="M3 50h94M50 3v47M28 50v47M72 50v47" stroke="#55606d" stroke-width="3"/>` +
      `<path d="M8 8h38v4H8zM54 8h38v4H54zM8 54h17v4H8zM32 54h37v4H32zM76 54h16v4H76z" fill="#ffffff" fill-opacity="0.35"/>` +
      `<path d="M14 30l8 6 6-4M62 76l6 6 8-3" fill="none" stroke="#55606d" stroke-width="2" stroke-opacity="0.6"/>` +
      `<ellipse cx="80" cy="40" rx="8" ry="4" fill="#6fbf5f" fill-opacity="0.75"/>`,
    ),
  },
  {
    id: 'brick', name: 'آجر', category: 'ground', width: 140, height: 60,
    body: draw((k) => {
      const brick = (x: number, y: number, w: number) => `<rect x="${x}" y="${y}" width="${w}" height="22" rx="4" fill="${k.lin('#e0623f', 0.3, 0.3)}" stroke="#8f2d17" stroke-width="2"/><rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="4" rx="2" fill="#ffffff" fill-opacity="0.3"/>`;
      return `<rect x="2" y="2" width="136" height="56" rx="6" fill="#d9cfc4" stroke="#8f2d17" stroke-width="3"/>` + brick(5, 5, 42) + brick(50, 5, 42) + brick(95, 5, 40) + brick(5, 31, 20) + brick(28, 31, 42) + brick(73, 31, 42) + brick(118, 31, 17);
    }),
  },
  {
    id: 'crate', name: 'جعبه', category: 'ground', width: 100, height: 100,
    body: draw((k) =>
      `<rect x="3" y="3" width="94" height="94" rx="8" fill="${k.lin('#c98d4f', 0.3, 0.35)}" ${ol('#6b3e19', 4)}/>` +
      `<rect x="15" y="15" width="70" height="70" fill="${k.lin('#d9a066', 0.25, 0.25)}" stroke="#6b3e19" stroke-width="3"/>` +
      `<path d="M15 33h70M15 51h70M15 69h70" stroke="#8b5a2b" stroke-width="2" stroke-opacity="0.6"/>` +
      `<path d="M18 82 82 18" stroke="${k.lin('#b97a3e')}" stroke-width="12" stroke-linecap="round"/><path d="M18 82 82 18" stroke="#6b3e19" stroke-width="2" stroke-opacity="0.5"/>` +
      `<g fill="${k.lin('#c3cdd8')}" stroke="#5b6b80" stroke-width="2"><path d="M3 22V11q0-8 8-8h11v8H11v11z"/><path d="M97 22V11q0-8-8-8H78v8h11v11z"/><path d="M3 78v11q0 8 8 8h11v-8H11V78z"/><path d="M97 78v11q0 8-8 8H78v-8h11V78z"/></g>` +
      `<rect x="8" y="6" width="84" height="5" rx="2.5" fill="#ffffff" fill-opacity="0.3"/>`,
    ),
  },
  {
    id: 'glass-block', name: 'شیشه', category: 'ground', width: 100, height: 100,
    body: draw((k) =>
      `<rect x="4" y="4" width="92" height="92" rx="6" fill="${k.lin('#bfefff', 0.15, 0.2)}" fill-opacity="0.72" ${ol('#3d8fb8', 4)}/>` +
      `<rect x="12" y="12" width="76" height="76" rx="3" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="3"/>` +
      `<path d="M20 70 70 20M34 80 80 34" stroke="#ffffff" stroke-opacity="0.7" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M16 22l8-8" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>`,
    ),
  },
  {
    id: 'stone-block', name: 'سنگ چهارگوش', category: 'ground', width: 100, height: 100,
    body: draw((k) =>
      `<rect x="3" y="3" width="94" height="94" rx="7" fill="${k.lin('#9aa3ad', 0.3, 0.35)}" ${ol('#454b52', 4)}/>` +
      `<path d="M5 36h90M5 66h90M38 5v31M70 36v30M30 66v29M76 66v29" stroke="#5c636b" stroke-width="3"/>` +
      `<path d="M10 10h22v6H10zM44 41h20v5H44zM12 71h12v5H12zM50 71h20v5H50z" fill="#ffffff" fill-opacity="0.25"/>` +
      `<circle cx="80" cy="20" r="3" fill="#5c636b"/><circle cx="20" cy="52" r="2.5" fill="#5c636b"/>`,
    ),
  },
  {
    id: 'steel-beam', name: 'تیرآهن', category: 'ground', width: 300, height: 40,
    body: draw((k) =>
      `<rect x="3" y="3" width="294" height="34" rx="5" fill="${k.lin('#b8c4cf', 0.35, 0.3)}" ${ol('#3d4752', 4)}/>` +
      `<rect x="8" y="16" width="284" height="8" fill="#7d8a97"/>` +
      `<g fill="#e6edf3" stroke="#3d4752" stroke-width="2">${[22, 70, 118, 166, 214, 262, 278].slice(0, 6).map((x) => `<circle cx="${x}" cy="11" r="3.5"/><circle cx="${x + 18}" cy="29" r="3.5"/>`).join('')}</g>` +
      `<rect x="8" y="6" width="284" height="3" rx="1.5" fill="#ffffff" fill-opacity="0.5"/>`,
    ),
  },
  {
    id: 'tnt', name: 'بشکه‌ی انفجاری', category: 'ground', width: 90, height: 110,
    body: draw((k) =>
      `<rect x="6" y="6" width="78" height="98" rx="14" fill="${k.lin('#e8442e', 0.3, 0.35)}" ${ol('#6e1208', 4)}/>` +
      `<path d="M6 30h78M6 80h78" stroke="#6e1208" stroke-width="5"/>` +
      `<rect x="16" y="40" width="58" height="30" rx="5" fill="#ffd23f" stroke="#6e1208" stroke-width="3"/>` +
      `<text x="45" y="63" font-family="Arial Black, Arial" font-weight="900" font-size="21" text-anchor="middle" fill="#6e1208">TNT</text>` +
      `<rect x="14" y="10" width="10" height="88" rx="5" fill="#ffffff" fill-opacity="0.25"/>`,
    ),
  },
  {
    id: 'cloud-step', name: 'سکوی ابری', category: 'ground', width: 200, height: 70,
    body: draw((k) =>
      `<path d="M34 64q-28 0-28-22t26-20q8-18 30-16 14-8 30 2 22-10 38 8 34-4 34 24 0 24-28 24z" fill="${k.grad([[0, '#ffffff'], [0.6, '#f2f8ff'], [1, '#b9d4ef']])}" stroke="#8fb3d9" stroke-width="3.5" stroke-linejoin="round"/>` +
      shine(k, 60, 20, 22, 6, -5, 0.9),
    ),
  },
  {
    id: 'pipe', name: 'لوله', category: 'ground', width: 110, height: 320,
    body: draw((k) =>
      `<rect x="14" y="40" width="82" height="278" fill="${k.side('#3fb950')}" stroke="#1f6b2a" stroke-width="4"/>` +
      `<rect x="4" y="4" width="102" height="44" rx="7" fill="${k.side('#4cc95c')}" stroke="#1f6b2a" stroke-width="4"/>` +
      `<rect x="24" y="52" width="9" height="262" rx="4.5" fill="#ffffff" fill-opacity="0.4"/><rect x="16" y="10" width="9" height="32" rx="4.5" fill="#ffffff" fill-opacity="0.45"/>` +
      `<rect x="14" y="48" width="82" height="7" fill="#1f6b2a" fill-opacity="0.35"/>`,
    ),
  },
  {
    id: 'ice', name: 'سکوی یخی', category: 'ground', width: 240, height: 60,
    body: draw((k) =>
      `<rect x="3" y="5" width="234" height="52" rx="12" fill="${k.grad([[0, '#e4f9ff'], [1, '#7cc8ec']])}" ${ol('#3a8fbf', 3.5)}/>` +
      `<path d="M30 54 54 6h14L44 54zM120 54l20-48h8l-20 48z" fill="#ffffff" fill-opacity="0.45"/>` +
      `<path d="M3 17Q3 5 15 5h210q12 0 12 12v2q-12 6-22 0-12 8-24 0-12 7-24 0-12 8-24 0-12 7-24 0-12 8-24 0-12 7-24 0-12 8-24 0-12 7-24 0-10 6-22-1z" fill="#ffffff" stroke="#9fd6ef" stroke-width="2"/>` +
      glint(190, 36, 6),
    ),
  },
  {
    id: 'plank', name: 'تخته‌ی چوبی', category: 'ground', width: 120, height: 30,
    body: draw((k) =>
      `<rect x="2" y="3" width="116" height="24" rx="5" fill="${k.lin('#c8894e', 0.35, 0.35)}" ${ol('#6b3e19', 3)}/>` +
      `<path d="M8 12q30-4 60 0t44 0M10 20q36 3 70-1" fill="none" stroke="#8b5a2b" stroke-width="1.6" stroke-opacity="0.7"/>` +
      `<circle cx="10" cy="15" r="2.6" fill="#4a3020"/><circle cx="110" cy="15" r="2.6" fill="#4a3020"/>` +
      `<rect x="6" y="5" width="108" height="3" rx="1.5" fill="#ffffff" fill-opacity="0.35"/>`,
    ),
  },
  {
    id: 'tire', name: 'چرخ', category: 'ground', width: 100, height: 100,
    body: draw((k) => {
      const tread = Array.from({ length: 16 }, (_, i) => `<rect x="47" y="3" width="6" height="9" rx="2" fill="#0b0d10" transform="rotate(${i * 22.5} 50 50)"/>`).join('');
      const bolts = Array.from({ length: 5 }, (_, i) => `<circle cx="50" cy="35" r="3" fill="#5b6b80" transform="rotate(${i * 72} 50 50)"/>`).join('');
      return (
        `<circle cx="50" cy="50" r="46" fill="${k.radial([[0, '#4a525c'], [0.75, '#20252b'], [1, '#0b0d10']], 0.4, 0.35, 0.65)}"/>` + tread +
        `<circle cx="50" cy="50" r="25" fill="${k.lin('#e3e9ef', 0.5, 0.35)}" stroke="#5b6b80" stroke-width="3"/>` + bolts +
        `<circle cx="50" cy="50" r="7" fill="${k.sphere('#9aa7b6')}"/>` + shine(k, 40, 38, 9, 4, -30, 0.7)
      );
    }),
  },
  {
    id: 'peg', name: 'میخ فلزی', category: 'ground', width: 60, height: 60,
    body: draw((k) =>
      `<circle cx="30" cy="30" r="26" fill="${k.sphere('#b6c0ca')}" ${ol('#5b6b80', 3)}/>` +
      `<path d="M20 30h20M30 20v20" stroke="#5b6b80" stroke-width="5" stroke-linecap="round"/>` +
      shine(k, 22, 18, 9, 4),
    ),
  },
  {
    id: 'belt', name: 'تسمه', category: 'ground', width: 420, height: 44,
    body: draw((k) => {
      const marks = Array.from({ length: 21 }, (_, i) => `<path d="M${34 + i * 17.5} 8l-7 28" stroke="#5b6470" stroke-width="3" stroke-linecap="round"/>`).join('');
      const roller = (x: number) => `<circle cx="${x}" cy="22" r="16" fill="${k.sphere('#c3cdd8')}" stroke="#4b5868" stroke-width="3"/><circle cx="${x}" cy="22" r="5" fill="#4b5868"/><path d="M${x - 9} 22h18" stroke="#4b5868" stroke-width="2"/>`;
      return `<rect x="3" y="3" width="414" height="38" rx="19" fill="${k.lin('#3a4049', 0.25, 0.4)}" ${ol('#1c2026', 3.5)}/>` + marks + roller(24) + roller(396) +
        `<rect x="44" y="5" width="332" height="4" rx="2" fill="#ffffff" fill-opacity="0.22"/>` +
        `<g fill="#ffd23f">${[120, 210, 300].map((x) => `<path d="M${x} 16l10 6-10 6z"/>`).join('')}</g>`;
    }),
  },
  {
    id: 'rock', name: 'سنگ گرد', category: 'item', width: 100, height: 100,
    body: draw((k) =>
      `<path d="M50 4Q78 4 90 26 99 44 94 64 88 88 62 95 40 100 22 90 4 78 5 54 6 30 24 14 36 4 50 4z" fill="${k.radial([[0, '#b9c3cc'], [0.5, '#7d8994'], [1, '#3f4851']], 0.36, 0.3, 0.8)}" ${ol('#4a535c', 4)}/>` +
      `<path d="M30 60q8 6 18 2M60 30q10 2 14 12M58 74l8-4" fill="none" stroke="#4a535c" stroke-width="3" stroke-opacity="0.55" stroke-linecap="round"/>` +
      `<ellipse cx="70" cy="62" rx="9" ry="6" fill="#5a646d" fill-opacity="0.6"/><ellipse cx="34" cy="38" rx="5" ry="4" fill="#5a646d" fill-opacity="0.5"/>` +
      shine(k, 36, 24, 18, 8, -25, 0.75) + glint(28, 20, 4),
    ),
  },
  {
    id: 'slingshot', name: 'تیرکمان', category: 'item', width: 150, height: 240,
    body: draw((k) => {
      const wood = k.side('#a0612f');
      return (
        `<ellipse cx="75" cy="234" rx="34" ry="6" fill="#000" fill-opacity="0.25"/>` +
        // A wide fork on a thick handle, so a stone fits between its arms.
        `<path d="M64 234V138Q64 120 48 108Q20 88 14 40 12 22 24 18 36 14 40 32 46 76 70 92Q75 95 80 92 104 76 110 32 114 14 126 18 138 22 136 40 130 88 102 108 86 120 86 138V234z" fill="${wood}" ${ol('#5e3415', 4)}/>` +
        `<path d="M70 146v82M24 44q4 36 26 54M126 44q-4 36-26 54" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="3.5" stroke-linecap="round"/>` +
        `<path d="M66 170q9 5 18 0M66 196q9 5 18 0" fill="none" stroke="#5e3415" stroke-width="2.5" stroke-opacity="0.6"/>` +
        `<rect x="58" y="118" width="34" height="20" rx="6" fill="${k.lin('#d94f2b')}" stroke="#7a2410" stroke-width="2.5"/>` +
        `<path d="M60 125h30M60 131h30" stroke="#7a2410" stroke-width="1.5" stroke-opacity="0.6"/>` +
        `<rect x="14" y="26" width="24" height="14" rx="5" transform="rotate(-8 26 33)" fill="#4a2c1a"/><rect x="112" y="26" width="24" height="14" rx="5" transform="rotate(8 124 33)" fill="#4a2c1a"/>`
      );
    }),
  },
  {
    id: 'water', name: 'آب', category: 'scenery', width: 200, height: 200,
    body: draw((k) =>
      `<rect x="0" y="10" width="200" height="190" fill="${k.grad([[0, '#5fd4ff', 0.85], [0.4, '#1e9bdc', 0.85], [1, '#0b4f8a', 0.95]])}"/>` +
      `<path d="M0 12q25-10 50 0t50 0 50 0 50 0V24q-25 8-50 0t-50 0-50 0-50 0z" fill="#d9f6ff" fill-opacity="0.9"/>` +
      `<path d="M20 60q30-8 60 0M110 90q30-8 60 0M40 130q30-8 60 0M120 165q25-6 50 0" fill="none" stroke="#bff0ff" stroke-width="3" stroke-opacity="0.45" stroke-linecap="round"/>` +
      `<circle cx="40" cy="100" r="5" fill="none" stroke="#e6fbff" stroke-opacity="0.6" stroke-width="2"/><circle cx="150" cy="140" r="4" fill="none" stroke="#e6fbff" stroke-opacity="0.6" stroke-width="2"/><circle cx="90" cy="170" r="3" fill="none" stroke="#e6fbff" stroke-opacity="0.6" stroke-width="2"/>`,
    ),
  },

  // ── Scenery ──
  {
    id: 'cloud', name: 'ابر', category: 'scenery', width: 200, height: 110,
    body: draw((k) =>
      `<path d="M44 102q-38 0-38-30 0-28 32-28 4-34 40-36 30-2 42 22 20-10 38 4t10 32q26 4 22 22-4 14-24 14z" fill="${k.grad([[0, '#ffffff'], [0.55, '#f4f9ff'], [1, '#bcd6f0']])}" stroke="#9fc0e2" stroke-width="3.5" stroke-linejoin="round"/>` +
      shine(k, 80, 28, 30, 10, -8, 0.9),
    ),
  },
  {
    id: 'tree', name: 'درخت', category: 'scenery', width: 150, height: 210,
    body: draw((k) =>
      `<path d="M62 206q4-40 0-82h26q-4 42 0 82z" fill="${k.side('#8b5a3c')}" ${ol('#4a2e1a', 3.5)}/>` +
      `<path d="M70 140v50M80 150v40" stroke="#5e3a24" stroke-width="2" stroke-opacity="0.6"/>` +
      `<circle cx="42" cy="88" r="36" fill="${k.sphere('#3e9b44')}" ${ol('#1f5f28', 3.5)}/>` +
      `<circle cx="108" cy="90" r="34" fill="${k.sphere('#3e9b44')}" ${ol('#1f5f28', 3.5)}/>` +
      `<circle cx="75" cy="56" r="48" fill="${k.sphere('#4fb853')}" ${ol('#1f5f28', 3.5)}/>` +
      `<circle cx="75" cy="112" r="34" fill="${k.sphere('#46a84b')}" ${ol('#1f5f28', 3.5)}/>` +
      shine(k, 58, 30, 22, 10) +
      `<circle cx="50" cy="70" r="5" fill="${k.sphere('#ff4d5e')}"/><circle cx="100" cy="80" r="5" fill="${k.sphere('#ff4d5e')}"/><circle cx="82" cy="40" r="5" fill="${k.sphere('#ff4d5e')}"/>`,
    ),
  },
  {
    id: 'bush', name: 'بوته', category: 'scenery', width: 170, height: 90,
    body: draw((k) =>
      `<circle cx="40" cy="60" r="30" fill="${k.sphere('#2f8a3a')}" ${ol('#16521f', 3)}/>` +
      `<circle cx="132" cy="60" r="30" fill="${k.sphere('#2f8a3a')}" ${ol('#16521f', 3)}/>` +
      `<circle cx="86" cy="48" r="40" fill="${k.sphere('#3ea64a')}" ${ol('#16521f', 3)}/>` +
      `<rect x="14" y="70" width="146" height="18" rx="9" fill="#2a7d34"/>` +
      shine(k, 72, 24, 18, 7) +
      `<circle cx="60" cy="50" r="4.5" fill="${k.sphere('#ff3b6b')}"/><circle cx="104" cy="40" r="4.5" fill="${k.sphere('#ff3b6b')}"/><circle cx="130" cy="58" r="4.5" fill="${k.sphere('#ff3b6b')}"/>`,
    ),
  },
  {
    id: 'hill', name: 'تپه', category: 'scenery', width: 420, height: 200,
    body: draw((k) =>
      `<path d="M4 210Q60 10 210 10t206 200z" fill="${k.grad([[0, '#8ee66a'], [0.6, '#52b84a'], [1, '#2f8a35']])}" ${ol('#2a7a30', 3.5)}/>` +
      `<path d="M100 110q30-60 110-80" fill="none" stroke="#c8f7a0" stroke-width="12" stroke-opacity="0.55" stroke-linecap="round"/>` +
      `<circle cx="150" cy="120" r="5" fill="#ffffff"/><circle cx="160" cy="128" r="5" fill="#ffd23f"/><circle cx="260" cy="90" r="5" fill="#ff6fa5"/><circle cx="300" cy="140" r="5" fill="#ffffff"/>`,
    ),
  },
  {
    id: 'mountain', name: 'کوه', category: 'scenery', width: 340, height: 240,
    body: draw((k) =>
      `<path d="M4 236 150 10l186 226z" fill="${k.grad([[0, '#a4b3c4'], [1, '#5f6f82']])}" ${ol('#3e4a59', 3.5)}/>` +
      `<path d="M150 10l186 226H180z" fill="#2a3442" fill-opacity="0.25"/>` +
      `<path d="M150 10 106 78l26-12 18 20 20-24 26 18z" fill="${k.grad([[0, '#ffffff'], [1, '#d6e4f2']])}" stroke="#9fb4c8" stroke-width="2.5" stroke-linejoin="round"/>`,
    ),
  },
  {
    id: 'sun', name: 'خورشید', category: 'scenery', width: 150, height: 150,
    body: draw((k) => {
      const rays = Array.from({ length: 12 }, (_, i) => `<path d="M75 4l7 22h-14z" fill="${k.lin('#ffcf33', 0.3, 0.1)}" transform="rotate(${i * 30} 75 75)"/>`).join('');
      return `<circle cx="75" cy="75" r="70" fill="${k.radial([[0, '#fff2a8', 0.9], [1, '#ffcf33', 0]])}"/>` + rays +
        `<circle cx="75" cy="75" r="38" fill="${k.sphere('#ffd23f')}" ${ol('#e69500', 3.5)}/>` + shine(k, 62, 60, 14, 7);
    }),
  },
  {
    id: 'moon', name: 'ماه', category: 'scenery', width: 100, height: 100,
    body: draw((k) =>
      `<circle cx="50" cy="50" r="46" fill="${k.radial([[0, '#fffbe0', 0.55], [1, '#fffbe0', 0]])}"/>` +
      `<path d="M64 10Q34 22 34 50t30 40Q22 96 12 56 6 16 64 10z" fill="${k.lin('#fff6b8', 0.4, 0.2)}" ${ol('#c9b44a', 3)}/>` +
      `<circle cx="26" cy="40" r="5" fill="#e3d27a" fill-opacity="0.7"/><circle cx="32" cy="66" r="4" fill="#e3d27a" fill-opacity="0.7"/>`,
    ),
  },

  // ── Buttons ──
  {
    id: 'btn-sword', name: 'حمله', category: 'button', width: 100, height: 100,
    body: button('#ff7a1a', () => `<path d="M68 22 74 26 46 58 40 52z" ${WHITE}/><path d="M34 52l14 14M30 66l8 8" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/><circle cx="31" cy="69" r="5" fill="#ffffff"/>`),
  },
  {
    id: 'slash', name: 'ضربه‌ی شمشیر', category: 'item', width: 120, height: 120,
    body: draw((k) =>
      `<path d="M20 18Q104 18 108 60 104 102 20 102 84 94 86 60 84 26 20 18z" fill="${k.grad([[0, '#ffffff', 0.95], [1, '#7fe8ff', 0.6]], 0, 0, 1, 0)}" filter="${k.glow(4)}"/>` +
      `<path d="M34 30Q92 34 94 60 92 86 34 90" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-opacity="0.9"/>` +
      glint(100, 60, 8),
    ),
  },
  { id: 'btn-play', name: 'شروع', category: 'button', width: 100, height: 100, body: button('#3fbf4f', () => `<path d="M40 30v38l30-19z" ${WHITE}/>`) },
  { id: 'btn-pause', name: 'مکث', category: 'button', width: 100, height: 100, body: button('#ff9f1c', () => `<rect x="33" y="30" width="12" height="38" rx="4" fill="#ffffff"/><rect x="55" y="30" width="12" height="38" rx="4" fill="#ffffff"/>`) },
  { id: 'btn-restart', name: 'دوباره', category: 'button', width: 100, height: 100, body: button('#2f7cf6', () => `<path d="M68 49a18 18 0 1 1-7-14" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/><path d="M64 20v18H46z" fill="#ffffff"/>`) },
  { id: 'btn-left', name: 'چپ', category: 'button', width: 100, height: 100, body: button('#5b6b80', () => `<path d="M60 28 32 49l28 21z" ${WHITE}/>`) },
  { id: 'btn-right', name: 'راست', category: 'button', width: 100, height: 100, body: button('#5b6b80', () => `<path d="M40 28l28 21-28 21z" ${WHITE}/>`) },
  { id: 'btn-up', name: 'پرش', category: 'button', width: 100, height: 100, body: button('#ff4d5e', () => `<path d="M28 60 50 32l22 28z" ${WHITE}/>`) },
  { id: 'btn-home', name: 'خانه', category: 'button', width: 100, height: 100, body: button('#8f5ff0', () => `<path d="M26 50 50 27l24 23v22H58V57H42v15H26z" ${WHITE}/>`) },
  { id: 'btn-sound', name: 'صدا روشن', category: 'button', width: 100, height: 100, body: button('#26c6da', () => `<path d="M26 41h12l16-14v44L38 57H26z" ${WHITE}/><path d="M62 37q8 12 0 24M70 29q14 20 0 40" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>`) },
  { id: 'btn-mute', name: 'صدا خاموش', category: 'button', width: 100, height: 100, body: button('#9fb4c0', () => `<path d="M26 41h12l16-14v44L38 57H26z" ${WHITE}/><path d="M62 39l16 20M78 39 62 59" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>`) },
  {
    id: 'btn-wide', name: 'دکمه‌ی پهن', category: 'button', width: 280, height: 96,
    body: draw((k) =>
      `<rect x="4" y="12" width="272" height="80" rx="34" fill="#1f7a2c"/>` +
      `<rect x="4" y="4" width="272" height="80" rx="34" fill="${k.lin('#3fbf4f', 0.35, 0.2)}" stroke="#1f6b2a" stroke-width="4"/>` +
      `<path d="M24 34Q28 12 60 12H220Q252 12 256 34Q240 26 140 26T24 34Z" fill="${k.grad([[0, '#ffffff', 0.7], [1, '#ffffff', 0.08]])}"/>`,
    ),
  },
  {
    id: 'btn-level', name: 'دکمه‌ی مرحله', category: 'button', width: 140, height: 140,
    body: draw((k) =>
      `<rect x="6" y="16" width="128" height="118" rx="30" fill="#1546a0"/>` +
      `<rect x="6" y="6" width="128" height="118" rx="30" fill="${k.lin('#3d8bff', 0.35, 0.2)}" stroke="#1546a0" stroke-width="4"/>` +
      `<path d="M22 46Q24 18 60 18h20q36 0 38 28-20-12-48-12T22 46Z" fill="${k.grad([[0, '#ffffff', 0.65], [1, '#ffffff', 0.05]])}"/>`,
    ),
  },
  {
    id: 'panel', name: 'صفحه‌ی منو', category: 'button', width: 400, height: 400,
    body: draw((k) =>
      `<rect x="8" y="16" width="384" height="376" rx="36" fill="#0d1430" fill-opacity="0.6"/>` +
      `<rect x="8" y="8" width="384" height="376" rx="36" fill="${k.grad([[0, '#34437a'], [1, '#1a2248']])}" stroke="#ffd23f" stroke-width="7"/>` +
      `<rect x="24" y="24" width="352" height="344" rx="26" fill="none" stroke="#ffd23f" stroke-opacity="0.4" stroke-width="2.5"/>` +
      `<path d="M40 70Q44 30 90 30h220q46 0 50 40-60-20-160-20T40 70Z" fill="#ffffff" fill-opacity="0.12"/>` +
      glint(60, 50, 8) + glint(344, 340, 6),
    ),
  },
  {
    id: 'door', name: 'در قفل', category: 'ground', width: 120, height: 180,
    body: draw((k) => {
      const planks = [22, 42, 62, 82].map((x) => `<path d="M${x + 18} 34V174" stroke="#5e3415" stroke-width="2.5" stroke-opacity="0.7"/>`).join('');
      const band = (y: number) => `<rect x="18" y="${y}" width="84" height="12" rx="3" fill="${k.lin('#6d7b8c', 0.35, 0.35)}" stroke="#2f3a46" stroke-width="2.5"/>` +
        [28, 60, 92].map((x) => `<circle cx="${x}" cy="${y + 6}" r="2.6" fill="#c3cdd8"/>`).join('');
      return (
        // A stone arch, a plank door in it with iron bands, and a gold padlock.
        `<path d="M4 178V60Q4 4 60 4t56 56v118z" fill="${k.lin('#9aa7b6', 0.3, 0.35)}" ${ol('#4b5868', 4)}/>` +
        `<path d="M10 60Q10 12 60 12t50 48" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="3"/>` +
        `<path d="M18 178V64Q18 22 60 22t42 42v114z" fill="${k.side('#b8743a')}" stroke="#5e3415" stroke-width="3.5"/>` +
        planks + band(54) + band(140) +
        `<path d="M50 104v-10a10 10 0 0 1 20 0v10" fill="none" stroke="#8a99ab" stroke-width="5"/>` +
        `<rect x="44" y="102" width="32" height="28" rx="6" fill="${k.lin('#ffcf33', 0.45, 0.3)}" ${ol('#b8860b', 3)}/>` +
        `<circle cx="60" cy="113" r="4" fill="#5a3d00"/><path d="M60 115v8" stroke="#5a3d00" stroke-width="3.5" stroke-linecap="round"/>` +
        shine(k, 52, 107, 6, 3, -20, 0.8)
      );
    }),
  },
  {
    id: 'hud', name: 'قاب امتیاز', category: 'button', width: 240, height: 80,
    body: draw((k) =>
      `<rect x="4" y="8" width="232" height="68" rx="34" fill="#000000" fill-opacity="0.3"/>` +
      `<rect x="4" y="4" width="232" height="68" rx="34" fill="${k.grad([[0, '#2b3a6b', 0.92], [1, '#141c3a', 0.92]])}" stroke="#ffd23f" stroke-width="4"/>` +
      `<path d="M26 26Q30 10 60 10H180Q210 10 214 26Q190 20 120 20T26 26Z" fill="#ffffff" fill-opacity="0.18"/>`,
    ),
  },
  {
    id: 'clock', name: 'ساعت', category: 'item', width: 100, height: 100,
    body: draw((k) =>
      `<rect x="40" y="2" width="20" height="12" rx="4" fill="${k.lin('#ffcf33')}" ${ol('#b8860b', 3)}/>` +
      `<circle cx="50" cy="56" r="40" fill="${k.lin('#ffcf33', 0.45, 0.3)}" ${ol('#b8860b', 4)}/>` +
      `<circle cx="50" cy="56" r="31" fill="${k.grad([[0, '#ffffff'], [1, '#dfe6ee']])}" stroke="#b8860b" stroke-width="2.5"/>` +
      `<path d="M50 34v4M72 56h-4M50 78v-4M28 56h4" stroke="#5b6b80" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M50 56V40M50 56l12 8" stroke="#1f2a37" stroke-width="4.5" stroke-linecap="round"/><circle cx="50" cy="56" r="4" fill="#ff4d5e"/>` +
      shine(k, 36, 36, 12, 5, -30, 0.7),
    ),
  },
  {
    id: 'trophy', name: 'جام', category: 'item', width: 100, height: 100,
    body: draw((k) =>
      `<path d="M26 18H12q0 30 22 34M74 18h14q0 30-22 34" fill="none" stroke="#d99a00" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M24 8h52v22q0 30-26 32Q24 60 24 30z" fill="${k.lin('#ffcf33', 0.45, 0.3)}" ${ol('#b8860b', 4)}/>` +
      `<path d="M44 62h12v14H44z" fill="${k.side('#e0a800')}" stroke="#b8860b" stroke-width="3"/>` +
      `<rect x="28" y="76" width="44" height="18" rx="5" fill="${k.lin('#8b5a3c')}" ${ol('#4a2e1a', 3)}/>` +
      `<rect x="38" y="81" width="24" height="7" rx="2" fill="#ffd23f"/>` +
      shine(k, 36, 20, 7, 12, 0, 0.7) + glint(66, 16, 6),
    ),
  },
  {
    id: 'basket', name: 'سبد', category: 'item', width: 160, height: 90,
    body: draw((k) => {
      const weave = Array.from({ length: 8 }, (_, i) => `<path d="M${22 + i * 17} 28l${-4} 56" stroke="#8b5a2b" stroke-width="2.5" stroke-opacity="0.65"/>`).join('');
      return `<path d="M10 28h140l-14 58H24z" fill="${k.lin('#e0a050', 0.3, 0.35)}" ${ol('#7a4a1e', 3.5)}/>` + weave +
        `<path d="M18 48h124M22 66h116" stroke="#8b5a2b" stroke-width="2.5" stroke-opacity="0.6"/>` +
        `<rect x="4" y="18" width="152" height="16" rx="8" fill="${k.lin('#f0b866', 0.4, 0.3)}" ${ol('#7a4a1e', 3)}/>`;
    }),
  },
  {
    id: 'car-body', name: 'بدنه‌ی ماشین', category: 'character', width: 240, height: 90,
    body: draw((k) =>
      `<path d="M6 68V44q0-10 12-10h36l24-26h70l30 26h40q14 0 14 14v20q0 6-6 6h-24a26 26 0 0 0-52 0H86a26 26 0 0 0-52 0H12q-6 0-6-6z" fill="${k.lin('#ff3b47', 0.4, 0.32)}" ${ol('#a50f1c', 4)}/>` +
      `<path d="M84 14h60l22 20H68z" fill="${k.grad([[0, '#d9f4ff'], [1, '#4aa6d6']])}" stroke="#2b6f97" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<path d="M90 17h12l-14 15h-12z" fill="#ffffff" fill-opacity="0.6"/>` +
      `<rect x="16" y="40" width="208" height="5" rx="2.5" fill="#ffffff" fill-opacity="0.45"/>` +
      `<circle cx="222" cy="50" r="5" fill="#fff6a8" filter="${k.glow(2)}"/><rect x="8" y="48" width="8" height="8" rx="2" fill="#ff8a8a"/>`,
    ),
  },
];
