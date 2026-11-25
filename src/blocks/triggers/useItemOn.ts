import type { Context } from '../../runtime/Game';
import { firstItem, firstRef, hasItems } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const useItemOn = triggerBlock({
  type: 'useItemOn',
  editor: {
    title: 'بازیکن وسیله‌ای را روی چیزی می‌کشد',
    about: 'بازیکن وسیله را از کوله‌پشتی با انگشت بیرون می‌کشد و روی یک شیء رها می‌کند؛ مثل کلید روی در، یا آب روی آتش. اگر جای دیگری رهایش کند، به کوله‌پشتی برمی‌گردد.',
    available: hasItems,
    make: (ctx) => ({ type: 'useItemOn', item: firstItem(ctx), target: firstRef(ctx) }),
    fields: [{ key: 'item', label: 'کدام وسیله', kind: 'item' }, { key: 'target', label: 'روی کدام شیء', kind: 'ref' }],
  },
  sentence: (w, { scene }) => `وقتی بازیکن ${w.item || '؟'} را از کوله‌پشتی روی ${describeRef(scene, w.target)} می‌کشد`,
  subjects: (when, { scene }) => ({ first: `همان که وسیله رویش کشیده شد (${describeRef(scene, when.target)})` }),
  check: (w, { needItem }) => {
    needItem(w.item);
  },
  fired: (game, w) => {
    const hits: Context[] = [];
    for (const drop of game.drops) {
      if (drop.item !== w.item) continue;
      const on = game.droppedOn(drop.at, w.target);
      if (on) hits.push({ first: on });
    }
    return hits;
  },
});
