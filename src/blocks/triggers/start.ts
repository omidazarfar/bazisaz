import { triggerBlock } from '../types';

export const start = triggerBlock({
  type: 'start',
  editor: {
    title: 'صحنه شروع می‌شود',
    make: () => ({ type: 'start' }),
    fields: [],
  },
  sentence: () => 'وقتی صحنه شروع می‌شود',
  fired: (game) => {
    return game.started ? [] : [{}];
  },
});
