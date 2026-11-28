import { fa, slider } from '../fields';
import { group } from '../say';
import { behaviorBlock } from '../types';

export const light = behaviorBlock({
  type: 'light',
  editor: {
    title: 'نور',
    about: 'دور شیء را روشن می‌کند، وقتی صحنه تاریک است. تاریکی صحنه را در برگه‌ی «بازی» زیاد کن (یا با کار «تاریک و روشن کردن صحنه»). برای چراغ‌قوه، مشعل یا کرم شب‌تاب.',
    make: () => ({ type: 'light', radius: 220, color: '#ffffff', flicker: false, shadowSoftness: 8 }),
    fields: [
      slider('radius', 'تا کجا روشن کند', 30, 800, 10),
      { key: 'color', label: 'رنگ نور', hint: 'سفید یعنی فقط روشن می‌کند؛ رنگی، یک هاله‌ی رنگی هم دارد.', kind: 'color' },
      { key: 'shadowTag', label: 'سایه‌ی این گروه بیفتد', hint: 'اشیای این گروه (مثلاً دیوار یا ستون) جلوی نور را می‌گیرند و پشتشان سایه می‌افتد؛ روی خودشان نور می‌خورد. خالی یعنی نور از همه چیز رد می‌شود.', kind: 'tag', fallback: '' },
      { ...slider('shadowLength', 'سایه تا کجا برود', 0, 800, 10, 'از پشت دیوار تا کجا سایه است؛ بعد از آن نور دوباره می‌رسد، مثل سایه‌ی کوتاه زیر آفتاب. صفر یعنی تا ته نور.', 'پیکسل'), fallback: 0, showIf: (v) => Boolean(v.shadowTag) },
      { ...slider('shadowSoftness', 'نرمی لبه‌ی سایه', 0, 40, 1, 'صفر یعنی لبه‌ی تیز؛ بیشتر یعنی سایه آرام‌آرام تاریک شود، مثل سایه‌ی واقعی.'), fallback: 0, showIf: (v) => Boolean(v.shadowTag) },
      { key: 'flicker', label: 'مثل شعله بلرزد', kind: 'bool' },
    ],
  },
  sentence: (b) =>
    `در تاریکی دورش را روشن می‌کند${b.flicker ? '، مثل شعله‌ای که می‌لرزد' : ''}${b.shadowTag ? `؛ ${group(b.shadowTag)} سایه می‌اندازد${b.shadowLength ? ` تا ${fa(b.shadowLength)} پیکسل پشتشان` : ''}${b.shadowSoftness ? '، با لبه‌ی نرم' : ''}` : ''}`,
});
