/** Small number helpers shared by the runtime and the blocks (moved out of Game.ts as they were). */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
