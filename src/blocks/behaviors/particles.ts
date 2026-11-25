import { PARTICLE_COLORS } from '../../runtime/particles';
import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const particles = behaviorBlock({
  type: 'particles',
  editor: {
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
  sentence: (b) => {
    const kinds: Record<typeof b.preset, string> = { fire: 'آتش', smoke: 'دود', rain: 'باران', snow: 'برف', sparkle: 'برق و ستاره', bubbles: 'حباب', confetti: 'کاغذ رنگی', sparks: 'جرقه', petals: 'گلبرگ', feathers: 'پَر', poison: 'حباب سم', frost: 'یخ‌زدگی', glitter: 'اکلیل', coins: 'سکه', ash: 'خاکستر', rainbow: 'رنگین‌کمان', splash: 'آب', sand: 'شن', embers: 'جرقه‌ی آتش', leaves: 'برگ پاییزی', dust: 'گرد و خاک', magic: 'ذره‌های جادویی', hearts: 'قلب', steam: 'بخار', electric: 'جرقه‌ی برق', portal: 'ذره‌های چرخان', waterfall: 'آبشار', fireflies: 'کرم شب‌تاب', stars: 'ستاره', drip: 'چکه' };
    if (b.onGroundMove) return `فقط هنگام حرکت روی زمین از آن ${kinds[b.preset]} بیرون می‌آید`;
    return b.preset === 'rain' || b.preset === 'snow' || b.preset === 'leaves' || b.preset === 'drip' || b.preset === 'petals' || b.preset === 'ash' || b.preset === 'waterfall' ? `از آن ${kinds[b.preset]} می‌بارد` : `از آن ${kinds[b.preset]} بیرون می‌آید`;
  },
  check: (b, { object, say }) => {
    if (b.onGroundMove !== undefined && typeof b.onGroundMove !== 'boolean')
      say(`"${object.id}" needs a boolean for moving ground particles.`);
  },
  step: (game, e, b, frame) => {
    const { dt } = frame;
    if (!b.onGroundMove || (e.grounded && Math.abs(e.vx) > 10)) game.stream(e, b, dt);
  },
});
