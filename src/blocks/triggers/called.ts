import { INPUT_FIELDS, namesOf } from '../fields';
import { triggerBlock } from '../types';

// A function the user makes (Phase 4): a named list of actions, run by the action "call" from any rule of the
// scene, at once, about the same objects as that rule.
declare module '../../format/types' {
  interface MoreTriggers {
    called: { type: 'called'; name: string; in1?: string; in2?: string; in3?: string };
  }
}

/** Its inputs, in words. */
const inputs = (w: { in1?: string; in2?: string; in3?: string }) => [w.in1, w.in2, w.in3].filter(Boolean).join('، ');

export const called = triggerBlock({
  type: 'called',
  editor: {
    title: 'وقتی تابع اجرا می‌شود (تابع خودت)',
    about: 'یک «تابع» می‌سازی: کارهایی که از چند جا لازم‌اند یک بار این‌جا نوشته می‌شوند و هر قانونی با کار «اجرای تابع» همه‌شان را با هم انجام می‌دهد؛ همان لحظه. ورودی‌ها مقدارهایی‌اند که موقع اجرا پر می‌شوند؛ مثلاً تابع «جایزه» با ورودی «امتیاز» که سکه ۱ و الماس ۵ می‌دهد.',
    make: ({ scene }) => ({ type: 'called', name: `تابع ${namesOf(scene, 'called').length + 1}`, in1: '' }),
    fields: [{ key: 'name', label: 'نام تابع', hint: 'هر نامی که بخواهی، مثل «جایزه» یا «باخت». کار «اجرای تابع» با همین نام اجرایش می‌کند.', kind: 'function' }, ...INPUT_FIELDS],
  },
  sentence: (w) => `وقتی تابع «${w.name || '؟'}» اجرا می‌شود${inputs(w) ? ` (ورودی‌ها: ${inputs(w)})` : ''}`,
  subjects: () => ({ first: 'همان «اولی» در قانونی که تابع را اجرا کرد', second: 'همان «دومی» در قانونی که تابع را اجرا کرد' }),
  check: (w, { say, needVariable }) => {
    if (!w.name) say('is a function with no name.');
    for (const v of [w.in1, w.in2, w.in3]) if (v) needVariable(v);
  },
  // Never by itself: only when called (Game.callFunction).
  fired: () => [],
});
