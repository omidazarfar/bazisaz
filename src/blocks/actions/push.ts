import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const push = actionBlock({
  type: 'push',
  editor: {
    title: 'هل دادن شیء',
    about: 'به شیء سرعت می‌دهد. منفی یعنی به چپ یا بالا.',
    make: (ctx) => ({ type: 'push', target: firstRef(ctx), vx: 0, vy: -600 }),
    fields: [TARGET, { key: 'vx', label: 'سرعت افقی', kind: 'number' }, { key: 'vy', label: 'سرعت عمودی', kind: 'number' }],
  },
  sentence: (a, { who }) => `${who(a.target)} را هل بده`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      e.vx = action.vx;
      e.vy = action.vy;
    }
  },
});
