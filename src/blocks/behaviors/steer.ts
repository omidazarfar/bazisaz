import type { Point } from '../../runtime/Game';
import { STICK_REACH } from '../../runtime/constants';
import { slider } from '../fields';
import { behaviorBlock } from '../types';

export const steer = behaviorBlock({
  type: 'steer',
  editor: {
    title: 'حرکت در چهار جهت',
    about: 'بازیکن آن را به هر طرف می‌برد؛ برای بازی‌هایی که از بالا دیده می‌شوند، مثل هزارتو یا سفینه. با «جسم فیزیکی» (بدون جاذبه) از دیوار رد نمی‌شود.',
    make: () => ({ type: 'steer', speed: 320, control: 'stick', upTag: '', downTag: '', leftTag: '', rightTag: '', face: false }),
    fields: [
      slider('speed', 'سرعت', 50, 1000, 10),
      { key: 'control', label: 'چطور کنترل شود', kind: 'choice', options: [
        { value: 'stick', label: 'دسته‌ی لمسی: انگشت را بکش' },
        { value: 'buttons', label: 'با چهار دکمه' },
        { value: 'swipe', label: 'با کشیدن؛ خودش ادامه می‌دهد' },
        { value: 'tilt', label: 'با کج کردن گوشی' },
      ] },
      { key: 'upTag', label: 'گروه دکمه‌ی بالا', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { key: 'downTag', label: 'گروه دکمه‌ی پایین', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { key: 'leftTag', label: 'گروه دکمه‌ی چپ', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { key: 'rightTag', label: 'گروه دکمه‌ی راست', kind: 'tag', showIf: (v) => v.control === 'buttons' },
      { key: 'face', label: 'رو به جهت حرکت بچرخد', hint: 'عکس را رو به راست بکش.', kind: 'bool', fallback: false, advanced: true },
      { key: 'roll', label: 'غلت زدن برای فرار', hint: 'با یک دکمه (یا Shift و X) تند به همان طرف غلت می‌زند و در این مدت هیچ چیز به آن آسیب نمی‌زند.', kind: 'bool', fallback: false },
      { key: 'rollTag', label: 'گروه دکمه‌ی غلت', kind: 'tag', fallback: '', showIf: (v) => Boolean(v.roll) },
    ],
  },
  sentence: (b) => b.control === 'tilt' ? 'با کج کردن گوشی به هر طرف می‌رود' : b.control === 'buttons' ? 'با چهار دکمه به هر طرف می‌رود' : b.control === 'swipe' ? 'با کشیدن انگشت به آن طرف راه می‌افتد' : 'با کشیدن انگشت روی صفحه به هر طرف می‌رود',
  step: (game, e, b, frame) => {
    const { dt } = frame;
    let dx = 0;
    let dy = 0;
    const arrows: [string, number, number][] = [['ArrowLeft', -1, 0], ['ArrowRight', 1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1]];
    if (b.control === 'swipe') {
      // A swipe (or an arrow key) sets the way; it keeps going that way until the next one.
      const ways: Record<string, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
      for (const swipe of game.swipes) e.heading = ways[swipe];
      for (const [key, x, y] of arrows) if (game.keys.has(key)) e.heading = { x, y };
      if (e.heading) [dx, dy] = [e.heading.x, e.heading.y];
    } else {
      for (const [key, x, y] of arrows) {
        if (!game.keys.has(key)) continue;
        dx += x;
        dy += y;
      }
      if (b.control === 'tilt') {
        // Tilting the phone (item 6): the more it is tilted, the faster, up to full speed.
        dx += game.tilt.x;
        dy += game.tilt.y;
      } else if (b.control === 'buttons') {
        dx += (game.held(b.rightTag) ? 1 : 0) - (game.held(b.leftTag) ? 1 : 0);
        dy += (game.held(b.downTag) ? 1 : 0) - (game.held(b.upTag) ? 1 : 0);
      } else {
        const finger = [...game.pointers.values()].find((p) => !p.drag && !game.onControl({ x: p.startX, y: p.startY }));
        const pull = finger ? Math.hypot(finger.x - finger.startX, finger.y - finger.startY) : 0;
        // A short drag is a gentle push; past the stick's reach it is full speed.
        if (finger && pull > 8) {
          dx += ((finger.x - finger.startX) / pull) * Math.min(1, pull / STICK_REACH);
          dy += ((finger.y - finger.startY) / pull) * Math.min(1, pull / STICK_REACH);
        }
      }
    }
    const push = Math.hypot(dx, dy);
    const scale = push > 1 ? 1 / push : 1;
    e.vx = dx * scale * b.speed;
    e.vy = dy * scale * b.speed;
    if (b.roll) game.roll(e, b, push > 0 ? { x: dx / push, y: dy / push } : null, dt);
    if (b.face && push > 0) e.angle = Math.atan2(dy, dx);
    frame.steered = true;
  },
});
