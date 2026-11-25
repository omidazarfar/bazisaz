import type { GameProject, ImageVisual, TileKind } from '../../format/types';
import { animationsOf, cutAtlas, parseAtlas, type Animations } from '../atlas';
import tilesPng from './kenney-platformer/tiles.png?url';
import tilesXml from './kenney-platformer/tiles.xml?raw';
import charactersPng from './kenney-platformer/characters.png?url';
import charactersXml from './kenney-platformer/characters.xml?raw';
import enemiesPng from './kenney-platformer/enemies.png?url';
import enemiesXml from './kenney-platformer/enemies.xml?raw';
import backgroundsPng from './kenney-platformer/backgrounds.png?url';
import backgroundsXml from './kenney-platformer/backgrounds.xml?raw';
import sfxCoin from './kenney-platformer/sounds/sfx_coin.ogg?url';
import sfxGem from './kenney-platformer/sounds/sfx_gem.ogg?url';
import sfxHurt from './kenney-platformer/sounds/sfx_hurt.ogg?url';
import sfxJump from './kenney-platformer/sounds/sfx_jump.ogg?url';
import sfxJumpHigh from './kenney-platformer/sounds/sfx_jump-high.ogg?url';
import sfxBump from './kenney-platformer/sounds/sfx_bump.ogg?url';
import sfxMagic from './kenney-platformer/sounds/sfx_magic.ogg?url';
import sfxSelect from './kenney-platformer/sounds/sfx_select.ogg?url';
import sfxDisappear from './kenney-platformer/sounds/sfx_disappear.ogg?url';
import sfxThrow from './kenney-platformer/sounds/sfx_throw.ogg?url';

/**
 * Kenney's New Platformer Pack (CC0, see CREDITS.md): one art style for the flagship game's characters, enemies,
 * tiles, backgrounds and sounds. Its sheets are read with the atlas importer (src/editor/atlas.ts), the same one
 * the editor offers for any sheet, so the flagship exercises it.
 */

const SHEETS = {
  tiles: { png: tilesPng, xml: tilesXml },
  characters: { png: charactersPng, xml: charactersXml },
  enemies: { png: enemiesPng, xml: enemiesXml },
  backgrounds: { png: backgroundsPng, xml: backgroundsXml },
} as const;
export type Sheet = keyof typeof SHEETS;

const SOUNDS = {
  coin: sfxCoin, gem: sfxGem, hurt: sfxHurt, jump: sfxJump, 'jump-high': sfxJumpHigh, bump: sfxBump,
  magic: sfxMagic, select: sfxSelect, disappear: sfxDisappear, throw: sfxThrow,
} as const;
export type PackSound = keyof typeof SOUNDS;

/** Frames already cut, per sheet and name, so a sheet is decoded once. */
const cut = new Map<string, string>();

/** The picture key of a frame of the pack. */
export const packKey = (name: string) => `kenney-${name.replace(/_/g, '-')}`;

/** Puts frames of a sheet into the project as pictures (once each); returns the project and their keys, in order. */
export async function packPictures(project: GameProject, sheet: Sheet, names: string[]): Promise<{ project: GameProject; keys: string[] }> {
  const missing = names.filter((n) => !cut.has(`${sheet}/${n}`));
  if (missing.length) {
    const atlas = parseAtlas(SHEETS[sheet].xml);
    const unknown = missing.filter((n) => !atlas.frames.some((f) => f.name === n));
    if (unknown.length) throw new Error(`Not in the Kenney ${sheet} sheet: ${unknown.join(', ')}`);
    const pictures = await cutAtlas(SHEETS[sheet].png, atlas, (n) => missing.includes(n));
    for (const [name, src] of pictures) cut.set(`${sheet}/${name}`, src);
  }
  const assets = { ...project.assets };
  const keys = names.map((name) => {
    const key = packKey(name);
    if (assets[key]?.type !== 'image') assets[key] = { type: 'image', src: cut.get(`${sheet}/${name}`)! };
    return key;
  });
  return { project: { ...project, assets }, keys };
}

/**
 * Cuts away the empty border that all the given pictures share (the same box for each, so an animation does not
 * jump), keeping `margin` pixels. Kenney's characters stand in 128-pixel squares with much room around them.
 */
async function trimTogether(srcs: string[], margin = 2): Promise<string[]> {
  const images = await Promise.all(srcs.map(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  }));
  const [w, h] = [images[0].naturalWidth, images[0].naturalHeight];
  let [x0, y0, x1, y1] = [w, h, 0, 0];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  for (const img of images) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < x0) return srcs;
  [x0, y0] = [Math.max(0, x0 - margin), Math.max(0, y0 - margin)];
  [x1, y1] = [Math.min(w - 1, x1 + margin), Math.min(h - 1, y1 + margin)];
  return images.map((img) => {
    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1;
    out.height = y1 - y0 + 1;
    out.getContext('2d')!.drawImage(img, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  });
}

