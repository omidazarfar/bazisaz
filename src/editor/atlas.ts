import type { GameProject, ImageVisual } from '../format/types';

/**
 * Sprite sheets and texture atlases made by other tools (flagship Phase B): one big picture with many small ones
 * on it, and a file that says where each is. Read here: TexturePacker's JSON (hash or array), Aseprite's JSON (the
 * same, plus its animation tags and frame times), and the Starling / Sparrow XML that Kenney's packs and many
 * other tools write. Each small picture becomes a picture of the game; an animation's frames become an object's
 * animations (rest, run, jump, hurt).
 */

/** One small picture: where it is on the sheet, and where it sits in its full (untrimmed) picture. */
export interface AtlasFrame {
  name: string;
  /** On the sheet. When `rotated`, it lies turned a quarter clockwise there, `h` wide and `w` high. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  /** The full picture's size, and where the trimmed part goes in it. */
  fullW: number;
  fullH: number;
  ox: number;
  oy: number;
  /** How long it shows, in milliseconds (Aseprite), if the file says. */
  ms?: number;
}

/** A named run of frames (Aseprite's tags): frames `from` to `to`, counted from 0 in the file's order. */
export interface AtlasTag {
  name: string;
  from: number;
  to: number;
  direction: 'forward' | 'reverse' | 'pingpong';
}

export interface Atlas {
  /** The sheet's file name, as the atlas names it. */
  image: string | null;
  frames: AtlasFrame[];
  tags: AtlasTag[];
}

type Rect = { x: number; y: number; w: number; h: number };
interface JsonFrame {
  filename?: string;
  frame: Rect;
  rotated?: boolean;
  trimmed?: boolean;
  spriteSourceSize?: Rect;
  sourceSize?: { w: number; h: number };
  duration?: number;
}

/** Reads an atlas file of any of the kinds above. Throws, saying what is wrong, if it is none of them. */
export function parseAtlas(text: string): Atlas {
  const trimmed = text.trim();
  if (trimmed.startsWith('<')) return parseXml(trimmed);
  let data: { frames?: Record<string, JsonFrame> | JsonFrame[]; meta?: { image?: string; frameTags?: AtlasTag[] } };
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error('The atlas is neither JSON nor XML.');
  }
  if (!data.frames || typeof data.frames !== 'object') throw new Error('The atlas lists no frames.');
  const entries: [string, JsonFrame][] = Array.isArray(data.frames)
    ? data.frames.map((f, i) => [f.filename ?? String(i), f])
    : Object.entries(data.frames);
  const frames = entries.map(([name, f]): AtlasFrame => {
    if (!f?.frame) throw new Error(`Frame "${name}" has no place on the sheet.`);
    const source = f.spriteSourceSize ?? { x: 0, y: 0, w: f.frame.w, h: f.frame.h };
    const size = f.sourceSize ?? { w: f.frame.w, h: f.frame.h };
    return {
      // Aseprite names frames "sheet 0.aseprite": the file's own name is kept, without its extension.
      name: name.replace(/\.(png|aseprite|ase)$/i, ''),
      x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h,
      rotated: Boolean(f.rotated),
      fullW: size.w, fullH: size.h, ox: source.x, oy: source.y,
      ...(typeof f.duration === 'number' ? { ms: f.duration } : {}),
    };
  });
  const tags = (data.meta?.frameTags ?? [])
    .filter((t) => typeof t?.name === 'string' && Number.isInteger(t.from) && Number.isInteger(t.to))
    .map((t) => ({ name: t.name, from: t.from, to: t.to, direction: t.direction ?? 'forward' }));
  return { image: data.meta?.image ?? null, frames, tags };
}

function parseXml(text: string): Atlas {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const root = doc.querySelector('TextureAtlas');
  if (!root || doc.querySelector('parsererror')) throw new Error('The XML is not a TextureAtlas.');
  const num = (el: Element, name: string, fallback = 0) => {
    const v = el.getAttribute(name);
    return v === null ? fallback : Number(v);
  };
  const frames = [...root.querySelectorAll('SubTexture')].map((el): AtlasFrame => {
    const [w, h] = [num(el, 'width'), num(el, 'height')];
    // Starling: frameX/frameY are the trimmed part's offset, negative, in the full picture of frameWidth × frameHeight.
    return {
      name: (el.getAttribute('name') ?? '').replace(/\.png$/i, ''),
      x: num(el, 'x'), y: num(el, 'y'), w, h,
      rotated: el.getAttribute('rotated') === 'true',
      fullW: num(el, 'frameWidth', w), fullH: num(el, 'frameHeight', h),
      ox: -num(el, 'frameX'), oy: -num(el, 'frameY'),
    };
  });
  return { image: root.getAttribute('imagePath'), frames, tags: [] };
}

