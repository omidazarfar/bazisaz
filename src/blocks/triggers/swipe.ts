import { triggerBlock } from '../types';

export const swipe = triggerBlock({
  type: 'swipe',
  editor: {
    title: 'صفحه با انگشت کشیده می‌شود',
    short: 'وقتی بازیکن انگشتش را روی صفحه به یک طرف بکشد.',
    make: () => ({ type: 'swipe', direction: 'right' }),
    fields: [{ key: 'direction', label: 'به کدام طرف', kind: 'choice', options: [
      { value: 'right', label: 'راست' },
      { value: 'left', label: 'چپ' },
      { value: 'up', label: 'بالا' },
      { value: 'down', label: 'پایین' },
    ] }],
  },
  sentence: (w) => {
    const way = { right: 'راست', left: 'چپ', up: 'بالا', down: 'پایین' } as const;
    return `وقتی صفحه به ${way[w.direction]} کشیده می‌شود`;
  },
  fired: (game, w) => {
    return game.swipes.includes(w.direction) ? [{}] : [];
  },
});
