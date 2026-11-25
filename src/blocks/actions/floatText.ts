import { fillTemplate } from '../../runtime/text';
import { firstRef, slider } from '../fields';
import { actionBlock } from '../types';

export const floatText = actionBlock({
  type: 'floatText',
  editor: {
    title: 'نوشته‌ی پران',
    about: 'یک عدد یا کلمه بالای شیء ظاهر می‌شود، کمی بالا می‌رود و محو می‌شود؛ مثل «+۳۰» وقتی سکه برداشته می‌شود، یا «آخ!» وقتی ضربه می‌خورد. مقدارها را با {score} می‌شود نوشت.',
    make: (ctx) => ({ type: 'floatText', target: firstRef(ctx), text: '+10', color: '#ffe066', size: 40 }),
    fields: [
      { key: 'target', label: 'بالای کدام شیء', kind: 'target' },
      { key: 'text', label: 'چه بنویسد', kind: 'text' },
      { key: 'color', label: 'رنگ', kind: 'color' },
      slider('size', 'اندازه', 16, 120, 2),
    ],
  },
  sentence: (a, { who }) => `بالای ${who(a.target)} بنویس «${a.text}» و بپرانش`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) game.floatText(e, fillTemplate(action.text, game.variables, e.values, game.textVariables), action.color, action.size);
  },
});
