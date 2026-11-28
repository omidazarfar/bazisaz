import { firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

// Text input (item 6 of the 2026-11-27 roadmap): see Game.placeInputs.
declare module '../../format/types' {
  interface MoreTriggers {
    /** The player confirmed what they typed in a text-input box (Enter, or the keyboard's go button). That box is "first". */
    inputDone: { type: 'inputDone'; target: Ref };
  }
}

export const inputDone = triggerBlock({
  type: 'inputDone',
  editor: {
    title: 'بازیکن نوشته‌اش را تأیید می‌کند',
    about: 'وقتی بازیکن در یک «جای نوشتن» دکمه‌ی Enter (یا دکمه‌ی تأیید صفحه‌کلید گوشی) را می‌زند. نوشته‌اش همان لحظه در مقدار متنیِ آن جا هست؛ مثلاً اگر جوابش درست بود، در باز شود.',
    make: (ctx) => {
      const box = ctx.scene.objects.find((o) => o.visual.kind === 'input');
      return { type: 'inputDone', target: box ? { by: 'id', id: box.id } : firstRef(ctx) };
    },
    fields: [{ key: 'target', label: 'کدام جای نوشتن', kind: 'ref' }],
  },
  sentence: (w, { scene }) => `وقتی بازیکن نوشته‌اش را در ${describeRef(scene, w.target)} تأیید می‌کند`,
  subjects: (w, { scene }) => ({ first: `همان جای نوشتن (${describeRef(scene, w.target)})` }),
  fired: (game, w) => {
    if (game.inputDone.length === 0) return [];
    const wanted = new Set(game.matching(w.target));
    return game.inputDone.filter((e) => wanted.has(e)).map((first) => ({ first }));
  },
});
