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
  shape: 'dot' | 'ring' | 'streak' | 'square' | 'star' | 'heart' | 'leaf';
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
/** Autumn: the chosen colour and a few of its neighbours, so a fall of leaves is not all one colour. */
const AUTUMN = ['#e07b39', '#c94f2c', '#e9b949', '#9a6b2f'];
/** A colour or, now and then, one of a few others, for streams that look better mixed. */
const mixed = (own: string, others: string[]) => (Math.random() < 0.5 ? own : others[Math.floor(Math.random() * others.length)]);
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
    case 'embers':
      // Sparks off a fire: small, bright, rising and swaying, dying out.
      return { ...base, at: { x: between(0.2, 0.8), y: 0.7 }, ...fly(aim(-90, 30), between(60, 150)), gravity: -40, life: between(1, 1.8), grow: 0.3, wobble: 30, shape: 'dot', width: s * 0.35, height: s * 0.35, glow: true };
    case 'leaves':
      return { ...base, at: { x: Math.random(), y: 0 }, ...fly(aim(70, 15), between(50, 100)), gravity: 10, life: between(4, 6), spin: between(-3, 3), wobble: 40, shape: 'leaf', height: s * 0.55, color: mixed(b.color, AUTUMN), alpha: 0.95 };
    case 'dust':
      // Kicked up from the ground: low, slow, spreading and fading.
      return { ...base, at: { x: between(0.1, 0.9), y: 0.95 }, ...fly(aim(-90, 70), between(20, 60)), gravity: -8, life: between(0.8, 1.4), grow: 2.4, shape: 'dot', alpha: 0.35, behind: true };
    case 'magic':
      return { ...base, at: { x: between(0.2, 0.8), y: between(0.2, 0.8) }, ...fly(aim(-90, 180), between(20, 70)), gravity: -30, life: between(0.7, 1.3), grow: 0, spin: between(-4, 4), shape: Math.random() < 0.6 ? 'star' : 'dot', width: s * (Math.random() < 0.6 ? 1 : 0.4), height: s * (Math.random() < 0.6 ? 1 : 0.4), glow: true, color: mixed(b.color, ['#ffffff', '#b388ff', '#80d8ff']) };
    case 'hearts':
      return { ...base, at: { x: between(0.3, 0.7), y: 0.4 }, ...fly(aim(-90, 25), between(50, 110)), gravity: -20, life: between(1.2, 1.8), grow: 1.3, wobble: 18, shape: 'heart' };
    case 'steam':
      return { ...base, at: { x: between(0.3, 0.7), y: 0.3 }, ...fly(aim(-90, 12), between(50, 100)), gravity: -30, life: between(1, 1.6), grow: 3.2, wobble: 14, shape: 'dot', alpha: 0.3 };
    case 'electric':
      // Short bright crackles in every direction from near the middle.
      return { ...base, at: { x: between(0.35, 0.65), y: between(0.35, 0.65) }, ...fly(aim(0, 180), between(250, 420)), gravity: 0, life: between(0.08, 0.18), shape: 'streak', width: Math.max(2, s * 0.15), height: s * 1.6, glow: true };
    case 'portal': {
      // Specks swirling in toward the middle.
      const angle = Math.random() * Math.PI * 2;
      const r = 0.5;
      return { ...base, at: { x: 0.5 + Math.cos(angle) * r, y: 0.5 + Math.sin(angle) * r }, vx: (-Math.cos(angle) * 90 - Math.sin(angle) * 120) * f, vy: (-Math.sin(angle) * 90 + Math.cos(angle) * 120) * f, gravity: 0, life: between(0.6, 1), grow: 0.2, shape: 'dot', width: s * 0.5, height: s * 0.5, glow: true };
    }
    case 'waterfall':
      return { ...base, at: { x: Math.random(), y: 0 }, ...fly(aim(90, 3), between(380, 520)), gravity: 600, life: between(0.7, 1), shape: 'streak', width: Math.max(3, s * 0.35), height: s * 1.8, alpha: 0.7 };
    case 'fireflies':
      return { ...base, at: { x: Math.random(), y: Math.random() }, ...fly(aim(0, 180), between(8, 25)), gravity: 0, life: between(2.5, 4), wobble: 22, shape: 'dot', width: s * 0.35, height: s * 0.35, glow: true };
    case 'stars':
      return { ...base, at: { x: 0.5, y: 0.5 }, ...fly(aim(-90, 60), between(120, 260)), gravity: 380, life: between(0.8, 1.3), grow: 0.4, spin: between(-6, 6), shape: 'star', glow: true };
    case 'sparks':
      // Welding sparks: fast, bright, thrown up and out, falling back in arcs.
      return { ...base, at: { x: 0.5, y: 0.5 }, ...fly(aim(-90, 70), between(250, 480)), gravity: 900, life: between(0.4, 0.8), shape: 'streak', width: Math.max(2, s * 0.15), height: s * 0.9, glow: true };
    case 'petals':
      return { ...base, at: { x: Math.random(), y: 0 }, ...fly(aim(80, 20), between(40, 80)), gravity: 8, life: between(4, 6), spin: between(-2, 2), wobble: 35, shape: 'leaf', height: s * 0.7, color: mixed(b.color, ['#ffd1dc', '#ffffff', '#f8bbd0']) };
    case 'feathers':
      return { ...base, at: { x: between(0.3, 0.7), y: 0.5 }, ...fly(aim(-90, 80), between(60, 140)), gravity: 60, life: between(1.8, 2.6), spin: between(-2, 2), wobble: 30, shape: 'leaf', height: s * 0.35 };
    case 'poison':
      return { ...base, at: { x: between(0.2, 0.8), y: 0.8 }, ...fly(aim(-90, 15), between(40, 90)), gravity: -15, life: between(1.2, 2), grow: 1.6, wobble: 12, shape: Math.random() < 0.5 ? 'ring' : 'dot', alpha: 0.75 };
    case 'frost':
      return { ...base, at: { x: Math.random(), y: Math.random() }, ...fly(aim(90, 40), between(5, 25)), gravity: 10, life: between(0.8, 1.6), grow: 0.3, spin: between(-1, 1), shape: Math.random() < 0.5 ? 'star' : 'square', width: s * 0.6, height: s * 0.6, glow: true };
    case 'glitter':
      return { ...base, at: { x: Math.random(), y: Math.random() * 0.5 }, ...fly(aim(90, 30), between(30, 80)), gravity: 40, life: between(1, 2), spin: between(-8, 8), shape: 'square', width: s * 0.3, height: s * 0.3, glow: true, color: mixed(b.color, CONFETTI) };
    case 'coins':
      return { ...base, at: { x: 0.5, y: 0.4 }, ...fly(aim(-90, 40), between(300, 520)), gravity: 1100, life: between(1, 1.4), spin: between(-10, 10), shape: 'dot', height: s * 0.35 };
    case 'ash':
      return { ...base, at: { x: Math.random(), y: 0 }, ...fly(aim(95, 20), between(20, 50)), gravity: 5, life: between(4, 6), wobble: 20, spin: between(-2, 2), shape: 'square', width: s * 0.3, height: s * 0.3, alpha: 0.6 };
    case 'rainbow':
      return { ...base, at: { x: between(0.2, 0.8), y: 0.7 }, ...fly(aim(-90, 35), between(80, 160)), gravity: -20, life: between(1, 1.6), grow: 0.2, shape: 'dot', glow: true, color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)] };
    case 'splash':
      return { ...base, at: { x: between(0.3, 0.7), y: 0.9 }, ...fly(aim(-90, 50), between(200, 380)), gravity: 1200, life: between(0.5, 0.8), grow: 0.5, shape: 'dot', width: s * 0.45, height: s * 0.45, alpha: 0.85 };
    case 'sand':
      return { ...base, at: { x: 0, y: Math.random() }, ...fly(aim(5, 6), between(220, 380)), gravity: 30, life: between(1.2, 1.8), shape: 'streak', width: Math.max(1.5, s * 0.12), height: s * 0.6, alpha: 0.55 };
    case 'drip':
      return { ...base, at: { x: between(0.1, 0.9), y: 1 }, ...fly(aim(90, 0), 10), gravity: 1100, life: 1.2, shape: 'dot', width: s * 0.45, height: s * 0.45, alpha: 0.85 };
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
  embers: '#ffb347',
  leaves: '#e07b39',
  dust: '#c8b89a',
  magic: '#ce93d8',
  hearts: '#ff6b9a',
  steam: '#eceff1',
  electric: '#80d8ff',
  portal: '#b388ff',
  waterfall: '#81d4fa',
  fireflies: '#e6ee9c',
  stars: '#ffe066',
  drip: '#4fc3f7',
  sparks: '#ffd180',
  petals: '#f48fb1',
  feathers: '#fafafa',
  poison: '#9ccc65',
  frost: '#b3e5fc',
  glitter: '#ffd54a',
  coins: '#ffc107',
  ash: '#9e9e9e',
  rainbow: '#ff5a5f',
  splash: '#81d4fa',
  sand: '#e0c48a',
};
