import { firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const dead = triggerBlock({
  type: 'dead',
  editor: {
    title: 'جان یک شیء تمام می‌شود',
    make: (ctx) => ({ type: 'dead', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء یا گروه', kind: 'ref' }],
  },
  sentence: (w, { scene }) => `وقتی جان ${describeRef(scene, w.target)} تمام می‌شود`,
  subjects: () => ({ first: 'همان که جانش تمام شد' }),
  fired: (game, w) => {
    const targets = new Set(game.matching(w.target));
    return game.diedLastFrame.filter((e) => targets.has(e)).map((first) => ({ first }));
  },
});
