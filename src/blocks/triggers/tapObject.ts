import type { Context } from '../../runtime/Game';
import { TAP_GRACE } from '../../runtime/constants';
import { contains } from '../../runtime/geometry';
import { firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const tapObject = triggerBlock({
  type: 'tapObject',
  editor: {
    title: 'روی یک شیء زده می‌شود',
    make: (ctx) => ({ type: 'tapObject', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء', kind: 'ref' }],
  },
  sentence: (w, { scene }) => `وقتی روی ${describeRef(scene, w.target)} زده می‌شود`,
  subjects: () => ({ first: 'همان که رویش زده شد' }),
  fired: (game, w) => {
    if (game.time <= TAP_GRACE) return [];
    const hits: Context[] = [];
    for (const tap of game.taps) {
      const first = game.matching(w.target)
        .reverse()
        .find((e) => e.tappable && contains(game.boxOf(e), game.inSpaceOf(e, tap)));
      if (first) {
        hits.push({ first });
        // A tapped button gives a little under the finger, so a tap is felt to have landed.
        if (!game.tweens.some((t) => t.entity === first && t.kind === 'press')) {
          game.tweens.push({ entity: first, kind: 'press', elapsed: 0, seconds: 0.16, from: { x: 0, y: 0 }, to: { x: 0, y: 0 } });
        }
      }
    }
    return hits;
  },
});
