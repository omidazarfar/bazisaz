/**
 * The outline of a picture, for physics that should touch where the picture
 * is drawn rather than at the corners of its box: the smallest convex shape
 * around its solid pixels, cut down to a few corners. Points run from 0 to 1
 * across the picture (or across the part of it a crop shows).
 */
export interface Point {
  x: number;
  y: number;
}

/** How finely the picture is looked at; enough for a shape a physics body can use. */
const GRID = 64;
/** Box2D is fastest and steadiest with few corners. */
const MOST_CORNERS = 8;
/** Pixels at least this opaque (of 255) count as part of the picture. */
const SOLID = 48;

export function traceOutline(image: CanvasImageSource, crop?: { x: number; y: number; w: number; h: number }): Point[] | null {
  const size = sizeOf(image);
  if (!size) return null;
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GRID;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  let data: Uint8ClampedArray;
  try {
    ctx.drawImage(image, c.x * size.w, c.y * size.h, c.w * size.w, c.h * size.h, 0, 0, GRID, GRID);
    data = ctx.getImageData(0, 0, GRID, GRID).data;
  } catch {
    return null;
  }
  const points: Point[] = [];
  for (let y = 0; y < GRID; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < GRID; x++) {
      if (data[(y * GRID + x) * 4 + 3] < SOLID) continue;
      if (left < 0) left = x;
      right = x;
    }
    if (left < 0) continue;
    // Both corners of the first and last solid pixel of the row.
    points.push({ x: left, y }, { x: left, y: y + 1 }, { x: right + 1, y }, { x: right + 1, y: y + 1 });
  }
  if (points.length < 3) return null;
  const hull = simplify(convexHull(points), MOST_CORNERS).map((p) => ({ x: p.x / GRID, y: p.y / GRID }));
  return area(hull) > 0.01 ? hull : null;
}

function sizeOf(image: CanvasImageSource): { w: number; h: number } | null {
  const i = image as { naturalWidth?: number; naturalHeight?: number; width?: number | { baseVal: { value: number } }; height?: number | { baseVal: { value: number } } };
  const w = i.naturalWidth || (typeof i.width === 'number' ? i.width : 0);
  const h = i.naturalHeight || (typeof i.height === 'number' ? i.height : 0);
  return w > 0 && h > 0 ? { w, h } : null;
}

/** Andrew's monotone chain: the convex hull, going round one way. */
export function convexHull(points: Point[]): Point[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Point[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Drops the corners that matter least (the smallest triangle each makes with its neighbours) until only `most` are left. */
function simplify(hull: Point[], most: number): Point[] {
  const h = [...hull];
  const weight = (i: number) => {
    const [a, b, c] = [h[(i + h.length - 1) % h.length], h[i], h[(i + 1) % h.length]];
    return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  };
  while (h.length > most) {
    let least = 0;
    for (let i = 1; i < h.length; i++) if (weight(i) < weight(least)) least = i;
    h.splice(least, 1);
  }
  return h;
}

function area(p: Point[]): number {
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    const [a, b] = [p[i], p[(i + 1) % p.length]];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
