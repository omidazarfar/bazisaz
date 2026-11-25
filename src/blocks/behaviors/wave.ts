import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const wave = behaviorBlock({
  type: 'wave',
  editor: {
    title: 'حرکت موجی',
    about: 'آرام به دو طرف تاب می‌خورد. روی هر حرکت دیگری هم سوار می‌شود؛ مثل پرنده‌ای که بالا و پایین می‌رود.',
    make: () => ({ type: 'wave', axis: 'y', distance: 40, seconds: 2 }),
    fields: [
      { key: 'axis', label: 'جهت', kind: 'choice', options: [{ value: 'y', label: 'بالا و پایین' }, { value: 'x', label: 'چپ و راست' }] },
      slider('distance', 'تا چه فاصله‌ای', 5, 400, 5),
      slider('seconds', 'هر تاب چند ثانیه', 0.2, 10, 0.1, undefined, 'ثانیه'),
    ],
  },
  sentence: () => 'آرام تاب می‌خورد',
});
