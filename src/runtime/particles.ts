import type { ParticlesBehavior } from '../format/types';

/** How one particle of a stream starts out and changes over its short life. */
export interface ParticleSpec {
  /** Where it starts, from the object's box: 0 to 1 across and down. */
  at: { x: number; y: number };
  vx: number;
  vy: number;
  /** Pull downward (negative rises), pixels per second squared. */
  gravity: number;
  life: number;
  /** Its size at the end of its life, as a share of its size at the start. */
  grow: number;
  /** Turning speed, radians per second. */
  spin: number;
  /** Side-to-side drift, like a snowflake or a bubble, in pixels per second. */
  wobble: number;
  shape: 'dot' | 'ring' | 'streak' | 'square' | 'star';
  width: number;
  height: number;
  color: string;
  alpha: number;
  /** Glowing: lighter where particles overlap, for fire and sparkles. */
  glow: boolean;
  /** Drawn behind the object instead of in front of it. */
  behind: boolean;
}

const CONFETTI = ['#ff5a5f', '#ffd54a', '#43a047', '#26c6da', '#7e57c2', '#ff9f1c'];
const between = (low: number, high: number) => low + Math.random() * (high - low);
/** A direction around `degrees` (0 is right, 90 down), up to `spread` degrees either side. */
const aim = (degrees: number, spread: number) => ((degrees + between(-spread, spread)) * Math.PI) / 180;

/** One new particle of a stream. `speed` multiplies the preset's own speed. */
export function particle(b: ParticlesBehavior): ParticleSpec {
  const s = Math.max(1, b.size);
  const f = Math.max(0.05, b.speed);
  const base = { spin: 0, wobble: 0, grow: 1, glow: false, behind: false, color: b.color, alpha: 1, width: s, height: s };
  const fly = (angle: number, speed: number) => ({ vx: Math.cos(angle) * speed * f, vy: Math.sin(angle) * speed * f });
  switch (b.preset) {
    case 'fire':
      return { ...base, at: { x: between(0.3, 0.7), y: 0.75 }, ...fly(aim(-90, 18), between(120, 220)), gravity: -160, life: between(0.45, 0.85), grow: 0.15, shape: 'dot', glow: true, alpha: 0.9, behind: true };
    case 'smoke':
      return { ...base, at: { x: between(0.35, 0.65), y: 0.4 }, ...fly(aim(-90, 25), between(40, 90)), gravity: -25, life: between(1.4, 2.2), grow: 3, shape: 'dot', alpha: 0.4, behind: true };
    case 'rain':
      return { ...base, at: { x: Math.random(), y: 0 }, ...fly(aim(100, 2), 950), gravity: 0, life: 1.1, shape: 'streak', width: Math.max(2, s * 0.2), height: s * 2.4, alpha: 0.6 };
    case 'snow':
      return { ...base, at: { x: Math.random(), y: 0 }, ...fly(aim(90, 10), between(60, 120)), gravity: 0, life: 7, wobble: 35, shape: 'dot', alpha: 0.9 };
    case 'sparkle':
      return { ...base, at: { x: Math.random(), y: Math.random() }, ...fly(aim(0, 180), between(5, 30)), gravity: 0, life: between(0.4, 0.8), grow: 0, shape: 'star', glow: true };
    case 'bubbles':
      return { ...base, at: { x: between(0.3, 0.7), y: 0.8 }, ...fly(aim(-90, 8), between(60, 120)), gravity: -20, life: between(2, 3), wobble: 25, shape: 'ring', alpha: 0.85 };
    case 'confetti':
      return { ...base, at: { x: 0.5, y: 0.5 }, ...fly(aim(-90, 45), between(450, 750)), gravity: 900, life: 2.4, spin: between(-9, 9), shape: 'square', height: s * 0.55, color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)] };
  }
}

/** The colour each kind of stream starts with, so a new one looks right at once. */
export const PARTICLE_COLORS: Record<ParticlesBehavior['preset'], string> = {
  fire: '#ff9100',
  smoke: '#9e9e9e',
  rain: '#90caf9',
  snow: '#ffffff',
  sparkle: '#fff59d',
  bubbles: '#b3e5fc',
  confetti: '#ff5a5f',
};
