import type { Context } from '../../runtime/Game';
import { TAP_GRACE } from '../../runtime/constants';
import { firstItem, hasItems } from '../fields';
import { triggerBlock } from '../types';

export const useItem = triggerBlock({
  type: 'useItem',
  editor: {
    title: 'بازیکن وسیله‌ای را در کوله‌پشتی لمس می‌کند',
    about: 'برای استفاده از وسیله‌ها؛ مثلاً با لمس معجون، جان زیاد شود و یک معجون از کوله‌پشتی برداشته شود. کوله‌پشتی باید در صحنه باشد.',
    available: hasItems,
    make: (ctx) => ({ type: 'useItem', item: firstItem(ctx) }),
    fields: [{ key: 'item', label: 'کدام وسیله', kind: 'item' }],
  },
  sentence: (w) => `وقتی بازیکن ${w.item || '؟'} را در کوله‌پشتی لمس می‌کند`,
  subjects: () => ({ first: 'کوله‌پشتی' }),
  check: (w, { needItem }) => {
    needItem(w.item);
  },
  fired: (game, w) => {
    if (game.time <= TAP_GRACE) return [];
    const used: Context[] = [];
    for (const tap of game.taps) {
      const hit = game.bagHit(tap);
      if (hit?.item !== w.item) continue;
      used.push({ first: hit.bag });
      game.bagPops.set(hit.item, game.time);
    }
    return used;
  },
});
