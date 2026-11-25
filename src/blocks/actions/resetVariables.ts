import { actionBlock } from '../types';

export const resetVariables = actionBlock({
  type: 'resetVariables',
  still: true,
  editor: {
    title: 'همه‌ی مقدارها از نو',
    about: 'مقدارهایی که «روی گوشی بماند» دارند دست نمی‌خورند.',
    make: () => ({ type: 'resetVariables' }),
    fields: [],
  },
  sentence: (_a) => 'همه‌ی مقدارها را از نو کن',
  run: (game, _action) => {
    game.resetVariables(false);
  },
});
