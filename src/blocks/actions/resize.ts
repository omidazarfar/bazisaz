import { fa, firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const resize = actionBlock({
  type: 'resize',
  editor: {
    title: 'عوض کردن اندازه',
    about: 'شیء بزرگ یا کوچک می‌شود و وسطش سر جایش می‌ماند. برخوردش هم با اندازه‌ی تازه حساب می‌شود؛ مثل قارچی که بازیکن را بزرگ می‌کند.',
    make: (ctx) => ({ type: 'resize', target: firstRef(ctx), width: 160, height: 160 }),
    fields: [TARGET, { key: 'width', label: 'پهنای تازه', kind: 'number' }, { key: 'height', label: 'بلندی تازه', kind: 'number' }],
  },
  sentence: (a, { who }) => `اندازه‌ی ${who(a.target)} را ${fa(a.width)} در ${fa(a.height)} کن`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      if (e.def.visual.kind === 'text') continue;
      // It grows or shrinks around its middle, so it does not seem to jump.
      const width = Math.max(1, action.width);
      const height = Math.max(1, action.height);
      e.x += (e.width - width) / 2;
      e.y += (e.height - height) / 2;
      e.width = width;
      e.height = height;
    }
  },
});
