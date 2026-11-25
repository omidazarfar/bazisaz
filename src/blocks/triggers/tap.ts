import { triggerBlock } from '../types';

export const tap = triggerBlock({
  type: 'tap',
  editor: {
    title: 'صفحه لمس می‌شود',
    short: 'هر بار که بازیکن هر جای صفحه را لمس کند.',
    make: () => ({ type: 'tap' }),
    fields: [],
  },
  sentence: () => 'وقتی صفحه لمس می‌شود',
  fired: (_game, _w, _rule, { screenTapped }) => {
    return screenTapped ? [{}] : [];
  },
});
