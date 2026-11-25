import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const moveBy = actionBlock({
  type: 'moveBy',
  editor: {
    title: 'جابه‌جا کردن شیء به یک اندازه',
    about: 'از همان جایی که هست حرکتش می‌دهد. منفی یعنی به چپ یا بالا.',
    make: (ctx) => ({ type: 'moveBy', target: firstRef(ctx), dx: 100, dy: 0 }),
    fields: [TARGET, { key: 'dx', label: 'چقدر به راست', kind: 'number' }, { key: 'dy', label: 'چقدر به پایین', kind: 'number' }],
  },
  sentence: (a, { who }) => `${who(a.target)} را جابه‌جا کن`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) game.place(e, e.x + action.dx, e.y + action.dy);
  },
});
