import type { Behavior, Scene } from '../format/types';

/**
 * Screen framing (roadmap Phase 1, 2026-11-27): where the world is shown on a phone's screen while playing.
 *
 * - The controls area: when a level has on-screen buttons at the bottom (walk, jump, dash, a sword…), the
 *   bottom of the screen from the top of the highest of them down is kept for them, under a panel, and the
 *   world is framed above it: the ground, the pits and what comes are never under a thumb or a button.
 * - The play area is the screen above it. On a tall phone, the world is shown a little larger (up to 1.25
 *   times) instead of adding empty sky above the level, as long as the level is still at least as wide as the
 *   game's design across the screen; a world no larger than the screen is never cut.
 *
 * Only levels: a scene with something the camera follows. Menus and win screens keep their layout (fixed
 * things keep to their edges, see Game.placeOnScreen).
 */

export interface Frame {
  /** Height of the controls area at the bottom of the screen, in screen pixels (0: none). */
  strip: number;
  /** How much larger the world is drawn than the design (1 at the design's own shape). */
  zoom: number;
}

export const NO_FRAME: Frame = { strip: 0, zoom: 1 };
/** Room between the controls area's edge and its highest button. */
export const STRIP_GAP = 18;
/** The most the world is enlarged on a tall screen. */
export const MAX_FRAME_ZOOM = 1.25;

/** The groups of the scene's on-screen buttons: those its behaviors are steered by. */
export function buttonTags(scene: Scene): Set<string> {
  const tags = new Set<string>();
  const add = (t: string | undefined) => t && tags.add(t);
  for (const def of [...scene.objects, ...scene.prefabs]) {
    for (const b of def.behaviors as Behavior[]) {
      if (b.type === 'jumper' && b.on === 'button') add(b.buttonTag);
      if (b.type === 'walker' && b.control === 'buttons') { add(b.leftTag); add(b.rightTag); }
      if (b.type === 'moves') { add(b.dashTag); add(b.poundTag); }
      if (b.type === 'steer') add(b.rollTag);
    }
  }
  return tags;
}

/** Whether the scene is a level: it has something, moving in the world, that the camera follows. */
export function isLevel(scene: Scene): boolean {
  return scene.objects.some((o) => !o.fixed && o.behaviors.some((b) => b.type === 'camera'));
}

interface Box { x: number; y: number; width: number; height: number }

/**
 * The frame of a level on a view (the game's screen, in design pixels, which may be taller or wider than the
 * design). `controls`: where its on-screen buttons are on that view (after keeping to their edges).
 */
export function frameOf(scene: Scene, view: { width: number; height: number }, design: { width: number; height: number }, controls: Box[]): Frame {
  if (!isLevel(scene)) return NO_FRAME;
  // The bottom third only: a button high on the screen (a pause button) is not in the way of the ground.
  const low = controls.filter((b) => b.y + b.height / 2 > view.height * (2 / 3));
  const strip = low.length ? Math.max(0, Math.round(view.height - Math.min(...low.map((b) => b.y)) + STRIP_GAP)) : 0;
  const play = view.height - strip;
  // A world no larger than the screen (a board, a room): shown whole, smaller if the controls need the room.
  if (scene.width <= design.width && scene.height <= design.height) return { strip, zoom: Math.min(1, play / scene.height, view.width / scene.width) };
  // A larger world: drawn larger on a tall screen, never showing more of it from top to bottom than the design
  // does. Across, at least 80% of the design's width; a world no wider than the screen (a tower) is never cut
  // at the sides.
  const tall = play / Math.min(scene.height, design.height);
  const across = scene.width <= design.width ? view.width / scene.width : view.width / (0.8 * design.width);
  return { strip, zoom: Math.max(1, Math.min(MAX_FRAME_ZOOM, tall, across)) };
}
