import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const destroy = actionBlock({
  type: 'destroy',
  editor: {
    title: 'حذف شیء', make: (ctx) => ({ type: 'destroy', target: firstRef(ctx) }), fields: [TARGET],
  },
  sentence: (a, { who }) => `${who(a.target)} را حذف کن`,
  run: (game, action, context) => {
    game.targets(action.target, context).forEach((e) => (e.alive = false));
  },
});
