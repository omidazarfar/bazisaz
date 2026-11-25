import { clamp } from '../../runtime/math';
import { slider } from '../fields';
import { actionBlock } from '../types';

export const setDarkness = actionBlock({
  type: 'setDarkness',
  still: true,
  editor: {
    title: 'تاریک و روشن کردن صحنه',
    about: 'صحنه را آرام تاریک یا روشن می‌کند؛ مثل شب شدن. فقط اشیایی که رفتار «نور» دارند در تاریکی روشن می‌مانند.',
    make: () => ({ type: 'setDarkness', amount: 0.8, seconds: 2 }),
    fields: [slider('amount', 'چقدر تاریک', 0, 1, 0.05, 'صفر یعنی روشن، یک یعنی سیاه.'), slider('seconds', 'در چند ثانیه', 0, 10, 0.5, 'صفر یعنی یک‌دفعه.', 'ثانیه')],
  },
  sentence: (a) => a.amount <= 0.01 ? 'صحنه را روشن کن' : `صحنه را ${a.amount >= 0.99 ? 'کاملاً' : 'کمی'} تاریک کن`,
  run: (game, action) => {
    game.darknessGlide = { from: game.darkness, to: clamp(action.amount, 0, 1), elapsed: 0, seconds: Math.max(0, action.seconds) };
  },
});
