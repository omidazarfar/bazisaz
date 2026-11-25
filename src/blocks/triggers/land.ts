import { firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const land = triggerBlock({
  type: 'land',
  editor: {
    title: 'یک شیء روی چیزی فرود می‌آید',
    short: 'هر بار که شیئی با «جسم فیزیکی» از هوا روی زمین، سکو یا لبه‌ی پایین دنیا بنشیند؛ مثل پرش دوباره از روی سکو.',
    make: (ctx) => ({ type: 'land', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء یا گروه', hint: 'شیء باید «جسم فیزیکی» داشته باشد.', kind: 'ref' }],
  },
  sentence: (w, { scene }) => `وقتی ${describeRef(scene, w.target)} روی چیزی فرود می‌آید`,
  subjects: () => ({ first: 'همان که فرود آمد', second: 'همان که رویش فرود آمد' }),
  fired: (game, w) => {
    const targets = new Set(game.matching(w.target));
    return game.landings.filter((l) => targets.has(l.entity)).map((l) => ({ first: l.entity, second: l.on ?? undefined }));
  },
});
