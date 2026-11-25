import type { Context } from '../../runtime/Game';
import { fa, firstRef, slider } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const hit = triggerBlock({
  type: 'hit',
  editor: {
    title: 'یک شیء محکم به چیزی می‌خورد',
    short: 'لحظه‌ای که شیئی با «فیزیک واقعی» با سرعت به چیزی بخورد؛ مثل سنگی که به برج می‌خورد. نشستن آرام حساب نمی‌شود.',
    make: (ctx) => ({ type: 'hit', a: firstRef(ctx), b: firstRef(ctx), speed: 600 }),
    fields: [
      { key: 'a', label: 'اولی', hint: 'دست‌کم یکی از دو تا باید «فیزیک واقعی» داشته باشد.', kind: 'ref' },
      { key: 'b', label: 'به', kind: 'ref' },
      slider('speed', 'دست‌کم با این سرعت', 100, 3000, 50, 'برخوردهای آرام‌تر، و نشستن آرام روی هم، حساب نمی‌شوند؛ مثل شیشه‌ای که فقط با ضربه‌ی محکم می‌شکند.'),
    ],
  },
  sentence: (w, { scene }) => `وقتی ${describeRef(scene, w.a)} محکم به ${describeRef(scene, w.b)} می‌خورد (دست‌کم ${fa(w.speed)} پیکسل در ثانیه)`,
  subjects: (when, { scene }) => ({ first: `همان اولی (${describeRef(scene, when.a)})`, second: `همان که به آن خورد (${describeRef(scene, when.b)})` }),
  check: (w, { checkRef }) => {
    [w.a, w.b].forEach((r) => checkRef(r));
  },
  fired: (game, w) => {
    if (!game.physics) return [];
    const as = new Set(game.matching(w.a));
    const bs = new Set(game.matching(w.b));
    const hits: Context[] = [];
    for (const hit of game.physics.hits) {
      if (hit.speed < w.speed) continue;
      if (as.has(hit.a) && bs.has(hit.b)) hits.push({ first: hit.a, second: hit.b });
      else if (as.has(hit.b) && bs.has(hit.a)) hits.push({ first: hit.b, second: hit.a });
    }
    return hits;
  },
});
