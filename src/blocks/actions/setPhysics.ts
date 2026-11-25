import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const setPhysics = actionBlock({
  type: 'setPhysics',
  editor: {
    title: 'ثابت کردن یا رها کردن',
    about: 'شیء «فیزیک واقعی» را رها می‌کند تا بیفتد و غلت بخورد، یا همان‌جا محکمش می‌کند. مثلاً پلی که وقتی بازیکن رسید فرو می‌ریزد.',
    make: (ctx) => ({ type: 'setPhysics', target: firstRef(ctx), kind: 'moving' }),
    fields: [TARGET, { key: 'kind', label: 'چه شود', kind: 'choice', options: [{ value: 'moving', label: 'رها شود و بیفتد' }, { value: 'still', label: 'همان‌جا محکم شود' }] }],
  },
  sentence: (a, { who }) => a.kind === 'moving' ? `${who(a.target)} را رها کن تا بیفتد` : `${who(a.target)} را همان‌جا محکم کن`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) game.physics?.setKind(e, action.kind);
  },
});
