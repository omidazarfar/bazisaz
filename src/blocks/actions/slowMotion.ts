import { clamp } from '../../runtime/math';
import { fa, slider } from '../fields';
import { actionBlock } from '../types';

export const slowMotion = actionBlock({
  type: 'slowMotion',
  editor: {
    title: 'زمان آهسته',
    about: 'بازی برای چند لحظه آهسته می‌شود، مثل فیلم‌ها؛ برای ضربه‌ی آخر، انفجار بزرگ یا پرش دیدنی. صفر یعنی یک لحظه کاملاً می‌ایستد («ایست ضربه») تا ضربه محکم حس شود.',
    make: () => ({ type: 'slowMotion', amount: 0.3, seconds: 1 }),
    fields: [
      slider('amount', 'سرعت زمان', 0, 1, 0.05, 'یک یعنی عادی، ۰٫۳ یعنی سه برابر آهسته‌تر، صفر یعنی ایستادن کامل.'),
      slider('seconds', 'چه مدت', 0.03, 5, 0.01, 'به ثانیه‌ی واقعی. برای «ایست ضربه» حدود ۰٫۰۵ تا ۰٫۱ خوب است.', 'ثانیه'),
    ],
  },
  sentence: (a) => (a.amount <= 0 ? `بازی را ${fa(a.seconds)} ثانیه نگه دار (ایست ضربه)` : `زمان را ${fa(a.seconds)} ثانیه آهسته کن`),
  run: (game, action) => {
    game.slowScale = clamp(action.amount, 0, 1);
    game.slowLeft = Math.max(0, action.seconds);
  },
});
