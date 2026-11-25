import { slider } from '../fields';
import { group } from '../say';
import { behaviorBlock } from '../types';

export const body = behaviorBlock({
  type: 'body',
  editor: {
    title: 'جسم فیزیکی',
    about: 'وزن دارد و از میان اشیای یک گروه رد نمی‌شود. ساده و دقیق، برای بازیکنِ بازی‌های پرشی بهترین است؛ برای جعبه و توپی که واقعاً غلت بخورد و واژگون شود، «فیزیک واقعی» را بگذار.',
    make: () => ({ type: 'body', gravity: true, solidTag: '', bounce: 0, edges: 'none', oneWay: false }),
    fields: [
      { key: 'gravity', label: 'جاذبه رویش اثر کند', kind: 'bool' },
      { key: 'solidTag', label: 'از این گروه رد نشود', hint: 'مثلاً گروه زمین یا دیوار', kind: 'tag' },
      slider('bounce', 'برگشت بعد از برخورد', 0, 1, 0.05, 'صفر یعنی می‌ایستد؛ یک یعنی با همان سرعت برمی‌گردد'),
      { key: 'edges', label: 'لبه‌های دنیا', kind: 'choice', options: [
        { value: 'none', label: 'آزاد' },
        { value: 'stop', label: 'مثل دیوار' },
        { value: 'bounce', label: 'برگرداند، مثل توپ' },
        { value: 'wrap', label: 'از آن طرف بیرون بیاید' },
      ] },
      { key: 'oneWay', label: 'سکوها یک‌طرفه باشند', hint: 'از زیر گروه بالا رد می‌شود و فقط از بالا رویش می‌ایستد؛ مثل سکوهای بازی‌های پرشی.', kind: 'bool', fallback: false, advanced: true },
      { ...slider('friction', 'اصطکاک', 0, 1, 0.05, 'بیشتر یعنی وقتی هلش دادی زودتر می‌ایستد؛ مثل جعبه روی زمین. صفر یعنی مثل یخ سُر می‌خورد. وقتی بازیکن کنترلش می‌کند اثری ندارد.'), fallback: 0, advanced: true },
      { key: 'pushable', label: 'با هل دادن جابه‌جا شود', hint: 'مثل جعبه: اگر بازیکن به آن بخورد و پشتش جا باشد، جلو می‌رود. باید در گروهی باشد که بازیکن از آن رد نمی‌شود.', kind: 'bool', fallback: false, advanced: true },
      { key: 'bumpTag', label: 'به این گروه بخورد و در آن فرو نرود', hint: 'مثلاً دشمن‌ها به بازیکن و به هم: به هم می‌خورند و آرام همدیگر را کنار می‌زنند، به جای اینکه از هم رد شوند یا روی هم جمع شوند.', kind: 'tag', fallback: '', advanced: true },
      { key: 'roll', label: 'موقع حرکت بچرخد', hint: 'مثل توپی که روی زمین قل می‌خورد. با «برخورد دایره‌ای» بهتر است.', kind: 'bool', fallback: false, advanced: true },
    ],
  },
  sentence: (b) => {
    const parts = [b.gravity ? 'وزن دارد و می‌افتد' : 'وزن ندارد'];
    if (b.solidTag) parts.push(`از ${group(b.solidTag)} رد نمی‌شود`);
    if (b.bounce > 0) parts.push('بعد از برخورد برمی‌گردد');
    if (b.pushable) parts.push('با هل دادن جابه‌جا می‌شود');
    if (b.bumpTag) parts.push(`به ${group(b.bumpTag)} می‌خورد و در آن فرو نمی‌رود`);
    return parts.join('، ');
  },
  step: (_game, _e, b, frame) => {
    frame.body = b;
  },
});
