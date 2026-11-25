import { fa, firstRef, slider } from '../fields';
import { describeRef } from '../say';
import { triggerBlock } from '../types';

export const line = triggerBlock({
  type: 'line',
  editor: {
    title: 'چند شیء در یک خط ردیف می‌شوند',
    short: 'وقتی چند شیء هم‌نوع در یک ردیف، ستون یا خط اریب کنار هم قرار بگیرند؛ مثل بازی دوز.',
    make: (ctx) => ({ type: 'line', target: firstRef(ctx), name: '', length: 3, diagonal: true }),
    fields: [
      { key: 'target', label: 'اشیای کدام گروه', kind: 'ref' },
      slider('length', 'چند تا پشت‌سرهم', 2, 8, 1),
      { key: 'name', label: 'با مقدار یکسانِ', hint: 'مثلاً mark در بازی دوز. مقدار صفر یعنی «هنوز هیچ» و حساب نمی‌شود. خالی بگذار اگر کنار هم بودن کافی است.', kind: 'valueName' },
      { key: 'diagonal', label: 'خط اریب هم حساب شود', kind: 'bool' },
    ],
  },
  sentence: (w, { scene }) => `وقتی ${fa(w.length)} تا از ${describeRef(scene, w.target)}${w.name ? ` با ${w.name} یکسان` : ''} در یک خط ردیف می‌شوند`,
  subjects: () => ({ first: 'هر کدام از آن‌ها که در خط‌اند' }),
  fired: (game, w, rule) => {
    return game.newlyHeld(rule.id, game.inLines(game.matching(w.target), w.name, Math.max(2, w.length), w.diagonal)).map((first) => ({ first }));
  },
});
