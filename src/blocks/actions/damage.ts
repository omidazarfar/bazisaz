import { fa, firstRef, slider, TARGET } from '../fields';
import { actionBlock } from '../types';

export const damage = actionBlock({
  type: 'damage',
  editor: {
    title: 'کم کردن جان شیء',
    about: 'فقط روی شیئی اثر دارد که در برگه‌ی «شیء» برایش «جان» گذاشته‌ای. وقتی جانش تمام شود، اتفاق «جان یک شیء تمام می‌شود» رخ می‌دهد.',
    make: (ctx) => ({ type: 'damage', target: firstRef(ctx), amount: 1 }),
    fields: [TARGET, { key: 'amount', label: 'چقدر', kind: 'number' }, { ...slider('push', 'پس زدن', 0, 1500, 50, 'شیء از چیزی که به آن خورد دور و کمی بالا پرت می‌شود؛ مثل وقتی بازیکن به دشمن می‌خورد. صفر یعنی بدون پس زدن.'), fallback: 0 }],
  },
  sentence: (a, { who }) => `از جان ${who(a.target)} ${fa(a.amount)} تا کم کن`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      if (e.def.health === undefined || e.health <= 0 || game.time < (e.hurtUntil ?? 0) || game.time < (e.safeUntil ?? 0)) continue;
      e.health -= action.amount;
      if (action.amount > 0) e.hurtPoseUntil = game.time + 0.22;
      if (e.health <= 0) game.died.push(e);
      else if (e.def.invincible) e.hurtUntil = game.time + e.def.invincible;
      // Knocked away from whatever hit it, and up a little.
      const from = e === context.first ? context.second : context.first;
      if (action.push && from) {
        const side = e.x + e.width / 2 >= from.x + from.width / 2 ? 1 : -1;
        e.vx = side * action.push;
        e.vy = -action.push * 0.6;
      }
    }
  },
});
