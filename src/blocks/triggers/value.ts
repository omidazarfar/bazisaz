import { test } from '../../runtime/geometry';
import { COMPARE, fa, firstRef } from '../fields';
import { describeRef, OP_WORD } from '../say';
import { triggerBlock } from '../types';

export const value = triggerBlock({
  type: 'value',
  editor: {
    title: 'مقدار یک شیء به حدی می‌رسد',
    make: (ctx) => ({ type: 'value', target: firstRef(ctx), name: 'open', op: '==', value: 1 }),
    fields: [
      { key: 'target', label: 'کدام شیء یا گروه', kind: 'ref' },
      { key: 'name', label: 'کدام مقدارش', hint: 'مقدارهای هر شیء در برگه‌ی «شیء» ساخته می‌شوند.', kind: 'valueName' },
      COMPARE,
      { key: 'value', label: 'با عدد', kind: 'number' },
    ],
  },
  sentence: (w, { scene }) => `وقتی ${w.name} در ${describeRef(scene, w.target)} ${OP_WORD[w.op]} ${fa(w.value)} می‌شود`,
  subjects: () => ({ first: 'همان که مقدارش عوض شد' }),
  fired: (game, w, rule) => {
    const now = new Set(game.matching(w.target).filter((e) => test(e.values.get(w.name) ?? 0, w.op, w.value)));
    return game.newlyHeld(rule.id, now).map((first) => ({ first }));
  },
});
