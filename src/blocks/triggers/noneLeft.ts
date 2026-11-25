import { firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const noneLeft = triggerBlock({
  type: 'noneLeft',
  editor: {
    title: 'دیگر هیچ شیئی از یک گروه نمانده',
    short: 'وقتی آخرین شیء یک گروه هم از بین برود؛ مثل تمام شدن آجرها.',
    make: (ctx) => ({ type: 'noneLeft', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء یا گروه', kind: 'ref' }],
  },
  sentence: (w, { scene }) => `وقتی دیگر ${describeRef(scene, w.target)} نمانده`,
  fired: (game, w, rule) => {
    // A scene that starts with none (they are spawned later) has not "run out" yet.
    return game.becameTrue(rule.id, game.matching(w.target).length === 0, true) ? [{}] : [];
  },
});
