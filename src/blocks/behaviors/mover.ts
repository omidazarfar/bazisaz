import { SPEED } from '../fields';
import { behaviorBlock } from '../types';

export const mover = behaviorBlock({
  type: 'mover',
  editor: {
    title: 'حرکت یکنواخت',
    about: 'با سرعت ثابت حرکت می‌کند؛ مثل مانع، تیر یا چیزی که می‌افتد.',
    make: () => ({ type: 'mover', vx: -300, vy: 0, speedVariable: '', atEdge: 'remove' }),
    fields: [
      SPEED('vx', 'سرعت افقی', 'منفی یعنی به چپ'),
      SPEED('vy', 'سرعت عمودی', 'منفی یعنی به بالا'),
      { key: 'speedVariable', label: 'سرعت ضرب شود در', hint: 'با زیاد شدن این مقدار، همه با هم تندتر می‌شوند', kind: 'variable', optional: true },
      { key: 'atEdge', label: 'وقتی از صفحه بیرون رفت', kind: 'choice', options: [
        { value: 'remove', label: 'حذف شود' },
        { value: 'wrap', label: 'از آن طرف برگردد' },
        { value: 'nothing', label: 'هیچ' },
      ] },
    ],
  },
  sentence: (b) => {
    const ways = [b.vx < 0 ? 'چپ' : b.vx > 0 ? 'راست' : '', b.vy < 0 ? 'بالا' : b.vy > 0 ? 'پایین' : ''].filter(Boolean);
    return ways.length > 0 ? `با سرعت ثابت به ${ways.join(' و ')} می‌رود` : 'ساکن است';
  },
  check: (b, { needVariable }) => {
    if (b.speedVariable) needVariable(b.speedVariable);
  },
  step: (game, e, b, frame) => {
    const { dt } = frame;
    // A homing object steers its own speed from the start.
    if (e.homing || e.def.behaviors.some((h) => h.type === 'homing')) return;
    const factor = b.speedVariable ? (game.variables.get(b.speedVariable) ?? 1) : 1;
    e.x += b.vx * factor * dt;
    e.y += b.vy * factor * dt;
  },
});
