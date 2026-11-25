import type { Action, Behavior, Trigger } from '../format/types';
import { COMPARE, fa, hasPrefabs, hasTexts, LOOK_OPTIONS, SOUND_LABEL, type Block, type Context, type Field, type Option } from '../blocks/fields';
import { ACTION_BLOCKS, BEHAVIOR_BLOCKS, TRIGGER_BLOCKS } from '../blocks/registry';

export { fa, LOOK_OPTIONS, SOUND_LABEL, type Context, type Field };

/**
 * Everything the editor says about the format, in the user's words. Each
 * behavior, trigger and action is described once here: its Persian name, a
 * starting value, and the list of fields that edit it. The panels are drawn
 * from these descriptions, so adding a block to the engine means adding one
 * entry here and nothing in the panels.
 */





/** The painted backdrops, in words. */
export const RETRO_OPTIONS: Option[] = [
  { value: 'none', label: 'هیچ' },
  { value: 'pixel', label: 'پیکسلی، مثل بازی‌های قدیمی' },
  { value: 'crt', label: 'صفحه‌ی گرد و خط‌دار تلویزیون قدیمی' },
  { value: 'film', label: 'فیلم قدیمی با خش و رنگ قهوه‌ای' },
];

export const WEATHER_OPTIONS: Option[] = [
  { value: 'none', label: 'صاف' },
  { value: 'rain', label: 'باران' },
  { value: 'storm', label: 'طوفان با رعد و برق' },
  { value: 'snow', label: 'برف' },
  { value: 'leaves', label: 'برگ‌ریزان' },
  { value: 'embers', label: 'جرقه‌های آتش' },
  { value: 'fog', label: 'مه' },
];

export const SKY_OPTIONS: Option[] = [
  { value: 'none', label: 'هیچ (فقط رنگ پس‌زمینه)' },
  { value: 'day', label: 'روز آفتابی با ابر و تپه' },
  { value: 'sunset', label: 'غروب با کوه' },
  { value: 'night', label: 'شب پرستاره با ماه' },
  { value: 'space', label: 'فضا با سیاره و ستاره' },
  { value: 'underwater', label: 'زیر آب با نور و حباب' },
  { value: 'forest', label: 'جنگل کاج' },
  { value: 'desert', label: 'بیابان با تپه‌ی شنی' },
  { value: 'city', label: 'شهر در غروب' },
  { value: 'cave', label: 'غار با کریستال' },
  { value: 'snow', label: 'کوهستان برفی با بارش برف' },
];
/** What the cells of a tile map can be made of, in words. */
export const TILE_STYLE_OPTIONS: Option[] = [
  { value: 'flat', label: 'رنگ ساده' },
  { value: 'grass', label: 'چمن روی خاک' },
  { value: 'dirt', label: 'خاک' },
  { value: 'stone', label: 'سنگ' },
  { value: 'brick', label: 'آجر' },
  { value: 'wood', label: 'چوب' },
  { value: 'ice', label: 'یخ' },
  { value: 'metal', label: 'فلز' },
  { value: 'sand', label: 'شن' },
  { value: 'snow', label: 'برف روی سنگ' },
  { value: 'water', label: 'آب (موج می‌زند)' },
  { value: 'lava', label: 'گدازه (موج می‌زند)' },
];
/** The music that comes with the engine, in words, for pick lists. */
export const BUILTIN_MUSIC_OPTIONS: Option[] = [
  { value: 'music:happy', label: 'موسیقی آماده: شاد' },
  { value: 'music:adventure', label: 'موسیقی آماده: ماجراجویی' },
  { value: 'music:calm', label: 'موسیقی آماده: آرام' },
  { value: 'music:tense', label: 'موسیقی آماده: هیجانی' },
  { value: 'music:dungeon', label: 'موسیقی آماده: سیاه‌چال' },
  { value: 'music:orbit', label: 'موسیقی آماده: مدار فضایی' },
  { value: 'music:forest', label: 'موسیقی آماده: جنگل' },
  { value: 'music:mystery', label: 'موسیقی آماده: رمزآلود' },
];
/** Messages already in use in a scene, so a new rule starts with one that is already being sent or waited for. */
// Every behavior is a block in its own file (src/blocks/behaviors/), which describes itself.
export const BEHAVIORS = Object.fromEntries(BEHAVIOR_BLOCKS.map((b) => [b.type, b.editor])) as { [K in Behavior['type']]: Block<Extract<Behavior, { type: K }>> };

// Every trigger is a block in its own file (src/blocks/triggers/), which describes itself.
export const TRIGGERS = Object.fromEntries(TRIGGER_BLOCKS.map((b) => [b.type, b.editor])) as { [K in Trigger['type']]: Block<Extract<Trigger, { type: K }>> };

export const CONDITION_FIELDS: Field[] = [
  { key: 'name', label: 'مقدار', kind: 'variable' },
  COMPARE,
  { key: 'value', label: 'با', kind: 'amount' },
];


