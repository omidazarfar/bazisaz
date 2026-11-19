import { Texture } from 'pixi.js';
import type { TileStyle } from '../format/types';

/**
 * The look of one cell of a tile map made of a material: grass, dirt, stone,
 * brick, wood, ice, metal, sand or snow. A cell knows which of its sides are
 * open (no cell of the map next to it), so grass grows only along a top that
 * nothing covers and the outer edges of a level are shaded. Drawn once on a
 * canvas per material, size and set of open sides, then shared.
 */

export interface OpenSides {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

const made = new Map<string, Texture>();

/** A little random source with a fixed seed, so a material looks the same in every cell and every game. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** The texture of one cell `cell` pixels square, for a material and the sides of it that are open. */
export function tileTexture(style: Exclude<TileStyle, 'flat'>, cell: number, open: OpenSides, variant = 0): Texture {
  const size = Math.max(16, Math.min(256, Math.round(cell * 2)));
  const key = `${style}:${size}:${+open.top}${+open.bottom}${+open.left}${+open.right}:${variant % 4}`;
  const cached = made.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  paint(g, style, size, open, seeded(style.length * 131 + (variant % 4) * 977 + 7));
  const texture = Texture.from(c);
  made.set(key, texture);
  return texture;
}

function speckle(g: CanvasRenderingContext2D, rnd: () => number, s: number, count: number, colours: string[], size: [number, number], from = 0): void {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colours[Math.floor(rnd() * colours.length)];
    const r = (size[0] + rnd() * (size[1] - size[0])) * s;
    g.beginPath();
    g.ellipse(rnd() * s, from + rnd() * (s - from), r, r * (0.6 + rnd() * 0.4), rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
}

function fillAll(g: CanvasRenderingContext2D, s: number, top: string, bottom: string): void {
  const gradient = g.createLinearGradient(0, 0, 0, s);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  g.fillStyle = gradient;
  g.fillRect(0, 0, s, s);
}

/** Light on the top and left edges and shade on the bottom and right, so each block stands out a little. */
function bevel(g: CanvasRenderingContext2D, s: number, light: string, dark: string, width = 0.06): void {
  const w = Math.max(2, s * width);
  g.fillStyle = light;
  g.fillRect(0, 0, s, w);
  g.fillRect(0, 0, w, s);
  g.fillStyle = dark;
  g.fillRect(0, s - w, s, w);
  g.fillRect(s - w, 0, w, s);
}

/** Darkens the sides of a cell that face open air, so the outline of a level reads clearly. */
function edges(g: CanvasRenderingContext2D, s: number, open: OpenSides, colour: string): void {
  const w = Math.max(2, s * 0.07);
  g.fillStyle = colour;
  if (open.left) g.fillRect(0, 0, w, s);
  if (open.right) g.fillRect(s - w, 0, w, s);
  if (open.bottom) g.fillRect(0, s - w, s, w);
}

/** A cap on top of a cell (grass or snow): a band with a wavy lower edge and a lighter rim. */
function cap(g: CanvasRenderingContext2D, rnd: () => number, s: number, depth: number, top: string, bottom: string, rim: string, blades: boolean): void {
  const d = s * depth;
  const gradient = g.createLinearGradient(0, 0, 0, d * 1.3);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  g.fillStyle = gradient;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(s, 0);
  const bumps = 4;
  for (let i = bumps; i >= 0; i--) {
    const x = (i / bumps) * s;
    g.lineTo(x, d + (i % 2 === 0 ? s * 0.06 : -s * 0.02) + rnd() * s * 0.03);
  }
  g.closePath();
  g.fill();
  g.fillStyle = rim;
  g.fillRect(0, 0, s, Math.max(2, s * 0.05));
  if (blades) {
    g.strokeStyle = rim;
    g.lineWidth = Math.max(1.5, s * 0.025);
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = rnd() * s;
      g.beginPath();
      g.moveTo(x, s * 0.05);
      g.lineTo(x + (rnd() - 0.5) * s * 0.06, -s * 0.02);
      g.stroke();
    }
  }
}

function paint(g: CanvasRenderingContext2D, style: Exclude<TileStyle, 'flat'>, s: number, open: OpenSides, rnd: () => number): void {
  switch (style) {
    case 'grass':
    case 'dirt': {
      fillAll(g, s, '#9a6440', '#7a4a2e');
      speckle(g, rnd, s, 9, ['#6b4027', '#b07a52', '#5e3a24'], [0.03, 0.07]);
      // A pebble or two.
      speckle(g, rnd, s, 2, ['#a9a39b', '#8f8a83'], [0.05, 0.08], s * 0.3);
      edges(g, s, open, 'rgba(60,30,15,0.35)');
      if (style === 'grass' && open.top) cap(g, rnd, s, 0.26, '#7ed957', '#3f9b3a', '#b4f08a', true);
      else if (open.top) {
        g.fillStyle = '#b07a52';
        g.fillRect(0, 0, s, Math.max(2, s * 0.06));
      }
      return;
    }
    case 'snow': {
      fillAll(g, s, '#7f8fa3', '#5d6b7e');
      speckle(g, rnd, s, 6, ['#6f7d90', '#93a2b5'], [0.04, 0.08]);
      edges(g, s, open, 'rgba(30,40,60,0.3)');
      if (open.top) cap(g, rnd, s, 0.32, '#ffffff', '#dbe8f4', '#ffffff', false);
      return;
    }
    case 'stone': {
      fillAll(g, s, '#9aa6b2', '#7b8794');
      // Two rows of blocks, the second shifted, with light and shade on each.
      g.strokeStyle = 'rgba(40,50,60,0.55)';
      g.lineWidth = Math.max(2, s * 0.035);
      g.beginPath();
      g.moveTo(0, s / 2);
      g.lineTo(s, s / 2);
      g.moveTo(s * 0.55, 0);
      g.lineTo(s * 0.55, s / 2);
      g.moveTo(s * 0.25, s / 2);
      g.lineTo(s * 0.25, s);
      g.moveTo(s * 0.8, s / 2);
      g.lineTo(s * 0.8, s);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(0, 0, s, s * 0.05);
      g.fillRect(0, s / 2 + s * 0.02, s, s * 0.04);
      speckle(g, rnd, s, 6, ['rgba(60,70,80,0.35)', 'rgba(255,255,255,0.18)'], [0.02, 0.05]);
      edges(g, s, open, 'rgba(30,35,45,0.35)');
      return;
    }
    case 'brick': {
      fillAll(g, s, '#ddd2c6', '#c9bcae');
      const rows = 4;
      const h = s / rows;
      for (let r = 0; r < rows; r++) {
        const shift = r % 2 === 0 ? 0 : s / 4;
        for (let x = -s / 2 + shift; x < s; x += s / 2) {
          const tone = 0.85 + rnd() * 0.3;
          g.fillStyle = `rgb(${Math.round(196 * tone)},${Math.round(84 * tone)},${Math.round(60 * tone)})`;
          const [bx, by, bw, bh] = [x + s * 0.02, r * h + s * 0.02, s / 2 - s * 0.04, h - s * 0.04];
          g.fillRect(bx, by, bw, bh);
          g.fillStyle = 'rgba(255,255,255,0.18)';
          g.fillRect(bx, by, bw, bh * 0.18);
          g.fillStyle = 'rgba(0,0,0,0.15)';
          g.fillRect(bx, by + bh * 0.82, bw, bh * 0.18);
        }
      }
      edges(g, s, open, 'rgba(60,20,10,0.3)');
      return;
    }
    case 'wood': {
      fillAll(g, s, '#c48a52', '#a86d3b');
      const planks = 3;
      for (let p = 0; p < planks; p++) {
        const y = (p / planks) * s;
        g.fillStyle = 'rgba(80,40,15,0.55)';
        g.fillRect(0, y, s, Math.max(2, s * 0.03));
        g.strokeStyle = 'rgba(110,60,25,0.35)';
        g.lineWidth = Math.max(1, s * 0.012);
        for (let i = 0; i < 2; i++) {
          const gy = y + (s / planks) * (0.3 + i * 0.35);
          g.beginPath();
          g.moveTo(0, gy);
          g.bezierCurveTo(s * 0.3, gy + (rnd() - 0.5) * s * 0.05, s * 0.6, gy + (rnd() - 0.5) * s * 0.05, s, gy);
          g.stroke();
        }
        g.fillStyle = '#5b3a20';
        for (const nx of [0.1, 0.9]) {
          g.beginPath();
          g.arc(nx * s, y + s / planks / 2, Math.max(1.5, s * 0.025), 0, Math.PI * 2);
          g.fill();
        }
      }
      edges(g, s, open, 'rgba(70,35,10,0.35)');
      return;
    }
    case 'ice': {
      fillAll(g, s, '#d6f3ff', '#9fd6f2');
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.moveTo(s * 0.15, s);
      g.lineTo(s * 0.45, 0);
      g.lineTo(s * 0.6, 0);
      g.lineTo(s * 0.3, s);
      g.fill();
      g.strokeStyle = 'rgba(120,180,220,0.6)';
      g.lineWidth = Math.max(1, s * 0.015);
      g.beginPath();
      g.moveTo(s * 0.7, s * 0.2);
      g.lineTo(s * 0.8, s * 0.45);
      g.lineTo(s * 0.72, s * 0.7);
      g.stroke();
      if (open.top) {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, s, Math.max(2, s * 0.08));
      }
      edges(g, s, open, 'rgba(60,120,170,0.3)');
      return;
    }
    case 'metal': {
      fillAll(g, s, '#b6c0ca', '#7d8893');
      bevel(g, s, 'rgba(255,255,255,0.45)', 'rgba(30,40,50,0.4)');
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(0, s * 0.2, s, s * 0.08);
      for (const [x, y] of [[0.16, 0.16], [0.84, 0.16], [0.16, 0.84], [0.84, 0.84]]) {
        g.fillStyle = '#5f6a75';
        g.beginPath();
        g.arc(x * s, y * s, Math.max(2, s * 0.045), 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.beginPath();
        g.arc(x * s - s * 0.012, y * s - s * 0.012, Math.max(1, s * 0.015), 0, Math.PI * 2);
        g.fill();
      }
      return;
    }
    case 'sand': {
      fillAll(g, s, '#f1d39a', '#dcb676');
      speckle(g, rnd, s, 14, ['#c99d5e', '#fbe6bb', '#d8ae6c'], [0.012, 0.03]);
      g.strokeStyle = 'rgba(190,140,80,0.35)';
      g.lineWidth = Math.max(1, s * 0.02);
      for (let i = 0; i < 2; i++) {
        const y = s * (0.35 + i * 0.3);
        g.beginPath();
        g.moveTo(0, y);
        g.quadraticCurveTo(s / 2, y - s * 0.08, s, y);
        g.stroke();
      }
      if (open.top) {
        g.fillStyle = '#fbe6bb';
        g.fillRect(0, 0, s, Math.max(2, s * 0.06));
      }
      edges(g, s, open, 'rgba(120,80,30,0.25)');
      return;
    }
  }
}
