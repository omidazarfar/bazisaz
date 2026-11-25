import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const setText = actionBlock({
  type: 'setText',
  editor: {
    title: 'عوض کردن متن',
    about: 'آنچه یک متن می‌نویسد را عوض می‌کند. مقدارها را مثل همیشه با {نام} نشان بده.',
    make: (ctx) => ({ type: 'setText', target: firstRef(ctx), text: 'You win!' }),
    fields: [TARGET, { key: 'text', label: 'متن تازه', kind: 'text' }],
  },
  sentence: (a, { who }) => `متن ${who(a.target)} را «${a.text}» کن`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) e.text = action.text;
    game.refreshTexts(true);
  },
});
