import { fa } from '../fields';
import { behaviorBlock } from '../types';

export const animate = behaviorBlock({
  type: 'animate',
  editor: {
    title: 'انیمیشن (خط زمان)',
    about: 'شیء در لحظه‌های مختلف («کلید»ها) جا، چرخش، اندازه و کم‌رنگی متفاوتی دارد و بین آن‌ها نرم حرکت می‌کند؛ مثل پرچمی که تاب می‌خورد، سکه‌ای که می‌چرخد یا نوشته‌ای که از کنار وارد می‌شود. دکمه‌ی «ویرایش انیمیشن» خط زمان را با پیش‌نمایش زنده و انیمیشن‌های آماده باز می‌کند. روی جای خود شیء اضافه می‌شود، پس شیء می‌تواند هم راه برود و هم تاب بخورد. برای اشیای «فیزیک واقعی» نیست.',
    make: () => ({ type: 'animate', repeat: 'loop', ease: 'smooth', keys: [{ t: 0, x: 0, y: 0, angle: 0, scale: 1, opacity: 1 }, { t: 1, x: 0, y: -24, angle: 0, scale: 1, opacity: 1 }, { t: 2, x: 0, y: 0, angle: 0, scale: 1, opacity: 1 }] }),
    fields: [
      { key: 'repeat', label: 'تکرار', kind: 'choice', options: [
        { value: 'loop', label: 'از اول، پشت سر هم' },
        { value: 'bounce', label: 'رفت و برگشت' },
        { value: 'once', label: 'فقط یک بار' },
      ] },
      { key: 'ease', label: 'حرکت بین کلیدها', kind: 'choice', options: [
        { value: 'smooth', label: 'نرم (آهسته شروع و تمام می‌شود)' },
        { value: 'linear', label: 'یکنواخت' },
      ] },
    ],
  },
  sentence: (b) => {
    const length = Math.max(0, ...b.keys.map((k) => k.t));
    return `انیمیشن ${fa(b.keys.length)} کلیدی دارد، ${fa(Math.round(length * 10) / 10)} ثانیه، ${b.repeat === 'once' ? 'یک بار' : b.repeat === 'bounce' ? 'رفت و برگشت' : 'پشت سر هم'}`;
  },
  check: (b, { object, say }) => {
    if (!Array.isArray(b.keys) || b.keys.length === 0 || !b.keys.every((k) => [k.t, k.x, k.y, k.angle, k.scale, k.opacity].every(Number.isFinite) && k.t >= 0))
      say(`"${object.id}" has an animation without proper keys.`);
  },
});
