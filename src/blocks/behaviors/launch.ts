import { slider, SPEED } from '../fields';
import { group } from '../say';
import { behaviorBlock } from '../types';

export const launch = behaviorBlock({
  type: 'launch',
  editor: {
    title: 'شروع با سرعت',
    about: 'از لحظه‌ای که ساخته می‌شود حرکت می‌کند؛ مثل توپی که پرتاب شده. با «جسم فیزیکی» از دیوارها برمی‌گردد.',
    make: () => ({ type: 'launch', vx: 300, vy: -300, toward: 'fixed', targetTag: '', speed: 600, face: false }),
    fields: [
      { key: 'toward', label: 'به کدام طرف', kind: 'choice', fallback: 'fixed', options: [
        { value: 'fixed', label: 'جهت ثابت' },
        { value: 'tap', label: 'جایی که لمس شد' },
        { value: 'group', label: 'نزدیک‌ترین شیء یک گروه' },
      ] },
      { ...SPEED('vx', 'سرعت افقی', 'منفی یعنی به چپ'), showIf: (v) => (v.toward ?? 'fixed') === 'fixed' },
      { ...SPEED('vy', 'سرعت عمودی', 'منفی یعنی به بالا'), showIf: (v) => (v.toward ?? 'fixed') === 'fixed' },
      { key: 'targetTag', label: 'به طرف این گروه', kind: 'tag', fallback: '', showIf: (v) => v.toward === 'group' },
      { ...slider('speed', 'سرعت', 50, 2000, 10), fallback: 600, showIf: (v) => (v.toward ?? 'fixed') !== 'fixed' },
      { key: 'face', label: 'رو به جهت حرکت بچرخد', hint: 'برای تیر و موشک. عکس را رو به راست بکش.', kind: 'bool', fallback: false, advanced: true },
    ],
  },
  sentence: (b) => b.toward === 'tap' ? 'به طرف جایی که لمس شد پرتاب می‌شود' : b.toward === 'group' ? `به طرف ${group(b.targetTag ?? '')} پرتاب می‌شود` : 'از همان اول با سرعت راه می‌افتد',
});
