import { slider } from '../fields';
import { actionBlock } from '../types';

export const vibrate = actionBlock({
  type: 'vibrate',
  still: true,
  editor: {
    title: 'لرزش گوشی',
    about: 'گوشی یک لحظه می‌لرزد؛ برای ضربه یا باخت. روی کامپیوتر اثری ندارد.',
    make: () => ({ type: 'vibrate', ms: 60 }),
    fields: [slider('ms', 'چقدر طول بکشد', 10, 500, 10, undefined, 'هزارم ثانیه')],
  },
  sentence: () => 'گوشی را بلرزان',
  run: (_game, action) => {
    try {
      navigator.vibrate?.(action.ms);
    } catch {
      // No vibration on this device.
    }
  },
});
