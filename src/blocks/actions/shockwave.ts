import { ShockwaveFilter } from 'pixi-filters';
import { firstRef, slider } from '../fields';
import { actionBlock } from '../types';

export const shockwave = actionBlock({
  type: 'shockwave',
  editor: {
    title: 'موج انفجار',
    about: 'حلقه‌ای از وسط شیء بیرون می‌رود و تصویرِ پشتش را مثل هوای داغ انفجار کج و موج‌دار می‌کند.',
    make: (ctx) => ({ type: 'shockwave', at: firstRef(ctx), size: 400 }),
    fields: [{ key: 'at', label: 'از کدام شیء', kind: 'target' }, slider('size', 'تا کجا برود', 100, 1200, 20, undefined, 'پیکسل')],
  },
  sentence: (a, { who }) => `از ${who(a.at)} موج انفجار بفرست`,
  run: (game, action, context) => {
    for (const e of game.targets(action.at, context)) {
      const box = game.boxOf(e);
      const at = e.def.fixed ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : { x: (box.x + box.width / 2 - game.camera.x) * game.z, y: (box.y + box.height / 2 - game.camera.y) * game.z };
      const size = Math.max(50, action.size) * (e.def.fixed ? 1 : game.z);
      // Not on a slow phone, and never more than a few at once.
      if (game.light || game.waves.length >= 4) break;
      game.waves.push({ filter: new ShockwaveFilter({ center: at, amplitude: 22, wavelength: 140, speed: size * 1.6, brightness: 1.15, radius: size, time: 0 }), left: 0.8 });
      game.applyLook();
    }
  },
});
