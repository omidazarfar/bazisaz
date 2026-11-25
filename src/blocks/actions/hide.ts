import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const hide = actionBlock({
  type: 'hide',
  editor: {
    title: 'پنهان کردن شیء', make: (ctx) => ({ type: 'hide', target: firstRef(ctx) }), fields: [TARGET],
    short: 'شیء را پنهان می‌کند؛ شیء پنهان به چیزی نمی‌خورد.',
  },
  sentence: (a, { who }) => `${who(a.target)} را پنهان کن`,
  run: (game, action, context) => {
    game.targets(action.target, context).forEach((e) => (e.visible = false));
  },
});
