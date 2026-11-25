import { actionBlock } from '../types';

export const pause = actionBlock({
  type: 'pause',
  editor: {
    title: 'مکث بازی', about: 'همه‌چیز می‌ایستد. فقط قانون‌های «لمس» کار می‌کنند تا بتوانی بازی را ادامه بدهی.', make: () => ({ type: 'pause' }), fields: [],
  },
  sentence: (_a) => 'بازی را نگه دار',
  run: (game, _action) => {
    game.paused = true;
  },
});
