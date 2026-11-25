import { actionBlock } from '../types';

export const goToScene = actionBlock({
  type: 'goToScene',
  editor: {
    title: 'رفتن به صحنه‌ی دیگر',
    make: ({ project }) => ({ type: 'goToScene', scene: project.scenes[0].id }),
    fields: [
      { key: 'scene', label: 'کدام صحنه', kind: 'scene' },
      { key: 'arriveAt', label: 'کنار کدام در برسد', hint: 'برای دنیای چنداتاقه: نام گروهی در صحنه‌ی بعد (مثلاً «در خانه»). بازیکن کنار اولین شیء آن گروه ظاهر می‌شود، نه جای اولش. خالی یعنی جای خودش.', kind: 'tag', fallback: '', advanced: true },
      { key: 'bring', label: 'چه کسی آن‌جا ظاهر شود', hint: 'نام گروه؛ خالی یعنی گروه «بازیکن».', kind: 'tag', fallback: '', advanced: true, showIf: (v) => Boolean(v.arriveAt) },
    ],
  },
  sentence: (a, { project }) => `به صحنه‌ی «${project.scenes.find((s) => s.id === a.scene)?.name ?? '؟'}» برو${a.arriveAt ? ` و کنار «${a.arriveAt}» برس` : ''}`,
  check: (a, { hasScene, say }) => {
    if (!hasScene(a.scene)) say(`goes to missing scene "${a.scene}".`);
  },
  run: (game, action) => {
    game.nextScene = action.scene;
    game.arrival = action.arriveAt ? { at: action.arriveAt, bring: action.bring || 'بازیکن' } : null;
  },
});
