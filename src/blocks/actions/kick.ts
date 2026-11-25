import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const kick = actionBlock({
  type: 'kick',
  editor: {
    title: 'ضربه زدن به شیء',
    about: 'به سرعت فعلی شیء اضافه می‌کند (کار «هل دادن» سرعت را عوض می‌کند، این یکی اضافه می‌کند). مثل لگد زدن به توپ یا یک وزش باد.',
    make: (ctx) => ({ type: 'kick', target: firstRef(ctx), vx: 300, vy: -300 }),
    fields: [TARGET, { key: 'vx', label: 'به راست', hint: 'منفی یعنی به چپ', kind: 'number' }, { key: 'vy', label: 'به پایین', hint: 'منفی یعنی به بالا', kind: 'number' }],
  },
  sentence: (a, { who }) => `به ${who(a.target)} ضربه بزن`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      e.vx += action.vx;
      e.vy += action.vy;
    }
  },
});
