import { fa, firstRef, slider } from '../fields';
import { actionBlock } from '../types';

export const focus = actionBlock({
  type: 'focus',
  editor: {
    title: 'دوربین روی یک شیء',
    about: 'دوربین نرم به طرف یک شیء می‌رود و چند ثانیه آنجا می‌ماند، بعد دوباره دنبال بازیکن می‌رود. برای نشان دادن دری که باز شد، غولی که آمد، یا یک صحنه‌ی کوتاه فیلم‌مانند همراه «حرف زدن».',
    make: (ctx) => ({ type: 'focus', target: firstRef(ctx), seconds: 2 }),
    fields: [{ key: 'target', label: 'روی کدام شیء', kind: 'target' }, slider('seconds', 'چند ثانیه', 0.5, 10, 0.5, undefined, 'ثانیه')],
  },
  sentence: (a, { who }) => `دوربین ${fa(a.seconds)} ثانیه روی ${who(a.target)} برود`,
  run: (game, action, context) => {
    const [e] = game.targets(action.target, context);
    if (e) game.focus = { entity: e, left: Math.max(0.1, action.seconds) };
  },
});
