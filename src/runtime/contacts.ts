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
 * at the few objects filed there instead of at all of them. Objects fixed to the screen and objects in the world
 * live in separate grids, as they can never meet.
 */
class Grid {
  private cells = new Map<number, Entity[]>();
  constructor(private readonly size: number) {}

  clear(): void {
    this.cells.clear();
  }

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

  /** Every object filed in a cell that the box covers; each once (`seen` marks them for this question). */
  query(box: Box, seen: Set<Entity>, out: Entity[]): void {
    const [x0, y0] = [Math.floor(box.x / this.size), Math.floor(box.y / this.size)];
    const [x1, y1] = [Math.floor((box.x + box.width) / this.size), Math.floor((box.y + box.height) / this.size)];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.cells.get(this.key(cx, cy));
        if (!list) continue;
        for (const e of list) {
          if (seen.has(e)) continue;
          seen.add(e);
          out.push(e);
        }
      }
    }
  }
}

/** The broadphase for rules: built from the objects as they are, again whenever a rule may have moved or made one. */
export class Contacts {
  private readonly world = new Grid(192);
  private readonly screen = new Grid(192);
  /** Where each object is in the game's list, so answers come in the same order as a search of the whole list. */
  private readonly order = new Map<Entity, number>();
  private fresh = false;
  private readonly seen = new Set<Entity>();
  /** How many times the grids were built (for the performance budget, Phase 5). */
  builds = 0;

  /** The grids no longer match the objects (something moved, appeared or went). */
  stale(): void {
    this.fresh = false;
  }

  private build(entities: readonly Entity[]): void {
    this.world.clear();
    this.screen.clear();
    this.order.clear();
    entities.forEach((e, i) => {
      if (!e.alive || !e.visible) return;
      this.order.set(e, i);
      (e.def.fixed ? this.screen : this.world).add(e);
    });
    this.fresh = true;
    this.builds += 1;
  }

  /**
   * The visible objects in the same space whose reach comes within `pad` of a box (in that space), in the order
   * of the game's list. Hidden objects are never near anything.
   */
  around(entities: readonly Entity[], fixed: boolean, box: Box, pad: number): Entity[] {
    if (!this.fresh) this.build(entities);
    const out: Entity[] = [];
    this.seen.clear();
    (fixed ? this.screen : this.world).query({ x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad }, this.seen, out);
    return out.sort((a, b) => (this.order.get(a) ?? 0) - (this.order.get(b) ?? 0));
  }

  /** The objects that might touch `e`: near enough to it in its own space. */
  near(entities: readonly Entity[], e: Entity): Entity[] {
    return this.around(entities, Boolean(e.def.fixed), reach(e), 2);
  }
}
