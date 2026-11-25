import type { Action } from '../../format/types';
import type { Context, Game } from '../../runtime/Game';
import { fa, firstItem, hasItems } from '../fields';
import { actionBlock } from '../types';

/** Give and take share their code: a thing put into (or taken out of) the bag, flying in from an object. */
const run = (game: Game, action: Extract<Action, { type: 'give' | 'take' }>, context: Context) => {
  const old = game.variables.get(action.item) ?? 0;
  const amount = Math.max(0, action.amount);
  game.setValueOf(action.item, action.type === 'give' ? old + amount : Math.max(0, old - amount));
  if (action.type === 'give' && amount > 0 && action.from !== undefined) {
    const from = game.targets(action.from, context)[0];
    if (from) game.flyToBag(action.item, from, old <= 0);
  }
};

export const give = actionBlock({
  type: 'give',
  editor: {
    title: 'دادن وسیله به کوله‌پشتی',
    about: 'وسیله‌ای مثل کلید یا معجون به کوله‌پشتی بازیکن اضافه می‌شود. عکسش از روی شیئی که برداشته شد پرواز می‌کند و در خانه‌اش در کوله‌پشتی می‌نشیند.',
    available: hasItems,
    make: (ctx) => ({ type: 'give', item: firstItem(ctx), amount: 1, from: 'second' }),
    fields: [
      { key: 'item', label: 'کدام وسیله', kind: 'item' },
      { key: 'amount', label: 'چند تا', kind: 'number' },
      { key: 'from', label: 'عکسش از کجا پرواز کند', hint: 'معمولاً همان چیزی که بازیکن به آن خورد. «بدون پرواز» یعنی فقط در کوله‌پشتی پیدا شود.', kind: 'flyFrom' },
    ],
  },
  sentence: (a, { who }) => `${a.amount === 1 ? 'یک' : fa(a.amount)} ${a.item || '؟'} به کوله‌پشتی بده${a.from !== undefined ? ` (از روی ${who(a.from)} پرواز کند)` : ''}`,
  check: (a, { needItem, checkRef }) => {
    needItem(a.item);
    if (a.from !== undefined) checkRef(a.from);
  },
  run,
});

export const take = actionBlock({
  type: 'take',
  editor: {
    title: 'برداشتن وسیله از کوله‌پشتی',
    about: 'وسیله‌ای از کوله‌پشتی کم می‌شود؛ مثلاً کلیدی که در را باز کرد. اگر بیشتر از آنچه هست برداری، فقط تا صفر کم می‌شود.',
    available: hasItems,
    make: (ctx) => ({ type: 'take', item: firstItem(ctx), amount: 1 }),
    fields: [
      { key: 'item', label: 'کدام وسیله', kind: 'item' },
      { key: 'amount', label: 'چند تا', kind: 'number' },
    ],
  },
  sentence: (a) => `${a.amount === 1 ? 'یک' : fa(a.amount)} ${a.item || '؟'} از کوله‌پشتی بردار`,
  check: (a, { needItem }) => {
    needItem(a.item);
  },
  run,
});
