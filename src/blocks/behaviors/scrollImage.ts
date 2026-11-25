import { TilingSprite } from 'pixi.js';
import { SPEED } from '../fields';
import { behaviorBlock } from '../types';

export const scrollImage = behaviorBlock({
  type: 'scrollImage',
  editor: {
    title: 'تصویر روان',
    about: 'عکس تکرار می‌شود و پیوسته حرکت می‌کند؛ برای زمین یا آسمانی که بی‌پایان می‌گذرد. فقط برای شیئی که عکس دارد.',
    needsImage: true,
    make: () => ({ type: 'scrollImage', vx: -200, vy: 0 }),
    fields: [SPEED('vx', 'سرعت افقی', 'منفی یعنی به چپ'), SPEED('vy', 'سرعت عمودی', 'منفی یعنی به بالا')],
  },
  sentence: () => 'عکسش پیوسته می‌لغزد',
  step: (_game, e, b, frame) => {
    const { dt } = frame;
    if (e.view instanceof TilingSprite) {
      e.view.tilePosition.x += b.vx * dt;
      e.view.tilePosition.y += b.vy * dt;
    }
  },
});
