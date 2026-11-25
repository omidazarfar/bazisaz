import { TARGET } from '../fields';
import { actionBlock } from '../types';

export const respawn = actionBlock({
  type: 'respawn',
  editor: {
    title: 'برگشتن به ایست بازرسی',
    about: 'شیء به آخرین ایست بازرسی‌اش برمی‌گردد (اگر به هیچ‌کدام نرسیده، به جای اولش در صحنه) و می‌ایستد؛ مثلاً وقتی بازیکن به خار می‌خورد، به‌جای شروع دوباره‌ی کل مرحله.',
    make: () => ({ type: 'respawn', target: 'first' }),
    fields: [TARGET],
  },
  sentence: (a, { who }) => `${who(a.target)} را به ایست بازرسی‌اش برگردان`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      const back = e.checkpoint ?? { x: e.def.x, y: e.def.y };
      game.place(e, back.x, back.y);
      e.vx = e.vy = 0;
    }
  },
});
