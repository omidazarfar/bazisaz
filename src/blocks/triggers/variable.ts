import { COMPARE, fa, hasVariables } from '../fields';
import { OP_WORD } from '../say';
import { triggerBlock } from '../types';

export const variable = triggerBlock({
  type: 'variable',
  editor: {
    title: 'یک مقدار به حدی می‌رسد',
    short: 'وقتی مقداری مثل امتیاز به عددی برسد.',
    available: hasVariables,
    make: ({ project }) => ({ type: 'variable', name: project.variables[0].name, op: '>=', value: 10 }),
    fields: [{ key: 'name', label: 'کدام مقدار', kind: 'variable' }, COMPARE, { key: 'value', label: 'با عدد', kind: 'number' }],
  },
  sentence: (w) => `وقتی ${w.name} ${OP_WORD[w.op]} ${fa(w.value)} می‌شود`,
  check: (w, { needVariable }) => {
    needVariable(w.name);
  },
  fired: (game, w, rule) => {
    return game.becameTrue(rule.id, game.compare(w.name, w.op, w.value), false) ? [{}] : [];
  },
});
