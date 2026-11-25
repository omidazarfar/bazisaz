import { actionBlock } from '../types';

export const resume = actionBlock({
  type: 'resume',
  editor: {
    title: 'ادامه‌ی بازی بعد از مکث', make: () => ({ type: 'resume' }), fields: [],
  },
  sentence: (_a) => 'بازی را ادامه بده',
  run: (game, _action) => {
    game.paused = false;
  },
});
