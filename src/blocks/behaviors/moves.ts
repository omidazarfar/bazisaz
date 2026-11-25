import { group } from '../say';
import { behaviorBlock } from '../types';

export const moves = behaviorBlock({
  type: 'moves',
  editor: {
    title: 'حرکت‌های ویژه: پرش از دیوار، تیز رفتن، نردبان، کوبیدن',
    about: 'برای قهرمان بازی پرشی، کنار «حرکت چپ و راست» و «پرش». پرش از دیوار: در هوا به دیوار بچسبد آرام سُر می‌خورد و با پرش از دیوار جدا می‌شود. تیز رفتن: یک لحظه خیلی سریع جلو می‌رود. نردبان: از اشیای یک گروه بالا و پایین می‌رود. کوبیدن: در هوا محکم پایین می‌آید و زمین را می‌لرزاند. روی کامپیوتر: Shift یا X برای تیز رفتن، فلش پایین برای کوبیدن.',
    make: () => ({ type: 'moves', wallJump: true, dash: true, dashTag: '', climbTag: '', pound: true, poundTag: '' }),
    fields: [
      { key: 'wallJump', label: 'پرش از دیوار', hint: 'به دیوار که بچسبد آرام سُر می‌خورد و با پرش، از دیوار دور می‌شود.', kind: 'bool' },
      { key: 'dash', label: 'تیز رفتن (دش)', kind: 'bool' },
      { key: 'dashTag', label: 'گروه دکمه‌ی تیز رفتن', kind: 'tag', fallback: '', showIf: (v) => Boolean(v.dash) },
      { key: 'pound', label: 'کوبیدن به زمین', kind: 'bool' },
      { key: 'crouch', label: 'نشستن', hint: 'روی زمین با دکمه‌ی پایین (یا فلش پایین) می‌نشیند: کوتاه‌تر و آهسته‌تر، و از زیر سقف‌های کوتاه رد می‌شود.', kind: 'bool', fallback: false },
      { key: 'poundTag', label: 'گروه دکمه‌ی پایین (کوبیدن و پایین رفتن از نردبان)', kind: 'tag', fallback: '' },
      { key: 'climbTag', label: 'از این گروه بالا برود (نردبان)', hint: 'وقتی روی نردبان است، دکمه‌ی پرش بالا و دکمه‌ی پایین پایین می‌برد؛ ول کند همان‌جا می‌ماند.', kind: 'tag', fallback: '' },
    ],
  },
  sentence: (b) => {
    const can = [b.wallJump ? 'از دیوار می‌پرد' : '', b.dash ? 'تیز می‌رود' : '', b.climbTag ? `از ${group(b.climbTag)} بالا می‌رود` : '', b.pound ? 'به زمین می‌کوبد' : '', b.crouch ? 'می‌نشیند' : ''].filter(Boolean);
    return can.length ? can.join('، ') : 'حرکت ویژه‌ای ندارد';
  },
});
