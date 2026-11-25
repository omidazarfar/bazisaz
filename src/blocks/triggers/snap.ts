import { firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const snap = triggerBlock({
  type: 'snap',
  editor: {
    title: 'اتصالی پاره می‌شود',
    about: 'وقتی «اتصال» یک شیء زیر بار پاره شود یا با کار «بریدن اتصال» بریده شود.',
    make: (ctx) => ({ type: 'snap', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'اتصالِ کدام شیء', kind: 'ref' }],
  },
  sentence: (w, { scene }) => `وقتی اتصال ${describeRef(scene, w.target)} پاره می‌شود`,
  subjects: () => ({ first: 'همان که اتصالش پاره شد', second: 'همان که به آن وصل بود' }),
  fired: (game, w) => {
    if (!game.physics) return [];
    const targets = new Set(game.matching(w.target));
    return game.physics.snapped.filter((s) => targets.has(s.a)).map((s) => ({ first: s.a, second: s.b }));
  },
});
