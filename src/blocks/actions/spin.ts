import { firstRef, slider, TARGET } from '../fields';
import { actionBlock } from '../types';

export const spin = actionBlock({
  type: 'spin',
  editor: {
    title: 'چرخاندن با فیزیک',
    about: 'شیء «فیزیک واقعی» را با این سرعت به چرخش می‌اندازد؛ بعد خودش آرام می‌شود یا به چیزها می‌خورد.',
    make: (ctx) => ({ type: 'spin', target: firstRef(ctx), speed: 360 }),
    fields: [TARGET, slider('speed', 'سرعت چرخش', -1440, 1440, 10, 'مثبت یعنی در جهت عقربه‌های ساعت.', 'درجه در ثانیه')],
  },
  sentence: (a, { who }) => `${who(a.target)} را به چرخش بینداز`,
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) game.physics?.spin(e, action.speed);
  },
});
