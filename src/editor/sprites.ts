import type { GameProject } from '../format/types';
import { ART_SPRITES } from './art';

/**
 * Ready-made pictures, so a game can look like a game before its maker has
 * drawn anything. Each is a small drawing kept as SVG text; when one is used
 * it is turned into an ordinary PNG inside the game, exactly as if the user
 * had uploaded it, so the game itself knows nothing about this library.
 */
export interface Sprite {
  id: string;
  /** Persian name shown under the picture. */
  name: string;
  category: SpriteCategory;
  /** Size of the drawing, which is also the size it gets in the scene. */
  width: number;
  height: number;
  /** What is inside the <svg> element. */
  body: string;
  /** More drawings shown one after another, e.g. a wing beat. */
  frames?: string[];
  /** Drawings shown while the object moves sideways. */
  move?: string[];
}

export type SpriteCategory = 'character' | 'enemy' | 'item' | 'board' | 'ground' | 'scenery' | 'button';

export const SPRITE_CATEGORIES: { id: SpriteCategory; title: string }[] = [
  { id: 'character', title: 'شخصیت‌ها' },
  { id: 'enemy', title: 'دشمن و خطر' },
  { id: 'item', title: 'جایزه و وسیله' },
  { id: 'board', title: 'مهره و صفحه' },
  { id: 'ground', title: 'زمین و سکو' },
  { id: 'scenery', title: 'منظره' },
  { id: 'button', title: 'دکمه‌ها' },
];

/** The pictures themselves are drawn in art.ts. */
export const SPRITES: Sprite[] = ART_SPRITES;

/** A drawing as a complete SVG file in a data: URL, for showing it in the editor's own pages. */
export function spriteUrl(sprite: Sprite, body = sprite.body): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sprite.width}" height="${sprite.height}" viewBox="0 0 ${sprite.width} ${sprite.height}">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Draws one drawing as a PNG, three times its size in the scene so it stays sharp on the densest screens. */
async function toPng(sprite: Sprite, body: string): Promise<string> {
  const img = new Image();
  img.src = spriteUrl(sprite, body);
  await img.decode();
  const scale = Math.min(3, 1024 / Math.max(sprite.width, sprite.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sprite.width * scale);
  canvas.height = Math.round(sprite.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export interface PlacedSprite {
  project: GameProject;
  /** The picture, and the extra pictures of its animations, as asset ids. */
  asset: string;
  frames: string[];
  move: string[];
}

/**
 * Puts a library picture into the game's assets. The same picture is stored
 * only once however many objects use it.
 */
export async function useSprite(project: GameProject, id: string): Promise<PlacedSprite> {
  const sprite = SPRITES.find((s) => s.id === id);
  if (!sprite) throw new Error(`No library picture called "${id}"`);
  const assets = { ...project.assets };
  const store = async (key: string, body: string) => {
    if (!assets[key]) assets[key] = { type: 'image', src: await toPng(sprite, body) };
    return key;
  };
  const asset = await store(`art-${id}`, sprite.body);
  const frames = await Promise.all((sprite.frames ?? []).map((body, i) => store(`art-${id}-f${i + 1}`, body)));
  const move = await Promise.all((sprite.move ?? []).map((body, i) => store(`art-${id}-m${i + 1}`, body)));
  return { project: { ...project, assets }, asset, frames, move };
}
