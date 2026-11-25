import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const cut = actionBlock({
  type: 'cut',
  editor: {
    title: 'بریدن اتصال',
    about: 'همه‌ی «اتصال»‌های شیء را می‌بُرد؛ مثل بریدن طناب یا افتادن پیچ. مثلاً وقتی صفحه کشیده شد، طناب آب‌نبات بریده شود.',
    make: (ctx) => ({ type: 'cut', target: firstRef(ctx) }),
    fields: [TARGET],
  },
  sentence: (a, { who }) => `اتصال‌های ${who(a.target)} را ببُر`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) game.physics?.cut(e);
  },
});
