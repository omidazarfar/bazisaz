import { actionBlock } from '../types';

export const setSound = actionBlock({
  type: 'setSound',
  still: true,
  editor: {
    title: 'روشن یا خاموش کردن صدا',
    about: 'همه‌ی صداها و موسیقی بازی را تا آخر همین بار بازی کردن خاموش یا روشن می‌کند؛ برای دکمه‌ی صدا.',
    make: () => ({ type: 'setSound', on: false }),
    fields: [{ key: 'on', label: 'صدا روشن باشد', kind: 'bool' }],
  },
  sentence: (a) => (a.on ? 'صدا را روشن کن' : 'صدا را خاموش کن'),
  run: (game, action) => {
    game.soundOn = action.on;
    game.playMusic();
  },
});
