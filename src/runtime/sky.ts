import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { Sky } from '../format/types';

/**
 * Painted backdrops for a scene: a sky and layers of scenery behind the game
 * (hills, mountains, trees, a city, dunes, rocks), each further layer moving
 * less as the camera moves, so the world has depth. Some parts are alive:
 * clouds drift, stars twinkle, bubbles rise, snow falls, light shimmers.
 *
 * Everything is drawn once on canvases, from a fixed seed so a backdrop always
 * looks the same, and shown as repeating strips, which is cheap on a phone.
 */

/** Width of one repeat of a strip, in its own pixels. Strips repeat sideways without a seam. */
const W = 1024;

type Stop = [number, string];

interface Layer {
  view: TilingSprite;
  /** How much it follows the camera: 0 not at all (as far as the sky), 1 as much as the world. */
  depth: number;
  /** Where it sits: along the bottom of the world, along the top, or over the whole screen. */
  anchor: 'bottom' | 'top' | 'screen';
  /** Its height, as a share of the screen's. */
  share: number;
  /** Drift of its own, in pixels per second: sideways (clouds) and up or down (bubbles, snow). */
  drift?: { x: number; y: number };
  /** A gentle pulse of its opacity: stars twinkling, light shimmering. */
  pulse?: { speed: number; low: number; phase: number };
}

/** A little random number source with a fixed seed, so every backdrop is the same each time. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return [c, c.getContext('2d')!];
}

function vertical(g: CanvasRenderingContext2D, height: number, stops: Stop[]): CanvasGradient {
  const gradient = g.createLinearGradient(0, 0, 0, height);
  for (const [at, colour] of stops) gradient.addColorStop(at, colour);
  return gradient;
}

/**
 * The outline of a range along the top of a strip: a sum of waves whose
 * lengths divide the strip's width, so it repeats without a seam. `sharp`
 * folds the waves into peaks, for mountains instead of rolling hills.
 */
function ridge(rnd: () => number, base: number, amp: number, sharp: boolean, waves = 4): (x: number) => number {
  // Long waves carry most of the height and short ones only roughen it, so peaks are broad, not needles.
  const parts = Array.from({ length: waves }, (_, i) => ({ f: (i + 1) * 2 + Math.floor(rnd() * 2), a: amp / (i + 1) ** 1.7, p: rnd() * Math.PI * 2 }));
  return (x) => {
    let y = 0;
    for (const [i, w] of parts.entries()) {
      const s = Math.sin((x / W) * Math.PI * 2 * w.f + w.p);
      // A mountain's main waves are folded into peaks; its smaller ones stay round.
      y += (sharp && i < 2 ? 0.6 - Math.abs(s) * 1.2 : s) * w.a;
    }
    return base - y;
  };
}

/** Fills under a ridge, with a top-to-bottom shading, and an optional lighter rim along its crest. */
function fillRidge(g: CanvasRenderingContext2D, height: number, top: (x: number) => number, stops: Stop[], rim?: string): void {
  g.beginPath();
  g.moveTo(0, height);
  for (let x = 0; x <= W; x += 4) g.lineTo(x, top(x));
  g.lineTo(W, height);
  g.closePath();
  g.fillStyle = vertical(g, height, stops);
  g.fill();
  if (rim) {
    g.beginPath();
    for (let x = 0; x <= W; x += 4) (x === 0 ? g.moveTo : g.lineTo).call(g, x, top(x) + 2);
    g.strokeStyle = rim;
    g.lineWidth = 5;
    g.stroke();
  }
}

/** Draws a shape at x, and again one strip-width to either side, so a shape near the edge wraps round. */
function wrapped(x: number, draw: (x: number) => void): void {
  for (const dx of [-W, 0, W]) draw(x + dx);
}

