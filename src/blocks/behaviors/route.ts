import { slider } from '../fields';
import { group } from '../say';
import { behaviorBlock } from '../types';

export const route = behaviorBlock({
  type: 'route',
  editor: {
    title: 'رفتن روی مسیر',
    about: 'از یک نشانه به نشانه‌ی بعدی می‌رود. نشانه‌ها اشیای یک گروه‌اند (می‌توانند پنهان باشند) و ترتیبشان از روی نامشان است: «نقطه ۱»، «نقطه ۲»، … . برای دشمنی که راه مشخصی را می‌رود.',
    make: () => ({ type: 'route', tag: '', speed: 200, end: 'loop' }),
    fields: [
      { key: 'tag', label: 'گروه نشانه‌های مسیر', kind: 'tag' },
      slider('speed', 'سرعت', 10, 1000, 10),
      { key: 'end', label: 'در آخر مسیر', kind: 'choice', options: [
        { value: 'loop', label: 'از اول شروع کند' },
        { value: 'back', label: 'همان راه را برگردد' },
        { value: 'stop', label: 'بایستد' },
      ] },
    ],
  },
  sentence: (b) => `روی نشانه‌های ${group(b.tag)} راه می‌رود`,
  step: (game, e, b, frame) => {
    const { dt } = frame;
    let marks = game.marks.get(b.tag);
    if (!marks) {
      marks = game.entities
        .filter((m) => m.alive && m !== e && m.def.tags.includes(b.tag))
        .sort((m, n) => m.def.name.localeCompare(n.def.name, undefined, { numeric: true }));
      game.marks.set(b.tag, marks);
    }
    if (marks.length === 0) return;
    const mark = marks[Math.min(e.routeAt, marks.length - 1)];
    const tx = mark.x + mark.width / 2 - e.width / 2;
    const ty = mark.y + mark.height / 2 - e.height / 2;
    const far = Math.hypot(tx - e.x, ty - e.y);
    const stride = b.speed * dt;
    if (far > stride) {
      e.x += ((tx - e.x) / far) * stride;
      e.y += ((ty - e.y) / far) * stride;
      return;
    }
    // Reached this marker: on to the next, or whatever the end of the route calls for.
    e.x = tx;
    e.y = ty;
    const next = e.routeAt + e.routeWay;
    if (next >= 0 && next < marks.length) e.routeAt = next;
    else if (b.end === 'loop') e.routeAt = 0;
    else if (b.end === 'back' && marks.length > 1) {
      e.routeWay = e.routeWay === 1 ? -1 : 1;
      e.routeAt += e.routeWay;
    }
  },
});
