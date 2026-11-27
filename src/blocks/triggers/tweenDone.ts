import { firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

// "A tween finished" (roadmap item 1): when the last round of a tween of any number on an object ends.
declare module '../../format/types' {
  interface MoreTriggers {
    tweenDone: { type: 'tweenDone'; target: Ref; label?: string };
  }
}

export const tweenDone = triggerBlock({
  type: 'tweenDone',
  editor: {
    title: 'تغییر نرم یک شیء تمام می‌شود',
    short: 'وقتی کارِ «تغییر نرم یک عدد» روی یک شیء به آخر می‌رسد (بعد از آخرین بار، اگر چند بار بود)؛ مثلاً در باز شد، حالا صدا بده.',
    make: (ctx) => ({ type: 'tweenDone', target: firstRef(ctx), label: '' }),
    fields: [
      { key: 'target', label: 'کدام شیء یا گروه', kind: 'ref' },
      { key: 'label', label: 'فقط تغییری با این نام', hint: 'خالی یعنی هر تغییری.', kind: 'text', fallback: '', advanced: true },
    ],
  },
  sentence: (w, { scene }) => `وقتی تغییر نرم ${describeRef(scene, w.target)}${w.label ? ` (${w.label})` : ''} تمام می‌شود`,
  subjects: () => ({ first: 'همان که تغییرش تمام شد' }),
  fired: (game, w) => {
    if (!game.tweenEnds.length) return [];
    const targets = new Set(game.matching(w.target));
    return game.tweenEnds.filter((t) => t.entity && targets.has(t.entity) && (!w.label || t.label === w.label)).map((t) => ({ first: t.entity! }));
  },
});
