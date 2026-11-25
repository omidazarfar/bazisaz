import { firstRef, TARGET } from '../fields';
import { actionBlock } from '../types';

export const setImage = actionBlock({
  type: 'setImage',
  editor: {
    title: 'عوض کردن عکس',
    about: 'شیء عکس دیگری نشان می‌دهد؛ مثل دری که باز می‌شود یا دشمنی که زخمی شده. انیمیشنش می‌ایستد.',
    make: (ctx) => ({ type: 'setImage', target: firstRef(ctx), asset: Object.keys(ctx.project.assets).find((id) => ctx.project.assets[id].type === 'image') ?? '' }),
    fields: [TARGET, { key: 'asset', label: 'عکس تازه', kind: 'image' }],
  },
  sentence: (a, { who }) => `عکس ${who(a.target)} را عوض کن`,
  check: (a, { project, say }) => {
    if (a.asset !== '' && project.assets[a.asset]?.type !== 'image') say(`shows missing image "${a.asset}".`);
  },
  run: (game, action, context) => {
    if (game.project.assets[action.asset]?.type !== 'image') return;
    for (const e of game.targets(action.target, context)) {
      if (e.def.visual.kind === 'text' || e.def.visual.kind === 'bar') continue;
      e.image = action.asset;
      game.redraw(e);
    }
  },
});
