import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const pulse = behaviorBlock({
  type: 'pulse',
  editor: {
    title: 'تپش',
    about: 'آرام بزرگ و کوچک می‌شود تا به چشم بیاید؛ برای دکمه و جایزه.',
    make: () => ({ type: 'pulse', amount: 0.15, seconds: 1 }),
    fields: [slider('amount', 'چقدر بزرگ شود', 0.05, 0.6, 0.05), slider('seconds', 'هر تپش چند ثانیه', 0.2, 5, 0.1, undefined, 'ثانیه')],
  },
  sentence: () => 'آرام بزرگ و کوچک می‌شود',
  step: (_game, e, b) => {
    e.scale = 1 + b.amount * 0.5 * (1 - Math.cos((2 * Math.PI * e.age) / b.seconds));
  },
});
