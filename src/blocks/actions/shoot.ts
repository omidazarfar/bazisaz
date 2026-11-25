import { fa, firstRef, slider } from '../fields';
import { actionBlock } from '../types';

export const shoot = actionBlock({
  type: 'shoot',
  editor: {
    title: 'شلیک با الگو',
    about: 'از یک شیء چند نمونه از یک شیء ساختنی را با سرعت پرتاب می‌کند: یکی، بادبزنی، حلقه‌ای دور تا دور، یا رو به نزدیک‌ترین هدف. برای اسلحه و حمله‌ی غول آخر. عکس تیر رو به بالا باشد.',
    make: (ctx) => ({ type: 'shoot', from: firstRef(ctx), prefab: '', pattern: 'spread', count: 3, direction: -90, spread: 40, speed: 700, aimTag: '' }),
    fields: [
      { key: 'from', label: 'از کدام شیء', kind: 'target' },
      { key: 'prefab', label: 'چه چیزی', kind: 'prefab' },
      { key: 'pattern', label: 'الگو', kind: 'choice', options: [
        { value: 'single', label: 'یکی' },
        { value: 'spread', label: 'بادبزنی' },
        { value: 'ring', label: 'حلقه، دور تا دور' },
        { value: 'aimed', label: 'رو به نزدیک‌ترین هدف' },
      ] },
      { ...slider('count', 'چند تا', 1, 24, 1), showIf: (v) => v.pattern !== 'single' },
      { ...slider('direction', 'به کدام طرف', -180, 180, 5, '۹۰- یعنی بالا، ۹۰ پایین، صفر راست.', 'درجه'), showIf: (v) => v.pattern !== 'aimed' },
      { ...slider('spread', 'باز شدن بادبزن', 5, 180, 5, undefined, 'درجه'), showIf: (v) => v.pattern === 'spread' || v.pattern === 'aimed' },
      slider('speed', 'سرعت', 100, 2000, 20, undefined, 'پیکسل در ثانیه'),
      { key: 'aimTag', label: 'هدف از این گروه', kind: 'tag', fallback: '', showIf: (v) => v.pattern === 'aimed' },
    ],
  },
  sentence: (a, { who }) => `از ${who(a.from)} ${{ single: 'یک تیر', spread: `${fa(a.count)} تیر بادبزنی`, ring: `${fa(a.count)} تیر دور تا دور`, aimed: `${fa(a.count)} تیر رو به هدف` }[a.pattern]} شلیک کن`,
  run: (game, action, context) => {
    const prefab = game.scene.prefabs.find((p) => p.id === action.prefab);
    if (!prefab) return;
    for (const from of game.targets(action.from, context)) {
      const cx = from.x + from.width / 2;
      const cy = from.y + from.height / 2;
      const count = Math.max(1, Math.round(action.count));
      let base = (action.direction * Math.PI) / 180;
      if (action.pattern === 'aimed') {
        const target = game.nearest(from, action.aimTag);
        if (target) base = Math.atan2(target.y + target.height / 2 - cy, target.x + target.width / 2 - cx);
      }
      const angles = action.pattern === 'single' || count === 1 ? [base]
        : action.pattern === 'ring' ? Array.from({ length: count }, (_, i) => base + (i * 2 * Math.PI) / count)
        : Array.from({ length: count }, (_, i) => base + ((i / (count - 1) - 0.5) * action.spread * Math.PI) / 180);
      for (const a of angles) {
        const shot = game.createEntity(prefab, cx - prefab.width / 2, cy - prefab.height / 2);
        shot.spawned = true;
        shot.vx = Math.cos(a) * action.speed;
        shot.vy = Math.sin(a) * action.speed;
        shot.angle = a + Math.PI / 2;
        game.insertAbove(shot, from);
      }
    }
  },
});
