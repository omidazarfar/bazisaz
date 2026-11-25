import type { Trigger } from '../../format/types';
import type { Game } from '../../runtime/Game';
import { firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

/** Thrown and rest share their code: the objects real physics says were let go from a sling, or came to rest. */
const fired = (game: Game, w: Extract<Trigger, { type: 'thrown' | 'rest' }>) => {
  if (!game.physics) return [];
  const targets = new Set(game.matching(w.target));
  return (w.type === 'thrown' ? game.physics.thrown : game.physics.rested).filter((e) => targets.has(e)).map((first) => ({ first }));
};

export const thrown = triggerBlock({
  type: 'thrown',
  editor: {
    title: 'یک شیء پرتاب می‌شود',
    about: 'لحظه‌ای که بازیکن شیئی را با تیرکمان رها می‌کند؛ مثلاً برای شمردن پرتاب‌ها.',
    make: (ctx) => ({ type: 'thrown', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء', kind: 'ref' }],
  },
  sentence: (w, { scene }) => `وقتی ${describeRef(scene, w.target)} پرتاب می‌شود`,
  subjects: () => ({ first: 'همان که پرتاب شد' }),
  fired,
});

export const rest = triggerBlock({
  type: 'rest',
  editor: {
    title: 'یک شیء از حرکت می‌ایستد',
    about: 'وقتی شیئی با «فیزیک واقعی» که حرکت می‌کرد، از حرکت بایستد؛ مثل سنگی که فرود آمد و آرام گرفت. برای نوبت بعد.',
    make: (ctx) => ({ type: 'rest', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'کدام شیء', kind: 'ref' }],
  },
  sentence: (w, { scene }) => `وقتی ${describeRef(scene, w.target)} از حرکت می‌ایستد`,
  subjects: () => ({ first: 'همان که ایستاد' }),
  fired,
});
