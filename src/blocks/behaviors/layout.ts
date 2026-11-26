import { fa, slider } from '../fields';
import { group } from '../say';
import { behaviorBlock } from '../types';

// Simple layout (flagship Phase D, the UI kit): the objects of a group arranged in a row or a column, centred in
// this object (a panel), with a gap between them, as the scene starts. With anchors, menus fit any phone.
declare module '../../format/types' {
  interface MoreBehaviors {
    layout: { type: 'layout'; tag: string; direction: 'row' | 'column'; gap: number };
  }
}

export const layout = behaviorBlock({
  type: 'layout',
  editor: {
    title: 'چیدن در ردیف یا ستون',
    about: 'اشیای یک گروه را وسط همین شیء (مثلاً یک پنل) پشت‌سرهم می‌چیند: کنار هم در یک ردیف، یا زیر هم در یک ستون، با فاصله‌ی یکسان. برای دکمه‌های منو و انتخاب مرحله؛ دیگر لازم نیست دکمه‌ها را دستی تراز کنی.',
    make: () => ({ type: 'layout', tag: '', direction: 'column', gap: 24 }),
    fields: [
      { key: 'tag', label: 'اشیای کدام گروه', kind: 'tag' },
      { key: 'direction', label: 'چطور', kind: 'choice', options: [{ value: 'column', label: 'زیر هم (ستون)' }, { value: 'row', label: 'کنار هم (ردیف)' }] },
      slider('gap', 'فاصله', 0, 200, 2, undefined, 'پیکسل'),
    ],
  },
  sentence: (b) => `اشیای ${group(b.tag)} را ${b.direction === 'row' ? 'کنار هم' : 'زیر هم'} وسط خودش می‌چیند، با فاصله‌ی ${fa(b.gap)}`,
  check: (b, { object, say }) => {
    if (!b.tag) say(`"${object.id}" lays out no group.`);
  },
  step: (game, e, b) => {
    // Once, as the scene starts (its first step); the things then stay where they were put.
    if (e.age > 1 / 60 + 1e-6) return;
    const items = game.tagged(b.tag).filter((o) => o.alive && o !== e && Boolean(o.def.fixed) === Boolean(e.def.fixed));
    if (!items.length) return;
    const row = b.direction === 'row';
    const total = items.reduce((sum, o) => sum + (row ? o.width : o.height), 0) + b.gap * (items.length - 1);
    let at = (row ? e.x + e.width / 2 : e.y + e.height / 2) - total / 2;
    for (const o of items) {
      const [dx, dy] = row ? [at - o.x, e.y + e.height / 2 - o.height / 2 - o.y] : [e.x + e.width / 2 - o.width / 2 - o.x, at - o.y];
      // Whatever sits on it (its words, its icon) goes with it.
      for (const rider of game.entities) {
        if (rider === o || rider === e || !rider.alive || Boolean(rider.def.fixed) !== Boolean(o.def.fixed)) continue;
        const cx = rider.x + rider.width / 2;
        const cy = rider.y + rider.height / 2;
        if (cx >= o.x && cx <= o.x + o.width && cy >= o.y && cy <= o.y + o.height && rider.width * rider.height < o.width * o.height) {
          rider.x += dx;
          rider.y += dy;
        }
      }
      o.x += dx;
      o.y += dy;
      at += (row ? o.width : o.height) + b.gap;
    }
  },
});
