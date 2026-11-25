import type { Action, Behavior, Trigger } from '../format/types';
import { PARTICLE_COLORS } from '../runtime/particles';
import { COMPARE, fa, hasPrefabs, hasTexts, LOOK_OPTIONS, slider, SOUND_LABEL, type Block, type Context, type Field, type Option } from '../blocks/fields';
import { ACTION_BLOCKS, TRIGGER_BLOCKS } from '../blocks/registry';

export { fa, LOOK_OPTIONS, SOUND_LABEL, type Context, type Field };

/**
 * Everything the editor says about the format, in the user's words. Each
 * behavior, trigger and action is described once here: its Persian name, a
 * starting value, and the list of fields that edit it. The panels are drawn
 * from these descriptions, so adding a block to the engine means adding one
 * entry here and nothing in the panels.
 */





const SPEED = (key: string, label: string, hint: string) => slider(key, label, -1500, 1500, 10, hint);
/** The group most games call their ground, if this scene has one, so new physics stands on it from the start. */
const groundTag = ({ scene }: Context): string => {
  const tags = new Set(scene.objects.flatMap((o) => [...o.tags, ...(o.visual.kind === 'tiles' ? Object.values(o.visual.kinds).flatMap((k) => k.tags) : [])]));
  return ['زمین', 'ground', 'دیوار'].find((tag) => tags.has(tag)) ?? '';
};
const moving = (v: Record<string, unknown>) => v.kind !== 'still';
const custom = (v: Record<string, unknown>) => !v.material || v.material === 'custom';
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
      { ...slider('bounce', 'برگشت بعد از برخورد', 0, 1, 0.05, 'صفر یعنی می‌ایستد؛ یک یعنی مثل توپ لاستیکی همان‌قدر بالا برمی‌گردد.'), showIf: custom },
      { ...slider('friction', 'زبری', 0, 1, 0.05, 'صفر یعنی مثل یخ سُر می‌خورد؛ یک یعنی مثل لاستیک می‌چسبد و غلت می‌خورد.'), showIf: custom },
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
      { key: 'material', label: 'جنس', hint: 'با یک انتخاب، زبری، برگشت، سنگینی و صدای برخوردش مثل همان جنس واقعی می‌شود. «دلخواه» یعنی خودت تنظیم کنی.', kind: 'choice', fallback: 'custom', options: [
        { value: 'custom', label: 'دلخواه' },
        { value: 'wood', label: 'چوب' },
        { value: 'stone', label: 'سنگ' },
        { value: 'metal', label: 'فلز' },
        { value: 'ice', label: 'یخ (لیز)' },
        { value: 'rubber', label: 'لاستیک (فنری)' },
        { value: 'glass', label: 'شیشه' },
      ] },
      { key: 'shape', label: 'شکل برخورد', hint: 'با چه شکلی به بقیه می‌خورد. «دور عکس» یعنی دقیقاً همان‌جا که عکس کشیده شده، نه گوشه‌های جعبه‌ی دورش؛ برای سنگ، موجود و هر عکس نامنظم. «کپسول» گوشه‌ی تیز ندارد و به لبه‌ها گیر نمی‌کند؛ برای شخصیت یا کُنده‌ی درخت.', kind: 'choice', fallback: 'auto', options: [
        { value: 'auto', label: 'خودکار: جعبه، یا دایره اگر گرد است' },
        { value: 'outline', label: 'دور عکس (دقیق)' },
        { value: 'capsule', label: 'کپسول: دو سر گرد' },
        { value: 'triangle', label: 'مثلث' },
        { value: 'hexagon', label: 'شش‌ضلعی' },
      ] },
      { ...slider('propeller', 'رانش ملخ در آب', 0, 3000, 50, 'با کلید راست یا لمس نیمه‌ی راست روی آب جلو می‌رود و با چپ عقب می‌آید.'), fallback: 0, showIf: moving },
      { ...slider('breaks', 'بشکند با ضربه‌ی', 0, 2000, 50, 'اگر محکم‌تر از این بخورد، تکه‌تکه می‌شود و تکه‌ها پخش می‌شوند؛ مثل شیشه یا جعبه‌ی ترد. صفر یعنی هیچ‌وقت نمی‌شکند. حدود ۴۰۰ یعنی با یک ضربه‌ی معمولی.', 'پیکسل در ثانیه'), fallback: 0 },
      { key: 'passTag', label: 'از این گروه رد شود', hint: 'به اشیای این گروه نمی‌خورد و از میانشان رد می‌شود؛ مثلاً تیرهای خود بازیکن، یا دشمن‌هایی که از هم رد می‌شوند.', kind: 'tag', fallback: '', advanced: true },
      { ...slider('weight', 'سنگینی', 0.1, 10, 0.1, 'یک معمولی است. سنگین‌تر بقیه را محکم‌تر هل می‌دهد و سخت‌تر جابه‌جا می‌شود.'), fallback: 1, advanced: true, showIf: (v) => moving(v) && custom(v) },
      { key: 'rotates', label: 'بتواند بچرخد و واژگون شود', hint: 'برای شخصیت بازی خاموشش کن تا همیشه سرپا بماند.', kind: 'bool', fallback: true, advanced: true, showIf: moving },
      { key: 'gravity', label: 'جاذبه رویش اثر کند', hint: 'خاموش برای فضا، یا میز بیلیارد که از بالا دیده می‌شود.', kind: 'bool', fallback: true, advanced: true, showIf: moving },
      { ...slider('slowdown', 'کند شدن خودبه‌خود', 0, 1, 0.05, 'مثل هوای غلیظ یا پارچه‌ی میز بیلیارد. صفر یعنی هیچ.'), fallback: 0, advanced: true, showIf: moving },
    ],
  },
  field: {
    title: 'منطقه‌ی نیرو: باد، آب، آهن‌ربا، سیاره و جاذبه',
    about: 'اشیای «فیزیک واقعی» را تا وقتی داخل این شیء‌اند هل می‌دهد. باد: به یک طرف، مثل پنکه. آب: چیزهای سبک شناور می‌مانند و سنگین‌ها غرق می‌شوند (سنگینی در «فیزیک واقعی» است). آهن‌ربا: به وسطش می‌کشد. خود این شیء به چیزی نمی‌خورد؛ معمولاً یک مستطیل کم‌رنگ است.',
    make: () => ({ type: 'field', kind: 'wind', direction: -90, strength: 3000 }),
    fields: [
      { key: 'kind', label: 'چه نیرویی', kind: 'choice', options: [
        { value: 'wind', label: 'باد' },
        { value: 'water', label: 'آب' },
        { value: 'magnet', label: 'آهن‌ربا' },
        { value: 'planet', label: 'جاذبه‌ی سیاره' },
        { value: 'gravity', label: 'جاذبه‌ی دیگر: وارونه، کج یا بی‌وزنی' },
      ] },
      { ...slider('direction', 'به کدام طرف', -180, 180, 5, 'صفر یعنی راست، ۹۰ پایین، ۹۰- بالا، ۱۸۰ چپ.', 'درجه'), showIf: (v) => v.kind === 'wind' || v.kind === 'gravity' },
      { ...slider('strength', 'قدرت', -8000, 8000, 50, 'هرچه بیشتر، محکم‌تر. برای آهن‌ربا، منفی یعنی دور می‌کند. جاذبه‌ی معمولی حدود ۲۴۰۰ است.'), showIf: (v) => v.kind !== 'water' && v.kind !== 'gravity' },
      { ...slider('strength', 'قدرت جاذبه', 0, 6000, 50, 'جاذبه‌ی جای دیگر صحنه را برمی‌دارد و این را می‌گذارد. صفر یعنی بی‌وزنی، مثل فضا. جاذبه‌ی معمولی حدود ۲۴۰۰ است. برای وارونه، جهت را ۹۰- بگذار.'), showIf: (v) => v.kind === 'gravity' },
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
        { value: 'embers', label: 'جرقه‌ی آتش' },
        { value: 'leaves', label: 'برگ پاییزی' },
        { value: 'dust', label: 'گرد و خاک' },
        { value: 'magic', label: 'جادو' },
        { value: 'hearts', label: 'قلب' },
        { value: 'steam', label: 'بخار' },
        { value: 'electric', label: 'برق و جرقه‌ی الکتریکی' },
        { value: 'portal', label: 'دروازه‌ی چرخان' },
        { value: 'waterfall', label: 'آبشار' },
        { value: 'fireflies', label: 'کرم شب‌تاب' },
        { value: 'stars', label: 'ستاره‌های پران' },
        { value: 'drip', label: 'چکه' },
        { value: 'sparks', label: 'جرقه‌ی جوشکاری' },
        { value: 'petals', label: 'گلبرگ' },
        { value: 'feathers', label: 'پَر' },
        { value: 'poison', label: 'سم (حباب سبز)' },
        { value: 'frost', label: 'یخ‌زدگی' },
        { value: 'glitter', label: 'اکلیل' },
        { value: 'coins', label: 'سکه‌های پران' },
        { value: 'ash', label: 'خاکستر' },
        { value: 'rainbow', label: 'رنگین‌کمان' },
        { value: 'splash', label: 'پاشیدن آب' },
        { value: 'sand', label: 'طوفان شن' },
      ] },
      { key: 'color', label: 'رنگ', kind: 'color' },
      slider('rate', 'چند تا در ثانیه', 1, 120, 1, 'زیاد کردنش روی گوشی ضعیف سنگین است؛ ۴۰ معمولاً کافی است.'),
      slider('size', 'اندازه‌ی هر ذره', 2, 60, 1),
      { key: 'onGroundMove', label: 'فقط هنگام حرکت روی زمین', kind: 'bool', fallback: false },
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
      { key: 'shadowTag', label: 'سایه‌ی این گروه بیفتد', hint: 'اشیای این گروه (مثلاً دیوار یا ستون) جلوی نور را می‌گیرند و پشتشان سایه می‌افتد؛ روی خودشان نور می‌خورد. خالی یعنی نور از همه چیز رد می‌شود.', kind: 'tag', fallback: '' },
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
        { value: 'gear', label: 'چرخ‌دنده: با چرخ یا ریل دیگری با هم می‌چرخند' },
      ] },
      { key: 'belt', label: 'هم‌جهت بچرخند، مثل زنجیر دوچرخه', hint: 'خاموش: مثل دنده‌هایی که در هم رفته‌اند، برعکس هم می‌چرخند. چرخ‌دنده‌ی بزرگ‌تر آهسته‌تر می‌چرخد. هر دو شیء باید «لولا» هم داشته باشند (یا آن یکی «ریل»، مثل دنده‌ی شانه‌ای آسانسور).', kind: 'bool', fallback: false, showIf: (v) => v.kind === 'gear' },
      { key: 'targetTag', label: 'به نزدیک‌ترین شیء این گروه', kind: 'tag' },
      { key: 'at', label: 'میخ کجا باشد', kind: 'choice', fallback: 'self', showIf: (v) => v.kind === 'hinge' || v.kind === 'weld', options: [
        { value: 'self', label: 'وسط همین شیء، مثل چرخ' },
        { value: 'other', label: 'وسط آن یکی، مثل آونگی که از میخ آویزان است' },
        { value: 'between', label: 'وسط این دو، مثل حلقه‌های زنجیر یا تخته‌های پل' },
      ] },
      { ...slider('motor', 'موتور', -720, 720, 10, 'خودش می‌چرخد، مثل چرخ ماشین. مثبت یعنی در جهت عقربه‌های ساعت. صفر یعنی موتور ندارد.', 'درجه در ثانیه'), fallback: 0, showIf: (v) => v.kind === 'hinge' || v.kind === 'wheel' },
      { key: 'drive', label: 'چه کسی موتور را روشن می‌کند', hint: 'بازیکن: مثل پدال گاز ماشین؛ با لمس نیمه‌ی راست صفحه (یا کلید راست) جلو می‌رود و با نیمه‌ی چپ عقب. رها کند، چرخ آزاد می‌چرخد.', kind: 'choice', fallback: 'always', showIf: (v) => (v.kind === 'hinge' || v.kind === 'wheel') && Boolean(v.motor), options: [
        { value: 'always', label: 'همیشه روشن است' },
        { value: 'player', label: 'بازیکن، مثل پدال گاز' },
      ] },
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
      { key: 'bumpTag', label: 'به این گروه بخورد و در آن فرو نرود', hint: 'مثلاً دشمن‌ها به بازیکن و به هم: به هم می‌خورند و آرام همدیگر را کنار می‌زنند، به جای اینکه از هم رد شوند یا روی هم جمع شوند.', kind: 'tag', fallback: '', advanced: true },
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
      { key: 'sight', label: 'فقط وقتی ببیند', hint: 'اگر دیواری بین آن‌ها باشد، بازیکن را نمی‌بیند و دنبالش نمی‌کند؛ تا جایی که آخرین بار دیدش می‌رود، کمی آنجا می‌گردد و بعد بی‌خیال می‌شود. برای بازی‌های مخفی‌کاری. دیوار همان گروه بالا است، یا گروهی که از آن رد نمی‌شود.', kind: 'bool', fallback: false, advanced: true, showIf: (v) => !v.away },
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
      { key: 'roll', label: 'غلت زدن برای فرار', hint: 'با یک دکمه (یا Shift و X) تند به همان طرف غلت می‌زند و در این مدت هیچ چیز به آن آسیب نمی‌زند.', kind: 'bool', fallback: false },
      { key: 'rollTag', label: 'گروه دکمه‌ی غلت', kind: 'tag', fallback: '', showIf: (v) => Boolean(v.roll) },
    ],
  },
  moves: {
    title: 'حرکت‌های ویژه: پرش از دیوار، تیز رفتن، نردبان، کوبیدن',
    about: 'برای قهرمان بازی پرشی، کنار «حرکت چپ و راست» و «پرش». پرش از دیوار: در هوا به دیوار بچسبد آرام سُر می‌خورد و با پرش از دیوار جدا می‌شود. تیز رفتن: یک لحظه خیلی سریع جلو می‌رود. نردبان: از اشیای یک گروه بالا و پایین می‌رود. کوبیدن: در هوا محکم پایین می‌آید و زمین را می‌لرزاند. روی کامپیوتر: Shift یا X برای تیز رفتن، فلش پایین برای کوبیدن.',
    make: () => ({ type: 'moves', wallJump: true, dash: true, dashTag: '', climbTag: '', pound: true, poundTag: '' }),
    fields: [
      { key: 'wallJump', label: 'پرش از دیوار', hint: 'به دیوار که بچسبد آرام سُر می‌خورد و با پرش، از دیوار دور می‌شود.', kind: 'bool' },
      { key: 'dash', label: 'تیز رفتن (دش)', kind: 'bool' },
      { key: 'dashTag', label: 'گروه دکمه‌ی تیز رفتن', kind: 'tag', fallback: '', showIf: (v) => Boolean(v.dash) },
      { key: 'pound', label: 'کوبیدن به زمین', kind: 'bool' },
      { key: 'crouch', label: 'نشستن', hint: 'روی زمین با دکمه‌ی پایین (یا فلش پایین) می‌نشیند: کوتاه‌تر و آهسته‌تر، و از زیر سقف‌های کوتاه رد می‌شود.', kind: 'bool', fallback: false },
      { key: 'poundTag', label: 'گروه دکمه‌ی پایین (کوبیدن و پایین رفتن از نردبان)', kind: 'tag', fallback: '' },
      { key: 'climbTag', label: 'از این گروه بالا برود (نردبان)', hint: 'وقتی روی نردبان است، دکمه‌ی پرش بالا و دکمه‌ی پایین پایین می‌برد؛ ول کند همان‌جا می‌ماند.', kind: 'tag', fallback: '' },
    ],
  },
  animate: {
    title: 'انیمیشن (خط زمان)',
    about: 'شیء در لحظه‌های مختلف («کلید»ها) جا، چرخش، اندازه و کم‌رنگی متفاوتی دارد و بین آن‌ها نرم حرکت می‌کند؛ مثل پرچمی که تاب می‌خورد، سکه‌ای که می‌چرخد یا نوشته‌ای که از کنار وارد می‌شود. دکمه‌ی «ویرایش انیمیشن» خط زمان را با پیش‌نمایش زنده و انیمیشن‌های آماده باز می‌کند. روی جای خود شیء اضافه می‌شود، پس شیء می‌تواند هم راه برود و هم تاب بخورد. برای اشیای «فیزیک واقعی» نیست.',
    make: () => ({ type: 'animate', repeat: 'loop', ease: 'smooth', keys: [{ t: 0, x: 0, y: 0, angle: 0, scale: 1, opacity: 1 }, { t: 1, x: 0, y: -24, angle: 0, scale: 1, opacity: 1 }, { t: 2, x: 0, y: 0, angle: 0, scale: 1, opacity: 1 }] }),
    fields: [
      { key: 'repeat', label: 'تکرار', kind: 'choice', options: [
        { value: 'loop', label: 'از اول، پشت سر هم' },
        { value: 'bounce', label: 'رفت و برگشت' },
        { value: 'once', label: 'فقط یک بار' },
      ] },
      { key: 'ease', label: 'حرکت بین کلیدها', kind: 'choice', options: [
        { value: 'smooth', label: 'نرم (آهسته شروع و تمام می‌شود)' },
        { value: 'linear', label: 'یکنواخت' },
      ] },
    ],
  },
  homing: {
    title: 'تعقیب هدف (موشک)',
    about: 'وقتی پرواز می‌کند آرام به طرف نزدیک‌ترین شیء یک گروه می‌چرخد و سرعتش را نگه می‌دارد؛ مثل موشک. برای تیر و گلوله. عکسش رو به بالا باشد.',
    make: () => ({ type: 'homing', targetTag: '', turn: 180 }),
    fields: [
      { key: 'targetTag', label: 'به طرف این گروه', kind: 'tag' },
      slider('turn', 'تندی چرخش', 20, 720, 10, 'هرچه بیشتر، تیزتر می‌پیچد.', 'درجه در ثانیه'),
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
    ] }, { key: 'roomTag', label: 'دوربین از اتاق بیرون نرود', hint: 'برای دنیای اتاق‌به‌اتاق: برای هر اتاق یک مستطیل پنهان در یک گروه بکش (مثلاً «اتاق») و نام گروه را این‌جا بنویس. دوربین داخل اتاقی که شیء در آن است می‌ماند و وقتی به اتاق بعد برود، آن‌جا را نشان می‌دهد. خالی یعنی کل دنیا.', kind: 'tag', fallback: '', advanced: true }],
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
