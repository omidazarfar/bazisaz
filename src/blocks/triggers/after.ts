import { fa } from '../fields';
import { triggerBlock } from '../types';

export const after = triggerBlock({
  type: 'after',
  editor: {
    title: 'چند ثانیه از شروع صحنه می‌گذرد',
    short: 'یک بار، چند ثانیه بعد از باز شدن صحنه.',
    make: () => ({ type: 'after', seconds: 3 }),
    fields: [{ key: 'seconds', label: 'بعد از چند ثانیه', kind: 'number' }],
  },
  sentence: (w) => `${fa(w.seconds)} ثانیه بعد از شروع صحنه`,
  check: (w, { say }) => {
    if (!(w.seconds > 0)) say('needs a time above zero.');
  },
  fired: (game, w, rule) => {
    if (game.time < w.seconds || game.ruleDone.has(rule.id)) return [];
    game.ruleDone.add(rule.id);
    return [{}];
  },
});
