import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const patrol = behaviorBlock({
  type: 'patrol',
  editor: {
    title: 'رفت و برگشت',
    about: 'از جایی که گذاشته شده می‌رود و برمی‌گردد؛ مثل نگهبان.',
    make: () => ({ type: 'patrol', axis: 'x', distance: 200, speed: 120 }),
    fields: [
      { key: 'axis', label: 'جهت', kind: 'choice', options: [{ value: 'x', label: 'چپ و راست' }, { value: 'y', label: 'بالا و پایین' }] },
      slider('distance', 'مسافت', 10, 1200, 10),
      slider('speed', 'سرعت', 10, 800, 10),
    ],
  },
  sentence: (b) => b.axis === 'x' ? 'به چپ و راست رفت و برگشت می‌کند' : 'بالا و پایین رفت و برگشت می‌کند',
  step: (_game, e, b) => {
    // A triangle wave: out to `distance` and back, at a steady speed.
    const along = (e.age * b.speed) % (2 * b.distance);
    const offset = b.distance - Math.abs(along - b.distance);
    if (b.axis === 'x') e.x = e.homeX + offset;
    else e.y = e.homeY + offset;
  },
});
