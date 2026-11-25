import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const followFinger = behaviorBlock({
  type: 'followFinger',
  editor: {
    title: 'دنبال کردن انگشت',
    about: 'به طرف جایی می‌رود که انگشت بازیکن روی صفحه است.',
    make: () => ({ type: 'followFinger', speed: 1200, axis: 'both' }),
    fields: [
      slider('speed', 'سرعت', 100, 3000, 50),
      { key: 'axis', label: 'جهت حرکت', kind: 'choice', options: [
        { value: 'both', label: 'هر دو' },
        { value: 'x', label: 'چپ و راست' },
        { value: 'y', label: 'بالا و پایین' },
      ] },
    ],
  },
  sentence: () => 'دنبال انگشت بازیکن می‌رود',
  step: (game, e, b, frame) => {
    const { dt } = frame;
    const pointer = [...game.pointers.values()].find((p) => !p.drag && !game.onControl(p)) ?? [...game.heldOver.values()].find((p) => !game.onControl(p));
    const finger = pointer && game.inSpaceOf(e, pointer);
    const dx = finger && b.axis !== 'y' ? finger.x - (e.x + e.width / 2) : 0;
    const dy = finger && b.axis !== 'x' ? finger.y - (e.y + e.height / 2) : 0;
    const distance = Math.hypot(dx, dy);
    // Never overshoot: close to the finger, slow down to arrive exactly on it.
    const speed = distance > 0 ? Math.min(b.speed, distance / dt) / distance : 0;
    if (b.axis !== 'y') e.vx = dx * speed;
    if (b.axis !== 'x') e.vy = dy * speed;
    frame.steered = true;
  },
});
