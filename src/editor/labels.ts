import type { Action, Behavior, GameProject, Ref, Scene, SoundName, Trigger } from '../format/types';
import { PARTICLE_COLORS } from '../runtime/particles';

/**
 * Everything the editor says about the format, in the user's words. Each
 * behavior, trigger and action is described once here: its Persian name, a
 * starting value, and the list of fields that edit it. The panels are drawn
 * from these descriptions, so adding a block to the engine means adding one
 * entry here and nothing in the panels.
 */

type Option = { value: string; label: string };

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

interface Block<T> {
  title: string;
  about?: string;
  fields: Field[];
  make: (ctx: Context) => T;
  /** Offered only when this holds, e.g. a spawner needs something to spawn. */
  available?: (ctx: Context) => boolean;
  /** A behavior that only makes sense on an object with a picture. */
  needsImage?: boolean;
}

const slider = (key: string, label: string, min: number, max: number, step: number, hint?: string, unit?: string): Field =>
  ({ key, label, hint, unit, kind: 'slider', min, max, step });
const firstRef = ({ scene }: Context): Ref =>
  scene.objects[0] ? { by: 'id', id: scene.objects[0].id } : { by: 'tag', tag: '' };
const hasVariables = ({ project }: Context) => project.variables.length > 0;
const hasItems = ({ project }: Context) => project.variables.some((v) => v.item);
const firstItem = ({ project }: Context) => project.variables.find((v) => v.item)?.name ?? '';
const hasPrefabs = ({ scene }: Context) => scene.prefabs.length > 0;
const SPEED = (key: string, label: string, hint: string) => slider(key, label, -1500, 1500, 10, hint);
/** The group most games call their ground, if this scene has one, so new physics stands on it from the start. */
const groundTag = ({ scene }: Context): string => {
  const tags = new Set(scene.objects.flatMap((o) => [...o.tags, ...(o.visual.kind === 'tiles' ? Object.values(o.visual.kinds).flatMap((k) => k.tags) : [])]));
  return ['زمین', 'ground', 'دیوار'].find((tag) => tags.has(tag)) ?? '';
};
const moving = (v: Record<string, unknown>) => v.kind !== 'still';
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
/** The painted backdrops, in words. */
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
];
/** The music that comes with the engine, in words, for pick lists. */
export const BUILTIN_MUSIC_OPTIONS: Option[] = [
  { value: 'music:happy', label: 'موسیقی آماده: شاد' },
  { value: 'music:adventure', label: 'موسیقی آماده: ماجراجویی' },
  { value: 'music:calm', label: 'موسیقی آماده: آرام' },
  { value: 'music:tense', label: 'موسیقی آماده: هیجانی' },
  { value: 'music:mystery', label: 'موسیقی آماده: رمزآلود' },
];
/** Messages already in use in a scene, so a new rule starts with one that is already being sent or waited for. */
const messageNamesOf = (scene: Scene): string[] => {
  const names = new Set<string>();
  for (const r of scene.rules) {
    if (r.when.type === 'message') names.add(r.when.name);
    for (const a of [...r.then, ...(r.otherwise ?? [])]) if (a.type === 'send') names.add(a.name);
  }
  return [...names].filter(Boolean);
};

