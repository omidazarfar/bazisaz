import { clamp } from '../../runtime/math';
import { slider } from '../fields';
import { actionBlock } from '../types';

export const zoomPunch = actionBlock({
  type: 'zoomPunch',
  editor: {
    title: 'ضربه‌ی دوربین',
    about: 'دوربین یک لحظه جلو می‌پرد و برمی‌گردد؛ ضربه و انفجار را سنگین‌تر نشان می‌دهد. با «لرزش صفحه» و «زمان آهسته» عالی است.',
    make: () => ({ type: 'zoomPunch', amount: 1.12, seconds: 0.35 }),
    fields: [
      slider('amount', 'چقدر جلو بپرد', 1.02, 1.5, 0.01, '۱٫۱ یعنی ده درصد نزدیک‌تر.'),
      slider('seconds', 'چه مدت', 0.1, 1.5, 0.05, undefined, 'ثانیه'),
    ],
  },
  sentence: () => 'دوربین را یک لحظه جلو بپران',
  run: (game, action) => {
    game.punch = { amount: clamp(action.amount, 1, 2), left: Math.max(0.05, action.seconds), span: Math.max(0.05, action.seconds) };
  },
});
