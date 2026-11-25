import type { Context } from '../../runtime/Game';
import { fa, firstRef, slider } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const near = triggerBlock({
  type: 'near',
  editor: {
    title: 'یک شیء به شیء دیگر نزدیک می‌شود',
    short: 'لحظه‌ای که دو شیء از فاصله‌ای نزدیک‌تر می‌شوند، بدون اینکه به هم بخورند؛ مثل دشمنی که بازیکن را می‌بیند.',
    make: (ctx) => ({ type: 'near', a: firstRef(ctx), b: firstRef(ctx), distance: 250, leave: false }),
    fields: [
      { key: 'a', label: 'اولی', kind: 'ref' },
      { key: 'b', label: 'دومی', kind: 'ref' },
      slider('distance', 'فاصله', 10, 2000, 10, 'از وسط یکی تا وسط دیگری، به پیکسل.'),
      { key: 'leave', label: 'وقتی دور می‌شود، نه نزدیک', hint: 'مثلاً وقتی بازیکن از دید نگهبان بیرون رفت.', kind: 'bool', fallback: false, advanced: true },
    ],
  },
  sentence: (w, { scene }) => w.leave
    ? `وقتی ${describeRef(scene, w.a)} از ${describeRef(scene, w.b)} بیش از ${fa(w.distance)} پیکسل دور می‌شود`
    : `وقتی ${describeRef(scene, w.a)} به ${describeRef(scene, w.b)} نزدیک‌تر از ${fa(w.distance)} پیکسل می‌شود`,
  subjects: (when, { scene }) => ({ first: `همان اولی (${describeRef(scene, when.a)})`, second: `همان دومی (${describeRef(scene, when.b)})` }),
  check: (w, { checkRef }) => {
    [w.a, w.b].forEach((r) => checkRef(r));
  },
  fired: (game, w, rule) => {
    // Like a touch, but with room between: centre to centre, within the distance (or, leaving, beyond it).
    const before = game.touching.get(rule.id);
    const now = new Set<string>();
    const hits: Context[] = [];
    const seconds = game.matching(w.b);
    const wanted = new Set(seconds);
    for (const first of game.matching(w.a)) {
      // Only what lies within the distance of its middle is looked at (the broadphase, src/runtime/contacts.ts).
      const [cx, cy] = [first.x + first.width / 2, first.y + first.height / 2];
      const square = { x: cx - w.distance, y: cy - w.distance, width: 2 * w.distance, height: 2 * w.distance };
      for (const second of game.contacts.around(game.entities, Boolean(first.def.fixed), square, 1)) {
        if (!wanted.has(second)) continue;
        if (first === second || !first.visible || !second.visible || Boolean(first.def.fixed) !== Boolean(second.def.fixed)) continue;
        const distance = Math.hypot(first.x + first.width / 2 - (second.x + second.width / 2), first.y + first.height / 2 - (second.y + second.height / 2));
        if (distance > w.distance) continue;
        const key = `${game.uids.get(first)}|${game.uids.get(second)}`;
        now.add(key);
        if (!w.leave && !before?.has(key)) hits.push({ first, second });
      }
    }
    if (w.leave && before) {
      // Pairs that were close a moment ago and are not now; both must still be there.
      const alive = new Map([...game.matching(w.a), ...seconds].map((e) => [game.uids.get(e), e]));
      for (const key of before) {
        if (now.has(key)) continue;
        const [a, b] = key.split('|').map((id) => alive.get(Number(id)));
        if (a && b) hits.push({ first: a, second: b });
      }
    }
    game.touching.set(rule.id, now);
    return hits;
  },
});
