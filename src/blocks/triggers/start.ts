import { triggerBlock } from '../types';

export const start = triggerBlock({
  type: 'start',
  editor: {
    title: 'صحنه شروع می‌شود',
    short: 'یک بار، همان لحظه‌ای که صحنه باز می‌شود.',
    make: () => ({ type: 'start' }),
    fields: [],
  },
  sentence: () => 'وقتی صحنه شروع می‌شود',
  fired: (game) => {
    return game.started ? [] : [{}];
  },
});
