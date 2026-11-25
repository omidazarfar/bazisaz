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
      { key: 'followAngle', label: 'با چرخیدن آن بچرخد (استخوان)', hint: 'مثل ساعد روی بازو: وقتی آن بچرخد، این هم با آن می‌چرخد و سر جایش روی آن می‌ماند؛ انیمیشن خودش روی آن اضافه می‌شود. این‌طور چند تکه پشت‌سرهم به هم وصل می‌شوند.', kind: 'bool', fallback: false, advanced: true },
    ],
  },
  sentence: (b) => `به ${group(b.targetTag)} می‌چسبد${b.followAngle ? ' و با چرخیدنش می‌چرخد' : ''}`,
  step: (game, e, b, frame) => {
    const target = game.nearest(e, b.targetTag);
    if (target) {
      if (b.followAngle) {
        // A bone: its place on the parent turns with the parent, about the parent's middle, and so does it.
        const [cx, cy] = [target.x + target.width / 2, target.y + target.height / 2];
        const lx = b.offsetX + e.width / 2 - target.width / 2;
        const ly = b.offsetY + e.height / 2 - target.height / 2;
        const [cos, sin] = [Math.cos(target.angle), Math.sin(target.angle)];
        e.x = cx + lx * cos - ly * sin - e.width / 2;
        e.y = cy + lx * sin + ly * cos - e.height / 2;
        e.angle = target.angle;
      } else {
        e.x = target.x + b.offsetX;
        e.y = target.y + b.offsetY;
      }
      frame.attached = true;
    }
  },
});
