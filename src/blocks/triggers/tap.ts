import { triggerBlock } from '../types';

export const tap = triggerBlock({
  type: 'tap',
  editor: {
    title: 'صفحه لمس می‌شود',
    make: () => ({ type: 'tap' }),
    fields: [],
  },
  sentence: () => 'وقتی صفحه لمس می‌شود',
  fired: (_game, _w, _rule, { screenTapped }) => {
    return screenTapped ? [{}] : [];
  },
});
