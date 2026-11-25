import type { Ref } from '../format/types';
import type { Box, Entity } from './Game';
import { overlaps } from './geometry';

/**
 * The one place that answers "do these two touch?" and "what is near this?" (Phase 2, docs/contact-report.md).
 * Both movers (the arcade `body` and real `physics`) keep their own way of moving; every rule asks here.
 */

/** Real physics, as far as contact goes (src/runtime/physics.ts). */
interface PhysicsContacts {
  exactly(a: Entity, b: Entity): boolean;
  touches(a: Entity, b: Entity): boolean;
}

/**
 * Whether two objects touch, by one definition:
 * - hidden objects, and an object fixed to the screen against one in the world, never touch;
 * - an object resting on another, or pressed against it, touches it whatever its hitbox inset;
 * - two whose real physics have shapes of their own touch only where those shapes do;
 * - otherwise their collision shapes overlap (or meet edge to edge), or real physics has them pressed together.
 */
export function touching(a: Entity, b: Entity, physics: PhysicsContacts | null): boolean {
  if (a === b || !a.visible || !b.visible || Boolean(a.def.fixed) !== Boolean(b.def.fixed)) return false;
  if (a.ground === b || b.ground === a || a.against === b || b.against === a) return true;
  // Far apart, however they are turned: no need for the exact shapes (2 px spare for real physics' own margin).
  const ra = reach(a);
  const rb = reach(b);
  if (ra.x > rb.x + rb.width + 2 || rb.x > ra.x + ra.width + 2 || ra.y > rb.y + rb.height + 2 || rb.y > ra.y + ra.height + 2) return false;
  if (physics?.exactly(a, b)) return physics.touches(a, b);
  return overlaps(a, b) || Boolean(physics?.touches(a, b));
}

/** The box an object can reach into, however it is turned: its own box, or the square around its turning circle. */
export function reach(e: Entity): Box {
  if (Math.abs(Math.sin(e.angle)) < 0.001 && Math.abs(Math.cos(e.angle) - 1) < 0.001) return e;
  const r = Math.hypot(e.width, e.height) / 2;
  const cx = e.x + e.width / 2;
  const cy = e.y + e.height / 2;
  return { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r };
}

/**
 * A spatial hash grid: objects filed by the square cells their reach covers, so a question about one place looks
 * at the few objects filed there instead of at all of them.
 */
class Grid {
  private cells = new Map<number, Entity[]>();
  constructor(private readonly size: number) {}

  private key(cx: number, cy: number): number {
    // Cells far outside any world still get keys of their own (2^20 cells each way).
    return (cx + 524288) * 1048576 + (cy + 524288);
  }

  add(e: Entity): void {
    const box = reach(e);
    const [x0, y0] = [Math.floor(box.x / this.size), Math.floor(box.y / this.size)];
    const [x1, y1] = [Math.floor((box.x + box.width) / this.size), Math.floor((box.y + box.height) / this.size)];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy);
        const list = this.cells.get(k);
        if (list) list.push(e);
        else this.cells.set(k, [e]);
      }
    }
  }

  /** Every object filed in a cell the box covers, each once: `stamp` marks the ones already given this time. */
  query(box: Box, stamp: number, out: Entity[]): void {
    const [x0, y0] = [Math.floor(box.x / this.size), Math.floor(box.y / this.size)];
    const [x1, y1] = [Math.floor((box.x + box.width) / this.size), Math.floor((box.y + box.height) / this.size)];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.cells.get(this.key(cx, cy));
        if (!list) continue;
        for (const e of list) {
          if (e.contactStamp === stamp) continue;
          e.contactStamp = stamp;
          out.push(e);
        }
      }
    }
  }
}

const CELL = 192;

/**
 * The broadphase for rules. Grids are made when first asked for, from the objects as they are, and kept until
 * something moves, appears or goes (`stale`): one for every visible object (by space: the screen and the world
 * never meet), and one per group, so that forty rules about coins share one grid of the coins.
 */
export class Contacts {
  private fresh = false;
  private all: { world: Grid; screen: Grid } | null = null;
  private groups = new Map<string, { world: Grid; screen: Grid }>();
  /** Where each object is in the game's list, for putting answers in that order. */
  private readonly order = new Map<Entity, number>();
  private stamp = 0;
  /** How many times the objects were gathered again (for the performance budget, Phase 5). */
  builds = 0;

  /** The grids no longer match the objects (something moved, appeared or went). */
  stale(): void {
    this.fresh = false;
  }

  private ensure(entities: readonly Entity[]): void {
    if (this.fresh) return;
    this.all = null;
    this.groups.clear();
    this.order.clear();
    entities.forEach((e, i) => this.order.set(e, i));
    this.fresh = true;
    this.builds += 1;
  }

  /** The place of an object in the game's list (for sorting answers the way a search of the whole list gives them). */
  orderOf(e: Entity): number {
    return this.order.get(e) ?? 0;
  }

  private grids(members: readonly Entity[]): { world: Grid; screen: Grid } {
    const grids = { world: new Grid(CELL), screen: new Grid(CELL) };
    for (const e of members) if (e.alive && e.visible) (e.def.fixed ? grids.screen : grids.world).add(e);
    return grids;
  }

  /** Visible objects of the same space whose reach comes within `pad` of a box. Hidden objects are never near. */
  around(entities: readonly Entity[], fixed: boolean, box: Box, pad: number): Entity[] {
    this.ensure(entities);
    this.all ??= this.grids(entities);
    return this.ask(fixed ? this.all.screen : this.all.world, box, pad);
  }

  /**
   * Visible, living objects of a group, in the same space, whose reach comes within `pad` of a box. `tagged` gives
   * the group's objects (Game.tagged).
   */
  aroundIn(entities: readonly Entity[], tag: string, members: () => readonly Entity[], fixed: boolean, box: Box, pad: number): Entity[] {
    this.ensure(entities);
    let grids = this.groups.get(tag);
    if (!grids) {
      grids = this.grids(members());
      this.groups.set(tag, grids);
    }
    return this.ask(fixed ? grids.screen : grids.world, box, pad);
  }

  private ask(grid: Grid, box: Box, pad: number): Entity[] {
    const out: Entity[] = [];
    this.stamp += 1;
    grid.query({ x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad }, this.stamp, out);
    return out;
  }

  /** The objects of `ref` that might touch `e`: near enough to it in its own space. Unsorted. */
  candidates(entities: readonly Entity[], ref: Ref, members: (tag: string) => readonly Entity[], e: Entity, wanted: () => Set<Entity>): Entity[] {
    if (isPlainGroup(ref)) return this.aroundIn(entities, ref.tag, () => members(ref.tag), Boolean(e.def.fixed), reach(e), 2);
    const set = wanted();
    // One object, or a few: looked at one by one.
    if (set.size <= 8) return [...set];
    return this.around(entities, Boolean(e.def.fixed), reach(e), 2).filter((o) => set.has(o));
  }
}

/** A group with nothing narrowing it (no value test, no spot, not one picked at random): its grid answers for it. */
export function isPlainGroup(ref: Ref): ref is Extract<Ref, { by: 'tag' }> {
  return ref.by === 'tag' && !ref.where && !ref.spot && ref.pick !== 'random';
}
