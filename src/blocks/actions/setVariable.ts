import { amountText } from '../say';
import { hasVariables } from '../fields';
import { actionBlock } from '../types';

export const setVariable = actionBlock({
  type: 'setVariable',
  editor: {
    title: 'تغییر یک مقدار',
    available: hasVariables,
    make: ({ project }) => ({ type: 'setVariable', name: project.variables[0].name, op: 'add', amount: 1 }),
    fields: [
      { key: 'name', label: 'کدام مقدار', kind: 'variable' },
      { key: 'op', label: 'چه کار', kind: 'choice', options: [
        { value: 'add', label: 'اضافه کن' },
        { value: 'subtract', label: 'کم کن' },
        { value: 'set', label: 'بگذار برابر' },
        { value: 'multiply', label: 'ضرب کن در' },
        { value: 'divide', label: 'تقسیم کن بر' },
        { value: 'max', label: 'اگر بیشتر بود، جایگزین کن' },
      ] },
      { key: 'amount', label: 'چقدر', kind: 'amount' },
    ],
  },
  sentence: (a, { who }) => {
    const n = amountText(a.amount, who);
    if (a.op === 'add') return `${a.name} را ${n} تا زیاد کن`;
    if (a.op === 'subtract') return `${a.name} را ${n} تا کم کن`;
    if (a.op === 'set') return `${a.name} را برابر ${n} بگذار`;
    if (a.op === 'multiply') return `${a.name} را در ${n} ضرب کن`;
    if (a.op === 'divide') return `${a.name} را بر ${n} تقسیم کن`;
    return `اگر ${n} بیشتر بود، ${a.name} را برابرش بگذار`;
  },
  check: (a, { needVariable }) => {
    needVariable(a.name);
    if (typeof a.amount === 'object' && 'variable' in a.amount) needVariable(a.amount.variable);
  },
  run: (game, action, context) => {
    const old = game.variables.get(action.name) ?? 0;
    const amount = game.amount(action.amount, context);
    const value =
      action.op === 'set' ? amount
      : action.op === 'add' ? old + amount
      : action.op === 'subtract' ? old - amount
      : action.op === 'multiply' ? old * amount
      : action.op === 'divide' ? (amount === 0 ? old : old / amount)
      : Math.max(old, amount);
    game.setValueOf(action.name, value);
  },
});
