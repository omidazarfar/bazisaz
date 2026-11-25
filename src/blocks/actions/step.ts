import type { Box } from '../../runtime/Game';
import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const step = actionBlock({
  type: 'step',
  editor: {
    title: 'یک خانه جابه‌جا شدن',
    about: 'شیء یک خانه می‌رود، مگر اینکه چیزی جلویش باشد یا از دنیا بیرون بزند. اندازه‌ی خانه در برگه‌ی «بازی» است؛ اگر نگذاشته باشی، اندازه‌ی خود شیء حساب می‌شود.',
    make: (ctx) => ({ type: 'step', target: firstRef(ctx), direction: 'right', blockTag: '', pushTag: '' }),
    fields: [
      TARGET,
      { key: 'direction', label: 'به کدام طرف', kind: 'choice', options: [
        { value: 'right', label: 'راست' },
        { value: 'left', label: 'چپ' },
        { value: 'up', label: 'بالا' },
        { value: 'down', label: 'پایین' },
      ] },
      { key: 'blockTag', label: 'از این گروه رد نشود', hint: 'مثلاً دیوار. خالی یعنی هیچ‌چیز جلویش را نمی‌گیرد.', kind: 'tag' },
      { key: 'pushTag', label: 'این گروه را هل بدهد', hint: 'مثلاً جعبه. اگر پشت جعبه جا باشد، جعبه هم یک خانه می‌رود.', kind: 'tag' },
    ],
  },
  sentence: (a, { who }) => `${who(a.target)} را یک خانه به ${{ left: 'چپ', right: 'راست', up: 'بالا', down: 'پایین' }[a.direction]} ببر`,
  run: (game, action, context) => {
    const way = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[action.direction];
    for (const e of game.targets(action.target, context)) {
      const cell = game.scene.cell || e.width;
      const [dx, dy] = [way[0] * cell, way[1] * cell];
      const inside = (b: Box) => b.x >= 0 && b.y >= 0 && b.x + b.width <= game.scene.width && b.y + b.height <= game.scene.height;
      const ahead = { x: e.x + dx, y: e.y + dy, width: e.width, height: e.height };
      if (!inside(ahead) || game.occupants(action.blockTag, ahead, e).length > 0) continue;
      const pushed = game.occupants(action.pushTag, ahead, e);
      // Whatever is pushed needs a free cell to go to; two in a row are too heavy.
      const free = pushed.every((p) => {
        const beyond = { x: p.x + dx, y: p.y + dy, width: p.width, height: p.height };
        return inside(beyond) && game.occupants(action.blockTag, beyond, p).length === 0 && game.occupants(action.pushTag, beyond, p).length === 0;
      });
      if (!free) continue;
      for (const p of [...pushed, e]) game.slideTo(p, p.x + dx, p.y + dy, 0.12);
    }
  },
});
