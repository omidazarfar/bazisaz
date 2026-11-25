import { behaviorBlock } from '../types';

export const draggable = behaviorBlock({
  type: 'draggable',
  editor: {
    title: 'قابل کشیدن',
    about: 'بازیکن می‌تواند با انگشت آن را بگیرد و جابه‌جا کند.',
    make: () => ({ type: 'draggable' }),
    fields: [],
  },
  sentence: () => 'بازیکن می‌تواند آن را با انگشت بکشد',
});
