import { amountText } from '../say';
import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const setValue = actionBlock({
  type: 'setValue',
  editor: {
    title: 'تغییر مقدار یک شیء',
    about: 'هر شیء می‌تواند مقدارهای خودش را داشته باشد؛ مثل «باز بودن» یک کارت. اگر شیء آن مقدار را نداشته باشد، همین‌جا ساخته می‌شود.',
    make: (ctx) => ({ type: 'setValue', target: firstRef(ctx), name: 'open', op: 'set', amount: 1 }),
    fields: [
      TARGET,
      { key: 'name', label: 'کدام مقدارش', kind: 'valueName' },
      { key: 'op', label: 'چه کار', kind: 'choice', options: [
        { value: 'set', label: 'بگذار برابر' },
        { value: 'add', label: 'اضافه کن' },
        { value: 'subtract', label: 'کم کن' },
        { value: 'multiply', label: 'ضرب کن در' },
      ] },
      { key: 'amount', label: 'چقدر', kind: 'amount' },
    ],
  },
  sentence: (a, { who }) => {
    const n = amountText(a.amount, who);
    const what = `${a.name}ِ ${who(a.target)}`;
    if (a.op === 'multiply') return `${what} را در ${n} ضرب کن`;
    return a.op === 'set' ? `${what} را برابر ${n} بگذار` : a.op === 'add' ? `${what} را ${n} تا زیاد کن` : `${what} را ${n} تا کم کن`;
  },
  run: (game, action, context) => {
    const by = game.amount(action.amount, context);
    for (const e of game.targets(action.target, context)) {
      const now = e.values.get(action.name) ?? 0;
      e.values.set(action.name, action.op === 'set' ? by : action.op === 'add' ? now + by : action.op === 'multiply' ? now * by : now - by);
    }
    game.valuesChanged = true;
  },
});