/** Each frame of the sheet as its own picture (a PNG data URL), keyed by frame name. */
export async function cutAtlas(sheetSrc: string, atlas: Atlas, only?: (name: string) => boolean): Promise<Map<string, string>> {
  const sheet = new Image();
  sheet.src = sheetSrc;
  await sheet.decode();
  const out = new Map<string, string>();
  for (const f of atlas.frames) {
    if (only && !only(f.name)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, f.fullW);
    canvas.height = Math.max(1, f.fullH);
    const ctx = canvas.getContext('2d')!;
    if (f.rotated) {
      // Turned a quarter back the other way: on the sheet it is h wide and w high.
      ctx.save();
      ctx.translate(f.ox, f.oy + f.h);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(sheet, f.x, f.y, f.h, f.w, 0, 0, f.h, f.w);
      ctx.restore();
    } else ctx.drawImage(sheet, f.x, f.y, f.w, f.h, f.ox, f.oy, f.w, f.h);
    out.set(f.name, canvas.toDataURL('image/png'));
  }
  return out;
}

/** The animations an object can have, each a list of frame names in order. */
export interface Animations {
  rest?: string[];
  run?: string[];
  jump?: string[];
  hurt?: string[];
  /** Images per second, from the frames' own times when the atlas has them. */
  fps?: number;
}

const ROLES: [keyof Omit<Animations, 'fps'>, RegExp][] = [
  ['rest', /^(rest|idle|stand|standing|breath|breathe|front)$/i],
  ['run', /^(run|running|walk|walking|move|moving)$/i],
  ['jump', /^(jump|jumping|air|fall|falling)$/i],
  ['hurt', /^(hurt|hit|damage|damaged|pain|ouch)$/i],
];

/**
 * The animations in an atlas. Tags (Aseprite) name them: a tag "run" or "walk" is the run. Without tags, frames
 * named like "hero_walk_a", "hero_walk_b" (Kenney) or "hero_run_01" are grouped by the word before the last part;
 * `base` keeps only the frames of one character ("hero").
 */
export function animationsOf(atlas: Atlas, base = ''): Animations {
  const result: Animations = {};
  const names = atlas.frames.map((f) => f.name);
  if (atlas.tags.length) {
    for (const tag of atlas.tags) {
      const role = ROLES.find(([, re]) => re.test(tag.name.trim()))?.[0];
      if (!role || result[role]) continue;
      let run = names.slice(tag.from, tag.to + 1);
      if (tag.direction === 'reverse') run = run.reverse();
      if (tag.direction === 'pingpong' && run.length > 2) run = [...run, ...run.slice(1, -1).reverse()];
      result[role] = run;
    }
    const times = atlas.frames.map((f) => f.ms).filter((ms): ms is number => typeof ms === 'number' && ms > 0);
    if (times.length) result.fps = Math.round(1000 / (times.reduce((a, b) => a + b, 0) / times.length));
    return result;
  }
  for (const name of names) {
    if (base && !name.startsWith(base)) continue;
    const words = name.slice(base.length).replace(/^[_\- ]+/, '').split(/[_\- ]+/);
    // The word that says the pose, before a frame letter or number at the end ("walk" in walk_a, run in run_01).
    const last = words.at(-1) ?? '';
    const word = words.length > 1 && /^([a-z]|\d+)$/i.test(last) ? words.at(-2)! : last;
    const role = ROLES.find(([, re]) => re.test(word))?.[0];
    if (!role) continue;
    (result[role] ??= []).push(name);
  }
  for (const role of ['rest', 'run', 'jump', 'hurt'] as const) result[role]?.sort();
  return result;
}

/** A picture key made from a frame's name: letters, digits and dashes only. */
const assetKey = (prefix: string, name: string) => `${prefix}-${name}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

/**
 * Puts the frames of an atlas into a project as pictures, each under the key `<prefix>-<frame name>`. Returns the
 * project, the key of each frame, and the animations found, as keys.
 */
export async function importAtlas(project: GameProject, sheetSrc: string, atlasText: string, prefix: string, only?: (name: string) => boolean): Promise<{ project: GameProject; keys: Map<string, string>; animations: Animations }> {
  const atlas = parseAtlas(atlasText);
  const pictures = await cutAtlas(sheetSrc, atlas, only);
  const keys = new Map<string, string>();
  const assets = { ...project.assets };
  for (const [name, src] of pictures) {
    const key = assetKey(prefix, name);
    keys.set(name, key);
    assets[key] = { type: 'image', src };
  }
  const found = animationsOf(atlas);
  const animations: Animations = { ...(found.fps ? { fps: found.fps } : {}) };
  for (const role of ['rest', 'run', 'jump', 'hurt'] as const) {
    const list = found[role]?.map((n) => keys.get(n)).filter((k): k is string => Boolean(k));
    if (list?.length) animations[role] = list;
  }
  return { project: { ...project, assets }, keys, animations };
}

/** A picture visual that plays the animations: resting frames, running ones, one for the air, one when hurt. */
export function animatedVisual(animations: Animations, fallback: string): ImageVisual {
  const rest = animations.rest?.length ? animations.rest : [fallback];
  return {
    kind: 'image',
    asset: rest[0],
    ...(rest.length > 1 ? { frames: rest.slice(1) } : {}),
    ...(animations.fps ? { fps: animations.fps } : {}),
    ...(animations.run?.length ? { moveFrames: animations.run } : {}),
    ...(animations.jump?.length ? { airFrames: animations.jump } : {}),
    ...(animations.hurt?.length ? { hurtFrames: animations.hurt } : {}),
    flip: true,
  };
}
