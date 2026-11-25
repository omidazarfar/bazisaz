import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const trail = behaviorBlock({
  type: 'trail',
  editor: {
    title: 'دنباله',
    about: 'پشت سرش ردی از نقطه‌های رنگی می‌گذارد که محو می‌شوند؛ برای موشک، توپ یا شخصیت تندرو. فقط ظاهر است.',
    make: () => ({ type: 'trail', color: '#ffffff', size: 18, rate: 30 }),
    fields: [{ key: 'color', label: 'رنگ', kind: 'color' }, slider('size', 'اندازه‌ی نقطه‌ها', 4, 60, 1), slider('rate', 'چند نقطه در ثانیه', 5, 60, 1)],
  },
  sentence: () => 'پشت سرش رد رنگی می‌گذارد',
  step: (game, e, b, frame) => {
    const { dt } = frame;
    e.trailIn -= dt;
    if (e.trailIn <= 0) {
      e.trailIn = 1 / Math.max(1, b.rate);
      if (e.visible) game.puff(e, b.color, b.size);
    }
  },
});
