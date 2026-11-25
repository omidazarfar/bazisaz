import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const moveRandom = actionBlock({
  type: 'moveRandom',
  editor: {
    title: 'بردن شیء به جای تصادفی',
    about: 'یک جای تصادفی روی صفحه.',
    make: (ctx) => ({ type: 'moveRandom', target: firstRef(ctx) }),
    fields: [TARGET],
  },
  sentence: (a, { who }) => `${who(a.target)} را به جایی تصادفی ببر`,
  run: (game, action, context) => {
    const { width: W, height: H } = game.view;
    for (const e of game.targets(action.target, context)) {
      const origin = e.def.fixed ? { x: 0, y: 0 } : game.camera;
      const [w, h] = e.def.fixed ? [W, H] : [W / game.z, H / game.z];
      game.place(e, origin.x + Math.random() * Math.max(0, w - e.width), origin.y + Math.random() * Math.max(0, h - e.height));
    }
  },
});
