import { clamp } from '../../runtime/math';
import { fa, firstRef, slider, TARGET } from '../fields';
import { actionBlock } from '../types';

export const setOpacity = actionBlock({
  type: 'setOpacity',
  editor: {
    title: 'عوض کردن پررنگی',
    about: 'صفر یعنی نامرئی، ولی هنوز سر جایش هست و به چیزها می‌خورد. برای پنهان کردن واقعی، «پنهان کردن شیء» را بزن.',
    make: (ctx) => ({ type: 'setOpacity', target: firstRef(ctx), opacity: 0.5 }),
    fields: [TARGET, slider('opacity', 'پررنگی', 0, 1, 0.05)],
  },
  sentence: (a, { who }) => `پررنگی ${who(a.target)} را ${fa(a.opacity)} کن`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) e.opacity = clamp(action.opacity, 0, 1);
  },
});
