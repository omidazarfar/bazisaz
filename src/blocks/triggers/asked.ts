import { INPUT_FIELDS, namesOf } from '../fields';
import { triggerBlock } from '../types';

// A yes/no question the user makes (Phase 4): its conditions are the answer. A rule's condition "ask …" asks it.
declare module '../../format/types' {
  interface MoreTriggers {
    asked: { type: 'asked'; name: string; in1?: string; in2?: string; in3?: string };
  }
}

const inputs = (w: { in1?: string; in2?: string; in3?: string }) => [w.in1, w.in2, w.in3].filter(Boolean).join('، ');

export const asked = triggerBlock({
  type: 'asked',
  editor: {
    title: 'وقتی پرسیده می‌شود (پرسش خودت)',
    about: 'یک «پرسش بله/نه» می‌سازی: شرط‌های همین قانون جوابش‌اند. اگر همه درست باشند جواب «بله» است. بعد در هر قانونی «+ شرط با یک پرسش» را بزن؛ مثلاً پرسش «آماده است؟» که می‌گوید جان بیشتر از ۰ و کلید ۱ است. کارهای این قانون انجام نمی‌شوند.',
    make: ({ scene }) => ({ type: 'asked', name: `پرسش ${namesOf(scene, 'asked').length + 1}`, in1: '' }),
    fields: [{ key: 'name', label: 'نام پرسش', hint: 'مثلاً «آماده است؟». شرط «پرسش» در قانون‌های دیگر با همین نام می‌پرسدش.', kind: 'check' }, ...INPUT_FIELDS],
  },
  sentence: (w) => `وقتی پرسیده می‌شود «${w.name || '؟'}»${inputs(w) ? ` (ورودی‌ها: ${inputs(w)})` : ''}؛ جواب «بله» است اگر شرط‌ها درست باشند`,
  subjects: () => ({ first: 'همان «اولی» در قانونی که پرسید', second: 'همان «دومی» در قانونی که پرسید' }),
  check: (w, { say, needVariable }) => {
    if (!w.name) say('is a question with no name.');
    for (const v of [w.in1, w.in2, w.in3]) if (v) needVariable(v);
  },
  fired: () => [],
});
