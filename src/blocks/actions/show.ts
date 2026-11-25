import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const show = actionBlock({
  type: 'show',
  editor: {
    title: 'نشان دادن شیء', make: (ctx) => ({ type: 'show', target: firstRef(ctx) }), fields: [TARGET],
  },
  sentence: (a, { who }) => `${who(a.target)} را نشان بده`,
  run: (game, action, context) => {
    game.targets(action.target, context).forEach((e) => (e.visible = true));
  },
});
