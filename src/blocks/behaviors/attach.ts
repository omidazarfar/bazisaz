import { group } from '../say';
import { behaviorBlock } from '../types';

export const attach = behaviorBlock({
  type: 'attach',
  editor: {
    title: 'چسبیدن به شیء دیگر',
    about: 'همیشه کنار نزدیک‌ترین شیء از یک گروه می‌ماند؛ مثل کلاه، سلاح یا نوار جان.',
    make: () => ({ type: 'attach', targetTag: '', offsetX: 0, offsetY: -40 }),
    fields: [
      { key: 'targetTag', label: 'به این گروه بچسبد', kind: 'tag' },
      { key: 'offsetX', label: 'فاصله‌ی افقی', hint: 'منفی یعنی سمت چپ آن', kind: 'number' },
      { key: 'offsetY', label: 'فاصله‌ی عمودی', hint: 'منفی یعنی بالای آن', kind: 'number' },
    ],
  },
  sentence: (b) => `به ${group(b.targetTag)} می‌چسبد`,
  step: (game, e, b, frame) => {
    const target = game.nearest(e, b.targetTag);
    if (target) {
      e.x = target.x + b.offsetX;
      e.y = target.y + b.offsetY;
      frame.attached = true;
    }
  },
});
