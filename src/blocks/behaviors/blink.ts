import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const blink = behaviorBlock({
  type: 'blink',
  editor: {
    title: 'چشمک زدن',
    about: 'کم‌رنگ و پررنگ می‌شود تا به چشم بیاید.',
    make: () => ({ type: 'blink', seconds: 1 }),
    fields: [slider('seconds', 'هر چشمک چند ثانیه', 0.2, 5, 0.1, undefined, 'ثانیه')],
  },
  sentence: () => 'چشمک می‌زند',
  step: (_game, e, b) => {
    // From solid to invisible and back, once every `seconds`.
    e.fade = 0.5 + 0.5 * Math.cos((2 * Math.PI * e.age) / b.seconds);
  },
});