/** Frames of a sheet as pictures cut to the box they share (see trimTogether), under keys of their own ("…-trim"). */
export async function packTrimmed(project: GameProject, sheet: Sheet, names: string[]): Promise<{ project: GameProject; keys: string[]; width: number; height: number }> {
  const { project: p, keys } = await packPictures(project, sheet, names);
  const trimmed = await trimTogether(keys.map((k) => (p.assets[k] as { src: string }).src));
  const assets = { ...p.assets };
  const out = keys.map((k, i) => {
    assets[`${k}-trim`] = { type: 'image', src: trimmed[i] };
    // The untrimmed square is not needed any more.
    delete assets[k];
    return `${k}-trim`;
  });
  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = trimmed[0];
  });
  return { project: { ...p, assets }, keys: out, ...size };
}

/** One frame of a sheet as a picture visual, its key in the project. */
export async function packPicture(project: GameProject, sheet: Sheet, name: string, extra: Partial<ImageVisual> = {}): Promise<{ project: GameProject; visual: ImageVisual; key: string }> {
  const { project: p, keys } = await packPictures(project, sheet, [name]);
  return { project: p, visual: { kind: 'image', asset: keys[0], ...extra }, key: keys[0] };
}

/** An animation of frames in turn (a flag waving, a fly's wings), cut to the box its frames share. */
export async function packAnimation(project: GameProject, sheet: Sheet, names: string[], fps: number): Promise<{ project: GameProject; visual: ImageVisual; width: number; height: number }> {
  const { project: p, keys, width, height } = await packTrimmed(project, sheet, names);
  return { project: p, visual: { kind: 'image', asset: keys[0], frames: keys.slice(1), fps }, width, height };
}

/**
 * A character of the pack with its animations, found from the frames' names (character_beige_walk_a…): resting,
 * walking, in the air, hurt. Mirrored when it goes left.
 */
export async function packCharacter(project: GameProject, sheet: Sheet, base: string, fps = 8): Promise<{ project: GameProject; visual: ImageVisual; width: number; height: number }> {
  const atlas = parseAtlas(SHEETS[sheet].xml);
  const found: Animations = animationsOf(atlas, base);
  // Kenney's characters stand still on "idle"; "front" is a pose facing the player, not a rest frame.
  const rest = atlas.frames.some((f) => f.name === `${base}_idle`) ? [`${base}_idle`] : (found.rest ?? []);
  const names = [...new Set([...rest, ...(found.run ?? []), ...(found.jump ?? []), ...(found.hurt ?? [])])];
  // All its frames cut to the one box they share, so the picture fills the object and does not jump between poses.
  const { project: p, keys: trimmed, width, height } = await packTrimmed(project, sheet, names);
  const byName = new Map(names.map((n, i) => [n, trimmed[i]]));
  const keys = (list?: string[]) => list?.map((n) => byName.get(n)!);
  return {
    project: p,
    width,
    height,
    visual: {
      kind: 'image',
      asset: byName.get(rest[0] ?? names[0])!,
      fps,
      flip: true,
      ...(found.run?.length ? { moveFrames: keys(found.run) } : {}),
      ...(found.jump?.length ? { airFrames: keys(found.jump) } : {}),
      ...(found.hurt?.length ? { hurtFrames: keys(found.hurt) } : {}),
    },
  };
}

/** Kenney's terrain names for each way a cell's neighbours are filled (top 1, right 2, bottom 4, left 8). */
const AUTOTILE_PARTS = [
  'block', 'vertical_bottom', 'horizontal_left', 'block_bottom_left',
  'vertical_top', 'vertical_middle', 'block_top_left', 'block_left',
  'horizontal_right', 'block_bottom_right', 'horizontal_middle', 'block_bottom',
  'block_top_right', 'block_right', 'block_top', 'block_center',
];

/** A tile kind of one of the pack's terrains (grass, stone, dirt, sand, snow, purple), each cell fitted to its neighbours. */
export async function packTerrain(project: GameProject, material: string, kind: Omit<TileKind, 'autotile' | 'asset'>): Promise<{ project: GameProject; kind: TileKind }> {
  const names = AUTOTILE_PARTS.map((part) => `terrain_${material}_${part}`);
  const { project: p, keys } = await packPictures(project, 'tiles', names);
  return { project: p, kind: { ...kind, asset: keys[0], autotile: keys } };
}

/** A sound of the pack, added to the project's sounds (once); returns its key for "play sound". */
export async function packSound(project: GameProject, name: PackSound): Promise<{ project: GameProject; key: string }> {
  const key = `kenney-sfx-${name}`;
  if (project.assets[key]?.type === 'sound') return { project, key };
  const blob = await (await fetch(SOUNDS[name])).blob();
  const src = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
  return { project: { ...project, assets: { ...project.assets, [key]: { type: 'sound', src, name: `Kenney ${name}` } } }, key };
}
