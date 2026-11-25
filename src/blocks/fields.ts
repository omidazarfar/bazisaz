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
  /** The name of a function (a rule "when function … is run") or a question ("when asked …"), Phase 4. */
  | { kind: 'function' }
  | { kind: 'check' }
  /** One of the game's lists. */
  | { kind: 'list' }
  /** One of the game's values, of numbers or of text. */
  | { kind: 'anyValue' }
);

/** What a new block can look at to start with values that already work. */
export interface Context {
  project: GameProject;
  scene: Scene;
}

export interface Block<T> {
  title: string;
  about?: string;
  /** One line on what it is for, shown in the pick list when it has no longer note of its own (`about`). */
  short?: string;
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

export const messageNamesOf = (scene: Scene): string[] => {
  const names = new Set<string>();
  for (const r of scene.rules) {
    if (r.when.type === 'message') names.add(r.when.name);
    for (const a of [...r.then, ...(r.otherwise ?? [])]) if (a.type === 'send') names.add(a.name);
  }
  return [...names].filter(Boolean);
};

export const hasTexts = ({ project }: Context) => Boolean(project.textVariables?.length);

export const hasVariables = ({ project }: Context) => project.variables.length > 0;

export const hasItems = ({ project }: Context) => project.variables.some((v) => v.item);

export const firstItem = ({ project }: Context) => project.variables.find((v) => v.item)?.name ?? '';

export const COMPARE: Field = { key: 'op', label: 'مقایسه', kind: 'choice', options: [
  { value: '>=', label: 'بیشتر یا مساوی' },
  { value: '<=', label: 'کمتر یا مساوی' },
  { value: '==', label: 'مساوی' },
  { value: '!=', label: 'نامساوی' },
  { value: '>', label: 'بیشتر' },
  { value: '<', label: 'کمتر' },
] };

export const SPEED = (key: string, label: string, hint: string) => slider(key, label, -1500, 1500, 10, hint);
/** The group most games call their ground, if this scene has one, so new physics stands on it from the start. */
export const groundTag = ({ scene }: Context): string => {
  const tags = new Set(scene.objects.flatMap((o) => [...o.tags, ...(o.visual.kind === 'tiles' ? Object.values(o.visual.kinds).flatMap((k) => k.tags) : [])]));
  return ['زمین', 'ground', 'دیوار'].find((tag) => tags.has(tag)) ?? '';
};
export const moving = (v: Record<string, unknown>) => v.kind !== 'still';
export const custom = (v: Record<string, unknown>) => !v.material || v.material === 'custom';

/** The names of the functions (rules "when function … is run") or questions ("when asked …") of a scene. */
export const namesOf = (scene: Scene, type: 'called' | 'asked'): string[] => [
  ...new Set(scene.rules.flatMap((r) => ((r.when.type === 'called' || r.when.type === 'asked') && r.when.type === type && r.when.name ? [r.when.name] : []))),
];

/** The input fields of a function or question: up to three game values it is given. */
export const INPUT_FIELDS: Field[] = [1, 2, 3].map((i) => ({
  key: `in${i}`,
  label: `ورودی ${['اول', 'دوم', 'سوم'][i - 1]}`,
  hint: i === 1 ? 'یک مقدار بازی که موقع اجرا با عددی که قانونِ اجراکننده می‌دهد پر می‌شود؛ مثلاً «ارتفاع». خالی یعنی ورودی ندارد.' : undefined,
  kind: 'variable',
  optional: true,
  fallback: '',
  advanced: i > 1,
}));

/** What a caller gives a function or question: one amount for each of its inputs. */
export const ARGUMENT_FIELDS: Field[] = [1, 2, 3].map((i) => ({
  key: `a${i}`,
  label: `برای ورودی ${['اول', 'دوم', 'سوم'][i - 1]}`,
  hint: i === 1 ? 'عددی که در ورودی اول تابع گذاشته می‌شود. اگر تابع ورودی ندارد، مهم نیست.' : undefined,
  kind: 'amount',
  fallback: 0,
  advanced: i > 1,
}));
