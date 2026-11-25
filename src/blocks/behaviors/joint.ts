import { slider } from '../fields';
import { group } from '../say';
import { behaviorBlock } from '../types';

export const joint = behaviorBlock({
  type: 'joint',
  editor: {
    title: 'اتصال',
    about: 'این شیء را به نزدیک‌ترین شیء یک گروه وصل می‌کند: با لولا (مثل چرخ ماشین یا در)، طناب، فنر یا جوش. «فیزیک واقعی» لازم دارد؛ اگر آن یکی فیزیک نداشت، مثل میخ سر جایش می‌ماند.',
    make: () => ({ type: 'joint', kind: 'hinge', targetTag: '', at: 'self', motor: 0 }),
    fields: [
      { key: 'kind', label: 'چه جور اتصالی', kind: 'choice', options: [
        { value: 'hinge', label: 'لولا: دور یک نقطه می‌چرخد' },
        { value: 'wheel', label: 'چرخ با کمک‌فنر، برای ماشین' },
        { value: 'slider', label: 'ریل: روی یک خط می‌لغزد، مثل آسانسور' },
        { value: 'rope', label: 'طناب: دورتر نمی‌رود' },
        { value: 'spring', label: 'فنر: کش می‌آید و برمی‌گردد' },
        { value: 'weld', label: 'جوش: محکم به هم می‌چسبند' },
        { value: 'gear', label: 'چرخ‌دنده: با چرخ یا ریل دیگری با هم می‌چرخند' },
      ] },
      { key: 'belt', label: 'هم‌جهت بچرخند، مثل زنجیر دوچرخه', hint: 'خاموش: مثل دنده‌هایی که در هم رفته‌اند، برعکس هم می‌چرخند. چرخ‌دنده‌ی بزرگ‌تر آهسته‌تر می‌چرخد. هر دو شیء باید «لولا» هم داشته باشند (یا آن یکی «ریل»، مثل دنده‌ی شانه‌ای آسانسور).', kind: 'bool', fallback: false, showIf: (v) => v.kind === 'gear' },
      { key: 'targetTag', label: 'به نزدیک‌ترین شیء این گروه', kind: 'tag' },
      { key: 'at', label: 'میخ کجا باشد', kind: 'choice', fallback: 'self', showIf: (v) => v.kind === 'hinge' || v.kind === 'weld', options: [
        { value: 'self', label: 'وسط همین شیء، مثل چرخ' },
        { value: 'other', label: 'وسط آن یکی، مثل آونگی که از میخ آویزان است' },
        { value: 'between', label: 'وسط این دو، مثل حلقه‌های زنجیر یا تخته‌های پل' },
      ] },
      { ...slider('motor', 'موتور', -720, 720, 10, 'خودش می‌چرخد، مثل چرخ ماشین. مثبت یعنی در جهت عقربه‌های ساعت. صفر یعنی موتور ندارد.', 'درجه در ثانیه'), fallback: 0, showIf: (v) => v.kind === 'hinge' || v.kind === 'wheel' },
      { key: 'drive', label: 'چه کسی موتور را روشن می‌کند', hint: 'بازیکن: مثل پدال گاز ماشین؛ با لمس نیمه‌ی راست صفحه (یا کلید راست) جلو می‌رود و با نیمه‌ی چپ عقب. رها کند، چرخ آزاد می‌چرخد.', kind: 'choice', fallback: 'always', showIf: (v) => (v.kind === 'hinge' || v.kind === 'wheel') && Boolean(v.motor), options: [
        { value: 'always', label: 'همیشه روشن است' },
        { value: 'player', label: 'بازیکن، مثل پدال گاز' },
      ] },
      { ...slider('limit', 'تا کجا بچرخد', 0, 180, 5, 'از هر طرف چند درجه؛ مثل دری که فقط تا یک جا باز می‌شود. صفر یعنی آزاد.', 'درجه'), fallback: 0, showIf: (v) => v.kind === 'hinge' },
      { ...slider('axis', 'جهت ریل', -90, 90, 5, 'صفر یعنی چپ و راست، ۹۰ یعنی بالا و پایین، عددهای وسط یعنی کج.', 'درجه'), fallback: 0, showIf: (v) => v.kind === 'slider' },
      { ...slider('range', 'تا کجا برود', 0, 1500, 10, 'از هر طرف چند پیکسل. با موتور، بین دو سر رفت و برگشت می‌کند. صفر یعنی بی‌انتها.', 'پیکسل'), fallback: 0, showIf: (v) => v.kind === 'slider' },
      { ...slider('motor', 'موتور', -800, 800, 10, 'خودش روی ریل حرکت می‌کند. صفر یعنی موتور ندارد.', 'پیکسل در ثانیه'), fallback: 0, showIf: (v) => v.kind === 'slider' },
      { ...slider('strength', 'استحکام', 0, 50, 0.5, 'اگر بیشتر از این‌قدر برابرِ وزن خودِ شیء کشیده شود، پاره می‌شود؛ مثل طنابی که زیر بار می‌بُرد. صفر یعنی هیچ‌وقت پاره نمی‌شود.'), fallback: 0, advanced: true },
    ],
  },
  sentence: (b) => {
    const to = group(b.targetTag);
    if (b.kind === 'rope') return `با طناب به نزدیک‌ترین ${to} بسته شده`;
    if (b.kind === 'spring') return `با فنر به نزدیک‌ترین ${to} وصل است`;
    if (b.kind === 'weld') return `به نزدیک‌ترین ${to} جوش خورده`;
    if (b.kind === 'wheel') return `چرخی است با کمک‌فنر، وصل به نزدیک‌ترین ${to}${b.motor ? '، با موتور' : ''}${b.motor && b.drive === 'player' ? ' که بازیکن مثل پدال گاز روشنش می‌کند' : ''}`;
    if (b.kind === 'gear') return `چرخ‌دنده است و با نزدیک‌ترین ${to} ${b.belt ? 'هم‌جهت' : 'برعکس'} می‌چرخد`;
    if (b.kind === 'slider') return `روی ریلی کنار نزدیک‌ترین ${to} می‌لغزد${b.motor && b.range ? '، و خودش رفت و برگشت می‌کند' : ''}`;
    if (b.at === 'between') return `با لولا به نزدیک‌ترین ${to} وصل است، مثل حلقه‌ی زنجیر`;
    const pin = b.at === 'other' ? `دور وسط نزدیک‌ترین ${to} می‌چرخد، مثل آونگ` : `با لولا به نزدیک‌ترین ${to} وصل است و دور وسط خودش می‌چرخد، مثل چرخ`;
    return `${pin}${b.motor ? '؛ موتور دارد و خودش می‌چرخد' : ''}`;
  },
});
