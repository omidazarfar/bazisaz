import type { Context } from '../../runtime/Game';
import { overlaps } from '../../runtime/geometry';
import { firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const touch = triggerBlock({
  type: 'touch',
  editor: {
    title: 'دو شیء به هم می‌خورند',
    short: 'لحظه‌ای که دو شیء به هم می‌رسند؛ مثل بازیکن و سکه.',
    make: (ctx) => ({ type: 'touch', a: firstRef(ctx), b: firstRef(ctx) }),
    fields: [
      { key: 'a', label: 'اولی', kind: 'ref' },
      { key: 'b', label: 'دومی', kind: 'ref' },
      { key: 'from', label: 'از کدام طرف', hint: '«از بالا» یعنی اولی از بالا روی دومی بیفتد؛ مثل پریدن روی سر دشمن. «از پهلو» یعنی هر برخورد دیگری؛ مثل وقتی دشمن به بازیکن می‌رسد.', kind: 'choice', fallback: '', advanced: true, options: [
        { value: '', label: 'از هر طرف' },
        { value: 'above', label: 'از بالا' },
        { value: 'side', label: 'از پهلو' },
      ] },
    ],
  },
  sentence: (w, { scene }) => `وقتی ${describeRef(scene, w.a)} ${w.from === 'above' ? 'از بالا روی' : 'به'} ${describeRef(scene, w.b)} ${w.from === 'above' ? 'می‌افتد' : w.from === 'side' ? 'از پهلو می‌خورد' : 'می‌خورد'}`,
  subjects: (when, { scene }) => ({ first: `همان اولی (${describeRef(scene, when.a)})`, second: `همان دومی (${describeRef(scene, when.b)})` }),
  check: (w, { checkRef }) => {
    [w.a, w.b].forEach((r) => checkRef(r));
  },
  fired: (game, w, rule) => {
    const before = game.touching.get(rule.id) ?? new Set<string>();
    const now = new Set<string>();
    const hits: Context[] = [];
    const seconds = game.matching(w.b);
    for (const first of game.matching(w.a)) {
      for (const second of seconds) {
        // Bodies resting on each other are pressed together without their boxes quite overlapping.
        // Bodies with a shape of their own (an outline, a capsule) touch only where those shapes do.
        if (first === second) continue;
        const touching = game.physics?.exactly(first, second) ? game.physics.touches(first, second) : overlaps(first, second) || game.physics?.touches(first, second);
        if (!touching) continue;
        const key = `${game.uids.get(first)}|${game.uids.get(second)}`;
        now.add(key);
        if (before.has(key)) continue;
        if (w.from) {
          // Coming down onto its top: last frame the first one's feet were above the upper part of the second,
          // and this frame it moved down toward it. Measured by how they moved, not by their speeds, which an
          // earlier rule this frame may already have changed (a bounce off the very enemy being landed on).
          const above = first.prevY + first.height <= second.prevY + second.height * 0.45 && first.y - first.prevY >= second.y - second.prevY;
          if ((w.from === 'above') !== above) continue;
        }
        hits.push({ first, second });
      }
    }
    game.touching.set(rule.id, now);
    return hits;
  },
});