function pine(g: CanvasRenderingContext2D, x: number, ground: number, size: number, colour: string, snow?: string): void {
  g.fillStyle = colour;
  for (let tier = 0; tier < 3; tier++) {
    const w = size * (0.55 - tier * 0.12);
    const y = ground - size * (0.25 + tier * 0.28);
    g.beginPath();
    g.moveTo(x - w, y + size * 0.32);
    g.lineTo(x, y - size * 0.18);
    g.lineTo(x + w, y + size * 0.32);
    g.fill();
    if (snow) {
      g.fillStyle = snow;
      g.beginPath();
      g.moveTo(x - w * 0.45, y + size * 0.04);
      g.lineTo(x, y - size * 0.18);
      g.lineTo(x + w * 0.45, y + size * 0.04);
      g.fill();
      g.fillStyle = colour;
    }
  }
  g.fillRect(x - size * 0.05, ground - size * 0.12, size * 0.1, size * 0.14);
}

function roundTree(g: CanvasRenderingContext2D, x: number, ground: number, size: number, colour: string, light: string): void {
  g.fillStyle = colour;
  g.fillRect(x - size * 0.06, ground - size * 0.4, size * 0.12, size * 0.42);
  for (const [dx, dy, r] of [[0, -0.62, 0.32], [-0.22, -0.48, 0.24], [0.22, -0.5, 0.25]]) {
    g.beginPath();
    g.arc(x + dx * size, ground + dy * size, r * size, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = light;
  g.beginPath();
  g.arc(x - size * 0.08, ground - size * 0.74, size * 0.12, 0, Math.PI * 2);
  g.fill();
}

/** A fluffy cloud of overlapping puffs, lit from above. */
function cloud(g: CanvasRenderingContext2D, x: number, y: number, size: number, rnd: () => number, colour: string, shadow: string): void {
  const puffs = Array.from({ length: 6 }, (_, i) => ({ dx: (i - 2.5) * size * 0.32 + (rnd() - 0.5) * size * 0.15, dy: -Math.sin((i / 5) * Math.PI) * size * 0.35 * (0.6 + rnd() * 0.5), r: size * (0.3 + rnd() * 0.18) }));
  g.fillStyle = shadow;
  for (const p of puffs) {
    g.beginPath();
    g.arc(x + p.dx, y + p.dy + size * 0.08, p.r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = colour;
  for (const p of puffs) {
    g.beginPath();
    g.arc(x + p.dx, y + p.dy, p.r * 0.93, 0, Math.PI * 2);
    g.fill();
  }
}

function glowDisc(g: CanvasRenderingContext2D, x: number, y: number, r: number, core: string, halo: string, haloSize = 3): void {
  const glow = g.createRadialGradient(x, y, r * 0.6, x, y, r * haloSize);
  glow.addColorStop(0, halo);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(x - r * haloSize, y - r * haloSize, r * haloSize * 2, r * haloSize * 2);
  g.fillStyle = core;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** A field of stars, some bigger and brighter. */
function stars(rnd: () => number, height: number, count: number, big: number): Texture {
  const [c, g] = canvas(W, height);
  for (let i = 0; i < count; i++) {
    const r = rnd() < 0.08 ? big : 0.6 + rnd() * 1.2;
    g.globalAlpha = 0.4 + rnd() * 0.6;
    g.fillStyle = rnd() < 0.15 ? '#ffe9b0' : rnd() < 0.15 ? '#b8d4ff' : '#ffffff';
    g.beginPath();
    g.arc(rnd() * W, rnd() * height, r, 0, Math.PI * 2);
    g.fill();
  }
  return Texture.from(c);
}

/** Small round things scattered over a strip that repeats both ways: bubbles or snowflakes. */
function specks(rnd: () => number, count: number, size: [number, number], colour: string, ring: boolean): Texture {
  const [c, g] = canvas(W, W);
  for (let i = 0; i < count; i++) {
    const r = size[0] + rnd() * (size[1] - size[0]);
    const [x, y] = [rnd() * W, rnd() * W];
    g.globalAlpha = 0.5 + rnd() * 0.5;
    for (const dx of [-W, 0, W]) {
      for (const dy of [-W, 0, W]) {
        g.beginPath();
        g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        if (ring) {
          g.strokeStyle = colour;
          g.lineWidth = Math.max(1.5, r / 4);
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.15)';
          g.fill();
        } else {
          g.fillStyle = colour;
          g.fill();
        }
      }
    }
  }
  return Texture.from(c);
}

/** Soft slanting beams of light from above, for water and forests. */
function rays(rnd: () => number, height: number, colour: string): Texture {
  const [c, g] = canvas(W, height);
  for (let i = 0; i < 7; i++) {
    const x = rnd() * W;
    const w = 30 + rnd() * 70;
    const gradient = g.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, colour);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient;
    wrapped(x, (at) => {
      g.beginPath();
      g.moveTo(at, 0);
      g.lineTo(at + w, 0);
      g.lineTo(at + w + height * 0.35, height);
      g.lineTo(at + height * 0.35 - w * 0.5, height);
      g.fill();
    });
  }
  g.clearRect(0, 0, W, 2);
  return Texture.from(c);
}

/** One strip of scenery, drawn by `paint` on a canvas `height` tall. */
function strip(height: number, paint: (g: CanvasRenderingContext2D, height: number) => void): Texture {
  const [c, g] = canvas(W, height);
  paint(g, height);
  // A strip repeats sideways only; its top and bottom rows are left clear, or the smoothing of a
  // repeating picture would carry its bottom edge round to its top as a thin line across the sky.
  g.clearRect(0, 0, W, 2);
  g.clearRect(0, height - 2, W, 2);
  return Texture.from(c);
}

interface Plan {
  sky: Stop[];
  /** The sun or moon, drawn on the sky itself, as shares of the screen. */
  disc?: { x: number; y: number; r: number; core: string; halo: string; craters?: boolean };
  layers: (Omit<Layer, 'view'> & { texture: Texture; alpha?: number; blend?: 'add' })[];
}

/** What each backdrop is made of. */
function plan(kind: Exclude<Sky, 'none'>): Plan {
  const rnd = seeded(kind.length * 7919 + kind.charCodeAt(0) * 31);
  // Clouds are painted solid; see-through clouds get their opacity on the whole layer, so the puffs do not show through each other.
  const clouds = (colour: string, shadow: string) =>
    strip(360, (g) => {
      for (let i = 0; i < 5; i++) {
        const [x, y, size] = [i * (W / 5) + rnd() * 80, 90 + rnd() * 170, 70 + rnd() * 60];
        wrapped(x, (at) => cloud(g, at, y, size, seeded(i * 97 + 3), colour, shadow));
      }
    });
  switch (kind) {
    case 'day':
      return {
        sky: [[0, '#3f8fd8'], [0.55, '#8fcbf2'], [1, '#e2f5ff']],
        disc: { x: 0.8, y: 0.13, r: 46, core: '#fff7c2', halo: 'rgba(255,240,170,0.75)' },
        layers: [
          { texture: clouds('#ffffff', 'rgba(170,200,225,0.9)'), depth: 0.05, anchor: 'top', share: 0.3, drift: { x: -12, y: 0 } },
          { texture: strip(400, (g, h) => fillRidge(g, h, ridge(rnd, 170, 70, false), [[0, '#a9dcc8'], [1, '#c9ecdd']])), depth: 0.12, anchor: 'bottom', share: 0.34 },
          { texture: strip(400, (g, h) => fillRidge(g, h, ridge(rnd, 200, 60, false), [[0, '#7cc98a'], [1, '#5aa96a']], '#a8e3a5')), depth: 0.3, anchor: 'bottom', share: 0.26 },
          {
            texture: strip(400, (g, h) => {
              const top = ridge(rnd, 230, 45, false, 3);
              fillRidge(g, h, top, [[0, '#52b25f'], [1, '#2f8040']], '#8fdc86');
              for (let i = 0; i < 9; i++) {
                const x = rnd() * W;
                wrapped(x, (at) => roundTree(g, at, top(((at % W) + W) % W) + 6, 70 + rnd() * 50, '#2e7d32', '#66bb6a'));
              }
            }),
            depth: 0.5, anchor: 'bottom', share: 0.2,
          },
        ],
      };
    case 'sunset':
      return {
        sky: [[0, '#241552'], [0.35, '#7b3a7c'], [0.65, '#e3696a'], [1, '#fcc58a']],
        disc: { x: 0.3, y: 0.58, r: 80, core: '#ffd9a0', halo: 'rgba(255,170,110,0.7)' },
        layers: [
          { texture: clouds('#ffae9c', '#b4627f'), depth: 0.04, anchor: 'top', share: 0.38, drift: { x: -8, y: 0 }, alpha: 0.75 },
          { texture: strip(400, (g, h) => fillRidge(g, h, ridge(rnd, 160, 95, true), [[0, '#8a4a86'], [1, '#6a3570']])), depth: 0.1, anchor: 'bottom', share: 0.4 },
          { texture: strip(400, (g, h) => fillRidge(g, h, ridge(rnd, 210, 80, true), [[0, '#4b2558'], [1, '#2f163b']])), depth: 0.25, anchor: 'bottom', share: 0.3 },
          { texture: strip(400, (g, h) => fillRidge(g, h, ridge(rnd, 260, 30, false), [[0, '#24102d'], [1, '#160a1c']])), depth: 0.5, anchor: 'bottom', share: 0.18 },
        ],
      };
    case 'night':
      return {
        sky: [[0, '#050a1c'], [0.6, '#13214a'], [1, '#2a3d73']],
        disc: { x: 0.24, y: 0.15, r: 40, core: '#f4f1d6', halo: 'rgba(200,215,255,0.45)', craters: true },
        layers: [
          { texture: stars(rnd, 900, 260, 2.4), depth: 0.02, anchor: 'top', share: 0.75 },
          { texture: stars(rnd, 900, 60, 3), depth: 0.02, anchor: 'top', share: 0.75, pulse: { speed: 1.6, low: 0.2, phase: 0 } },
          { texture: strip(400, (g, h) => fillRidge(g, h, ridge(rnd, 170, 90, true), [[0, '#22325f'], [1, '#18244a']], '#3a4f86')), depth: 0.12, anchor: 'bottom', share: 0.38 },
          {
            texture: strip(400, (g, h) => {
              const top = ridge(rnd, 250, 35, false, 3);
              fillRidge(g, h, top, [[0, '#0f1834'], [1, '#090f22']]);
              for (let i = 0; i < 26; i++) {
                const x = rnd() * W;
                wrapped(x, (at) => pine(g, at, top(((at % W) + W) % W) + 8, 50 + rnd() * 70, '#0a1128'));
              }
            }),
            depth: 0.35, anchor: 'bottom', share: 0.24,
          },
        ],
      };
    case 'space':
      return {
        sky: [[0, '#03010b'], [0.5, '#0f0828'], [1, '#1a0d39']],
        layers: [
          {
            texture: strip(900, (g, h) => {
              for (const [x, y, r, colour] of [[0.2, 0.3, 300, 'rgba(140,60,200,0.35)'], [0.65, 0.55, 360, 'rgba(40,140,200,0.28)'], [0.9, 0.2, 240, 'rgba(230,80,150,0.25)']] as const) {
                wrapped(x * W, (at) => {
                  const glow = g.createRadialGradient(at, y * h, 0, at, y * h, r);
                  glow.addColorStop(0, colour);
                  glow.addColorStop(1, 'rgba(0,0,0,0)');
                  g.fillStyle = glow;
                  g.fillRect(at - r, y * h - r, r * 2, r * 2);
                });
              }
            }),
            depth: 0.03, anchor: 'screen', share: 1, blend: 'add',
          },
          { texture: stars(rnd, 1024, 320, 1.8), depth: 0.04, anchor: 'screen', share: 1 },
          { texture: stars(rnd, 1024, 90, 2.6), depth: 0.1, anchor: 'screen', share: 1, pulse: { speed: 1.2, low: 0.35, phase: 1 } },
          {
            texture: strip(600, (g) => {
              const [x, y, r] = [700, 260, 110];
              const body = g.createRadialGradient(x - 40, y - 40, 10, x, y, r);
              body.addColorStop(0, '#f6b37e');
              body.addColorStop(0.7, '#c4573f');
              body.addColorStop(1, '#5a1f2a');
              g.fillStyle = body;
              g.beginPath();
              g.arc(x, y, r, 0, Math.PI * 2);
              g.fill();
              g.strokeStyle = 'rgba(255,220,180,0.7)';
              g.lineWidth = 7;
              g.beginPath();
              g.ellipse(x, y, r * 1.8, r * 0.35, -0.3, 0, Math.PI * 2);
              g.stroke();
            }),
            depth: 0.08, anchor: 'top', share: 0.45,
          },
        ],
      };
    case 'underwater':
      return {
        sky: [[0, '#38c4e0'], [0.45, '#1585ab'], [1, '#08395a']],
        layers: [
          { texture: rays(rnd, 900, 'rgba(220,250,255,0.35)'), depth: 0.05, anchor: 'top', share: 0.8, pulse: { speed: 0.7, low: 0.45, phase: 0 }, blend: 'add' },
          { texture: strip(400, (g, h) => fillRidge(g, h, ridge(rnd, 190, 80, true), [[0, '#0f5f80'], [1, '#0a4462']])), depth: 0.12, anchor: 'bottom', share: 0.34 },
          {
            texture: strip(400, (g, h) => {
              const top = ridge(rnd, 300, 30, false, 3);
              fillRidge(g, h, top, [[0, '#0b4b4a'], [1, '#07302f']]);
              for (let i = 0; i < 22; i++) {
                const x = rnd() * W;
                const tall = 80 + rnd() * 170;
                g.strokeStyle = rnd() < 0.5 ? '#14735a' : '#0f5f4b';
                g.lineWidth = 9 + rnd() * 6;
                g.lineCap = 'round';
                wrapped(x, (at) => {
                  const base = top(((at % W) + W) % W) + 10;
                  g.beginPath();
                  g.moveTo(at, base);
                  g.bezierCurveTo(at - 25, base - tall * 0.35, at + 25, base - tall * 0.65, at - 5, base - tall);
                  g.stroke();
                });
              }
            }),
            depth: 0.35, anchor: 'bottom', share: 0.3,
          },
          { texture: specks(rnd, 70, [4, 13], 'rgba(220,250,255,0.85)', true), depth: 0.2, anchor: 'screen', share: 1, drift: { x: 0, y: -45 } },
        ],
      };
    case 'forest':
      return {
        sky: [[0, '#9fd8f2'], [0.6, '#d4f0e4'], [1, '#eef9e8']],
        disc: { x: 0.7, y: 0.12, r: 40, core: '#fffbe0', halo: 'rgba(255,250,200,0.8)' },
        layers: [
          { texture: rays(rnd, 900, 'rgba(255,250,210,0.35)'), depth: 0.04, anchor: 'top', share: 0.85, pulse: { speed: 0.5, low: 0.5, phase: 2 }, blend: 'add' },
          {
            texture: strip(400, (g, h) => {
              const top = ridge(rnd, 220, 30, false, 3);
              fillRidge(g, h, top, [[0, '#9cc9ae'], [1, '#86b99a']]);
              for (let i = 0; i < 30; i++) {
                const x = rnd() * W;
                wrapped(x, (at) => pine(g, at, top(((at % W) + W) % W) + 10, 70 + rnd() * 70, '#8fbfa3'));
              }
            }),
            depth: 0.12, anchor: 'bottom', share: 0.36,
          },
          {
            texture: strip(400, (g, h) => {
              const top = ridge(rnd, 260, 25, false, 3);
              fillRidge(g, h, top, [[0, '#5b9877'], [1, '#467c60']]);
              for (let i = 0; i < 22; i++) {
                const x = rnd() * W;
                wrapped(x, (at) => pine(g, at, top(((at % W) + W) % W) + 10, 100 + rnd() * 90, '#4f8b6b'));
              }
            }),
            depth: 0.28, anchor: 'bottom', share: 0.32,
          },
          {
            texture: strip(400, (g, h) => {
              const top = ridge(rnd, 300, 20, false, 2);
              fillRidge(g, h, top, [[0, '#2f5d47'], [1, '#1f4232']]);
              for (let i = 0; i < 12; i++) {
                const x = rnd() * W;
                wrapped(x, (at) => pine(g, at, top(((at % W) + W) % W) + 10, 140 + rnd() * 120, '#2a5440'));
              }
            }),
            depth: 0.5, anchor: 'bottom', share: 0.26,
          },
        ],
      };
    case 'desert':
      return {
        sky: [[0, '#f7c66b'], [0.5, '#f9a27a'], [1, '#fcd9b0']],
        disc: { x: 0.72, y: 0.2, r: 60, core: '#fff3d1', halo: 'rgba(255,230,170,0.75)' },
        layers: [
          { texture: strip(400, (g, h) => fillRidge(g, h, ridge(rnd, 220, 50, false, 3), [[0, '#efc08a'], [1, '#e2aa72']])), depth: 0.1, anchor: 'bottom', share: 0.34 },
          {
            texture: strip(400, (g, h) => {
              const top = ridge(rnd, 240, 45, false, 3);
              fillRidge(g, h, top, [[0, '#dc9a58'], [1, '#c98445']], '#f0bd82');
              for (let i = 0; i < 6; i++) {
                const x = rnd() * W;
                const s = 60 + rnd() * 50;
                g.fillStyle = '#5f8f4a';
                wrapped(x, (at) => {
                  const base = top(((at % W) + W) % W) + 6;
                  g.fillRect(at - s * 0.08, base - s, s * 0.16, s);
                  g.fillRect(at - s * 0.32, base - s * 0.62, s * 0.12, s * 0.3);
                  g.fillRect(at - s * 0.32, base - s * 0.38, s * 0.3, s * 0.1);
                  g.fillRect(at + s * 0.2, base - s * 0.75, s * 0.12, s * 0.3);
                  g.fillRect(at + s * 0.04, base - s * 0.5, s * 0.28, s * 0.1);
                });
              }
            }),
            depth: 0.28, anchor: 'bottom', share: 0.28,
          },
          { texture: strip(400, (g, h) => fillRidge(g, h, ridge(rnd, 290, 35, false, 2), [[0, '#c27639'], [1, '#a5602b']], '#e09a5c')), depth: 0.5, anchor: 'bottom', share: 0.18 },
        ],
      };
    case 'city': {
      const skyline = (base: number, tall: number, colour: string, lit: string, windows: number) =>
        strip(500, (g, h) => {
          let x = 0;
          g.fillStyle = colour;
          while (x < W) {
            const w = 50 + rnd() * 70;
            const top = base - tall * (0.3 + rnd() * 0.7);
            g.fillRect(x, top, w - 4, h - top);
            if (rnd() < 0.3) g.fillRect(x + w * 0.4, top - 30, 4, 30);
            for (let wy = top + 14; wy < h - 10; wy += 22) {
              for (let wx = x + 8; wx < x + w - 14; wx += 16) {
                if (rnd() > windows) continue;
                g.fillStyle = lit;
                g.fillRect(wx, wy, 7, 10);
              }
            }
            g.fillStyle = colour;
            x += w;
          }
        });
      return {
        sky: [[0, '#151a45'], [0.45, '#4d3478'], [0.8, '#d9737a'], [1, '#f7b27a']],
        disc: { x: 0.78, y: 0.12, r: 26, core: '#fff3d6', halo: 'rgba(255,220,200,0.4)' },
        layers: [
          { texture: stars(rnd, 500, 70, 1.8), depth: 0.02, anchor: 'top', share: 0.4, pulse: { speed: 1.3, low: 0.4, phase: 0 } },
          { texture: skyline(380, 300, '#3a3a72', 'rgba(255,214,140,0.55)', 0.25), depth: 0.12, anchor: 'bottom', share: 0.42 },
          { texture: skyline(420, 330, '#1d1b42', 'rgba(255,224,130,0.9)', 0.35), depth: 0.3, anchor: 'bottom', share: 0.36 },
        ],
      };
    }
    case 'cave':
      return {
        sky: [[0, '#0d0b16'], [1, '#231c33']],
        layers: [
          {
            texture: strip(400, (g, h) => {
              const bottom = ridge(rnd, 130, 50, true);
              g.beginPath();
              g.moveTo(0, 0);
              for (let x = 0; x <= W; x += 4) g.lineTo(x, h - 400 + bottom(x));
              g.lineTo(W, 0);
              g.fillStyle = vertical(g, h, [[0, '#120e1c'], [1, '#2a2240']]);
              g.fill();
              for (let i = 0; i < 18; i++) {
                const x = rnd() * W;
                const len = 30 + rnd() * 90;
                wrapped(x, (at) => {
                  const from = bottom(((at % W) + W) % W) - 4;
                  g.beginPath();
                  g.moveTo(at - 10, from);
                  g.lineTo(at, from + len);
                  g.lineTo(at + 10, from);
                  g.fillStyle = '#2a2240';
                  g.fill();
                });
              }
            }),
            depth: 0.2, anchor: 'top', share: 0.3,
          },
          {
            texture: strip(400, (g, h) => {
              const top = ridge(rnd, 190, 80, true);
              fillRidge(g, h, top, [[0, '#2c2443'], [1, '#1c172c']]);
              for (let i = 0; i < 12; i++) {
                const x = rnd() * W;
                const teal = rnd() < 0.5;
                const [y, r] = [30 + rnd() * 80, 4 + rnd() * 4];
                wrapped(x, (at) => glowDisc(g, at, top(((at % W) + W) % W) + y, r, teal ? '#46e0d0' : '#c070ff', teal ? 'rgba(70,224,208,0.3)' : 'rgba(192,112,255,0.3)', 4));
              }
            }),
            depth: 0.15, anchor: 'bottom', share: 0.4,
          },
          { texture: strip(400, (g, h) => fillRidge(g, h, ridge(rnd, 260, 50, true), [[0, '#17121f'], [1, '#0c0911']])), depth: 0.4, anchor: 'bottom', share: 0.24 },
        ],
      };
    case 'snow':
      return {
        sky: [[0, '#8db8e2'], [0.55, '#cfe4f6'], [1, '#f2f8fd']],
        disc: { x: 0.25, y: 0.14, r: 36, core: '#ffffff', halo: 'rgba(255,255,255,0.7)' },
        layers: [
          { texture: clouds('#ffffff', '#b3c4d9'), depth: 0.04, anchor: 'top', share: 0.3, drift: { x: -6, y: 0 }, alpha: 0.9 },
          {
            texture: strip(400, (g, h) => {
              const top = ridge(rnd, 170, 100, true);
              fillRidge(g, h, top, [[0, '#a9bfd6'], [1, '#93abc4']]);
              g.save();
              g.beginPath();
              g.moveTo(0, h);
              for (let x = 0; x <= W; x += 4) g.lineTo(x, top(x));
              g.lineTo(W, h);
              g.clip();
              g.fillStyle = '#f5f9fd';
              g.beginPath();
              for (let x = 0; x <= W; x += 4) (x === 0 ? g.moveTo : g.lineTo).call(g, x, top(x) + 40 + Math.sin(x * 0.05) * 8);
              for (let x = W; x >= 0; x -= 4) g.lineTo(x, top(x) - 5);
              g.fill();
              g.restore();
            }),
            depth: 0.12, anchor: 'bottom', share: 0.38,
          },
          {
            texture: strip(400, (g, h) => {
              const top = ridge(rnd, 270, 30, false, 3);
              fillRidge(g, h, top, [[0, '#ffffff'], [1, '#dde9f3']]);
              for (let i = 0; i < 14; i++) {
                const x = rnd() * W;
                wrapped(x, (at) => pine(g, at, top(((at % W) + W) % W) + 10, 80 + rnd() * 90, '#4f6f84', '#ffffff'));
              }
            }),
            depth: 0.35, anchor: 'bottom', share: 0.26,
          },
          { texture: specks(rnd, 140, [2, 5], '#ffffff', false), depth: 0.3, anchor: 'screen', share: 1, drift: { x: 12, y: 50 } },
          { texture: specks(rnd, 60, [4, 7], '#ffffff', false), depth: 0.6, anchor: 'screen', share: 1, drift: { x: 20, y: 95 } },
        ],
      };
  }
}

/** The sky itself as a texture: its colours top to bottom, and the sun or moon on it. */
function skyTexture(p: Plan, width: number, height: number): Texture {
  const [c, g] = canvas(Math.max(2, Math.round(width / 2)), Math.max(2, Math.round(height / 2)));
  g.fillStyle = vertical(g, c.height, p.sky);
  g.fillRect(0, 0, c.width, c.height);
  if (p.disc) {
    const { x, y, r, core, halo, craters } = p.disc;
    glowDisc(g, x * c.width, y * c.height, r / 2, core, halo);
    if (craters) {
      g.fillStyle = 'rgba(160,160,140,0.35)';
      for (const [dx, dy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.35, 0.12]]) {
        g.beginPath();
        g.arc(x * c.width + (dx * r) / 2, y * c.height + (dy * r) / 2, (cr * r) / 2, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  return Texture.from(c);
}

/** Built backdrops, kept by kind and screen size: drawing them takes a moment, and scenes often share one. */
const built = new Map<string, Plan & { base: Texture }>();

export class SkyView {
  readonly container = new Container();
  private readonly layers: Layer[] = [];
  private readonly base: Sprite;
  private clock = 0;

  constructor(kind: Exclude<Sky, 'none'>, private readonly width: number, private readonly height: number) {
    const key = `${kind}:${width}x${height}`;
    let made = built.get(key);
    if (!made) {
      const p = plan(kind);
      made = { ...p, base: skyTexture(p, width, height) };
      built.set(key, made);
    }
    this.base = new Sprite(made.base);
    this.base.width = width;
    this.base.height = height;
    this.container.addChild(this.base);
    for (const l of made.layers) {
      const view = new TilingSprite({ texture: l.texture, width, height: height * l.share });
      if (l.alpha !== undefined) view.alpha = l.alpha;
      if (l.blend) view.blendMode = l.blend;
      this.container.addChild(view);
      this.layers.push({ ...l, view });
    }
  }

  /**
   * Puts every layer where it belongs for the camera, given in world pixels
   * (`camera`), the zoom, the world's height, and the time passed.
   */
  update(camera: { x: number; y: number }, z: number, worldHeight: number, dt: number): void {
    this.clock += dt;
    const { width, height } = this;
    // How far below the bottom of the screen the world's floor is, on screen.
    const below = (worldHeight - camera.y) * z - height;
    for (const l of this.layers) {
      const view = l.view;
      const scale = view.height / l.view.texture.height;
      view.tileScale.set(scale);
      const sideways = -camera.x * z * l.depth + (l.drift ? this.clock * l.drift.x : 0);
      view.tilePosition.x = sideways;
      if (l.anchor === 'bottom') {
        view.y = height - view.height + below * l.depth;
      } else if (l.anchor === 'top') {
        view.y = Math.min(0, -camera.y * z * l.depth);
      } else {
        view.y = 0;
        view.height = height;
        view.tilePosition.y = -camera.y * z * l.depth + (l.drift ? this.clock * l.drift.y : 0);
      }
      view.width = width;
      if (l.pulse) view.alpha = l.pulse.low + (1 - l.pulse.low) * (0.5 + 0.5 * Math.sin(this.clock * l.pulse.speed + l.pulse.phase));
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
