import { clamp } from '../../runtime/math';
import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const walker = behaviorBlock({
  type: 'walker',
  editor: {
    title: 'حرکت چپ و راست',
    about: 'به چپ و راست می‌رود و از صفحه بیرون نمی‌زند.',
    make: () => ({ type: 'walker', speed: 320, control: 'halves', leftTag: '', rightTag: '', ease: 0 }),
    fields: [
      slider('speed', 'سرعت', 50, 1000, 10),
      { key: 'control', label: 'چطور کنترل شود', kind: 'choice', options: [
        { value: 'halves', label: 'نیمه‌ی چپ و راست صفحه' },
        { value: 'buttons', label: 'با دکمه' },
        { value: 'auto', label: 'خودکار به راست' },
      ] },
      { key: 'leftTag', label: 'گروه دکمه‌ی چپ', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { key: 'rightTag', label: 'گروه دکمه‌ی راست', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { ...slider('ease', 'نرمی شروع و ایست', 0, 1, 0.05, 'صفر یعنی فوری. بیشتر یعنی آرام سرعت می‌گیرد و آرام می‌ایستد.', 'ثانیه'), fallback: 0, advanced: true },
    ],
  },
  sentence: (b) => b.control === 'auto' ? 'خودش به راست می‌رود' : b.control === 'halves' ? 'با لمس نیمه‌ی چپ یا راست صفحه، به همان طرف می‌رود' : 'با دکمه‌های چپ و راست حرکت می‌کند',
  step: (game, e, b, frame) => {
    const { dt, W } = frame;
    let direction = 0;
    if (b.control === 'auto') direction = 1;
    else {
      if (game.keys.has('ArrowLeft')) direction -= 1;
      if (game.keys.has('ArrowRight')) direction += 1;
      if (b.control === 'halves') {
        for (const p of game.pointers.values()) direction += p.x < W / 2 ? -1 : 1;
      } else {
        if (game.held(b.leftTag)) direction -= 1;
        if (game.held(b.rightTag)) direction += 1;
      }
    }
    const wanted = Math.sign(direction) * b.speed;
    if (b.ease && b.ease > 0) {
      // Speeds up and slows down over `ease` seconds instead of snapping.
      const change = (b.speed / b.ease) * dt;
      e.vx += clamp(wanted - e.vx, -change, change);
    } else e.vx = wanted;
    frame.steered = true;
  },
});
