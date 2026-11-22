import { Graphics } from 'pixi.js';
import type { ParticlesBehavior } from '../format/types';
import { shadeOf } from './color';
import { particle } from './particles';

/** One piece of a burst, a trail dot, or one particle of a stream: flying, falling or rising, and fading. */
export interface Particle {
  view: Graphics;
  vx: number;
  vy: number;
  life: number;
  span: number;
  /** Downward pull: burst pieces fall, trail dots hang where they were left. */
  gravity: number;
  /** Streams only: size at the end as a share of the start, turning speed, side-to-side drift. */
  grow?: number;
  spin?: number;
  wobble?: number;
  phase?: number;
  /** Strongest opacity; a stream particle keeps it until the last part of its life. */
  alpha?: number;
}

export function spawnParticle(b: ParticlesBehavior, box: { x: number; y: number; width: number; height: number }): Particle & { behind: boolean } {
  const spec = particle(b);
  const { width: w, height: h } = spec;
  const g = new Graphics();
  switch (spec.shape) {
    case 'dot': g.circle(0, 0, w / 2).fill(spec.color); break;
    case 'ring': g.circle(0, 0, w / 2).stroke({ width: Math.max(1.5, w / 8), color: spec.color }); break;
    case 'star': g.poly([0, -h / 2, w * 0.14, -h * 0.14, w / 2, 0, w * 0.14, h * 0.14, 0, h / 2, -w * 0.14, h * 0.14, -w / 2, 0, -w * 0.14, -h * 0.14]).fill(spec.color); break;
    case 'heart':
      g.moveTo(0, h * 0.42).bezierCurveTo(-w * 0.62, -h * 0.02, -w * 0.32, -h * 0.62, 0, -h * 0.22).bezierCurveTo(w * 0.32, -h * 0.62, w * 0.62, -h * 0.02, 0, h * 0.42).fill(spec.color);
      break;
    case 'leaf': g.ellipse(0, 0, w / 2, h / 2).fill(spec.color).moveTo(-w / 2, 0).lineTo(w / 2, 0).stroke({ width: Math.max(1, h / 8), color: shadeOf(spec.color, -0.3) }); break;
    default: g.rect(-w / 2, -h / 2, w, h).fill(spec.color);
  }
  if (spec.glow) g.blendMode = 'add';
  if (spec.shape === 'streak') g.rotation = Math.atan2(spec.vy, spec.vx) - Math.PI / 2;
  g.position.set(box.x + box.width * spec.at.x, box.y + box.height * spec.at.y);
  g.alpha = 0;
  return { behind: spec.behind, view: g, vx: spec.vx, vy: spec.vy, life: spec.life, span: spec.life, gravity: spec.gravity, grow: spec.grow, spin: spec.spin, wobble: spec.wobble, phase: Math.random() * 6, alpha: spec.alpha };
}

export function advanceParticle(p: Particle, dt: number): void {
  p.life -= dt;
  p.vy += p.gravity * dt;
  const age = p.span - p.life;
  const drift = p.wobble ? Math.sin(age * 3 + (p.phase ?? 0)) * p.wobble : 0;
  p.view.position.set(p.view.x + (p.vx + drift) * dt, p.view.y + p.vy * dt);
  const left = Math.max(0, p.life / p.span);
  // A stream's particle fades in quickly and out over the last part of its life; a burst piece fades all along.
  p.view.alpha = p.alpha === undefined ? left : p.alpha * Math.min(1, age * 12, left * 2.5);
  if (p.grow !== undefined) p.view.scale.set(Math.max(0.01, 1 + (p.grow - 1) * (1 - left)));
  if (p.spin) p.view.rotation += p.spin * dt;
  if (p.life <= 0) p.view.destroy();
}
