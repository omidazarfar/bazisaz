import { fa, firstRef, slider, TARGET } from '../fields';
import { actionBlock } from '../types';

export const turn = actionBlock({
  type: 'turn',
  editor: {
    title: 'چرخاندن شیء',
    short: 'شیء را می‌چرخاند؛ برخوردش هم با شکل چرخیده حساب می‌شود.',
    make: (ctx) => ({ type: 'turn', target: firstRef(ctx), op: 'add', degrees: 90 }),
    fields: [
      TARGET,
      { key: 'op', label: 'چه کار', kind: 'choice', options: [{ value: 'add', label: 'این‌قدر بیشتر بچرخد' }, { value: 'set', label: 'دقیقاً به این زاویه برود' }] },
      slider('degrees', 'زاویه', -360, 360, 5, 'منفی یعنی خلاف جهت عقربه‌های ساعت', 'درجه'),
    ],
  },
  sentence: (a, { who }) => a.op === 'set' ? `${who(a.target)} را به زاویه‌ی ${fa(a.degrees)} درجه بچرخان` : `${who(a.target)} را ${fa(a.degrees)} درجه بچرخان`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      const by = (action.degrees * Math.PI) / 180;
      e.angle = action.op === 'set' ? by : e.angle + by;
    }
  },
});
