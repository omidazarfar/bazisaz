import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const layer = actionBlock({
  type: 'layer',
  editor: {
    title: 'جلو یا عقب بردن شیء',
    about: 'شیء روی همه یا پشت همه کشیده می‌شود.',
    make: (ctx) => ({ type: 'layer', target: firstRef(ctx), to: 'front' }),
    fields: [TARGET, { key: 'to', label: 'کجا', kind: 'choice', options: [{ value: 'front', label: 'جلوی همه' }, { value: 'back', label: 'پشت همه' }] }],
  },
  sentence: (a, { who }) => a.to === 'front' ? `${who(a.target)} را جلوی همه بیاور` : `${who(a.target)} را پشت همه ببر`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      const layer = game.layerOf(e);
      // The list of objects is kept in drawing order too, so what is tapped is what is seen on top.
      game.entities.splice(game.entities.indexOf(e), 1);
      if (action.to === 'front') {
        game.entities.push(e);
        layer.addChild(e.view);
      } else {
        game.entities.unshift(e);
        layer.addChildAt(e.view, 0);
      }
    }
  },
});
