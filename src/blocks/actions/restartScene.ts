import { actionBlock } from '../types';

export const restartScene = actionBlock({
  type: 'restartScene',
  editor: {
    title: 'شروع دوباره‌ی همین صحنه', make: () => ({ type: 'restartScene' }), fields: [],
    short: 'همین صحنه را از اول شروع می‌کند.',
  },
  sentence: (_a) => 'صحنه را از اول شروع کن',
  run: (game, _action) => {
    game.nextScene = game.scene.id;
  },
});
