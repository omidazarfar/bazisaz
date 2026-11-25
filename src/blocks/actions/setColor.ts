import type { Text } from 'pixi.js';
import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const setColor = actionBlock({
  type: 'setColor',
  editor: {
    title: 'عوض کردن رنگ',
    about: 'رنگ شکل یا متن را عوض می‌کند. روی عکس، عکس را به آن رنگ درمی‌آورد؛ سفید یعنی رنگ خود عکس.',
    make: (ctx) => ({ type: 'setColor', target: firstRef(ctx), color: '#ff5a5f' }),
    fields: [TARGET, { key: 'color', label: 'رنگ تازه', kind: 'color' }],
  },
  sentence: (a, { who }) => `رنگ ${who(a.target)} را عوض کن`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      e.color = action.color;
      if (e.def.visual.kind === 'text') (e.view as Text).style.fill = action.color;
      else if (e.def.visual.kind === 'bar') game.refreshTexts(true);
      else game.redraw(e);
    }
  },
});
