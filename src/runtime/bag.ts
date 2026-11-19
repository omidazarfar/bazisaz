import { Container, FillGradient, Graphics, Sprite, Text, type Texture } from 'pixi.js';

/**
 * The player's bag: a row of glassy places with a gold edge, each holding the
 * picture of one thing the player carries and, when there is more than one of
 * it, how many. Drawn in the bag object's own space, from its top-left corner.
 */

/** One place of a bag: its middle and its side, in the bag's own space. */
export interface Slot {
  x: number;
  y: number;
  size: number;
}

/** Where the places of a bag go: across it if it is wider than tall, otherwise down it. */
export function bagSlots(width: number, height: number, count: number): Slot[] {
  const n = Math.max(1, Math.round(count));
  const across = width >= height;
  const cell = (across ? width : height) / n;
  const size = Math.min(cell, across ? height : width) * 0.9;
  return Array.from({ length: n }, (_, i) =>
    across ? { x: cell * (i + 0.5), y: height / 2, size } : { x: width / 2, y: cell * (i + 0.5), size },
  );
}

/** Which place of a bag a point (in the bag's own space) is on, or -1. */
export function slotAt(slots: Slot[], x: number, y: number): number {
  return slots.findIndex((s) => Math.abs(x - s.x) <= s.size / 2 && Math.abs(y - s.y) <= s.size / 2);
}

export interface Carried {
  name: string;
  texture: Texture | null;
  count: number;
}

/**
 * Draws a bag into `view`, replacing what was there. Returns the picture of
 * each thing in it by name, so that it can be made to pop when something
 * arrives or is tapped.
 */
export function drawBag(view: Container, slots: Slot[], things: Carried[], font: string[]): Map<string, Container> {
  for (const child of view.removeChildren()) child.destroy({ children: true });
  const icons = new Map<string, Container>();
  const frame = new Graphics();
  view.addChild(frame);
  slots.forEach((slot, i) => {
    const { size } = slot;
    const [x, y] = [slot.x - size / 2, slot.y - size / 2];
    const r = size * 0.2;
    const thing = things[i];
    // A soft shadow under the place, its dark glass, a gold edge and a shine along the top.
    frame.roundRect(x, y + size * 0.06, size, size, r).fill({ color: '#000000', alpha: 0.28 });
    frame.roundRect(x, y, size, size, r).fill(new FillGradient({
      type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
      colorStops: [{ offset: 0, color: thing ? '#33427a' : '#2a3459' }, { offset: 1, color: thing ? '#161d3d' : '#141a33' }],
    }));
    frame.roundRect(x, y, size, size, r).stroke({ width: Math.max(2, size * 0.05), color: thing ? '#ffd23f' : '#8a7a3a', alpha: thing ? 1 : 0.7 });
    frame.roundRect(x + size * 0.12, y + size * 0.08, size * 0.76, size * 0.16, size * 0.08).fill({ color: '#ffffff', alpha: 0.14 });
    if (!thing) return;
    // A soft gold light behind the thing, as if it were precious.
    frame.circle(slot.x, slot.y, size * 0.36).fill({ color: '#ffd23f', alpha: 0.1 });
    frame.circle(slot.x, slot.y, size * 0.24).fill({ color: '#ffe680', alpha: 0.12 });

    const icon = new Container();
    icon.position.set(slot.x, slot.y);
    if (thing.texture) {
      const picture = new Sprite(thing.texture);
      picture.anchor.set(0.5);
      const fit = (size * 0.76) / Math.max(thing.texture.width, thing.texture.height, 1);
      picture.scale.set(fit);
      icon.addChild(picture);
    }
    view.addChild(icon);
    icons.set(thing.name, icon);

    if (thing.count > 1) {
      const count = new Text({
        text: String(thing.count),
        style: {
          fontFamily: font,
          fontSize: Math.max(12, Math.round(size * 0.32)),
          fontWeight: 'bold',
          fill: '#ffffff',
          stroke: { color: '#1b2140', width: Math.max(3, Math.round(size * 0.08)), join: 'round' },
          padding: 6,
        },
      });
      count.anchor.set(1, 1);
      count.position.set(x + size * 0.94, y + size * 0.98);
      view.addChild(count);
    }
  });
  return icons;
}