/** A condition on one of an object's own values, rather than on a game variable. */
export const OBJECT_CONDITION_FIELDS: Field[] = [
  { key: 'of', label: 'مقدارِ کدام شیء', kind: 'target' },
  { key: 'name', label: 'کدام مقدارش', kind: 'valueName' },
  COMPARE,
  { key: 'value', label: 'با', kind: 'amount' },
];

// Every action is a block in its own file (src/blocks/actions/), which describes itself.
export const ACTIONS = Object.fromEntries(ACTION_BLOCKS.map((b) => [b.type, b.editor])) as { [K in Action['type']]: Block<Extract<Action, { type: K }>> };


// ── How the blocks are grouped in the pick lists ───────────────────────────

export interface BlockGroup<T extends string> {
  title: string;
  types: T[];
}

/** The few blocks most games are made of, shown first so a newcomer is not faced with all of them at once. */
export const COMMON_BEHAVIORS: Behavior['type'][] = ['jumper', 'walker', 'steer', 'followFinger', 'mover', 'patrol', 'chase', 'body', 'physics', 'camera', 'spawner'];
export const COMMON_TRIGGERS: Trigger['type'][] = ['tap', 'touch', 'tapObject', 'start', 'every', 'variable', 'swipe', 'near'];
export const COMMON_ACTIONS: Action['type'][] = ['setVariable', 'destroy', 'spawn', 'playSound', 'goToScene', 'restartScene', 'show', 'hide', 'effect', 'burst', 'flash', 'wait'];

export const BEHAVIOR_GROUPS: BlockGroup<Behavior['type']>[] = [
  { title: 'کنترل با انگشت', types: ['jumper', 'walker', 'moves', 'steer', 'followFinger', 'draggable'] },
  { title: 'حرکت خودکار', types: ['mover', 'homing', 'patrol', 'route', 'chase', 'launch', 'wave', 'attach'] },
  { title: 'فیزیک و دوربین', types: ['body', 'physics', 'joint', 'field', 'camera'] },
  { title: 'ساختن و از بین رفتن', types: ['spawner', 'lifetime'] },
  { title: 'جلوه‌ی ظاهری', types: ['animate', 'particles', 'light', 'rotate', 'pulse', 'blink', 'trail', 'scrollImage'] },
];

export const TRIGGER_GROUPS: BlockGroup<Trigger['type']>[] = [
  { title: 'لمس صفحه', types: ['tap', 'tapObject', 'swipe', 'holding'] },
  { title: 'اشیا', types: ['touch', 'near', 'land', 'offscreen', 'noneLeft', 'dead'] },
  { title: 'فیزیک واقعی', types: ['hit', 'thrown', 'rest', 'snap'] },
  { title: 'زمان', types: ['start', 'every', 'eachEvery', 'after'] },
  { title: 'جورچین و منطق', types: ['message', 'value', 'line'] },
  { title: 'مقدارها و تبلیغ', types: ['variable', 'textEquals', 'reward'] },
  { title: 'کوله‌پشتی', types: ['useItem', 'useItemOn'] },
];

export const ACTION_GROUPS: BlockGroup<Action['type']>[] = [
  { title: 'امتیاز و مقدارها', types: ['setVariable', 'setTextVariable', 'resetVariables', 'recordScore', 'achieve'] },
  { title: 'گفت‌وگو', types: ['say'] },
  { title: 'کوله‌پشتی', types: ['give', 'take'] },
  { title: 'اشیا', types: ['destroy', 'spawn', 'shoot', 'show', 'hide', 'damage'] },
  { title: 'حرکت دادن', types: ['checkpoint', 'respawn', 'moveTo', 'glide', 'moveBy', 'moveRandom', 'push', 'jump', 'turn'] },
  { title: 'فیزیک واقعی', types: ['kick', 'spin', 'blast', 'cut', 'setPhysics'] },
  { title: 'ظاهر', types: ['setColor', 'setImage', 'setText', 'resize', 'setOpacity', 'flash', 'layer', 'setLook', 'setDarkness'] },
  { title: 'صدا و جلوه', types: ['playSound', 'playMusic', 'effect', 'burst', 'floatText', 'shake', 'focus', 'zoomPunch', 'shockwave', 'slowMotion', 'vibrate', 'setSound'] },
  { title: 'صحنه و جریان بازی', types: ['goToScene', 'nextScene', 'restartScene', 'saveGame', 'loadGame', 'send', 'wait', 'pause', 'resume', 'setGravity', 'zoom'] },
  { title: 'جورچین و منطق', types: ['setValue', 'shuffle', 'swap', 'settle', 'slideAll', 'step'] },
  { title: 'تبلیغ', types: ['showAd', 'showRewardedAd'] },
];

