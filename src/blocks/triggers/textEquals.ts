import { hasTexts } from '../fields';
import { triggerBlock } from '../types';

export const textEquals = triggerBlock({
  type: 'textEquals',
  editor: {
    title: 'یک مقدار متنی برابر می‌شود با…',
    available: hasTexts,
    fields: [{ key: 'name', label: 'کدام مقدار متنی', kind: 'textVariable' }, { key: 'text', label: 'چه متنی', kind: 'text' }],
    make: ({ project }) => ({ type: 'textEquals', name: project.textVariables?.[0]?.name ?? '', text: 'Open the gate' }),
  },
  sentence: (w) => `وقتی متن ${w.name} برابر «${w.text}» می‌شود`,
  check: (w, { checkText }) => {
    checkText(w.name, w.text);
  },
  fired: (game, w, rule) => {
    return game.becameTrue(rule.id, game.textVariables.get(w.name) === w.text, false) ? [{}] : [];
  },
});
