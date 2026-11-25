import type { JumperBehavior } from '../../format/types';
import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const jump = actionBlock({
  type: 'jump',
  editor: {
    title: 'پراندن شیء',
    about: 'شیء باید رفتار «پرش» داشته باشد.',
    make: (ctx) => ({ type: 'jump', target: firstRef(ctx) }),
    fields: [TARGET],
  },
  sentence: (a, { who }) => `${who(a.target)} را بپران`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      const jumper = e.def.behaviors.find((b): b is JumperBehavior => b.type === 'jumper');
      if (jumper) e.vy = -jumper.jumpSpeed;
    }
  },
});
