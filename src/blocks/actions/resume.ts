import { actionBlock } from '../types';

export const resume = actionBlock({
  type: 'resume',
  still: true,
  editor: {
    title: 'ادامه‌ی بازی بعد از مکث', make: () => ({ type: 'resume' }), fields: [],
    short: 'بازیِ نگه‌داشته‌شده را ادامه می‌دهد.',
  },
  sentence: (_a) => 'بازی را ادامه بده',
  run: (game, _action) => {
    game.paused = false;
  },
});
