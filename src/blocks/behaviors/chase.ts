import { fa, slider } from '../fields';
import { group } from '../say';
import { behaviorBlock } from '../types';

export const chase = behaviorBlock({
  type: 'chase',
  editor: {
    title: 'تعقیب',
    about: 'دنبال نزدیک‌ترین شیء از یک گروه می‌رود.',
    make: () => ({ type: 'chase', targetTag: '', speed: 150, axis: 'both', range: 0, away: false, avoidTag: '' }),
    fields: [
      { key: 'targetTag', label: 'دنبال این گروه برود', kind: 'tag' },
      slider('speed', 'سرعت', 10, 1000, 10),
      { key: 'axis', label: 'در کدام جهت', hint: 'مثلاً راکت حریف در بازی تنیس فقط بالا و پایین دنبال توپ می‌رود.', kind: 'choice', fallback: 'both', advanced: true, options: [
        { value: 'both', label: 'هر دو' },
        { value: 'x', label: 'فقط چپ و راست' },
        { value: 'y', label: 'فقط بالا و پایین' },
      ] },
      { ...slider('range', 'فقط از این فاصله نزدیک‌تر', 0, 2000, 10, 'صفر یعنی از هر جای دنیا دنبالش می‌کند. با ۳۰۰، فقط وقتی بازیکن نزدیک‌تر از ۳۰۰ پیکسل بیاید متوجهش می‌شود.'), fallback: 0, advanced: true },
      { key: 'away', label: 'به‌جای دنبال کردن، فرار کند', hint: 'مثل موشی که از گربه دور می‌شود.', kind: 'bool', fallback: false, advanced: true },
      { key: 'avoidTag', label: 'دیوارهای این گروه را دور بزند', hint: 'دشمن به‌جای اینکه مستقیم به دیوار بخورد، راهش را در هزارتو پیدا می‌کند. خالی یعنی مستقیم برود.', kind: 'tag', fallback: '', advanced: true, showIf: (v) => !v.away },
      { key: 'sight', label: 'فقط وقتی ببیند', hint: 'اگر دیواری بین آن‌ها باشد، بازیکن را نمی‌بیند و دنبالش نمی‌کند؛ تا جایی که آخرین بار دیدش می‌رود، کمی آنجا می‌گردد و بعد بی‌خیال می‌شود. برای بازی‌های مخفی‌کاری. دیوار همان گروه بالا است، یا گروهی که از آن رد نمی‌شود.', kind: 'bool', fallback: false, advanced: true, showIf: (v) => !v.away },
    ],
  },
  sentence: (b) => {
    const what = b.away ? `از ${group(b.targetTag)} فرار می‌کند` : `دنبال ${group(b.targetTag)} می‌رود`;
    return `${what}${b.range ? `، وقتی نزدیک‌تر از ${fa(b.range)} پیکسل باشد` : ''}${b.avoidTag && !b.away ? `، و دیوارهای ${group(b.avoidTag)} را دور می‌زند` : ''}${b.sight && !b.away ? '، فقط وقتی ببیندش' : ''}`;
  },
  step: (game, e, b, frame) => {
    const { dt } = frame;
    const aim = game.chaseAim(e, b, dt);
    const dx = aim && b.axis !== 'y' ? aim.x - (e.x + e.width / 2) : 0;
    const dy = aim && b.axis !== 'x' ? aim.y - (e.y + e.height / 2) : 0;
    const distance = Math.hypot(dx, dy);
    // Never overshoot the point it is making for, or it would shake about it.
    const speed = distance > 1 ? Math.min(b.speed, distance / dt) / distance : 0;
    const away = b.away ? -1 : 1;
    e.vx = dx * speed * away;
    e.vy = dy * speed * away;
  },
});
