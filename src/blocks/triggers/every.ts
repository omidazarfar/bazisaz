import { fa } from '../fields';
import { triggerBlock } from '../types';

export const every = triggerBlock({
  type: 'every',
  editor: {
    title: 'هر چند ثانیه یک بار',
    short: 'پشت‌سرهم، با فاصله‌ی ثابت.',
    make: () => ({ type: 'every', seconds: 1 }),
    fields: [{ key: 'seconds', label: 'هر چند ثانیه', kind: 'number' }],
  },
  sentence: (w) => `هر ${fa(w.seconds)} ثانیه`,
  check: (w, { say }) => {
    if (!(w.seconds > 0)) say('needs a time above zero.');
  },
  fired: (game, w, rule, { dt }) => {
    const clock = (game.ruleClock.get(rule.id) ?? 0) + dt;
    game.ruleClock.set(rule.id, clock >= w.seconds ? clock - w.seconds : clock);
    return clock >= w.seconds ? [{}] : [];
  },
});
