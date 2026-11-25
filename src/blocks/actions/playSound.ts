import { SOUND_NAMES } from '../../format/types';
import { fa, SOUND_LABEL } from '../fields';
import { actionBlock } from '../types';

export const playSound = actionBlock({
  type: 'playSound',
  editor: {
    title: 'پخش صدا',
    short: 'یکی از صداهای آماده یا صدای خودت را پخش می‌کند.',
    make: () => ({ type: 'playSound', sound: 'coin' }),
    fields: [{ key: 'sound', label: 'کدام صدا', kind: 'sound' }, { key: 'volume', kind: 'slider', label: 'بلندی صدا', min: 0, max: 100, step: 1, unit: '٪', fallback: 100 }],
  },
  sentence: (a, { project }) => {
    const own = project.assets[a.sound];
    return `صدای «${own?.type === 'sound' ? own.name : (SOUND_LABEL[a.sound as keyof typeof SOUND_LABEL] ?? a.sound)}» را پخش کن${a.volume !== undefined && a.volume !== 100 ? ` با بلندی ${fa(a.volume)}٪` : ''}`;
  },
  check: (a, { project, say }) => {
    if (a.volume !== undefined && !(Number.isFinite(a.volume) && a.volume >= 0 && a.volume <= 100)) {
      say('needs a sound volume between 0 and 100.');
    }
    if (!(SOUND_NAMES as readonly string[]).includes(a.sound) && project.assets[a.sound]?.type !== 'sound') {
      say(`plays missing sound "${a.sound}".`);
    }
  },
  run: (game, action) => {
    game.sound(action.sound, action.volume);
  },
});
