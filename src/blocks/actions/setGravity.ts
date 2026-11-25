import { fa } from '../fields';
import { actionBlock } from '../types';

export const setGravity = actionBlock({
  type: 'setGravity',
  editor: {
    title: 'تغییر جاذبه',
    about: 'جاذبه‌ی این صحنه را تا آخر صحنه عوض می‌کند. عدد منفی یعنی همه‌چیز به بالا می‌افتد؛ صفر یعنی بی‌وزنی. جاذبه‌ی معمولی ۲۴۰۰ است.',
    make: () => ({ type: 'setGravity', amount: -2400 }),
    fields: [{ key: 'amount', label: 'جاذبه', kind: 'number' }],
  },
  sentence: (a) => `جاذبه را ${fa(a.amount)} کن`,
  run: (game, action) => {
    game.gravity = action.amount;
  },
});
