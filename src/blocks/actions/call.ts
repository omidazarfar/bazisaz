import { ARGUMENT_FIELDS, namesOf } from '../fields';
import { amountText } from '../say';
import { actionBlock } from '../types';

declare module '../../format/types' {
  interface MoreActions {
    call: { type: 'call'; name: string; a1?: Amount; a2?: Amount; a3?: Amount };
  }
}

export const call = actionBlock({
  type: 'call',
  editor: {
    title: 'اجرای تابع',
    short: 'کارهای یک «تابع» خودت را همین حالا انجام می‌دهد؛ با ورودی‌هایی که این‌جا می‌دهی.',
    available: ({ scene }) => namesOf(scene, 'called').length > 0,
    make: ({ scene }) => ({ type: 'call', name: namesOf(scene, 'called')[0] ?? '', a1: 1 }),
    fields: [{ key: 'name', label: 'کدام تابع', kind: 'function' }, ...ARGUMENT_FIELDS],
  },
  sentence: (a, { who }) => {
    const given = [a.a1, a.a2, a.a3].filter((x) => x !== undefined).map((x) => amountText(x!, who));
    return `تابع «${a.name || '؟'}» را اجرا کن${given.length ? ` (با ${given.join('، ')})` : ''}`;
  },
  check: (a, { scene, say }) => {
    if (!scene.rules.some((r) => r.when.type === 'called' && r.when.name === a.name)) say(`calls function "${a.name}", which no rule of the scene is.`);
  },
  run: (game, action, context) => {
    game.callFunction(action.name, [action.a1, action.a2, action.a3], context);
  },
});
