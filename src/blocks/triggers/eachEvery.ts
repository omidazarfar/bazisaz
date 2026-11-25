import { fa, firstRef } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const eachEvery = triggerBlock({
  type: 'eachEvery',
  editor: {
    title: 'هر چند ثانیه، برای هر شیء جدا',
    short: 'هر شیء ساعت خودش را دارد، از وقتی پیدا شد؛ مثل هر توپ‌انداز که جدا شلیک می‌کند.',
    make: (ctx) => ({ type: 'eachEvery', target: firstRef(ctx), seconds: 2 }),
    fields: [
      { key: 'target', label: 'برای هر کدام از', kind: 'ref' },
      { key: 'seconds', label: 'هر چند ثانیه', kind: 'number' },
    ],
  },
  sentence: (w, { scene }) => `هر ${fa(w.seconds)} ثانیه، برای هر ${describeRef(scene, w.target)} جدا`,
  subjects: () => ({ first: 'همان که ساعتش رسید' }),
  check: (w, { say }) => {
    if (!(w.seconds > 0)) say('needs a time above zero.');
  },
  fired: (game, w, _rule, { dt }) => {
    // Each object's own clock is its age: the rule fires as the age passes a whole number of periods.
    if (!(w.seconds > 0)) return [];
    const ticks = (age: number) => Math.floor(age / w.seconds + 1e-9);
    return game.matching(w.target).filter((e) => ticks(e.age) > ticks(Math.max(0, e.age - dt))).map((first) => ({ first }));
  },
});
