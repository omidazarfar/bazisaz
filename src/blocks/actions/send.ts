import { messageNamesOf } from '../fields';
import { actionBlock } from '../types';

export const send = actionBlock({
  type: 'send',
  editor: {
    title: 'فرستادن پیام',
    about: 'قانون‌هایی که با «پیامی می‌رسد» منتظر همین پیام‌اند، یک لحظه بعد اجرا می‌شوند. «همان اولی» و «همان دومی» با پیام می‌روند.',
    make: ({ scene }) => ({ type: 'send', name: messageNamesOf(scene)[0] ?? 'باخت' }),
    fields: [{ key: 'name', label: 'کدام پیام', kind: 'message' }],
  },
  sentence: (a) => `پیام «${a.name || '؟'}» را بفرست`,
  run: (game, action, context) => {
    if (action.name) game.outbox.push({ name: action.name, context });
  },
});
