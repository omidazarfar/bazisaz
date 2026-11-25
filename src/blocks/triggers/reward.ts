import { triggerBlock } from '../types';

export const reward = triggerBlock({
  type: 'reward',
  editor: {
    title: 'بازیکن تبلیغ جایزه‌ای را تا آخر دید',
    make: () => ({ type: 'reward' }),
    fields: [],
  },
  sentence: () => 'وقتی بازیکن تبلیغ جایزه‌ای را تا آخر دید',
  fired: (game) => {
    if (game.rewards === 0) return [];
    game.rewards -= 1;
    return [{}];
  },
});
