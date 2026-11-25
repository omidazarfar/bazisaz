import type { GameProject, Ref, Scene, SoundName } from '../format/types';

/**
 * What a block's editor description is made of: its fields, the starting value, and the small helpers the
 * descriptions share. Moved here from src/editor/labels.ts as it was, so that a block's own file (src/blocks/)
 * can describe itself without importing the editor's big list, which imports the blocks.
 */

export type Option = { value: string; label: string };

export type Field = {
  key: string;
  label: string;
  hint?: string;
  /** Hides the field unless the block's other values make it relevant. */
  showIf?: (value: Record<string, unknown>) => boolean;
  /** What the field shows for a block saved before the field existed. */
  fallback?: unknown;
  /** Rarely needed: kept behind "more settings" unless it has been changed. */
  advanced?: boolean;
} & (
  | { kind: 'slider'; min: number; max: number; step: number; unit?: string }
  | { kind: 'number' }
  | { kind: 'choice'; options: Option[] }
  | { kind: 'bool' }
  | { kind: 'color' }
  /** A group name. */
  | { kind: 'tag' }
  /** The name of one of an object's own values. */
  | { kind: 'valueName' }
  /** One object or one group. */
  | { kind: 'ref' }
  /** Like ref, plus "the object this rule is about". */
  | { kind: 'target' }
  /** Like target, plus "where the screen was touched". */
  | { kind: 'place' }
  | { kind: 'textVariable' }
  | { kind: 'variable'; optional?: boolean }
  /** One of the things the player can carry in a bag. */
  | { kind: 'item' }
  /** Like target, or nothing at all: where a thing put into the bag flies from. */
  | { kind: 'flyFrom' }
  /** A number or a variable. */
  | { kind: 'amount' }
  | { kind: 'scene' }
  | { kind: 'prefab' }
  | { kind: 'prefabs' }
  | { kind: 'sound' }
  /** One of the game's pictures, or a new one from the library or the computer. */
  | { kind: 'image' }
  /** One of the sounds the user added, or none. */
  | { kind: 'music' }
  /** A line of text, which may show values by {name}. */
  | { kind: 'text' }
  /** The name of a message one rule sends to others. */
  | { kind: 'message' }
);

/** What a new block can look at to start with values that already work. */
export interface Context {
  project: GameProject;
  scene: Scene;
}

export interface Block<T> {
  title: string;
  about?: string;
  fields: Field[];
  make: (ctx: Context) => T;
  /** Offered only when this holds, e.g. a spawner needs something to spawn. */
  available?: (ctx: Context) => boolean;
  /** A behavior that only makes sense on an object with a picture. */
  needsImage?: boolean;
}

export const slider = (key: string, label: string, min: number, max: number, step: number, hint?: string, unit?: string): Field =>
  ({ key, label, hint, unit, kind: 'slider', min, max, step });
export const firstRef = ({ scene }: Context): Ref =>
  scene.objects[0] ? { by: 'id', id: scene.objects[0].id } : { by: 'tag', tag: '' };

export const TARGET: Field = { key: 'target', label: 'کدام شیء', kind: 'target' };

export const SOUND_LABEL: Record<SoundName, string> = {
  jump: 'پرش',
  coin: 'سکه',
  hit: 'ضربه',
  win: 'برد',
  lose: 'باخت',
  click: 'کلیک',
  pop: 'ترکیدن حباب',
  laser: 'لیزر',
  boom: 'انفجار',
  powerup: 'قدرت گرفتن',
  bounce: 'برگشتن توپ',
  tick: 'تیک',
  knock: 'تق چوب',
  clang: 'دنگ فلز',
  thud: 'گروپ سنگ',
  shatter: 'شکستن شیشه',
  squeak: 'جیر لاستیک',
};

const faNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2, useGrouping: false });

export function fa(value: number): string {
  return faNumber.format(value);
}

/** The colour treatments of a scene's picture, in words. */
export const LOOK_OPTIONS: Option[] = [
  { value: 'none', label: 'معمولی' },
  { value: 'warm', label: 'گرم (غروب)' },
  { value: 'cold', label: 'سرد (زمستان)' },
  { value: 'gray', label: 'سیاه‌وسفید' },
  { value: 'old', label: 'قدیمی (قهوه‌ای)' },
  { value: 'night', label: 'شب (آبی و کم‌رنگ)' },
  { value: 'dream', label: 'رؤیایی (روشن و ملایم)' },
  { value: 'vivid', label: 'پررنگ و شاد' },
];

export const hasPrefabs = ({ scene }: Context) => scene.prefabs.length > 0;
