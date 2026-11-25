import { slider } from '../fields';
import { group } from '../say';
import { behaviorBlock } from '../types';

export const light = behaviorBlock({
  type: 'light',
  editor: {
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
  sentence: (b) => `در تاریکی دورش را روشن می‌کند${b.flicker ? '، مثل شعله‌ای که می‌لرزد' : ''}${b.shadowTag ? `؛ ${group(b.shadowTag)} سایه می‌اندازد` : ''}`,
});
