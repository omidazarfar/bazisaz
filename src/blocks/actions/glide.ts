import { fa, firstRef, slider, TARGET } from '../fields';
import { actionBlock } from '../types';

export const glide = actionBlock({
  type: 'glide',
  editor: {
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
  sentence: (a, { who }) => `${who(a.target)} را نرم به نقطه‌ی (${fa(a.x)}، ${fa(a.y)}) ببر`,
  check: (a, { say }) => {
    if (!(a.seconds > 0)) say(`has an effect that takes no time.`);
  },
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      game.tweens.push({ entity: e, kind: 'glide', elapsed: 0, seconds: action.seconds, from: { x: e.x, y: e.y }, to: { x: action.x, y: action.y }, ease: action.ease });
    }
  },
});
