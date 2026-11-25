import { isBuiltinMusic } from '../../format/types';
import { actionBlock } from '../types';

export const playMusic = actionBlock({
  type: 'playMusic',
  editor: {
    title: 'عوض کردن موسیقی',
    about: 'به‌جای موسیقی صحنه، یکی از صداهایی را که اضافه کرده‌ای پشت‌سرهم پخش می‌کند؛ مثل موسیقی تند برای غول آخر. «هیچ» موسیقی را قطع می‌کند.',
    make: ({ project }) => ({ type: 'playMusic', music: Object.keys(project.assets).find((id) => project.assets[id].type === 'sound') ?? '' }),
    fields: [{ key: 'music', label: 'کدام موسیقی', kind: 'music' }],
  },
  sentence: (a, { project }) => {
    const own = project.assets[a.music];
    return own?.type === 'sound' ? `موسیقی «${own.name}» را پخش کن` : 'موسیقی را قطع کن';
  },
  // An empty music is silence, which plays fine.
  check: (a, { project, say }) => {
    if (a.music !== '' && project.assets[a.music]?.type !== 'sound' && !isBuiltinMusic(a.music)) say(`plays missing music "${a.music}".`);
  },
  run: (game, action) => {
    if (action.music !== '' && game.project.assets[action.music]?.type !== 'sound') return;
    game.musicOverride = action.music;
    game.playMusic();
  },
});
