import { actionBlock } from '../types';

export const loadGame = actionBlock({
  type: 'loadGame',
  editor: {
    title: 'ادامه‌ی بازی ذخیره‌شده',
    about: 'به جایی که بازی ذخیره شده بود برمی‌گردد، با همان مقدارها؛ برای دکمه‌ی «Continue». اگر هنوز چیزی ذخیره نشده، به صحنه‌ای می‌رود که این‌جا انتخاب می‌کنی.',
    make: ({ project }) => ({ type: 'loadGame', scene: project.scenes[0].id }),
    fields: [{ key: 'scene', label: 'اگر چیزی ذخیره نشده، برو به', kind: 'scene' }],
  },
  sentence: (a, { project }) => `بازی ذخیره‌شده را ادامه بده (اگر نبود، به صحنه‌ی «${project.scenes.find((s) => s.id === a.scene)?.name ?? '؟'}» برو)`,
  check: (a, { hasScene, say }) => {
    if (!hasScene(a.scene)) say(`goes to missing scene "${a.scene}".`);
  },
  run: (game, action) => {
    let saved: { scene?: string; values?: Record<string, unknown> } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(game.savedKey('#game')) ?? 'null');
    } catch {
      saved = null;
    }
    if (saved?.scene && game.project.scenes.some((s) => s.id === saved.scene)) {
      for (const v of game.project.variables) {
        const value = saved.values?.[v.name];
        if (typeof value === 'number') game.setValueOf(v.name, value);
      }
      for (const v of game.project.textVariables ?? []) {
        const value = saved.values?.[v.name];
        game.setTextVariable(v.name, typeof value === 'string' ? value : v.initial);
      }
      game.nextScene = saved.scene;
    } else if (game.project.scenes.some((s) => s.id === action.scene)) game.nextScene = action.scene;
  },
});
