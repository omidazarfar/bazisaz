import { actionBlock } from '../types';

export const nextScene = actionBlock({
  type: 'nextScene',
  editor: {
    title: 'رفتن به صحنه‌ی بعد',
    about: 'به صحنه‌ای می‌رود که در فهرست صحنه‌ها بعد از همین است؛ بعد از آخری، به اولی. برای مرحله‌ی بعد، بدون اینکه نام صحنه را انتخاب کنی.',
    make: () => ({ type: 'nextScene' }),
    fields: [],
  },
  sentence: (_a) => 'به صحنه‌ی بعد برو',
  run: (game, _action) => {
    const scenes = game.project.scenes;
    game.nextScene = scenes[(scenes.findIndex((s) => s.id === game.scene.id) + 1) % scenes.length].id;
  },
});
