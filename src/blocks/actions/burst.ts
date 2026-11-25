import { firstRef, slider } from '../fields';
import { actionBlock } from '../types';

export const burst = actionBlock({
  type: 'burst',
  editor: {
    title: 'جرقه و تکه‌پرانی',
    about: 'تکه‌های کوچک رنگی از وسط شیء بیرون می‌پرند و محو می‌شوند؛ برای برخورد، انفجار یا گرفتن جایزه.',
    make: (ctx) => ({ type: 'burst', target: firstRef(ctx), color: '#ffd54a', count: 16 }),
    fields: [{ key: 'target', label: 'از کدام شیء', kind: 'target' }, { key: 'color', label: 'رنگ تکه‌ها', kind: 'color' }, slider('count', 'چند تکه', 4, 40, 1)],
  },
  sentence: (a, { who }) => `از ${who(a.target)} جرقه بپران`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) game.burst(e, action.color, action.count);
  },
});
