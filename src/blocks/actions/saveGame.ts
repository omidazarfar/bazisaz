import { actionBlock } from '../types';

export const saveGame = actionBlock({
  type: 'saveGame',
  editor: {
    title: 'ذخیره‌ی بازی',
    about: 'صحنه‌ای که بازیکن در آن است و همه‌ی مقدارها (امتیاز، جان، وسیله‌های کوله‌پشتی) روی گوشی نگه داشته می‌شوند، حتی اگر بازی بسته شود. مثلاً وقتی هر مرحله شروع می‌شود.',
    make: () => ({ type: 'saveGame' }),
    fields: [],
  },
  sentence: (_a) => 'بازی را روی گوشی ذخیره کن',
  run: (game, _action) => {
    try {
      localStorage.setItem(game.savedKey('#game'), JSON.stringify({ scene: game.scene.id, values: Object.fromEntries([...game.variables, ...game.textVariables]) }));
    } catch {
      // Progress simply isn't kept on this device.
    }
  },
});
