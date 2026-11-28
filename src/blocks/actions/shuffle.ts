import { describeRef } from '../say';
import { firstRef } from '../fields';
import { actionBlock } from '../types';

export const shuffle = actionBlock({
  type: 'shuffle',
  editor: {
    title: 'بُر زدن جای اشیا',
    about: 'اشیای یک گروه جایشان را تصادفی با هم عوض می‌کنند؛ مثل بُر زدن کارت‌ها در شروع بازی.',
    make: (ctx) => ({ type: 'shuffle', target: firstRef(ctx) }),
    fields: [{ key: 'target', label: 'اشیای کدام گروه', kind: 'ref' }],
  },
  sentence: (a, { scene }) => a.target.by === 'tag' ? `جای اشیای گروه «${a.target.tag}» را بُر بزن` : `جای ${describeRef(scene, a.target)} را بُر بزن`,
  run: (game, action) => {
    // Everyone in the group keeps a place of the group, but not their own.
    const t = action.target;
    const group = t.by === 'self' ? game.matching(t) : game.entities.filter((e) => e.alive && (t.by === 'id' ? e.def.id === t.id : e.def.tags.includes(t.tag)));
    const places = group.map((e) => ({ x: e.x + e.width / 2, y: e.y + e.height / 2 }));
    for (let i = places.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [places[i], places[j]] = [places[j], places[i]];
    }
    group.forEach((e, i) => game.slideTo(e, places[i].x - e.width / 2, places[i].y - e.height / 2, 0.35));
  },
});
