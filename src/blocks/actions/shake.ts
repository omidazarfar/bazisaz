import { SHAKE_SECONDS } from '../../runtime/constants';
import { slider } from '../fields';
import { actionBlock } from '../types';

export const shake = actionBlock({
  type: 'shake',
  still: true,
  editor: {
    title: 'لرزش صفحه',
    about: 'کل صفحه یک لحظه می‌لرزد؛ برای ضربه و باخت.',
    make: () => ({ type: 'shake', strength: 12 }),
    fields: [
      slider('strength', 'شدت', 2, 40, 1),
      { key: 'axis', label: 'به کدام طرف', kind: 'choice', fallback: 'both', options: [
        { value: 'both', label: 'همه طرف' },
        { value: 'side', label: 'فقط چپ و راست، مثل ضربه از پهلو' },
        { value: 'up', label: 'فقط بالا و پایین، مثل فرود سنگین' },
      ] },
    ],
  },
  sentence: (a) => (a.axis === 'side' ? 'صفحه را چپ و راست بلرزان' : a.axis === 'up' ? 'صفحه را بالا و پایین بلرزان' : 'صفحه را بلرزان'),
  run: (game, action) => {
    game.shakeLeft = SHAKE_SECONDS;
    game.shakeStrength = action.strength;
    game.shakeAxis = action.axis ?? 'both';
  },
});
