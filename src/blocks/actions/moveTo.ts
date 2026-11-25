import { fa, firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const moveTo = actionBlock({
  type: 'moveTo',
  editor: {
    title: 'بردن شیء به یک نقطه',
    make: (ctx) => ({ type: 'moveTo', target: firstRef(ctx), x: 0, y: 0 }),
    fields: [TARGET, { key: 'x', label: 'فاصله از چپ', kind: 'number' }, { key: 'y', label: 'فاصله از بالا', kind: 'number' }],
  },
  sentence: (a, { who }) => `${who(a.target)} را به نقطه‌ی (${fa(a.x)}، ${fa(a.y)}) ببر`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) game.place(e, action.x, action.y);
  },
});
