import { fa } from '../fields';
import { actionBlock } from '../types';

export const wait = actionBlock({
  type: 'wait',
  editor: {
    title: 'کمی صبر کن',
    about: 'کارهای بعدی همین قانون بعد از این مدت انجام می‌شوند.',
    make: () => ({ type: 'wait', seconds: 1 }),
    fields: [{ key: 'seconds', label: 'چند ثانیه', kind: 'number' }],
  },
  sentence: (a) => `${fa(a.seconds)} ثانیه صبر کن`,
  check: (a, { say }) => {
    if (!(a.seconds > 0)) say('waits for no time.');
  },
  // The rest of the rule's actions run after the wait.
  takesRest: true,
  run: (game, action, context, rest) => {
    game.waiting.push({ at: game.time + action.seconds, actions: rest, context });
  },
});
