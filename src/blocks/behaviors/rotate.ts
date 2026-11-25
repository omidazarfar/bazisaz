import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const rotate = behaviorBlock({
  type: 'rotate',
  editor: {
    title: 'چرخش',
    about: 'دور خودش می‌چرخد. برخورد هم با شکل چرخیده حساب می‌شود؛ برای توپ و سکه «برخورد دایره‌ای» را روشن کن.',
    make: () => ({ type: 'rotate', speed: 90 }),
    fields: [slider('speed', 'سرعت چرخش', -720, 720, 10, 'منفی یعنی خلاف جهت عقربه‌های ساعت', 'درجه در ثانیه')],
  },
  sentence: () => 'دور خودش می‌چرخد',
  step: (_game, e, b, frame) => {
    const { dt } = frame;
    e.angle += (b.speed * Math.PI * dt) / 180;
  },
});
