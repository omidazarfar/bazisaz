import type { Entity } from '../../runtime/Game';
import { firstRef, slider, TARGET } from '../fields';
import { actionBlock } from '../types';

export const swap = actionBlock({
  type: 'swap',
  editor: {
    title: 'جا عوض کردن دو شیء',
    about: 'دو شیء جایشان را با هم عوض می‌کنند. اگر «فقط اگر کنار هم‌اند» روشن باشد و کنار هم نباشند، هیچ کاری نمی‌شود.',
    make: (ctx) => ({ type: 'swap', target: firstRef(ctx), other: firstRef(ctx), near: true }),
    fields: [TARGET, { key: 'other', label: 'با کدام شیء', kind: 'target' }, { key: 'near', label: 'فقط اگر کنار هم‌اند', hint: 'یعنی یک خانه فاصله، در یک ردیف یا یک ستون.', kind: 'bool' },
      { ...slider('match', 'فقط اگر خطی به این درازا بسازد', 0, 6, 1, 'صفر یعنی همیشه جا عوض کنند. با ۳، فقط وقتی جا عوض می‌کنند که یکی‌شان در یک ردیف سه‌تایی هم‌نوع بنشیند؛ وگرنه سر جایشان می‌مانند.'), fallback: 0, advanced: true },
      { key: 'matchBy', label: 'هم‌نوع یعنی این مقدارشان یکی باشد', kind: 'valueName', fallback: '', advanced: true, showIf: (v) => Number(v.match ?? 0) >= 2 },
    ],
  },
  sentence: (a, { who }) => `جای ${who(a.target)} و ${who(a.other)} را${a.near ? '، اگر کنار هم‌اند،' : ''} با هم عوض کن`,
  run: (game, action, context) => {
    const a = game.targets(action.target, context)[0];
    const b = game.targets(action.other, context)[0];
    if (!a || !b || a === b) return;
    const centre = (e: Entity) => ({ x: e.x + e.width / 2, y: e.y + e.height / 2 });
    const [ca, cb] = [centre(a), centre(b)];
    if (action.near) {
      // Side by side: one cell apart along a row or a column, not on a slant.
      const cell = game.scene.cell || a.width;
      const [dx, dy] = [Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y)];
      if (Math.min(dx, dy) > cell * 0.25 || Math.abs(Math.max(dx, dy) - cell) > cell * 0.5) return;
    }
    if (action.match && action.match >= 2) {
      // Try the swap on the quiet: unless it lines one of the two up, they stay where they were.
      const before = [a.x, a.y, b.x, b.y];
      [a.x, a.y, b.x, b.y] = [cb.x - a.width / 2, cb.y - a.height / 2, ca.x - b.width / 2, ca.y - b.height / 2];
      const group = game.entities.filter((e) => e.alive && e.def.tags.some((tag) => a.def.tags.includes(tag)));
      const lined = game.inLines(group, action.matchBy ?? '', action.match, false);
      [a.x, a.y, b.x, b.y] = before;
      if (!lined.has(a) && !lined.has(b)) {
        // A short lean toward each other and back says "no" without a word.
        a.slide = { x: (cb.x - ca.x) * 0.3, y: (cb.y - ca.y) * 0.3, left: 0.14, span: 0.14 };
        b.slide = { x: (ca.x - cb.x) * 0.3, y: (ca.y - cb.y) * 0.3, left: 0.14, span: 0.14 };
        return;
      }
    }
    game.slideTo(a, cb.x - a.width / 2, cb.y - a.height / 2, 0.15);
    game.slideTo(b, ca.x - b.width / 2, ca.y - b.height / 2, 0.15);
  },
});
