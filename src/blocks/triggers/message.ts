import { messageNamesOf } from '../fields';
import { triggerBlock } from '../types';

export const message = triggerBlock({
  type: 'message',
  editor: {
    title: 'پیامی می‌رسد',
    about: 'وقتی قانون دیگری با کار «فرستادن پیام» همین پیام را بفرستد. کارهایی را که از چند جا لازم است یک بار این‌جا بنویس؛ مثلاً پیام «باخت» از هر جا که بیاید، صدا پخش شود و صحنه از نو شروع شود.',
    make: ({ scene }) => ({ type: 'message', name: messageNamesOf(scene)[0] ?? 'باخت' }),
    fields: [{ key: 'name', label: 'کدام پیام', hint: 'هر نامی که بخواهی، مثل «برد» یا «باخت». باید با نام پیامی که فرستاده می‌شود یکی باشد.', kind: 'message' }],
  },
  sentence: (w) => `وقتی پیام «${w.name || '؟'}» می‌رسد`,
  subjects: () => ({ first: 'همان «اولی» در قانونی که پیام را فرستاد', second: 'همان «دومی» در قانونی که پیام را فرستاد' }),
  fired: (game, w) => {
    return game.inbox.filter((m) => m.name === w.name).map((m) => ({ ...m.context }));
  },
});
