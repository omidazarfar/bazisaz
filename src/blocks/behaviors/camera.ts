import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const camera = behaviorBlock({
  type: 'camera',
  editor: {
    title: 'دوربین دنبالش بیاید',
    about: 'وقتی دنیا از صفحه بزرگ‌تر است، دوربین این شیء را وسط صفحه نگه می‌دارد. اندازه‌ی دنیا در برگه‌ی «بازی» است.',
    make: () => ({ type: 'camera', lock: 'free', smooth: 0.3 }),
    fields: [{ ...slider('smooth', 'نرمی دنبال کردن', 0, 1, 0.05, 'صفر یعنی شیء همیشه دقیقاً وسط است. بیشتر یعنی دوربین کمی عقب می‌ماند و نرم می‌رسد.'), fallback: 0 }, { key: 'lock', label: 'دوربین برنگردد', hint: 'اگر دوربین فقط بالا برود، بازیکنی که پایین بیفتد از صفحه بیرون می‌رود.', kind: 'choice', fallback: 'free', advanced: true, options: [
      { value: 'free', label: 'آزاد' },
      { value: 'up', label: 'فقط بالا برود' },
      { value: 'right', label: 'فقط راست برود' },
    ] }, { key: 'deadZone', label: 'جای آزاد وسط صفحه', hint: 'تا این‌قدر پیکسل از وسط، شیء جابه‌جا می‌شود و دوربین تکان نمی‌خورد؛ قدم‌های کوچک و پرش‌ها صفحه را نمی‌لرزانند.', kind: 'slider', min: 0, max: 300, step: 10, unit: 'پیکسل', fallback: 0, advanced: true }, { key: 'lookAhead', label: 'جلوتر را نشان بدهد', hint: 'دوربین این‌قدر جلوتر از جهتی که شیء می‌رود را نشان می‌دهد، تا بازیکن ببیند به چه می‌رسد.', kind: 'slider', min: 0, max: 400, step: 10, unit: 'پیکسل', fallback: 0, advanced: true }, { key: 'settle', label: 'بالا و پایین فقط روی زمین', hint: 'برای بازی‌های پرشی: با هر پرش صفحه بالا و پایین نمی‌رود؛ وقتی روی چیزی فرود آمد (یا خیلی بالا یا پایین رفت) دنبالش می‌رود.', kind: 'bool', fallback: false, advanced: true }, { key: 'roomTag', label: 'دوربین از اتاق بیرون نرود', hint: 'برای دنیای اتاق‌به‌اتاق: برای هر اتاق یک مستطیل پنهان در یک گروه بکش (مثلاً «اتاق») و نام گروه را این‌جا بنویس. دوربین داخل اتاقی که شیء در آن است می‌ماند و وقتی به اتاق بعد برود، آن‌جا را نشان می‌دهد. خالی یعنی کل دنیا.', kind: 'tag', fallback: '', advanced: true }],
  },
  sentence: () => 'دوربین دنبالش می‌آید',
});
