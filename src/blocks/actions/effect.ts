import type { Action } from '../../format/types';
import { firstRef, slider, TARGET, type Block } from '../fields';
import { actionBlock } from '../types';

const editor: Block<Extract<Action, { type: 'effect' }>> = {
  title: 'جلوه‌ی نرم',
  about: 'ظاهر شیء را نرم عوض می‌کند. «کوچک شدن و رفتن» در آخر شیء را حذف می‌کند.',
  make: (ctx) => ({ type: 'effect', target: firstRef(ctx), kind: 'pop', seconds: 0.3 }),
  fields: [TARGET, { key: 'kind', label: 'چه جلوه‌ای', kind: 'choice', options: [
    { value: 'pop', label: 'یک لحظه بزرگ شود' },
    { value: 'grow', label: 'از هیچ بزرگ شود' },
    { value: 'shrink', label: 'کوچک شود و برود' },
    { value: 'fadeIn', label: 'کم‌کم پیدا شود' },
    { value: 'fadeOut', label: 'کم‌کم محو شود' },
      { value: 'dissolve', label: 'فرو ریختن و محو شدن' },
  ] }, slider('seconds', 'چقدر طول بکشد', 0.1, 3, 0.1, undefined, 'ثانیه')],
};

export const effect = actionBlock({
  type: 'effect',
  editor,
  sentence: (a, { who }) => `${who(a.target)}: ${editor.fields.flatMap((f) => (f.kind === 'choice' ? f.options : [])).find((o) => o.value === a.kind)?.label ?? ''}`,
  check: (a, { say }) => {
    if (!(a.seconds > 0)) say('has an effect that takes no time.');
  },
  run: (game, action, context) => {
    for (const e of game.targets(action.target, context)) {
      if (action.kind === 'fadeIn' || action.kind === 'grow') e.visible = true;
      game.tweens.push({ entity: e, kind: action.kind, elapsed: 0, seconds: action.seconds, from: { x: 0, y: 0 }, to: { x: 0, y: 0 } });
    }
  },
});
