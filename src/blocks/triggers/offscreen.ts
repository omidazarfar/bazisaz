import { firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const offscreen = triggerBlock({
  type: 'offscreen',
  editor: {
    title: 'یک شیء از صفحه بیرون می‌رود',
    short: 'وقتی شیئی که دیده شده بود از صفحه بیرون برود؛ مثل افتادن بازیکن.',
    make: (ctx) => ({ type: 'offscreen', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء', kind: 'ref' }],
  },
  sentence: (w, { scene }) => `وقتی ${describeRef(scene, w.target)} از صفحه بیرون می‌رود`,
  subjects: () => ({ first: 'همان که بیرون رفت' }),
  fired: (game, w, _rule, { left }) => {
    const targets = new Set(game.matching(w.target));
    return left.filter((e) => targets.has(e)).map((first) => ({ first }));
  },
});
