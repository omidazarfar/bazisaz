import { clamp } from '../../runtime/math';
import { fa, slider } from '../fields';
import { actionBlock } from '../types';

export const zoom = actionBlock({
  type: 'zoom',
  still: true,
  editor: {
    title: 'نزدیک و دور کردن دوربین',
    about: '۱ اندازه‌ی معمولی است. ۲ همه‌چیز را دو برابر بزرگ نشان می‌دهد؛ ۰٫۵ دو برابر بیشتر از دنیا را. چیزهایی که به صفحه چسبیده‌اند عوض نمی‌شوند.',
    make: () => ({ type: 'zoom', amount: 1.5, seconds: 0.5 }),
    fields: [slider('amount', 'چقدر نزدیک', 0.25, 4, 0.05), slider('seconds', 'چقدر طول بکشد', 0, 3, 0.1, 'صفر یعنی فوری.', 'ثانیه')],
  },
  sentence: (a) => `دوربین را ${fa(a.amount)} برابر نزدیک کن`,
  run: (game, action) => {
    game.zoomGlide = { from: game.playZoom, to: clamp(action.amount, 0.25, 4), elapsed: 0, seconds: Math.max(0, action.seconds) };
    if (game.zoomGlide.seconds === 0) game.stepZoom(0);
  },
});
