import { LOOK_OPTIONS } from '../fields';
import { actionBlock } from '../types';

export const setLook = actionBlock({
  type: 'setLook',
  editor: {
    title: 'عوض کردن حال و هوای تصویر',
    about: 'رنگ کل تصویر را عوض می‌کند، مثل فیلتر عکس: گرم، سرد، سیاه‌وسفید، قدیمی، شب، رؤیایی یا پررنگ. مثلاً وقتی بازیکن می‌بازد، تصویر سیاه‌وسفید شود.',
    make: () => ({ type: 'setLook', look: 'gray' }),
    fields: [{ key: 'look', label: 'چه حال و هوایی', kind: 'choice', options: LOOK_OPTIONS }],
  },
  sentence: (a) => `حال و هوای تصویر را «${LOOK_OPTIONS.find((o) => o.value === a.look)?.label ?? a.look}» کن`,
  run: (game, action) => {
    game.look = action.look;
    game.applyLook();
  },
});
