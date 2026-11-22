import type { AnimateBehavior, AnimKey } from '../format/types';

/** How an object looks at one moment of its animation: offset from where it is, turn, size and opacity. */
export type Pose = Omit<AnimKey, 't'>;

export const REST: Pose = { x: 0, y: 0, angle: 0, scale: 1, opacity: 1 };

/** How long one pass of the animation lasts: the time of its last key. */
export function lengthOf(b: AnimateBehavior): number {
  return b.keys.reduce((most, k) => Math.max(most, k.t), 0);
}

/** Where a running animation is in its own time, `seconds` after it started: looping, going back and forth, or stopped at the end. */
export function localTime(b: AnimateBehavior, seconds: number): number {
  const length = lengthOf(b);
  if (length <= 0) return 0;
  if (b.repeat === 'once') return Math.min(seconds, length);
  if (b.repeat === 'bounce') {
    const at = seconds % (length * 2);
    return at <= length ? at : length * 2 - at;
  }
  return seconds % length;
}

/** The pose at a moment of the animation's own time, smoothly between the keys either side of it. */
export function poseAt(b: AnimateBehavior, time: number): Pose {
  const keys = [...b.keys].sort((p, q) => p.t - q.t);
  if (keys.length === 0) return REST;
  if (time <= keys[0].t) return strip(keys[0]);
  const last = keys[keys.length - 1];
  if (time >= last.t) return strip(last);
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t <= time) i++;
  const [from, to] = [keys[i], keys[i + 1]];
  const span = to.t - from.t;
  let f = span > 0 ? (time - from.t) / span : 1;
  if (b.ease === 'smooth') f = f * f * (3 - 2 * f);
  const mix = (a: number, c: number) => a + (c - a) * f;
  return { x: mix(from.x, to.x), y: mix(from.y, to.y), angle: mix(from.angle, to.angle), scale: mix(from.scale, to.scale), opacity: mix(from.opacity, to.opacity) };
}

function strip(k: AnimKey): Pose {
  return { x: k.x, y: k.y, angle: k.angle, scale: k.scale, opacity: k.opacity };
}

const key = (t: number, pose: Partial<Pose> = {}): AnimKey => ({ t, ...REST, ...pose });

/** Ready-made animations to start from, by name. */
export const ANIMATION_PRESETS: Record<string, { label: string; make: () => Pick<AnimateBehavior, 'keys' | 'repeat' | 'ease'> }> = {
  float: { label: 'شناور', make: () => ({ repeat: 'loop', ease: 'smooth', keys: [key(0), key(1, { y: -24 }), key(2)] }) },
  spin: { label: 'چرخش', make: () => ({ repeat: 'loop', ease: 'linear', keys: [key(0), key(2, { angle: 360 })] }) },
  pulse: { label: 'ضربان', make: () => ({ repeat: 'loop', ease: 'smooth', keys: [key(0), key(0.4, { scale: 1.2 }), key(0.8)] }) },
  shake: { label: 'لرزش', make: () => ({ repeat: 'loop', ease: 'linear', keys: [key(0), key(0.1, { x: -10 }), key(0.2, { x: 10 }), key(0.3, { x: -10 }), key(0.4, { x: 10 }), key(0.5)] }) },
  swing: { label: 'تاب خوردن', make: () => ({ repeat: 'bounce', ease: 'smooth', keys: [key(0, { angle: -15 }), key(1.2, { angle: 15 })] }) },
  enter: { label: 'ورود از کنار', make: () => ({ repeat: 'once', ease: 'smooth', keys: [key(0, { x: -320, opacity: 0 }), key(0.8)] }) },
  hop: { label: 'پرش', make: () => ({ repeat: 'loop', ease: 'smooth', keys: [key(0, { scale: 1 }), key(0.15, { y: 0, scale: 0.85 }), key(0.45, { y: -70 }), key(0.75, { y: 0 }), key(0.9, { scale: 0.9 }), key(1.2)] }) },
  blink: { label: 'چشمک', make: () => ({ repeat: 'loop', ease: 'linear', keys: [key(0), key(0.5, { opacity: 0.15 }), key(1)] }) },
};
