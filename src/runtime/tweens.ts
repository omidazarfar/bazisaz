import type { Ease } from '../format/types';
import { eased, type Entity, type Game } from './Game';

/**
 * Tweens of any number (roadmap item 1, 2026-11-27): an object's place, size, angle, opacity, scale or one of
 * its own values, or a game value, going to a target (or by an amount) over time with an easing curve; once,
 * a number of times or for ever, and there and back if asked. When the last round ends, "a tween finished"
 * fires on its object (the trigger tweenDone), with the tween's name.
 */

export const TWEEN_PROPERTIES = ['x', 'y', 'width', 'height', 'angle', 'opacity', 'scale', 'value', 'variable'] as const;
export type TweenProperty = (typeof TWEEN_PROPERTIES)[number];

export interface PropTween {
  /** The object it changes, or that it belongs to (a game value's tween belongs to the first object named). */
  entity: Entity | null;
  property: TweenProperty;
  /** The value's or the game value's name. */
  name: string;
  from: number;
  to: number;
  seconds: number;
  elapsed: number;
  ease?: Ease;
  /** Rounds in all; 0 for ever. */
  times: number;
  round: number;
  /** There and back each round. */
  yoyo: boolean;
  /** "by": each round goes on from where the last one ended (a spin keeps turning). */
  by: boolean;
  /** What the "tween finished" trigger may ask for. */
  label: string;
}

/** The number a tween changes, as it is now. Angles in degrees. */
export function readProperty(game: Game, e: Entity | null, property: TweenProperty, name: string): number {
  if (property === 'variable') return game.variables.get(name) ?? 0;
  if (!e) return 0;
  switch (property) {
    case 'x': return e.x;
    case 'y': return e.y;
    case 'width': return e.width;
    case 'height': return e.height;
    case 'angle': return (e.angle * 180) / Math.PI;
    case 'opacity': return e.opacity;
    case 'scale': return e.scale;
    case 'value': return e.values.get(name) ?? 0;
  }
}

function writeProperty(game: Game, e: Entity | null, property: TweenProperty, name: string, v: number): void {
  if (property === 'variable') return game.setValueOf(name, v);
  if (!e) return;
  switch (property) {
    case 'x': return game.place(e, v, e.y);
    case 'y': return game.place(e, e.x, v);
    // A size changes around the middle, so the object does not seem to slide.
    case 'width': {
      const w = Math.max(1, v);
      e.x += (e.width - w) / 2;
      e.width = w;
      return;
    }
    case 'height': {
      const h = Math.max(1, v);
      e.y += (e.height - h) / 2;
      e.height = h;
      return;
    }
    case 'angle':
      e.angle = (v * Math.PI) / 180;
      return;
    case 'opacity':
      e.opacity = Math.max(0, Math.min(1, v));
      return;
    case 'scale':
      e.scale = Math.max(0, v);
      return;
    case 'value':
      e.values.set(name, v);
      game.valuesChanged = true;
      return;
  }
}

/** Starts a tween; one already changing the same number of the same object gives way to it. */
export function startTween(game: Game, t: Omit<PropTween, 'elapsed' | 'round'>): void {
  game.propTweens = game.propTweens.filter((o) => !(o.entity === t.entity && o.property === t.property && o.name === t.name));
  game.propTweens.push({ ...t, elapsed: 0, round: 0 });
}

/** Moves every tween along by one step; those whose last round ended are left in `game.tweenEnds`. */
export function stepTweens(game: Game, dt: number): void {
  game.tweenEnds = [];
  if (!game.propTweens.length) return;
  const left: PropTween[] = [];
  for (const t of game.propTweens) {
    if (t.entity && !t.entity.alive) continue;
    t.elapsed += dt;
    let over = false;
    while (t.elapsed >= t.seconds && !over) {
      t.round += 1;
      if (t.times > 0 && t.round >= t.times) {
        over = true;
        break;
      }
      t.elapsed -= t.seconds;
      // Another round: from where this one ended when going "by", from the start again otherwise.
      if (t.by && !t.yoyo) [t.from, t.to] = [t.to, t.to + (t.to - t.from)];
    }
    const part = over ? 1 : Math.min(1, t.elapsed / t.seconds);
    // There and back: the first half of a round goes, the second comes back.
    const along = t.yoyo ? eased(t.ease, part < 0.5 ? part * 2 : 2 - part * 2) : eased(t.ease, part);
    writeProperty(game, t.entity, t.property, t.name, t.from + (t.to - t.from) * along);
    if (over) game.tweenEnds.push({ entity: t.entity, label: t.label });
    else left.push(t);
  }
  game.propTweens = left;
}
