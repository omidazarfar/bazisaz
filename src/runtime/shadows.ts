/**
 * Where a light reaches when walls stand in its way: the outline of what it
 * can see, worked out by casting rays toward every corner of every wall near
 * it (and a little either side of each, to slip past it) and round the
 * circle of its reach. Each ray stops a little way into the first wall it
 * meets, so the face of a wall toward the light is lit and what is behind it
 * is in shadow.
 */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Rays round the edge of the light, where nothing is in the way. */
const AROUND = 72;
/** How far into a wall a ray still lights, so the wall's own face is seen. */
const BLEED = 12;

/** The lit area as a flat list of points (x, y, x, y, …) in the same space as the boxes, or null when nothing is in the way. */
export function lightPolygon(cx: number, cy: number, radius: number, boxes: Box[]): number[] | null {
  const near = boxes.filter((b) => {
    const nx = Math.max(b.x, Math.min(cx, b.x + b.width));
    const ny = Math.max(b.y, Math.min(cy, b.y + b.height));
    return Math.hypot(nx - cx, ny - cy) < radius;
  });
  if (near.length === 0) return null;
  // A light inside a wall lights nothing past its own wall.
  const segments: number[][] = [];
  const angles: number[] = [];
  for (const b of near) {
    const corners = [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]];
    for (let i = 0; i < 4; i++) {
      const [a, c] = [corners[i], corners[(i + 1) % 4]];
      segments.push([a[0], a[1], c[0], c[1]]);
      const angle = Math.atan2(a[1] - cy, a[0] - cx);
      angles.push(angle - 0.0008, angle, angle + 0.0008);
    }
  }
  for (let i = 0; i < AROUND; i++) angles.push(-Math.PI + (i * 2 * Math.PI) / AROUND);
  angles.sort((a, b) => a - b);
  const points: number[] = [];
  for (const angle of angles) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let nearest = radius;
    for (const [x1, y1, x2, y2] of segments) {
      const sx = x2 - x1;
      const sy = y2 - y1;
      const denominator = dx * sy - dy * sx;
      if (Math.abs(denominator) < 1e-9) continue;
      const t = ((x1 - cx) * sy - (y1 - cy) * sx) / denominator;
      const u = ((x1 - cx) * dy - (y1 - cy) * dx) / denominator;
      if (t > 0 && t < nearest && u >= 0 && u <= 1) nearest = t;
    }
    const reach = Math.min(radius, nearest < radius ? nearest + BLEED : radius);
    points.push(cx + dx * reach, cy + dy * reach);
  }
  return points;
}

/** Whether a point is inside a polygon given as a flat list of points. */
export function insidePolygon(x: number, y: number, points: number[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [points[i], points[i + 1], points[j], points[j + 1]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Where a light reaches again behind walls whose shadows are only `length` long (item 5 of the 2026-11-27 roadmap):
 * past the end of each shadow the light goes on, as far as its reach. Each ray from the light is lit except where a
 * wall's shadow lies on it (from a little into the wall, so its face is lit, to `length` past its far side); the
 * parts lit again after the first shadow are given as four-sided pieces between neighbouring rays (flat lists of
 * points), to be drawn with the lit area of lightPolygon. Empty when nothing is in the way or the shadows reach as far
 * as the light does.
 */
export function lightBeyond(cx: number, cy: number, radius: number, boxes: Box[], length: number): number[][] {
  if (!(length > 0) || length >= radius) return [];
  const near = boxes.filter((b) => {
    const nx = Math.max(b.x, Math.min(cx, b.x + b.width));
    const ny = Math.max(b.y, Math.min(cy, b.y + b.height));
    return Math.hypot(nx - cx, ny - cy) < radius;
  });
  if (near.length === 0) return [];
  const angles: number[] = [];
  for (const b of near) {
    for (const [x, y] of [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]]) {
      const angle = Math.atan2(y - cy, x - cx);
      angles.push(angle - 0.0008, angle, angle + 0.0008);
    }
  }
  for (let i = 0; i < AROUND * 2; i++) angles.push(-Math.PI + (i * Math.PI) / AROUND);
  angles.sort((a, b) => a - b);
  /** The parts of one ray lit again after its first shadow: [from, to] distances. */
  const litAgain = (angle: number): [number, number][] => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const shadows: [number, number][] = [];
    for (const b of near) {
      // Where the ray enters and leaves the box (the slab method).
      let t0 = -Infinity;
      let t1 = Infinity;
      for (const [d, lo, hi, c] of [[dx, b.x, b.x + b.width, cx], [dy, b.y, b.y + b.height, cy]]) {
        if (Math.abs(d) < 1e-12) {
          if (c < lo || c > hi) t0 = Infinity;
          continue;
        }
        const a = (lo - c) / d;
        const z = (hi - c) / d;
        t0 = Math.max(t0, Math.min(a, z));
        t1 = Math.min(t1, Math.max(a, z));
      }
      if (t0 > t1 || t1 <= 0 || t0 >= radius) continue;
      shadows.push([t0 <= 0 ? 0 : t0 + BLEED, t1 + length]);
    }
    if (shadows.length === 0) return [];
    shadows.sort((a, b) => a[0] - b[0]);
    // The lit stretches between shadows, after the first one.
    const lit: [number, number][] = [];
    let reach = shadows[0][1];
    for (const [from, to] of shadows.slice(1)) {
      if (from > reach) lit.push([reach, Math.min(from, radius)]);
      reach = Math.max(reach, to);
    }
    if (reach < radius) lit.push([reach, radius]);
    return lit.filter(([a, b]) => b - a > 0.5);
  };
  const rays = angles.map((angle) => ({ dx: Math.cos(angle), dy: Math.sin(angle), lit: litAgain(angle) }));
  const pieces: number[][] = [];
  for (let i = 0; i < rays.length; i++) {
    const a = rays[i];
    const b = rays[(i + 1) % rays.length];
    for (let k = 0; k < Math.min(a.lit.length, b.lit.length); k++) {
      const [a0, a1] = a.lit[k];
      const [b0, b1] = b.lit[k];
      pieces.push([cx + a.dx * a0, cy + a.dy * a0, cx + a.dx * a1, cy + a.dy * a1, cx + b.dx * b1, cy + b.dy * b1, cx + b.dx * b0, cy + b.dy * b0]);
    }
  }
  return pieces;
}