/** One line on what a trigger or action is for, for those that have no longer note of their own. */
export const SHORT_ABOUT: Partial<Record<Trigger['type'] | Action['type'], string>> = {
  start: 'یک بار، همان لحظه‌ای که صحنه باز می‌شود.',
  tap: 'هر بار که بازیکن هر جای صفحه را لمس کند.',
  tapObject: 'هر بار که بازیکن روی یک شیء مشخص بزند؛ مثل دکمه.',
  touch: 'لحظه‌ای که دو شیء به هم می‌رسند؛ مثل بازیکن و سکه.',
  every: 'پشت‌سرهم، با فاصله‌ی ثابت.',
  after: 'یک بار، چند ثانیه بعد از باز شدن صحنه.',
  offscreen: 'وقتی شیئی که دیده شده بود از صفحه بیرون برود؛ مثل افتادن بازیکن.',
  variable: 'وقتی مقداری مثل امتیاز به عددی برسد.',
  swipe: 'وقتی بازیکن انگشتش را روی صفحه به یک طرف بکشد.',
  holding: 'پشت‌سرهم، تا وقتی انگشت روی صفحه است.',
  noneLeft: 'وقتی آخرین شیء یک گروه هم از بین برود؛ مثل تمام شدن آجرها.',
  dead: 'وقتی جان شیئی که «جان» دارد به صفر برسد.',
  value: 'وقتی یکی از مقدارهای خود یک شیء به عددی برسد؛ مثلاً وقتی کارتی باز شود.',
  line: 'وقتی چند شیء هم‌نوع در یک ردیف، ستون یا خط اریب کنار هم قرار بگیرند؛ مثل بازی دوز.',
  land: 'هر بار که شیئی با «جسم فیزیکی» از هوا روی زمین، سکو یا لبه‌ی پایین دنیا بنشیند؛ مثل پرش دوباره از روی سکو.',
  reward: 'بعد از «پیشنهاد تبلیغ جایزه‌ای»، اگر بازیکن تبلیغ را کامل ببیند.',
  near: 'لحظه‌ای که دو شیء از فاصله‌ای نزدیک‌تر می‌شوند، بدون اینکه به هم بخورند؛ مثل دشمنی که بازیکن را می‌بیند.',
  eachEvery: 'هر شیء ساعت خودش را دارد، از وقتی پیدا شد؛ مثل هر توپ‌انداز که جدا شلیک می‌کند.',
  hit: 'لحظه‌ای که شیئی با «فیزیک واقعی» با سرعت به چیزی بخورد؛ مثل سنگی که به برج می‌خورد. نشستن آرام حساب نمی‌شود.',
  turn: 'شیء را می‌چرخاند؛ برخوردش هم با شکل چرخیده حساب می‌شود.',
  setVariable: 'امتیاز، جان یا هر مقدار دیگری را زیاد، کم یا عوض می‌کند.',
  destroy: 'شیء را از بازی برمی‌دارد.',
  spawn: 'یکی از «چیزهایی که حین بازی ساخته می‌شوند» را روی یک شیء می‌سازد؛ مثل شلیک تیر.',
  show: 'شیئی را که پنهان بود نشان می‌دهد.',
  hide: 'شیء را پنهان می‌کند؛ شیء پنهان به چیزی نمی‌خورد.',
  moveTo: 'شیء را یک‌دفعه به جای مشخصی می‌برد.',
  glide: 'شیء را آرام و روان به جای مشخصی می‌برد.',
  goToScene: 'صحنه‌ی دیگری را باز می‌کند؛ مثل مرحله‌ی بعد یا صفحه‌ی باخت.',
  restartScene: 'همین صحنه را از اول شروع می‌کند.',
  playSound: 'یکی از صداهای آماده یا صدای خودت را پخش می‌کند.',
  resume: 'بازیِ نگه‌داشته‌شده را ادامه می‌دهد.',
};

const NEEDS_PREFAB = 'اول در فهرست «چیزهایی که حین بازی ساخته می‌شوند» یک شیء بساز.';
const NEEDS_VARIABLE = 'اول در برگه‌ی «بازی» یک مقدار بساز.';

/** Why a block cannot be used right now, in words that say what to do about it; null if it can. */
export function whyNot(block: { available?: (ctx: Context) => boolean }, ctx: Context): string | null {
  if (!block.available || block.available(ctx)) return null;
  if (block.available === hasTexts) return 'اول در برگه‌ی «بازی» یک مقدار از نوع «متن» بساز.';
  return block.available === hasPrefabs ? NEEDS_PREFAB : NEEDS_VARIABLE;
}


/** Colors offered as one-tap choices. */
export const PALETTE = [
  '#ff5a5f', '#ff9f1c', '#ffd54a', '#43a047', '#2e7d32', '#26c6da',
  '#bfe8ff', '#1565c0', '#7e57c2', '#6d4c41', '#1b3a4b', '#ffffff',
];
