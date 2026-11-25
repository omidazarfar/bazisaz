import type { Comparison } from '../format/types';
import type { Box, Entity, Point } from './Game';
import { clamp } from './math';

/** Where objects meet and how numbers compare: shared by the runtime core and the blocks (moved out of Game.ts as they were). */

/** Highest point of a terrain surface under a horizontal footprint (including peaks between its feet). */
export function terrainTop(r: Box, heights: number[], left: number, right: number): number {
  const last = heights.length - 1;
  const sample = (x: number) => clamp((x - r.x) / r.width, 0, 1) * last;
  const at = (i: number) => heights[Math.floor(i)] + (heights[Math.ceil(i)] - heights[Math.floor(i)]) * (i % 1);
  const a = sample(left), b = sample(right);
  let high = Math.min(at(a), at(b));
  for (let i = Math.ceil(a); i < b; i++) high = Math.min(high, heights[i]);
  return r.y + r.height * high;
}

export function contains(box: Box, point: Point): boolean {
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}

export function overlaps(a: Entity, b: Entity): boolean {
  // Objects in different spaces (one fixed to the screen, one in the world) have no meaningful overlap.
  if (!a.visible || !b.visible || Boolean(a.def.fixed) !== Boolean(b.def.fixed)) return false;
  const ia = a.def.hitboxInset ?? 0;
  const ib = b.def.hitboxInset ?? 0;
  if (a.def.visual.kind === 'terrain' || b.def.visual.kind === 'terrain') {
    const [ground, other, inset] = a.def.visual.kind === 'terrain' ? [a, b, ib] as const : [b, a, ia] as const;
    const v = ground.def.visual;
    if (v.kind !== 'terrain') return false;
    const left = other.x + inset, right = other.x + other.width - inset;
    return right > ground.x && left < ground.x + ground.width && other.y + inset < ground.y + ground.height &&
      other.y + other.height - inset >= terrainTop(ground, v.heights, left, right) - 0.01;
  }
  // A turned box is tested as the turned shape it is. A circle looks the same however it is turned.
  const turned = (e: Entity) => !e.def.round && e.def.visual.kind !== 'text' && Math.abs(Math.sin(e.angle)) > 0.001;
  if (turned(a) || turned(b)) {
    if (a.def.round || b.def.round) {
      const [round, box, inset] = a.def.round ? [a, b, ib] : [b, a, ia];
      const r = Math.min(round.width, round.height) / 2 - (round === a ? ia : ib);
      // The circle's centre as seen from the box's own, unturned frame.
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const dx = round.x + round.width / 2 - cx;
      const dy = round.y + round.height / 2 - cy;
      const cos = Math.cos(-box.angle);
      const sin = Math.sin(-box.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const hw = box.width / 2 - inset;
      const hh = box.height / 2 - inset;
      return Math.hypot(lx - clamp(lx, -hw, hw), ly - clamp(ly, -hh, hh)) <= r;
    }
    return polygonsMeet(cornersOf(a, ia), cornersOf(b, ib));
  }
  if (a.def.round || b.def.round) {
    // A round object is the largest circle that fits its box. Against a box, the test is the
    // distance from the circle's centre to the nearest point of the box.
    const circle = (e: Entity, inset: number) => ({ x: e.x + e.width / 2, y: e.y + e.height / 2, r: Math.min(e.width, e.height) / 2 - inset });
    if (a.def.round && b.def.round) {
      const [ca, cb] = [circle(a, ia), circle(b, ib)];
      return Math.hypot(ca.x - cb.x, ca.y - cb.y) <= ca.r + cb.r;
    }
    const [round, box, inset] = a.def.round ? [circle(a, ia), b, ib] : [circle(b, ib), a, ia];
    const nearestX = Math.min(Math.max(round.x, box.x + inset), box.x + box.width - inset);
    const nearestY = Math.min(Math.max(round.y, box.y + inset), box.y + box.height - inset);
    return Math.hypot(round.x - nearestX, round.y - nearestY) <= round.r;
  }
  // Edges that meet count as touching. A body is stopped exactly at the face of a solid, never
  // inside it, so without this a ball would bounce off a brick without ever "touching" it.
  return (
    a.x + ia <= b.x + b.width - ib &&
    a.x + a.width - ia >= b.x + ib &&
    a.y + ia <= b.y + b.height - ib &&
    a.y + a.height - ia >= b.y + ib
  );
}

/** The four corners of an object's collision box, turned as the object is. */
export function cornersOf(e: Entity, inset: number): Point[] {
  const cx = e.x + e.width / 2;
  const cy = e.y + e.height / 2;
  const hw = e.width / 2 - inset;
  const hh = e.height / 2 - inset;
  const cos = Math.cos(e.angle);
  const sin = Math.sin(e.angle);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos }));
}

/** Whether two convex shapes overlap: they do unless some edge of either has all of the other on its far side. */
export function polygonsMeet(p: Point[], q: Point[]): boolean {
  for (const shape of [p, q]) {
    for (let i = 0; i < shape.length; i++) {
      const from = shape[i];
      const to = shape[(i + 1) % shape.length];
      const nx = to.y - from.y;
      const ny = from.x - to.x;
      const span = (points: Point[]) => {
        const along = points.map((t) => t.x * nx + t.y * ny);
        return [Math.min(...along), Math.max(...along)];
      };
      const [p0, p1] = span(p);
      const [q0, q1] = span(q);
      if (p1 < q0 || q1 < p0) return false;
    }
  }
  return true;
}

/** Whether `a` stands to `b` as the comparison says. */
export function test(a: number, op: Comparison, b: number): boolean {
  switch (op) {
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '==': return a === b;
    case '!=': return a !== b;
    case '>': return a > b;
    case '<': return a < b;
  }
}
