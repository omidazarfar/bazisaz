import { TARGET } from '../fields';
import { actionBlock } from '../types';

export const checkpoint = actionBlock({
  type: 'checkpoint',
  editor: {
    title: 'ثبت ایست بازرسی',
    about: 'جایی که شیء همین حالا هست، جای برگشتنش می‌شود؛ مثل وقتی بازیکن به پرچم وسط مرحله می‌رسد. با کار «برگشتن به ایست بازرسی» به همین‌جا برمی‌گردد.',
    make: () => ({ type: 'checkpoint', target: 'first' }),
    fields: [TARGET],
  },
  sentence: (a, { who }) => `جای فعلی ${who(a.target)} را ایست بازرسی‌اش کن`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) e.checkpoint = { x: e.x, y: e.y };
  },
});
