import { ColorMatrixFilter } from 'pixi.js';
import { firstRef, slider, TARGET } from '../fields';
import { actionBlock } from '../types';

export const flash = actionBlock({
  type: 'flash',
  editor: {
    title: 'درخشیدن یک لحظه‌ای',
    about: 'شیء یک لحظه به رنگی درمی‌آید و آرام به رنگ خودش برمی‌گردد؛ مثل وقتی دشمن ضربه می‌خورد. سفید از همه بهتر دیده می‌شود.',
    make: (ctx) => ({ type: 'flash', target: firstRef(ctx), color: '#ffffff', seconds: 0.25 }),
    fields: [TARGET, { key: 'color', label: 'رنگ', kind: 'color' }, slider('seconds', 'چقدر طول بکشد', 0.05, 2, 0.05, undefined, 'ثانیه')],
  },
  sentence: (a, { who }) => `${who(a.target)} را یک لحظه بدرخشان`,
  check: (a, { say }) => {
    if (!(a.seconds > 0)) say(`has a flash that takes no time.`);
  },
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      const filter = e.flash?.filter ?? new ColorMatrixFilter();
      e.flash = { color: action.color, left: Math.max(0.05, action.seconds), span: Math.max(0.05, action.seconds), filter };
      game.applyFilters(e);
      game.paintFlash(e);
    }
  },
});
