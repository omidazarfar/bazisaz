import { hasTexts } from '../fields';
import { actionBlock } from '../types';

export const setTextVariable = actionBlock({
  type: 'setTextVariable',
  editor: {
    title: 'تغییر مقدار متنی',
    available: hasTexts,
    fields: [{ key: 'name', label: 'کدام مقدار متنی', kind: 'textVariable' }, { key: 'text', label: 'چه متنی', kind: 'text' }],
    make: ({ project }) => ({ type: 'setTextVariable', name: project.textVariables?.[0]?.name ?? '', text: 'Open the gate' }),
  },
  sentence: (a) => `متن ${a.name} را به «${a.text}» تغییر بده`,
  check: (a, { checkText }) => {
    checkText(a.name, a.text);
  },
  run: (game, action) => {
    game.setTextVariable(action.name, action.text);
  },
});
