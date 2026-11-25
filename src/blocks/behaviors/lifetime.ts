import { fa, slider } from '../fields';
import { behaviorBlock } from '../types';

export const lifetime = behaviorBlock({
  type: 'lifetime',
  editor: {
    title: 'عمر کوتاه',
    about: 'بعد از مدتی خودش ناپدید می‌شود.',
    make: () => ({ type: 'lifetime', seconds: 2 }),
    fields: [slider('seconds', 'چند ثانیه بماند', 0.1, 30, 0.1, undefined, 'ثانیه')],
  },
  sentence: (b) => `بعد از ${fa(b.seconds)} ثانیه ناپدید می‌شود`,
  step: (_game, e, b) => {
    if (e.age >= b.seconds) e.alive = false;
  },
});
