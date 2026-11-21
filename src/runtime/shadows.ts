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