export const BEHAVIORS: { [K in Behavior['type']]: Block<Extract<Behavior, { type: K }>> } = {
  physics: {
    title: 'فیزیک واقعی',
    about: 'مثل دنیای واقعی می‌افتد، غلت می‌خورد، روی بقیه می‌ایستد و آن‌ها را می‌اندازد؛ با شکل واقعی‌اش، حتی وقتی کج است. برای جعبه، توپ، برج و پرتاب با کمان. هر دو شیئی که این را دارند به هم می‌خورند.',
    make: (ctx) => ({ type: 'physics', kind: 'moving', solidTag: groundTag(ctx), bounce: 0.2, friction: 0.5, weight: 1, rotates: true, gravity: true, slowdown: 0, edges: true, drag: 'none', power: 8, reload: true }),
    fields: [
      { key: 'kind', label: 'حرکت می‌کند؟', kind: 'choice', options: [
        { value: 'moving', label: 'بله، می‌افتد و غلت می‌خورد' },
        { value: 'still', label: 'نه، محکم سر جایش است (زمین، دیوار، میله‌ی چرخان)' },
      ] },
      { key: 'solidTag', label: 'روی این گروه هم بایستد', hint: 'اشیای این گروه فیزیک ندارند، ولی مثل زمین و دیوار جلویش را می‌گیرند؛ مثلاً گروه زمین یا نقشه‌ی خانه‌ای. خالی یعنی فقط به اشیای فیزیکی می‌خورد.', kind: 'tag', showIf: moving },
      slider('bounce', 'برگشت بعد از برخورد', 0, 1, 0.05, 'صفر یعنی می‌ایستد؛ یک یعنی مثل توپ لاستیکی همان‌قدر بالا برمی‌گردد.'),
      slider('friction', 'زبری', 0, 1, 0.05, 'صفر یعنی مثل یخ سُر می‌خورد؛ یک یعنی مثل لاستیک می‌چسبد و غلت می‌خورد.'),
      { key: 'edges', label: 'لبه‌های دنیا دیوار باشند', hint: 'وگرنه می‌تواند از دنیا بیرون بیفتد.', kind: 'bool', fallback: false, showIf: moving },
      { key: 'drag', label: 'با انگشت', kind: 'choice', fallback: 'none', showIf: moving, options: [
        { value: 'none', label: 'کاری نمی‌شود کرد' },
        { value: 'grab', label: 'برداشتن و جابه‌جا کردن' },
        { value: 'sling', label: 'عقب کشیدن و پرتاب، مثل تیرکمان' },
      ] },
      { ...slider('power', 'قدرت پرتاب', 2, 20, 0.5, 'بیشتر یعنی با همان عقب کشیدن دورتر می‌رود. نقطه‌های سفید موقع کشیدن نشان می‌دهند کجا می‌رود.'), fallback: 8, showIf: (v) => moving(v) && v.drag === 'sling' },
      { key: 'reload', label: 'در تیرکمان منتظر بماند و برگردد', hint: 'روشن: همان‌جا که گذاشتی در هوا منتظر می‌ماند و نمی‌افتد؛ بعد از هر پرتاب، وقتی ایستاد یا از دنیا بیرون رفت، به همان‌جا برمی‌گردد. خاموش: می‌افتد و هر جا ایستاد از همان‌جا دوباره کشیده می‌شود.', kind: 'bool', fallback: true, showIf: (v) => moving(v) && v.drag === 'sling' },
      { ...slider('surfaceSpeed', 'تسمه‌ی نقاله', -600, 600, 10, 'چیزهایی که رویش هستند با این سرعت به راست (یا با عدد منفی به چپ) برده می‌شوند. صفر یعنی معمولی.', 'پیکسل در ثانیه'), fallback: 0, showIf: (v) => v.kind === 'still' },
      { key: 'oneWay', label: 'از زیر بشود ردش شد', hint: 'مثل سکوهای بازی‌های پرشی: چیزها از زیر بالا می‌آیند و فقط از بالا رویش می‌ایستند.', kind: 'bool', fallback: false, showIf: (v) => v.kind === 'still' },
      { ...slider('weight', 'سنگینی', 0.1, 10, 0.1, 'یک معمولی است. سنگین‌تر بقیه را محکم‌تر هل می‌دهد و سخت‌تر جابه‌جا می‌شود.'), fallback: 1, advanced: true, showIf: moving },
      { key: 'rotates', label: 'بتواند بچرخد و واژگون شود', hint: 'برای شخصیت بازی خاموشش کن تا همیشه سرپا بماند.', kind: 'bool', fallback: true, advanced: true, showIf: moving },
      { key: 'gravity', label: 'جاذبه رویش اثر کند', hint: 'خاموش برای فضا، یا میز بیلیارد که از بالا دیده می‌شود.', kind: 'bool', fallback: true, advanced: true, showIf: moving },
      { ...slider('slowdown', 'کند شدن خودبه‌خود', 0, 1, 0.05, 'مثل هوای غلیظ یا پارچه‌ی میز بیلیارد. صفر یعنی هیچ.'), fallback: 0, advanced: true, showIf: moving },
    ],
  },
  field: {
    title: 'منطقه‌ی نیرو: باد، آب، آهن‌ربا',
    about: 'اشیای «فیزیک واقعی» را تا وقتی داخل این شیء‌اند هل می‌دهد. باد: به یک طرف، مثل پنکه. آب: چیزهای سبک شناور می‌مانند و سنگین‌ها غرق می‌شوند (سنگینی در «فیزیک واقعی» است). آهن‌ربا: به وسطش می‌کشد. خود این شیء به چیزی نمی‌خورد؛ معمولاً یک مستطیل کم‌رنگ است.',
    make: () => ({ type: 'field', kind: 'wind', direction: -90, strength: 3000 }),
    fields: [
      { key: 'kind', label: 'چه نیرویی', kind: 'choice', options: [
        { value: 'wind', label: 'باد' },
        { value: 'water', label: 'آب' },
        { value: 'magnet', label: 'آهن‌ربا' },
      ] },
      { ...slider('direction', 'به کدام طرف', -180, 180, 5, 'صفر یعنی راست، ۹۰ پایین، ۹۰- بالا، ۱۸۰ چپ.', 'درجه'), showIf: (v) => v.kind === 'wind' },
      { ...slider('strength', 'قدرت', -8000, 8000, 50, 'هرچه بیشتر، محکم‌تر. برای آهن‌ربا، منفی یعنی دور می‌کند. جاذبه‌ی معمولی حدود ۲۴۰۰ است.'), showIf: (v) => v.kind !== 'water' },
      { ...slider('strength', 'چقدر نگه دارد', 0, 4, 0.1, 'یک: چیزهایی با سنگینی معمولی تا نیمه شناورند. سنگین‌تر از ۱٫۵ غرق می‌شود.'), showIf: (v) => v.kind === 'water' },
    ],
  },
  particles: {
    title: 'ذرات: آتش، دود، باران…',
    about: 'پیوسته ذره‌های کوچک از شیء بیرون می‌دهد. آتش و دود بالا می‌روند؛ باران و برف از سرتاسر پهنای شیء می‌بارند (برای باران، یک مستطیل پهن بالای صفحه بگذار و «پررنگی»اش را صفر کن). فقط برای دیدن است و به چیزی نمی‌خورد. در ویرایشگر هم زنده دیده می‌شود.',
    make: () => ({ type: 'particles', preset: 'fire', color: PARTICLE_COLORS.fire, rate: 40, size: 16, speed: 1 }),
    fields: [
      { key: 'preset', label: 'چه جور ذره‌ای', kind: 'choice', options: [
        { value: 'fire', label: 'آتش' },
        { value: 'smoke', label: 'دود' },
        { value: 'rain', label: 'باران' },
        { value: 'snow', label: 'برف' },
        { value: 'sparkle', label: 'برق و ستاره' },
        { value: 'bubbles', label: 'حباب' },
        { value: 'confetti', label: 'کاغذ رنگی' },
      ] },
      { key: 'color', label: 'رنگ', kind: 'color' },
      slider('rate', 'چند تا در ثانیه', 1, 120, 1, 'زیاد کردنش روی گوشی ضعیف سنگین است؛ ۴۰ معمولاً کافی است.'),
      slider('size', 'اندازه‌ی هر ذره', 2, 60, 1),
      slider('speed', 'سرعت', 0.2, 3, 0.1, 'یک یعنی سرعت معمول همین نوع ذره.'),
    ],
  },
  light: {
    title: 'نور',
    about: 'دور شیء را روشن می‌کند، وقتی صحنه تاریک است. تاریکی صحنه را در برگه‌ی «بازی» زیاد کن (یا با کار «تاریک و روشن کردن صحنه»). برای چراغ‌قوه، مشعل یا کرم شب‌تاب.',
    make: () => ({ type: 'light', radius: 220, color: '#ffffff', flicker: false }),
    fields: [
      slider('radius', 'تا کجا روشن کند', 30, 800, 10),
      { key: 'color', label: 'رنگ نور', hint: 'سفید یعنی فقط روشن می‌کند؛ رنگی، یک هاله‌ی رنگی هم دارد.', kind: 'color' },
      { key: 'flicker', label: 'مثل شعله بلرزد', kind: 'bool' },
    ],
  },
  joint: {
    title: 'اتصال',
    about: 'این شیء را به نزدیک‌ترین شیء یک گروه وصل می‌کند: با لولا (مثل چرخ ماشین یا در)، طناب، فنر یا جوش. «فیزیک واقعی» لازم دارد؛ اگر آن یکی فیزیک نداشت، مثل میخ سر جایش می‌ماند.',
    make: () => ({ type: 'joint', kind: 'hinge', targetTag: '', at: 'self', motor: 0 }),
    fields: [
      { key: 'kind', label: 'چه جور اتصالی', kind: 'choice', options: [
        { value: 'hinge', label: 'لولا: دور یک نقطه می‌چرخد' },
        { value: 'wheel', label: 'چرخ با کمک‌فنر، برای ماشین' },
        { value: 'slider', label: 'ریل: روی یک خط می‌لغزد، مثل آسانسور' },
        { value: 'rope', label: 'طناب: دورتر نمی‌رود' },
        { value: 'spring', label: 'فنر: کش می‌آید و برمی‌گردد' },
        { value: 'weld', label: 'جوش: محکم به هم می‌چسبند' },
      ] },
      { key: 'targetTag', label: 'به نزدیک‌ترین شیء این گروه', kind: 'tag' },
      { key: 'at', label: 'میخ کجا باشد', kind: 'choice', fallback: 'self', showIf: (v) => v.kind === 'hinge' || v.kind === 'weld', options: [
        { value: 'self', label: 'وسط همین شیء، مثل چرخ' },
        { value: 'other', label: 'وسط آن یکی، مثل آونگی که از میخ آویزان است' },
        { value: 'between', label: 'وسط این دو، مثل حلقه‌های زنجیر یا تخته‌های پل' },
      ] },
      { ...slider('motor', 'موتور', -720, 720, 10, 'خودش می‌چرخد، مثل چرخ ماشین. مثبت یعنی در جهت عقربه‌های ساعت. صفر یعنی موتور ندارد.', 'درجه در ثانیه'), fallback: 0, showIf: (v) => v.kind === 'hinge' || v.kind === 'wheel' },
      { ...slider('limit', 'تا کجا بچرخد', 0, 180, 5, 'از هر طرف چند درجه؛ مثل دری که فقط تا یک جا باز می‌شود. صفر یعنی آزاد.', 'درجه'), fallback: 0, showIf: (v) => v.kind === 'hinge' },
      { ...slider('axis', 'جهت ریل', -90, 90, 5, 'صفر یعنی چپ و راست، ۹۰ یعنی بالا و پایین، عددهای وسط یعنی کج.', 'درجه'), fallback: 0, showIf: (v) => v.kind === 'slider' },
      { ...slider('range', 'تا کجا برود', 0, 1500, 10, 'از هر طرف چند پیکسل. با موتور، بین دو سر رفت و برگشت می‌کند. صفر یعنی بی‌انتها.', 'پیکسل'), fallback: 0, showIf: (v) => v.kind === 'slider' },
      { ...slider('motor', 'موتور', -800, 800, 10, 'خودش روی ریل حرکت می‌کند. صفر یعنی موتور ندارد.', 'پیکسل در ثانیه'), fallback: 0, showIf: (v) => v.kind === 'slider' },
      { ...slider('strength', 'استحکام', 0, 50, 0.5, 'اگر بیشتر از این‌قدر برابرِ وزن خودِ شیء کشیده شود، پاره می‌شود؛ مثل طنابی که زیر بار می‌بُرد. صفر یعنی هیچ‌وقت پاره نمی‌شود.'), fallback: 0, advanced: true },
    ],
  },
  body: {
    title: 'جسم فیزیکی',
    about: 'وزن دارد و از میان اشیای یک گروه رد نمی‌شود. ساده و دقیق، برای بازیکنِ بازی‌های پرشی بهترین است؛ برای جعبه و توپی که واقعاً غلت بخورد و واژگون شود، «فیزیک واقعی» را بگذار.',
    make: () => ({ type: 'body', gravity: true, solidTag: '', bounce: 0, edges: 'none', oneWay: false }),
    fields: [
      { key: 'gravity', label: 'جاذبه رویش اثر کند', kind: 'bool' },
      { key: 'solidTag', label: 'از این گروه رد نشود', hint: 'مثلاً گروه زمین یا دیوار', kind: 'tag' },
      slider('bounce', 'برگشت بعد از برخورد', 0, 1, 0.05, 'صفر یعنی می‌ایستد؛ یک یعنی با همان سرعت برمی‌گردد'),
      { key: 'edges', label: 'لبه‌های دنیا', kind: 'choice', options: [
        { value: 'none', label: 'آزاد' },
        { value: 'stop', label: 'مثل دیوار' },
        { value: 'bounce', label: 'برگرداند، مثل توپ' },
        { value: 'wrap', label: 'از آن طرف بیرون بیاید' },
      ] },
      { key: 'oneWay', label: 'سکوها یک‌طرفه باشند', hint: 'از زیر گروه بالا رد می‌شود و فقط از بالا رویش می‌ایستد؛ مثل سکوهای بازی‌های پرشی.', kind: 'bool', fallback: false, advanced: true },
      { ...slider('friction', 'اصطکاک', 0, 1, 0.05, 'بیشتر یعنی وقتی هلش دادی زودتر می‌ایستد؛ مثل جعبه روی زمین. صفر یعنی مثل یخ سُر می‌خورد. وقتی بازیکن کنترلش می‌کند اثری ندارد.'), fallback: 0, advanced: true },
      { key: 'pushable', label: 'با هل دادن جابه‌جا شود', hint: 'مثل جعبه: اگر بازیکن به آن بخورد و پشتش جا باشد، جلو می‌رود. باید در گروهی باشد که بازیکن از آن رد نمی‌شود.', kind: 'bool', fallback: false, advanced: true },
      { key: 'roll', label: 'موقع حرکت بچرخد', hint: 'مثل توپی که روی زمین قل می‌خورد. با «برخورد دایره‌ای» بهتر است.', kind: 'bool', fallback: false, advanced: true },
    ],
  },
  jumper: {
    title: 'پرش',
    about: 'می‌پرد و با جاذبه پایین می‌آید. جسم فیزیکی لازم دارد.',
    make: () => ({ type: 'jumper', jumpSpeed: 1100, maxJumps: 1, on: 'tap', buttonTag: '', variable: false }),
    fields: [
      slider('jumpSpeed', 'قدرت پرش', 300, 2000, 10, 'بیشتر یعنی پرش بلندتر'),
      slider('maxJumps', 'تعداد پرش پشت‌سرهم', 1, 3, 1, '۲ یعنی در هوا یک بار دیگر هم می‌پرد'),
      { key: 'on', label: 'چطور بپرد', kind: 'choice', options: [
        { value: 'tap', label: 'با لمس صفحه' },
        { value: 'button', label: 'با دکمه' },
        { value: 'none', label: 'فقط با قانون' },
      ] },
      { key: 'buttonTag', label: 'گروه دکمه‌ی پرش', kind: 'tag', showIf: (v) => v.on === 'button' },
      { key: 'variable', label: 'با نگه داشتن، بلندتر بپرد', hint: 'لمس کوتاه یعنی پرش کوتاه؛ نگه داشتن یعنی پرش کامل.', kind: 'bool', fallback: false, advanced: true, showIf: (v) => v.on !== 'none' },
    ],
  },
  walker: {
    title: 'حرکت چپ و راست',
    about: 'به چپ و راست می‌رود و از صفحه بیرون نمی‌زند.',
    make: () => ({ type: 'walker', speed: 320, control: 'halves', leftTag: '', rightTag: '', ease: 0 }),
    fields: [
      slider('speed', 'سرعت', 50, 1000, 10),
      { key: 'control', label: 'چطور کنترل شود', kind: 'choice', options: [
        { value: 'halves', label: 'نیمه‌ی چپ و راست صفحه' },
        { value: 'buttons', label: 'با دکمه' },
        { value: 'auto', label: 'خودکار به راست' },
      ] },
      { key: 'leftTag', label: 'گروه دکمه‌ی چپ', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { key: 'rightTag', label: 'گروه دکمه‌ی راست', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { ...slider('ease', 'نرمی شروع و ایست', 0, 1, 0.05, 'صفر یعنی فوری. بیشتر یعنی آرام سرعت می‌گیرد و آرام می‌ایستد.', 'ثانیه'), fallback: 0, advanced: true },
    ],
  },
  followFinger: {
    title: 'دنبال کردن انگشت',
    about: 'به طرف جایی می‌رود که انگشت بازیکن روی صفحه است.',
    make: () => ({ type: 'followFinger', speed: 1200, axis: 'both' }),
    fields: [
      slider('speed', 'سرعت', 100, 3000, 50),
      { key: 'axis', label: 'جهت حرکت', kind: 'choice', options: [
        { value: 'both', label: 'هر دو' },
        { value: 'x', label: 'چپ و راست' },
        { value: 'y', label: 'بالا و پایین' },
      ] },
    ],
  },
  mover: {
    title: 'حرکت یکنواخت',
    about: 'با سرعت ثابت حرکت می‌کند؛ مثل مانع، تیر یا چیزی که می‌افتد.',
    make: () => ({ type: 'mover', vx: -300, vy: 0, speedVariable: '', atEdge: 'remove' }),
    fields: [
      SPEED('vx', 'سرعت افقی', 'منفی یعنی به چپ'),
      SPEED('vy', 'سرعت عمودی', 'منفی یعنی به بالا'),
      { key: 'speedVariable', label: 'سرعت ضرب شود در', hint: 'با زیاد شدن این مقدار، همه با هم تندتر می‌شوند', kind: 'variable', optional: true },
      { key: 'atEdge', label: 'وقتی از صفحه بیرون رفت', kind: 'choice', options: [
        { value: 'remove', label: 'حذف شود' },
        { value: 'wrap', label: 'از آن طرف برگردد' },
        { value: 'nothing', label: 'هیچ' },
      ] },
    ],
  },
  patrol: {
    title: 'رفت و برگشت',
    about: 'از جایی که گذاشته شده می‌رود و برمی‌گردد؛ مثل نگهبان.',
    make: () => ({ type: 'patrol', axis: 'x', distance: 200, speed: 120 }),
    fields: [
      { key: 'axis', label: 'جهت', kind: 'choice', options: [{ value: 'x', label: 'چپ و راست' }, { value: 'y', label: 'بالا و پایین' }] },
      slider('distance', 'مسافت', 10, 1200, 10),
      slider('speed', 'سرعت', 10, 800, 10),
    ],
  },
  chase: {
    title: 'تعقیب',
    about: 'دنبال نزدیک‌ترین شیء از یک گروه می‌رود.',
    make: () => ({ type: 'chase', targetTag: '', speed: 150, axis: 'both', range: 0, away: false, avoidTag: '' }),
    fields: [
      { key: 'targetTag', label: 'دنبال این گروه برود', kind: 'tag' },
      slider('speed', 'سرعت', 10, 1000, 10),
      { key: 'axis', label: 'در کدام جهت', hint: 'مثلاً راکت حریف در بازی تنیس فقط بالا و پایین دنبال توپ می‌رود.', kind: 'choice', fallback: 'both', advanced: true, options: [
        { value: 'both', label: 'هر دو' },
        { value: 'x', label: 'فقط چپ و راست' },
        { value: 'y', label: 'فقط بالا و پایین' },
      ] },
      { ...slider('range', 'فقط از این فاصله نزدیک‌تر', 0, 2000, 10, 'صفر یعنی از هر جای دنیا دنبالش می‌کند. با ۳۰۰، فقط وقتی بازیکن نزدیک‌تر از ۳۰۰ پیکسل بیاید متوجهش می‌شود.'), fallback: 0, advanced: true },
      { key: 'away', label: 'به‌جای دنبال کردن، فرار کند', hint: 'مثل موشی که از گربه دور می‌شود.', kind: 'bool', fallback: false, advanced: true },
      { key: 'avoidTag', label: 'دیوارهای این گروه را دور بزند', hint: 'دشمن به‌جای اینکه مستقیم به دیوار بخورد، راهش را در هزارتو پیدا می‌کند. خالی یعنی مستقیم برود.', kind: 'tag', fallback: '', advanced: true, showIf: (v) => !v.away },
    ],
  },
  steer: {
    title: 'حرکت در چهار جهت',
    about: 'بازیکن آن را به هر طرف می‌برد؛ برای بازی‌هایی که از بالا دیده می‌شوند، مثل هزارتو یا سفینه. با «جسم فیزیکی» (بدون جاذبه) از دیوار رد نمی‌شود.',
    make: () => ({ type: 'steer', speed: 320, control: 'stick', upTag: '', downTag: '', leftTag: '', rightTag: '', face: false }),
    fields: [
      slider('speed', 'سرعت', 50, 1000, 10),
      { key: 'control', label: 'چطور کنترل شود', kind: 'choice', options: [
        { value: 'stick', label: 'دسته‌ی لمسی: انگشت را بکش' },
        { value: 'buttons', label: 'با چهار دکمه' },
        { value: 'swipe', label: 'با کشیدن؛ خودش ادامه می‌دهد' },
      ] },
      { key: 'upTag', label: 'گروه دکمه‌ی بالا', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { key: 'downTag', label: 'گروه دکمه‌ی پایین', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { key: 'leftTag', label: 'گروه دکمه‌ی چپ', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { key: 'rightTag', label: 'گروه دکمه‌ی راست', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { key: 'face', label: 'رو به جهت حرکت بچرخد', hint: 'عکس را رو به راست بکش.', kind: 'bool', fallback: false, advanced: true },
    ],
  },
  route: {
    title: 'رفتن روی مسیر',
    about: 'از یک نشانه به نشانه‌ی بعدی می‌رود. نشانه‌ها اشیای یک گروه‌اند (می‌توانند پنهان باشند) و ترتیبشان از روی نامشان است: «نقطه ۱»، «نقطه ۲»، … . برای دشمنی که راه مشخصی را می‌رود.',
    make: () => ({ type: 'route', tag: '', speed: 200, end: 'loop' }),
    fields: [
      { key: 'tag', label: 'گروه نشانه‌های مسیر', kind: 'tag' },
      slider('speed', 'سرعت', 10, 1000, 10),
      { key: 'end', label: 'در آخر مسیر', kind: 'choice', options: [
        { value: 'loop', label: 'از اول شروع کند' },
        { value: 'back', label: 'همان راه را برگردد' },
        { value: 'stop', label: 'بایستد' },
      ] },
    ],
  },
  rotate: {
    title: 'چرخش',
    about: 'دور خودش می‌چرخد. برخورد هم با شکل چرخیده حساب می‌شود؛ برای توپ و سکه «برخورد دایره‌ای» را روشن کن.',
    make: () => ({ type: 'rotate', speed: 90 }),
    fields: [slider('speed', 'سرعت چرخش', -720, 720, 10, 'منفی یعنی خلاف جهت عقربه‌های ساعت', 'درجه در ثانیه')],
  },
  draggable: {
    title: 'قابل کشیدن',
    about: 'بازیکن می‌تواند با انگشت آن را بگیرد و جابه‌جا کند.',
    make: () => ({ type: 'draggable' }),
    fields: [],
  },
  lifetime: {
    title: 'عمر کوتاه',
    about: 'بعد از مدتی خودش ناپدید می‌شود.',
    make: () => ({ type: 'lifetime', seconds: 2 }),
    fields: [slider('seconds', 'چند ثانیه بماند', 0.1, 30, 0.1, undefined, 'ثانیه')],
  },
  spawner: {
    title: 'ساخت خودکار',
    about: 'هر چند ثانیه یک شیء تازه می‌سازد. لبه‌ی چپ و پایین شیء تازه روی گوشه‌ی بالا-چپ این شیء می‌نشیند.',
    available: hasPrefabs,
    make: ({ scene }) => ({ type: 'spawner', prefabs: [scene.prefabs[0].id], minInterval: 1, maxInterval: 2, spreadX: 0, spreadY: 0, everyDistance: 0 }),
    fields: [
      { key: 'prefabs', label: 'چه چیزهایی بسازد', kind: 'prefabs' },
      slider('minInterval', 'کمترین فاصله', 0.2, 10, 0.1, undefined, 'ثانیه'),
      slider('maxInterval', 'بیشترین فاصله', 0.2, 10, 0.1, undefined, 'ثانیه'),
      { ...slider('spreadX', 'پراکندگی افقی', 0, 720, 10, 'هر بار تا این اندازه چپ‌تر یا راست‌تر ساخته می‌شود'), fallback: 0, advanced: true },
      { ...slider('spreadY', 'پراکندگی عمودی', 0, 720, 10), fallback: 0, advanced: true },
      { ...slider('everyDistance', 'به‌جای زمان، با حرکت دوربین بساز', 0, 1000, 10, 'صفر یعنی با زمان. اگر عددی بگذاری، هر بار که دوربین این‌قدر جلو برود یکی می‌سازد؛ برای مرحله‌ی بی‌پایان، این شیء را «به صفحه چسبیده» کن.'), fallback: 0, advanced: true },
    ],
  },
  camera: {
    title: 'دوربین دنبالش بیاید',
    about: 'وقتی دنیا از صفحه بزرگ‌تر است، دوربین این شیء را وسط صفحه نگه می‌دارد. اندازه‌ی دنیا در برگه‌ی «بازی» است.',
    make: () => ({ type: 'camera', lock: 'free', smooth: 0.3 }),
    fields: [{ ...slider('smooth', 'نرمی دنبال کردن', 0, 1, 0.05, 'صفر یعنی شیء همیشه دقیقاً وسط است. بیشتر یعنی دوربین کمی عقب می‌ماند و نرم می‌رسد.'), fallback: 0 }, { key: 'lock', label: 'دوربین برنگردد', hint: 'اگر دوربین فقط بالا برود، بازیکنی که پایین بیفتد از صفحه بیرون می‌رود.', kind: 'choice', fallback: 'free', advanced: true, options: [
      { value: 'free', label: 'آزاد' },
      { value: 'up', label: 'فقط بالا برود' },
      { value: 'right', label: 'فقط راست برود' },
    ] }],
  },
  launch: {
    title: 'شروع با سرعت',
    about: 'از لحظه‌ای که ساخته می‌شود حرکت می‌کند؛ مثل توپی که پرتاب شده. با «جسم فیزیکی» از دیوارها برمی‌گردد.',
    make: () => ({ type: 'launch', vx: 300, vy: -300, toward: 'fixed', targetTag: '', speed: 600, face: false }),
    fields: [
      { key: 'toward', label: 'به کدام طرف', kind: 'choice', fallback: 'fixed', options: [
        { value: 'fixed', label: 'جهت ثابت' },
        { value: 'tap', label: 'جایی که لمس شد' },
        { value: 'group', label: 'نزدیک‌ترین شیء یک گروه' },
      ] },
      { ...SPEED('vx', 'سرعت افقی', 'منفی یعنی به چپ'), showIf: (v) => (v.toward ?? 'fixed') === 'fixed' },
      { ...SPEED('vy', 'سرعت عمودی', 'منفی یعنی به بالا'), showIf: (v) => (v.toward ?? 'fixed') === 'fixed' },
      { key: 'targetTag', label: 'به طرف این گروه', kind: 'tag', fallback: '', showIf: (v) => v.toward === 'group' },
      { ...slider('speed', 'سرعت', 50, 2000, 10), fallback: 600, showIf: (v) => (v.toward ?? 'fixed') !== 'fixed' },
      { key: 'face', label: 'رو به جهت حرکت بچرخد', hint: 'برای تیر و موشک. عکس را رو به راست بکش.', kind: 'bool', fallback: false, advanced: true },
    ],
  },
  trail: {
    title: 'دنباله',
    about: 'پشت سرش ردی از نقطه‌های رنگی می‌گذارد که محو می‌شوند؛ برای موشک، توپ یا شخصیت تندرو. فقط ظاهر است.',
    make: () => ({ type: 'trail', color: '#ffffff', size: 18, rate: 30 }),
    fields: [{ key: 'color', label: 'رنگ', kind: 'color' }, slider('size', 'اندازه‌ی نقطه‌ها', 4, 60, 1), slider('rate', 'چند نقطه در ثانیه', 5, 60, 1)],
  },
  wave: {
    title: 'حرکت موجی',
    about: 'آرام به دو طرف تاب می‌خورد. روی هر حرکت دیگری هم سوار می‌شود؛ مثل پرنده‌ای که بالا و پایین می‌رود.',
    make: () => ({ type: 'wave', axis: 'y', distance: 40, seconds: 2 }),
    fields: [
      { key: 'axis', label: 'جهت', kind: 'choice', options: [{ value: 'y', label: 'بالا و پایین' }, { value: 'x', label: 'چپ و راست' }] },
      slider('distance', 'تا چه فاصله‌ای', 5, 400, 5),
      slider('seconds', 'هر تاب چند ثانیه', 0.2, 10, 0.1, undefined, 'ثانیه'),
    ],
  },
  attach: {
    title: 'چسبیدن به شیء دیگر',
    about: 'همیشه کنار نزدیک‌ترین شیء از یک گروه می‌ماند؛ مثل کلاه، سلاح یا نوار جان.',
    make: () => ({ type: 'attach', targetTag: '', offsetX: 0, offsetY: -40 }),
    fields: [
      { key: 'targetTag', label: 'به این گروه بچسبد', kind: 'tag' },
      { key: 'offsetX', label: 'فاصله‌ی افقی', hint: 'منفی یعنی سمت چپ آن', kind: 'number' },
      { key: 'offsetY', label: 'فاصله‌ی عمودی', hint: 'منفی یعنی بالای آن', kind: 'number' },
    ],
  },
  scrollImage: {
    title: 'تصویر روان',
    about: 'عکس تکرار می‌شود و پیوسته حرکت می‌کند؛ برای زمین یا آسمانی که بی‌پایان می‌گذرد. فقط برای شیئی که عکس دارد.',
    needsImage: true,
    make: () => ({ type: 'scrollImage', vx: -200, vy: 0 }),
    fields: [SPEED('vx', 'سرعت افقی', 'منفی یعنی به چپ'), SPEED('vy', 'سرعت عمودی', 'منفی یعنی به بالا')],
  },
  pulse: {
    title: 'تپش',
    about: 'آرام بزرگ و کوچک می‌شود تا به چشم بیاید؛ برای دکمه و جایزه.',
    make: () => ({ type: 'pulse', amount: 0.15, seconds: 1 }),
    fields: [slider('amount', 'چقدر بزرگ شود', 0.05, 0.6, 0.05), slider('seconds', 'هر تپش چند ثانیه', 0.2, 5, 0.1, undefined, 'ثانیه')],
  },
  blink: {
    title: 'چشمک زدن',
    about: 'کم‌رنگ و پررنگ می‌شود تا به چشم بیاید.',
    make: () => ({ type: 'blink', seconds: 1 }),
    fields: [slider('seconds', 'هر چشمک چند ثانیه', 0.2, 5, 0.1, undefined, 'ثانیه')],
  },
};

const COMPARE: Field = { key: 'op', label: 'مقایسه', kind: 'choice', options: [
  { value: '>=', label: 'بیشتر یا مساوی' },
  { value: '<=', label: 'کمتر یا مساوی' },
  { value: '==', label: 'مساوی' },
  { value: '!=', label: 'نامساوی' },
  { value: '>', label: 'بیشتر' },
  { value: '<', label: 'کمتر' },
] };

export const TRIGGERS: { [K in Trigger['type']]: Block<Extract<Trigger, { type: K }>> } = {
  start: { title: 'صحنه شروع می‌شود', make: () => ({ type: 'start' }), fields: [] },
  tap: { title: 'صفحه لمس می‌شود', make: () => ({ type: 'tap' }), fields: [] },
  tapObject: {
    title: 'روی یک شیء زده می‌شود',
    make: (ctx) => ({ type: 'tapObject', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء', kind: 'ref' }],
  },
  touch: {
    title: 'دو شیء به هم می‌خورند',
    make: (ctx) => ({ type: 'touch', a: firstRef(ctx), b: firstRef(ctx) }),
    fields: [{ key: 'a', label: 'اولی', kind: 'ref' }, { key: 'b', label: 'دومی', kind: 'ref' }],
  },
  thrown: {
    title: 'یک شیء پرتاب می‌شود',
    about: 'لحظه‌ای که بازیکن شیئی را با تیرکمان رها می‌کند؛ مثلاً برای شمردن پرتاب‌ها.',
    make: (ctx) => ({ type: 'thrown', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء', kind: 'ref' }],
  },
  rest: {
    title: 'یک شیء از حرکت می‌ایستد',
    about: 'وقتی شیئی با «فیزیک واقعی» که حرکت می‌کرد، از حرکت بایستد؛ مثل سنگی که فرود آمد و آرام گرفت. برای نوبت بعد.',
    make: (ctx) => ({ type: 'rest', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء', kind: 'ref' }],
  },
  snap: {
    title: 'اتصالی پاره می‌شود',
    about: 'وقتی «اتصال» یک شیء زیر بار پاره شود یا با کار «بریدن اتصال» بریده شود.',
    make: (ctx) => ({ type: 'snap', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'اتصالِ کدام شیء', kind: 'ref' }],
  },
  message: {
    title: 'پیامی می‌رسد',
    about: 'وقتی قانون دیگری با کار «فرستادن پیام» همین پیام را بفرستد. کارهایی را که از چند جا لازم است یک بار این‌جا بنویس؛ مثلاً پیام «باخت» از هر جا که بیاید، صدا پخش شود و صحنه از نو شروع شود.',
    make: ({ scene }) => ({ type: 'message', name: messageNamesOf(scene)[0] ?? 'باخت' }),
    fields: [{ key: 'name', label: 'کدام پیام', hint: 'هر نامی که بخواهی، مثل «برد» یا «باخت». باید با نام پیامی که فرستاده می‌شود یکی باشد.', kind: 'message' }],
  },
  hit: {
    title: 'یک شیء محکم به چیزی می‌خورد',
    make: (ctx) => ({ type: 'hit', a: firstRef(ctx), b: firstRef(ctx), speed: 600 }),
    fields: [
      { key: 'a', label: 'اولی', hint: 'دست‌کم یکی از دو تا باید «فیزیک واقعی» داشته باشد.', kind: 'ref' },
      { key: 'b', label: 'به', kind: 'ref' },
      slider('speed', 'دست‌کم با این سرعت', 100, 3000, 50, 'برخوردهای آرام‌تر، و نشستن آرام روی هم، حساب نمی‌شوند؛ مثل شیشه‌ای که فقط با ضربه‌ی محکم می‌شکند.'),
    ],
  },
  every: {
    title: 'هر چند ثانیه یک بار',
    make: () => ({ type: 'every', seconds: 1 }),
    fields: [{ key: 'seconds', label: 'هر چند ثانیه', kind: 'number' }],
  },
  after: {
    title: 'چند ثانیه از شروع صحنه می‌گذرد',
    make: () => ({ type: 'after', seconds: 3 }),
    fields: [{ key: 'seconds', label: 'بعد از چند ثانیه', kind: 'number' }],
  },
  offscreen: {
    title: 'یک شیء از صفحه بیرون می‌رود',
    make: (ctx) => ({ type: 'offscreen', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء', kind: 'ref' }],
  },
  variable: {
    title: 'یک مقدار به حدی می‌رسد',
    available: hasVariables,
    make: ({ project }) => ({ type: 'variable', name: project.variables[0].name, op: '>=', value: 10 }),
    fields: [{ key: 'name', label: 'کدام مقدار', kind: 'variable' }, COMPARE, { key: 'value', label: 'با عدد', kind: 'number' }],
  },
  swipe: {
    title: 'صفحه با انگشت کشیده می‌شود',
    make: () => ({ type: 'swipe', direction: 'right' }),
    fields: [{ key: 'direction', label: 'به کدام طرف', kind: 'choice', options: [
      { value: 'right', label: 'راست' },
      { value: 'left', label: 'چپ' },
      { value: 'up', label: 'بالا' },
      { value: 'down', label: 'پایین' },
    ] }],
  },
  holding: { title: 'تا وقتی صفحه لمس است', make: () => ({ type: 'holding' }), fields: [] },
  dead: {
    title: 'جان یک شیء تمام می‌شود',
    make: (ctx) => ({ type: 'dead', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء یا گروه', kind: 'ref' }],
  },
  reward: { title: 'بازیکن تبلیغ جایزه‌ای را تا آخر دید', make: () => ({ type: 'reward' }), fields: [] },
  land: {
    title: 'یک شیء روی چیزی فرود می‌آید',
    make: (ctx) => ({ type: 'land', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء یا گروه', hint: 'شیء باید «جسم فیزیکی» داشته باشد.', kind: 'ref' }],
  },
  value: {
    title: 'مقدار یک شیء به حدی می‌رسد',
    make: (ctx) => ({ type: 'value', target: firstRef(ctx), name: 'open', op: '==', value: 1 }),
    fields: [
      { key: 'target', label: 'کدام شیء یا گروه', kind: 'ref' },
      { key: 'name', label: 'کدام مقدارش', hint: 'مقدارهای هر شیء در برگه‌ی «شیء» ساخته می‌شوند.', kind: 'valueName' },
      COMPARE,
      { key: 'value', label: 'با عدد', kind: 'number' },
    ],
  },
  line: {
    title: 'چند شیء در یک خط ردیف می‌شوند',
    make: (ctx) => ({ type: 'line', target: firstRef(ctx), name: '', length: 3, diagonal: true }),
    fields: [
      { key: 'target', label: 'اشیای کدام گروه', kind: 'ref' },
      slider('length', 'چند تا پشت‌سرهم', 2, 8, 1),
      { key: 'name', label: 'با مقدار یکسانِ', hint: 'مثلاً mark در بازی دوز. مقدار صفر یعنی «هنوز هیچ» و حساب نمی‌شود. خالی بگذار اگر کنار هم بودن کافی است.', kind: 'valueName' },
      { key: 'diagonal', label: 'خط اریب هم حساب شود', kind: 'bool' },
    ],
  },
  noneLeft: {
    title: 'دیگر هیچ شیئی از یک گروه نمانده',
    make: (ctx) => ({ type: 'noneLeft', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء یا گروه', kind: 'ref' }],
  },
  near: {
    title: 'یک شیء به شیء دیگر نزدیک می‌شود',
    make: (ctx) => ({ type: 'near', a: firstRef(ctx), b: firstRef(ctx), distance: 250, leave: false }),
    fields: [
      { key: 'a', label: 'اولی', kind: 'ref' },
      { key: 'b', label: 'دومی', kind: 'ref' },
      slider('distance', 'فاصله', 10, 2000, 10, 'از وسط یکی تا وسط دیگری، به پیکسل.'),
      { key: 'leave', label: 'وقتی دور می‌شود، نه نزدیک', hint: 'مثلاً وقتی بازیکن از دید نگهبان بیرون رفت.', kind: 'bool', fallback: false, advanced: true },
    ],
  },
  useItem: {
    title: 'بازیکن وسیله‌ای را در کوله‌پشتی لمس می‌کند',
    about: 'برای استفاده از وسیله‌ها؛ مثلاً با لمس معجون، جان زیاد شود و یک معجون از کوله‌پشتی برداشته شود. کوله‌پشتی باید در صحنه باشد.',
    available: hasItems,
    make: (ctx) => ({ type: 'useItem', item: firstItem(ctx) }),
    fields: [{ key: 'item', label: 'کدام وسیله', kind: 'item' }],
  },
  useItemOn: {
    title: 'بازیکن وسیله‌ای را روی چیزی می‌کشد',
    about: 'بازیکن وسیله را از کوله‌پشتی با انگشت بیرون می‌کشد و روی یک شیء رها می‌کند؛ مثل کلید روی در، یا آب روی آتش. اگر جای دیگری رهایش کند، به کوله‌پشتی برمی‌گردد.',
    available: hasItems,
    make: (ctx) => ({ type: 'useItemOn', item: firstItem(ctx), target: firstRef(ctx) }),
    fields: [{ key: 'item', label: 'کدام وسیله', kind: 'item' }, { key: 'target', label: 'روی کدام شیء', kind: 'ref' }],
  },
  eachEvery: {
    title: 'هر چند ثانیه، برای هر شیء جدا',
    make: (ctx) => ({ type: 'eachEvery', target: firstRef(ctx), seconds: 2 }),
    fields: [
      { key: 'target', label: 'برای هر کدام از', kind: 'ref' },
      { key: 'seconds', label: 'هر چند ثانیه', kind: 'number' },
    ],
  },
};

export const CONDITION_FIELDS: Field[] = [
  { key: 'name', label: 'مقدار', kind: 'variable' },
  COMPARE,
  { key: 'value', label: 'با', kind: 'amount' },
];

const TARGET: Field = { key: 'target', label: 'کدام شیء', kind: 'target' };

/** A condition on one of an object's own values, rather than on a game variable. */
export const OBJECT_CONDITION_FIELDS: Field[] = [
  { key: 'of', label: 'مقدارِ کدام شیء', kind: 'target' },
  { key: 'name', label: 'کدام مقدارش', kind: 'valueName' },
  COMPARE,
  { key: 'value', label: 'با', kind: 'amount' },
];

export const ACTIONS: { [K in Action['type']]: Block<Extract<Action, { type: K }>> } = {
  give: {
    title: 'دادن وسیله به کوله‌پشتی',
    about: 'وسیله‌ای مثل کلید یا معجون به کوله‌پشتی بازیکن اضافه می‌شود. عکسش از روی شیئی که برداشته شد پرواز می‌کند و در خانه‌اش در کوله‌پشتی می‌نشیند.',
    available: hasItems,
    make: (ctx) => ({ type: 'give', item: firstItem(ctx), amount: 1, from: 'second' }),
    fields: [
      { key: 'item', label: 'کدام وسیله', kind: 'item' },
      { key: 'amount', label: 'چند تا', kind: 'number' },
      { key: 'from', label: 'عکسش از کجا پرواز کند', hint: 'معمولاً همان چیزی که بازیکن به آن خورد. «بدون پرواز» یعنی فقط در کوله‌پشتی پیدا شود.', kind: 'flyFrom' },
    ],
  },
  checkpoint: {
    title: 'ثبت ایست بازرسی',
    about: 'جایی که شیء همین حالا هست، جای برگشتنش می‌شود؛ مثل وقتی بازیکن به پرچم وسط مرحله می‌رسد. با کار «برگشتن به ایست بازرسی» به همین‌جا برمی‌گردد.',
    make: () => ({ type: 'checkpoint', target: 'first' }),
    fields: [TARGET],
  },
  respawn: {
    title: 'برگشتن به ایست بازرسی',
    about: 'شیء به آخرین ایست بازرسی‌اش برمی‌گردد (اگر به هیچ‌کدام نرسیده، به جای اولش در صحنه) و می‌ایستد؛ مثلاً وقتی بازیکن به خار می‌خورد، به‌جای شروع دوباره‌ی کل مرحله.',
    make: () => ({ type: 'respawn', target: 'first' }),
    fields: [TARGET],
  },
  take: {
    title: 'برداشتن وسیله از کوله‌پشتی',
    about: 'وسیله‌ای از کوله‌پشتی کم می‌شود؛ مثلاً کلیدی که در را باز کرد. اگر بیشتر از آنچه هست برداری، فقط تا صفر کم می‌شود.',
    available: hasItems,
    make: (ctx) => ({ type: 'take', item: firstItem(ctx), amount: 1 }),
    fields: [
      { key: 'item', label: 'کدام وسیله', kind: 'item' },
      { key: 'amount', label: 'چند تا', kind: 'number' },
    ],
  },
  setVariable: {
    title: 'تغییر یک مقدار',
    available: hasVariables,
    make: ({ project }) => ({ type: 'setVariable', name: project.variables[0].name, op: 'add', amount: 1 }),
    fields: [
      { key: 'name', label: 'کدام مقدار', kind: 'variable' },
      { key: 'op', label: 'چه کار', kind: 'choice', options: [
        { value: 'add', label: 'اضافه کن' },
        { value: 'subtract', label: 'کم کن' },
        { value: 'set', label: 'بگذار برابر' },
        { value: 'multiply', label: 'ضرب کن در' },
        { value: 'divide', label: 'تقسیم کن بر' },
        { value: 'max', label: 'اگر بیشتر بود، جایگزین کن' },
      ] },
      { key: 'amount', label: 'چقدر', kind: 'amount' },
    ],
  },
  resetVariables: {
    title: 'همه‌ی مقدارها از نو',
    about: 'مقدارهایی که «روی گوشی بماند» دارند دست نمی‌خورند.',
    make: () => ({ type: 'resetVariables' }),
    fields: [],
  },
  destroy: { title: 'حذف شیء', make: (ctx) => ({ type: 'destroy', target: firstRef(ctx) }), fields: [TARGET] },
  spawn: {
    title: 'ساختن یک شیء',
    available: hasPrefabs,
    make: (ctx) => ({ type: 'spawn', prefab: ctx.scene.prefabs[0].id, at: firstRef(ctx) }),
    fields: [{ key: 'prefab', label: 'چه چیزی', kind: 'prefab' }, { key: 'at', label: 'کجا', kind: 'place' }],
  },
  show: { title: 'نشان دادن شیء', make: (ctx) => ({ type: 'show', target: firstRef(ctx) }), fields: [TARGET] },
  hide: { title: 'پنهان کردن شیء', make: (ctx) => ({ type: 'hide', target: firstRef(ctx) }), fields: [TARGET] },
  moveTo: {
    title: 'بردن شیء به یک نقطه',
    make: (ctx) => ({ type: 'moveTo', target: firstRef(ctx), x: 0, y: 0 }),
    fields: [TARGET, { key: 'x', label: 'فاصله از چپ', kind: 'number' }, { key: 'y', label: 'فاصله از بالا', kind: 'number' }],
  },
  push: {
    title: 'هل دادن شیء',
    about: 'به شیء سرعت می‌دهد. منفی یعنی به چپ یا بالا.',
    make: (ctx) => ({ type: 'push', target: firstRef(ctx), vx: 0, vy: -600 }),
    fields: [TARGET, { key: 'vx', label: 'سرعت افقی', kind: 'number' }, { key: 'vy', label: 'سرعت عمودی', kind: 'number' }],
  },
  jump: {
    title: 'پراندن شیء',
    about: 'شیء باید رفتار «پرش» داشته باشد.',
    make: (ctx) => ({ type: 'jump', target: firstRef(ctx) }),
    fields: [TARGET],
  },
  goToScene: {
    title: 'رفتن به صحنه‌ی دیگر',
    make: ({ project }) => ({ type: 'goToScene', scene: project.scenes[0].id }),
    fields: [{ key: 'scene', label: 'کدام صحنه', kind: 'scene' }],
  },
  restartScene: { title: 'شروع دوباره‌ی همین صحنه', make: () => ({ type: 'restartScene' }), fields: [] },
  playSound: {
    title: 'پخش صدا',
    make: () => ({ type: 'playSound', sound: 'coin' }),
    fields: [{ key: 'sound', label: 'کدام صدا', kind: 'sound' }],
  },
  effect: {
    title: 'جلوه‌ی نرم',
    about: 'ظاهر شیء را نرم عوض می‌کند. «کوچک شدن و رفتن» در آخر شیء را حذف می‌کند.',
    make: (ctx) => ({ type: 'effect', target: firstRef(ctx), kind: 'pop', seconds: 0.3 }),
    fields: [TARGET, { key: 'kind', label: 'چه جلوه‌ای', kind: 'choice', options: [
      { value: 'pop', label: 'یک لحظه بزرگ شود' },
      { value: 'grow', label: 'از هیچ بزرگ شود' },
      { value: 'shrink', label: 'کوچک شود و برود' },
      { value: 'fadeIn', label: 'کم‌کم پیدا شود' },
      { value: 'fadeOut', label: 'کم‌کم محو شود' },
    ] }, slider('seconds', 'چقدر طول بکشد', 0.1, 3, 0.1, undefined, 'ثانیه')],
  },
  glide: {
    title: 'حرکت نرم به یک نقطه',
    make: (ctx) => ({ type: 'glide', target: firstRef(ctx), x: 0, y: 0, seconds: 0.5 }),
    fields: [
      TARGET,
      { key: 'x', label: 'فاصله از چپ', kind: 'number' },
      { key: 'y', label: 'فاصله از بالا', kind: 'number' },
      slider('seconds', 'چقدر طول بکشد', 0.1, 5, 0.1, undefined, 'ثانیه'),
      { key: 'ease', label: 'چطور حرکت کند', kind: 'choice', fallback: 'smooth', options: [
        { value: 'smooth', label: 'نرم: آرام شروع و آرام تمام' },
        { value: 'linear', label: 'یکنواخت' },
        { value: 'in', label: 'آرام شروع، تند تمام' },
        { value: 'out', label: 'تند شروع، آرام تمام' },
        { value: 'bounce', label: 'فرود با جهیدن، مثل توپ' },
        { value: 'elastic', label: 'کشسان، مثل فنر' },
        { value: 'back', label: 'اول کمی عقب، بعد جلو' },
      ] },
    ],
  },
  damage: {
    title: 'کم کردن جان شیء',
    about: 'فقط روی شیئی اثر دارد که در برگه‌ی «شیء» برایش «جان» گذاشته‌ای. وقتی جانش تمام شود، اتفاق «جان یک شیء تمام می‌شود» رخ می‌دهد.',
    make: (ctx) => ({ type: 'damage', target: firstRef(ctx), amount: 1 }),
    fields: [TARGET, { key: 'amount', label: 'چقدر', kind: 'number' }],
  },
  pause: { title: 'مکث بازی', about: 'همه‌چیز می‌ایستد. فقط قانون‌های «لمس» کار می‌کنند تا بتوانی بازی را ادامه بدهی.', make: () => ({ type: 'pause' }), fields: [] },
  resume: { title: 'ادامه‌ی بازی بعد از مکث', make: () => ({ type: 'resume' }), fields: [] },
  setSound: {
    title: 'روشن یا خاموش کردن صدا',
    about: 'همه‌ی صداها و موسیقی بازی را تا آخر همین بار بازی کردن خاموش یا روشن می‌کند؛ برای دکمه‌ی صدا.',
    make: () => ({ type: 'setSound', on: false }),
    fields: [{ key: 'on', label: 'صدا روشن باشد', kind: 'bool' }],
  },
  setValue: {
    title: 'تغییر مقدار یک شیء',
    about: 'هر شیء می‌تواند مقدارهای خودش را داشته باشد؛ مثل «باز بودن» یک کارت. اگر شیء آن مقدار را نداشته باشد، همین‌جا ساخته می‌شود.',
    make: (ctx) => ({ type: 'setValue', target: firstRef(ctx), name: 'open', op: 'set', amount: 1 }),
    fields: [
      TARGET,
      { key: 'name', label: 'کدام مقدارش', kind: 'valueName' },
      { key: 'op', label: 'چه کار', kind: 'choice', options: [
        { value: 'set', label: 'بگذار برابر' },
        { value: 'add', label: 'اضافه کن' },
        { value: 'subtract', label: 'کم کن' },
        { value: 'multiply', label: 'ضرب کن در' },
      ] },
      { key: 'amount', label: 'چقدر', kind: 'amount' },
    ],
  },
  shuffle: {
    title: 'بُر زدن جای اشیا',
    about: 'اشیای یک گروه جایشان را تصادفی با هم عوض می‌کنند؛ مثل بُر زدن کارت‌ها در شروع بازی.',
    make: (ctx) => ({ type: 'shuffle', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'اشیای کدام گروه', kind: 'ref' }],
  },
  swap: {
    title: 'جا عوض کردن دو شیء',
    about: 'دو شیء جایشان را با هم عوض می‌کنند. اگر «فقط اگر کنار هم‌اند» روشن باشد و کنار هم نباشند، هیچ کاری نمی‌شود.',
    make: (ctx) => ({ type: 'swap', target: firstRef(ctx), other: firstRef(ctx), near: true }),
    fields: [TARGET, { key: 'other', label: 'با کدام شیء', kind: 'target' }, { key: 'near', label: 'فقط اگر کنار هم‌اند', hint: 'یعنی یک خانه فاصله، در یک ردیف یا یک ستون.', kind: 'bool' },
      { ...slider('match', 'فقط اگر خطی به این درازا بسازد', 0, 6, 1, 'صفر یعنی همیشه جا عوض کنند. با ۳، فقط وقتی جا عوض می‌کنند که یکی‌شان در یک ردیف سه‌تایی هم‌نوع بنشیند؛ وگرنه سر جایشان می‌مانند.'), fallback: 0, advanced: true },
      { key: 'matchBy', label: 'هم‌نوع یعنی این مقدارشان یکی باشد', kind: 'valueName', fallback: '', advanced: true, showIf: (v) => Number(v.match ?? 0) >= 2 },
    ],
  },
  settle: {
    title: 'پایین ریختن و پر کردن صفحه',
    about: 'برای صفحه‌ای که بعضی مهره‌هایش حذف شده‌اند: مهره‌های گروه در ستون خودشان پایین می‌ریزند و جای خالی از بالا با مهره‌های تازه پر می‌شود. صفحه همان جایی است که اشیای گروه را در ویرایشگر چیده‌ای.',
    available: hasPrefabs,
    make: (ctx) => ({ type: 'settle', target: firstRef(ctx), prefabs: [ctx.scene.prefabs[0].id] }),
    fields: [{ key: 'target', label: 'مهره‌های کدام گروه', kind: 'ref' }, { key: 'prefabs', label: 'مهره‌های تازه از این‌ها', kind: 'prefabs' }],
  },
  slideAll: {
    title: 'سُر دادن همه‌ی مهره‌ها به یک طرف',
    about: 'حرکت بازی ۲۰۴۸: همه‌ی مهره‌های گروه تا جایی که راه دارند به یک طرف سُر می‌خورند. دو مهره که مقدارشان یکی است به هم که برسند یکی می‌شوند و مقدارش یکی بالا می‌رود. اگر چیزی جابه‌جا شد، یک مهره‌ی تازه در یک خانه‌ی خالی می‌آید.',
    available: hasPrefabs,
    make: (ctx) => ({ type: 'slideAll', target: firstRef(ctx), direction: 'left', boardTag: '', mergeBy: 'level', prefab: ctx.scene.prefabs[0].id }),
    fields: [
      { key: 'target', label: 'مهره‌های کدام گروه', kind: 'ref' },
      { key: 'direction', label: 'به کدام طرف', kind: 'choice', options: [
        { value: 'left', label: 'چپ' },
        { value: 'right', label: 'راست' },
        { value: 'up', label: 'بالا' },
        { value: 'down', label: 'پایین' },
      ] },
      { key: 'boardTag', label: 'گروه خانه‌های صفحه', hint: 'اشیایی که خانه‌های صفحه را نشان می‌دهند؛ مهره‌ها از آن‌ها بیرون نمی‌روند.', kind: 'tag' },
      { key: 'mergeBy', label: 'دو تا با این مقدارِ یکسان یکی شوند', hint: 'خالی بگذار تا فقط سُر بخورند.', kind: 'valueName' },
      { key: 'prefab', label: 'مهره‌ی تازه', kind: 'prefab' },
    ],
  },
  step: {
    title: 'یک خانه جابه‌جا شدن',
    about: 'شیء یک خانه می‌رود، مگر اینکه چیزی جلویش باشد یا از دنیا بیرون بزند. اندازه‌ی خانه در برگه‌ی «بازی» است؛ اگر نگذاشته باشی، اندازه‌ی خود شیء حساب می‌شود.',
    make: (ctx) => ({ type: 'step', target: firstRef(ctx), direction: 'right', blockTag: '', pushTag: '' }),
    fields: [
      TARGET,
      { key: 'direction', label: 'به کدام طرف', kind: 'choice', options: [
        { value: 'right', label: 'راست' },
        { value: 'left', label: 'چپ' },
        { value: 'up', label: 'بالا' },
        { value: 'down', label: 'پایین' },
      ] },
      { key: 'blockTag', label: 'از این گروه رد نشود', hint: 'مثلاً دیوار. خالی یعنی هیچ‌چیز جلویش را نمی‌گیرد.', kind: 'tag' },
      { key: 'pushTag', label: 'این گروه را هل بدهد', hint: 'مثلاً جعبه. اگر پشت جعبه جا باشد، جعبه هم یک خانه می‌رود.', kind: 'tag' },
    ],
  },
  setGravity: {
    title: 'تغییر جاذبه',
    about: 'جاذبه‌ی این صحنه را تا آخر صحنه عوض می‌کند. عدد منفی یعنی همه‌چیز به بالا می‌افتد؛ صفر یعنی بی‌وزنی. جاذبه‌ی معمولی ۲۴۰۰ است.',
    make: () => ({ type: 'setGravity', amount: -2400 }),
    fields: [{ key: 'amount', label: 'جاذبه', kind: 'number' }],
  },
  vibrate: {
    title: 'لرزش گوشی',
    about: 'گوشی یک لحظه می‌لرزد؛ برای ضربه یا باخت. روی کامپیوتر اثری ندارد.',
    make: () => ({ type: 'vibrate', ms: 60 }),
    fields: [slider('ms', 'چقدر طول بکشد', 10, 500, 10, undefined, 'هزارم ثانیه')],
  },
  showRewardedAd: {
    title: 'پیشنهاد تبلیغ جایزه‌ای',
    about: 'اگر بازیکن تبلیغ را تا آخر ببیند، اتفاق «بازیکن تبلیغ جایزه‌ای را تا آخر دید» رخ می‌دهد.',
    make: () => ({ type: 'showRewardedAd' }),
    fields: [],
  },
  burst: {
    title: 'جرقه و تکه‌پرانی',
    about: 'تکه‌های کوچک رنگی از وسط شیء بیرون می‌پرند و محو می‌شوند؛ برای برخورد، انفجار یا گرفتن جایزه.',
    make: (ctx) => ({ type: 'burst', target: firstRef(ctx), color: '#ffd54a', count: 16 }),
    fields: [{ key: 'target', label: 'از کدام شیء', kind: 'target' }, { key: 'color', label: 'رنگ تکه‌ها', kind: 'color' }, slider('count', 'چند تکه', 4, 40, 1)],
  },
  shake: {
    title: 'لرزش صفحه',
    about: 'کل صفحه یک لحظه می‌لرزد؛ برای ضربه و باخت.',
    make: () => ({ type: 'shake', strength: 12 }),
    fields: [slider('strength', 'شدت', 2, 40, 1)],
  },
  showAd: {
    title: 'نمایش تبلیغ تمام‌صفحه',
    about: 'فقط وقتی تبلیغات در بخش «بازی» روشن باشد.',
    make: () => ({ type: 'showAd' }),
    fields: [],
  },
  moveBy: {
    title: 'جابه‌جا کردن شیء به یک اندازه',
    about: 'از همان جایی که هست حرکتش می‌دهد. منفی یعنی به چپ یا بالا.',
    make: (ctx) => ({ type: 'moveBy', target: firstRef(ctx), dx: 100, dy: 0 }),
    fields: [TARGET, { key: 'dx', label: 'چقدر به راست', kind: 'number' }, { key: 'dy', label: 'چقدر به پایین', kind: 'number' }],
  },
  moveRandom: {
    title: 'بردن شیء به جای تصادفی',
    about: 'یک جای تصادفی روی صفحه.',
    make: (ctx) => ({ type: 'moveRandom', target: firstRef(ctx) }),
    fields: [TARGET],
  },
  wait: {
    title: 'کمی صبر کن',
    about: 'کارهای بعدی همین قانون بعد از این مدت انجام می‌شوند.',
    make: () => ({ type: 'wait', seconds: 1 }),
    fields: [{ key: 'seconds', label: 'چند ثانیه', kind: 'number' }],
  },
  setColor: {
    title: 'عوض کردن رنگ',
    about: 'رنگ شکل یا متن را عوض می‌کند. روی عکس، عکس را به آن رنگ درمی‌آورد؛ سفید یعنی رنگ خود عکس.',
    make: (ctx) => ({ type: 'setColor', target: firstRef(ctx), color: '#ff5a5f' }),
    fields: [TARGET, { key: 'color', label: 'رنگ تازه', kind: 'color' }],
  },
  setImage: {
    title: 'عوض کردن عکس',
    about: 'شیء عکس دیگری نشان می‌دهد؛ مثل دری که باز می‌شود یا دشمنی که زخمی شده. انیمیشنش می‌ایستد.',
    make: (ctx) => ({ type: 'setImage', target: firstRef(ctx), asset: Object.keys(ctx.project.assets).find((id) => ctx.project.assets[id].type === 'image') ?? '' }),
    fields: [TARGET, { key: 'asset', label: 'عکس تازه', kind: 'image' }],
  },
  setText: {
    title: 'عوض کردن متن',
    about: 'آنچه یک متن می‌نویسد را عوض می‌کند. مقدارها را مثل همیشه با {نام} نشان بده.',
    make: (ctx) => ({ type: 'setText', target: firstRef(ctx), text: 'You win!' }),
    fields: [TARGET, { key: 'text', label: 'متن تازه', kind: 'text' }],
  },
  resize: {
    title: 'عوض کردن اندازه',
    about: 'شیء بزرگ یا کوچک می‌شود و وسطش سر جایش می‌ماند. برخوردش هم با اندازه‌ی تازه حساب می‌شود؛ مثل قارچی که بازیکن را بزرگ می‌کند.',
    make: (ctx) => ({ type: 'resize', target: firstRef(ctx), width: 160, height: 160 }),
    fields: [TARGET, { key: 'width', label: 'پهنای تازه', kind: 'number' }, { key: 'height', label: 'بلندی تازه', kind: 'number' }],
  },
  turn: {
    title: 'چرخاندن شیء',
    make: (ctx) => ({ type: 'turn', target: firstRef(ctx), op: 'add', degrees: 90 }),
    fields: [
      TARGET,
      { key: 'op', label: 'چه کار', kind: 'choice', options: [{ value: 'add', label: 'این‌قدر بیشتر بچرخد' }, { value: 'set', label: 'دقیقاً به این زاویه برود' }] },
      slider('degrees', 'زاویه', -360, 360, 5, 'منفی یعنی خلاف جهت عقربه‌های ساعت', 'درجه'),
    ],
  },
  setOpacity: {
    title: 'عوض کردن پررنگی',
    about: 'صفر یعنی نامرئی، ولی هنوز سر جایش هست و به چیزها می‌خورد. برای پنهان کردن واقعی، «پنهان کردن شیء» را بزن.',
    make: (ctx) => ({ type: 'setOpacity', target: firstRef(ctx), opacity: 0.5 }),
    fields: [TARGET, slider('opacity', 'پررنگی', 0, 1, 0.05)],
  },
  flash: {
    title: 'درخشیدن یک لحظه‌ای',
    about: 'شیء یک لحظه به رنگی درمی‌آید و آرام به رنگ خودش برمی‌گردد؛ مثل وقتی دشمن ضربه می‌خورد. سفید از همه بهتر دیده می‌شود.',
    make: (ctx) => ({ type: 'flash', target: firstRef(ctx), color: '#ffffff', seconds: 0.25 }),
    fields: [TARGET, { key: 'color', label: 'رنگ', kind: 'color' }, slider('seconds', 'چقدر طول بکشد', 0.05, 2, 0.05, undefined, 'ثانیه')],
  },
  layer: {
    title: 'جلو یا عقب بردن شیء',
    about: 'شیء روی همه یا پشت همه کشیده می‌شود.',
    make: (ctx) => ({ type: 'layer', target: firstRef(ctx), to: 'front' }),
    fields: [TARGET, { key: 'to', label: 'کجا', kind: 'choice', options: [{ value: 'front', label: 'جلوی همه' }, { value: 'back', label: 'پشت همه' }] }],
  },
  setLook: {
    title: 'عوض کردن حال و هوای تصویر',
    about: 'رنگ کل تصویر را عوض می‌کند، مثل فیلتر عکس: گرم، سرد، سیاه‌وسفید، قدیمی، شب، رؤیایی یا پررنگ. مثلاً وقتی بازیکن می‌بازد، تصویر سیاه‌وسفید شود.',
    make: () => ({ type: 'setLook', look: 'gray' }),
    fields: [{ key: 'look', label: 'چه حال و هوایی', kind: 'choice', options: LOOK_OPTIONS }],
  },
  setDarkness: {
    title: 'تاریک و روشن کردن صحنه',
    about: 'صحنه را آرام تاریک یا روشن می‌کند؛ مثل شب شدن. فقط اشیایی که رفتار «نور» دارند در تاریکی روشن می‌مانند.',
    make: () => ({ type: 'setDarkness', amount: 0.8, seconds: 2 }),
    fields: [slider('amount', 'چقدر تاریک', 0, 1, 0.05, 'صفر یعنی روشن، یک یعنی سیاه.'), slider('seconds', 'در چند ثانیه', 0, 10, 0.5, 'صفر یعنی یک‌دفعه.', 'ثانیه')],
  },
  send: {
    title: 'فرستادن پیام',
    about: 'قانون‌هایی که با «پیامی می‌رسد» منتظر همین پیام‌اند، یک لحظه بعد اجرا می‌شوند. «همان اولی» و «همان دومی» با پیام می‌روند.',
    make: ({ scene }) => ({ type: 'send', name: messageNamesOf(scene)[0] ?? 'باخت' }),
    fields: [{ key: 'name', label: 'کدام پیام', kind: 'message' }],
  },
  nextScene: {
    title: 'رفتن به صحنه‌ی بعد',
    about: 'به صحنه‌ای می‌رود که در فهرست صحنه‌ها بعد از همین است؛ بعد از آخری، به اولی. برای مرحله‌ی بعد، بدون اینکه نام صحنه را انتخاب کنی.',
    make: () => ({ type: 'nextScene' }),
    fields: [],
  },
  kick: {
    title: 'ضربه زدن به شیء',
    about: 'به سرعت فعلی شیء اضافه می‌کند (کار «هل دادن» سرعت را عوض می‌کند، این یکی اضافه می‌کند). مثل لگد زدن به توپ یا یک وزش باد.',
    make: (ctx) => ({ type: 'kick', target: firstRef(ctx), vx: 300, vy: -300 }),
    fields: [TARGET, { key: 'vx', label: 'به راست', hint: 'منفی یعنی به چپ', kind: 'number' }, { key: 'vy', label: 'به پایین', hint: 'منفی یعنی به بالا', kind: 'number' }],
  },
  spin: {
    title: 'چرخاندن با فیزیک',
    about: 'شیء «فیزیک واقعی» را با این سرعت به چرخش می‌اندازد؛ بعد خودش آرام می‌شود یا به چیزها می‌خورد.',
    make: (ctx) => ({ type: 'spin', target: firstRef(ctx), speed: 360 }),
    fields: [TARGET, slider('speed', 'سرعت چرخش', -1440, 1440, 10, 'مثبت یعنی در جهت عقربه‌های ساعت.', 'درجه در ثانیه')],
  },
  cut: {
    title: 'بریدن اتصال',
    about: 'همه‌ی «اتصال»‌های شیء را می‌بُرد؛ مثل بریدن طناب یا افتادن پیچ. مثلاً وقتی صفحه کشیده شد، طناب آب‌نبات بریده شود.',
    make: (ctx) => ({ type: 'cut', target: firstRef(ctx) }),
    fields: [TARGET],
  },
  setPhysics: {
    title: 'ثابت کردن یا رها کردن',
    about: 'شیء «فیزیک واقعی» را رها می‌کند تا بیفتد و غلت بخورد، یا همان‌جا محکمش می‌کند. مثلاً پلی که وقتی بازیکن رسید فرو می‌ریزد.',
    make: (ctx) => ({ type: 'setPhysics', target: firstRef(ctx), kind: 'moving' }),
    fields: [TARGET, { key: 'kind', label: 'چه شود', kind: 'choice', options: [{ value: 'moving', label: 'رها شود و بیفتد' }, { value: 'still', label: 'همان‌جا محکم شود' }] }],
  },
  blast: {
    title: 'انفجار',
    about: 'همه‌ی اشیای «فیزیک واقعی» دور و بر را به بیرون پرت می‌کند؛ هرچه نزدیک‌تر، محکم‌تر. خودش چیزی را از بین نمی‌برد؛ برای دیدنش «جرقه و تکه‌پرانی» و «لرزش صفحه» را هم اضافه کن.',
    make: (ctx) => ({ type: 'blast', at: firstRef(ctx), strength: 1500, radius: 300 }),
    fields: [{ key: 'at', label: 'از کجا', kind: 'target' }, slider('strength', 'قدرت', 100, 5000, 50), slider('radius', 'تا چه فاصله‌ای', 50, 1200, 10)],
  },
  playMusic: {
    title: 'عوض کردن موسیقی',
    about: 'به‌جای موسیقی صحنه، یکی از صداهایی را که اضافه کرده‌ای پشت‌سرهم پخش می‌کند؛ مثل موسیقی تند برای غول آخر. «هیچ» موسیقی را قطع می‌کند.',
    make: ({ project }) => ({ type: 'playMusic', music: Object.keys(project.assets).find((id) => project.assets[id].type === 'sound') ?? '' }),
    fields: [{ key: 'music', label: 'کدام موسیقی', kind: 'music' }],
  },
  zoom: {
    title: 'نزدیک و دور کردن دوربین',
    about: '۱ اندازه‌ی معمولی است. ۲ همه‌چیز را دو برابر بزرگ نشان می‌دهد؛ ۰٫۵ دو برابر بیشتر از دنیا را. چیزهایی که به صفحه چسبیده‌اند عوض نمی‌شوند.',
    make: () => ({ type: 'zoom', amount: 1.5, seconds: 0.5 }),
    fields: [slider('amount', 'چقدر نزدیک', 0.25, 4, 0.05), slider('seconds', 'چقدر طول بکشد', 0, 3, 0.1, 'صفر یعنی فوری.', 'ثانیه')],
  },
};

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
};

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
  { title: 'کنترل با انگشت', types: ['jumper', 'walker', 'steer', 'followFinger', 'draggable'] },
  { title: 'حرکت خودکار', types: ['mover', 'patrol', 'route', 'chase', 'launch', 'wave', 'attach'] },
  { title: 'فیزیک و دوربین', types: ['body', 'physics', 'joint', 'field', 'camera'] },
  { title: 'ساختن و از بین رفتن', types: ['spawner', 'lifetime'] },
  { title: 'جلوه‌ی ظاهری', types: ['particles', 'light', 'rotate', 'pulse', 'blink', 'trail', 'scrollImage'] },
];

export const TRIGGER_GROUPS: BlockGroup<Trigger['type']>[] = [
  { title: 'لمس صفحه', types: ['tap', 'tapObject', 'swipe', 'holding'] },
  { title: 'اشیا', types: ['touch', 'near', 'land', 'offscreen', 'noneLeft', 'dead'] },
  { title: 'فیزیک واقعی', types: ['hit', 'thrown', 'rest', 'snap'] },
  { title: 'زمان', types: ['start', 'every', 'eachEvery', 'after'] },
  { title: 'جورچین و منطق', types: ['message', 'value', 'line'] },
  { title: 'مقدارها و تبلیغ', types: ['variable', 'reward'] },
  { title: 'کوله‌پشتی', types: ['useItem', 'useItemOn'] },
];

export const ACTION_GROUPS: BlockGroup<Action['type']>[] = [
  { title: 'امتیاز و مقدارها', types: ['setVariable', 'resetVariables'] },
  { title: 'کوله‌پشتی', types: ['give', 'take'] },
  { title: 'اشیا', types: ['destroy', 'spawn', 'show', 'hide', 'damage'] },
  { title: 'حرکت دادن', types: ['checkpoint', 'respawn', 'moveTo', 'glide', 'moveBy', 'moveRandom', 'push', 'jump', 'turn'] },
  { title: 'فیزیک واقعی', types: ['kick', 'spin', 'blast', 'cut', 'setPhysics'] },
  { title: 'ظاهر', types: ['setColor', 'setImage', 'setText', 'resize', 'setOpacity', 'flash', 'layer', 'setLook', 'setDarkness'] },
  { title: 'صدا و جلوه', types: ['playSound', 'playMusic', 'effect', 'burst', 'shake', 'vibrate', 'setSound'] },
  { title: 'صحنه و جریان بازی', types: ['goToScene', 'nextScene', 'restartScene', 'send', 'wait', 'pause', 'resume', 'setGravity', 'zoom'] },
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
  return block.available === hasPrefabs ? NEEDS_PREFAB : NEEDS_VARIABLE;
}

const faNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2, useGrouping: false });

export function fa(value: number): string {
  return faNumber.format(value);
}

/** Colors offered as one-tap choices. */
export const PALETTE = [
  '#ff5a5f', '#ff9f1c', '#ffd54a', '#43a047', '#2e7d32', '#26c6da',
  '#bfe8ff', '#1565c0', '#7e57c2', '#6d4c41', '#1b3a4b', '#ffffff',
];
