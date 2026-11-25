import { custom, groundTag, moving, slider } from '../fields';
import { group, MATERIAL_LABEL } from '../say';
import { behaviorBlock } from '../types';

export const physics = behaviorBlock({
  type: 'physics',
  editor: {
    title: 'فیزیک واقعی',
    about: 'مثل دنیای واقعی می‌افتد، غلت می‌خورد، روی بقیه می‌ایستد و آن‌ها را می‌اندازد؛ با شکل واقعی‌اش، حتی وقتی کج است. برای جعبه، توپ، برج و پرتاب با کمان. هر دو شیئی که این را دارند به هم می‌خورند.',
    make: (ctx) => ({ type: 'physics', kind: 'moving', solidTag: groundTag(ctx), bounce: 0.2, friction: 0.5, weight: 1, rotates: true, gravity: true, slowdown: 0, edges: true, drag: 'none', power: 8, reload: true }),
    fields: [
      { key: 'kind', label: 'حرکت می‌کند؟', kind: 'choice', options: [
        { value: 'moving', label: 'بله، می‌افتد و غلت می‌خورد' },
        { value: 'still', label: 'نه، محکم سر جایش است (زمین، دیوار، میله‌ی چرخان)' },
      ] },
      { key: 'solidTag', label: 'روی این گروه هم بایستد', hint: 'اشیای این گروه فیزیک ندارند، ولی مثل زمین و دیوار جلویش را می‌گیرند؛ مثلاً گروه زمین یا نقشه‌ی خانه‌ای. خالی یعنی فقط به اشیای فیزیکی می‌خورد.', kind: 'tag', showIf: moving },
      { ...slider('bounce', 'برگشت بعد از برخورد', 0, 1, 0.05, 'صفر یعنی می‌ایستد؛ یک یعنی مثل توپ لاستیکی همان‌قدر بالا برمی‌گردد.'), showIf: custom },
      { ...slider('friction', 'زبری', 0, 1, 0.05, 'صفر یعنی مثل یخ سُر می‌خورد؛ یک یعنی مثل لاستیک می‌چسبد و غلت می‌خورد.'), showIf: custom },
      { key: 'edges', label: 'لبه‌های دنیا دیوار باشند', hint: 'وگرنه می‌تواند از دنیا بیرون بیفتد.', kind: 'bool', fallback: false, showIf: moving },
      { key: 'drag', label: 'با انگشت', kind: 'choice', fallback: 'none', showIf: moving, options: [
        { value: 'none', label: 'کاری نمی‌شود کرد' },
        { value: 'grab', label: 'برداشتن و جابه‌جا کردن' },
        { value: 'sling', label: 'عقب کشیدن و پرتاب، مثل تیرکمان' },
      ] },
      { ...slider('power', 'قدرت پرتاب', 2, 20, 0.5, 'بیشتر یعنی با همان عقب کشیدن دورتر می‌رود. نقطه‌های سفید موقع کشیدن نشان می‌دهند کجا می‌رود.'), fallback: 8, showIf: (v) => moving(v) && v.drag === 'sling' },
      { key: 'reload', label: 'در تیرکمان منتظر بماند و برگردد', hint: 'روشن: همان‌جا که گذاشتی در هوا منتظر می‌ماند و نمی‌افتد؛ بعد از هر پرتاب، وقتی ایستاد یا از دنیا بیرون رفت، به همان‌جا برمی‌گردد. خاموش: می‌افتد و هر جا ایستاد از همان‌جا دوباره کشیده می‌شود.', kind: 'bool', fallback: true, showIf: (v) => moving(v) && v.drag === 'sling' },
      { ...slider('surfaceSpeed', 'تسمه‌ی نقاله', -600, 600, 10, 'چیزهایی که رویش هستند با این سرعت به راست (یا با عدد منفی به چپ) برده می‌شوند. صفر یعنی معمولی.', 'پیکسل در ثانیه'), fallback: 0, showIf: (v) => v.kind === 'still' },
      { key: 'oneWay', label: 'از زیر بشود ردش شد', hint: 'مثل سکوهای بازی‌های پرشی: چیزها از زیر بالا می‌آیند و فقط از بالا رویش می‌ایستند.', kind: 'bool', fallback: false, showIf: (v) => v.kind === 'still' },
      { key: 'material', label: 'جنس', hint: 'با یک انتخاب، زبری، برگشت، سنگینی و صدای برخوردش مثل همان جنس واقعی می‌شود. «دلخواه» یعنی خودت تنظیم کنی.', kind: 'choice', fallback: 'custom', options: [
        { value: 'custom', label: 'دلخواه' },
        { value: 'wood', label: 'چوب' },
        { value: 'stone', label: 'سنگ' },
        { value: 'metal', label: 'فلز' },
        { value: 'ice', label: 'یخ (لیز)' },
        { value: 'rubber', label: 'لاستیک (فنری)' },
        { value: 'glass', label: 'شیشه' },
      ] },
      { key: 'shape', label: 'شکل برخورد', hint: 'با چه شکلی به بقیه می‌خورد. «دور عکس» یعنی دقیقاً همان‌جا که عکس کشیده شده، نه گوشه‌های جعبه‌ی دورش؛ برای سنگ، موجود و هر عکس نامنظم. «کپسول» گوشه‌ی تیز ندارد و به لبه‌ها گیر نمی‌کند؛ برای شخصیت یا کُنده‌ی درخت.', kind: 'choice', fallback: 'auto', options: [
        { value: 'auto', label: 'خودکار: جعبه، یا دایره اگر گرد است' },
        { value: 'outline', label: 'دور عکس (دقیق)' },
        { value: 'capsule', label: 'کپسول: دو سر گرد' },
        { value: 'triangle', label: 'مثلث' },
        { value: 'hexagon', label: 'شش‌ضلعی' },
      ] },
      { ...slider('propeller', 'رانش ملخ در آب', 0, 3000, 50, 'با کلید راست یا لمس نیمه‌ی راست روی آب جلو می‌رود و با چپ عقب می‌آید.'), fallback: 0, showIf: moving },
      { ...slider('breaks', 'بشکند با ضربه‌ی', 0, 2000, 50, 'اگر محکم‌تر از این بخورد، تکه‌تکه می‌شود و تکه‌ها پخش می‌شوند؛ مثل شیشه یا جعبه‌ی ترد. صفر یعنی هیچ‌وقت نمی‌شکند. حدود ۴۰۰ یعنی با یک ضربه‌ی معمولی.', 'پیکسل در ثانیه'), fallback: 0 },
      { key: 'passTag', label: 'از این گروه رد شود', hint: 'به اشیای این گروه نمی‌خورد و از میانشان رد می‌شود؛ مثلاً تیرهای خود بازیکن، یا دشمن‌هایی که از هم رد می‌شوند.', kind: 'tag', fallback: '', advanced: true },
      { ...slider('weight', 'سنگینی', 0.1, 10, 0.1, 'یک معمولی است. سنگین‌تر بقیه را محکم‌تر هل می‌دهد و سخت‌تر جابه‌جا می‌شود.'), fallback: 1, advanced: true, showIf: (v) => moving(v) && custom(v) },
      { key: 'rotates', label: 'بتواند بچرخد و واژگون شود', hint: 'برای شخصیت بازی خاموشش کن تا همیشه سرپا بماند.', kind: 'bool', fallback: true, advanced: true, showIf: moving },
      { key: 'gravity', label: 'جاذبه رویش اثر کند', hint: 'خاموش برای فضا، یا میز بیلیارد که از بالا دیده می‌شود.', kind: 'bool', fallback: true, advanced: true, showIf: moving },
      { ...slider('slowdown', 'کند شدن خودبه‌خود', 0, 1, 0.05, 'مثل هوای غلیظ یا پارچه‌ی میز بیلیارد. صفر یعنی هیچ.'), fallback: 0, advanced: true, showIf: moving },
    ],
  },
  sentence: (b) => {
    if (b.kind === 'still') {
      const extra = [b.surfaceSpeed ? 'مثل تسمه‌ی نقاله چیزهای رویش را می‌برد' : '', b.oneWay ? 'از زیرش می‌شود رد شد' : ''].filter(Boolean);
      return `فیزیک واقعی دارد ولی محکم سر جایش است؛ چیزهای فیزیکی رویش می‌ایستند${extra.length ? `، ${extra.join('، ')}` : ''}`;
    }
    const parts = [b.gravity === false ? 'در فضا شناور است و با ضربه حرکت می‌کند' : 'مثل دنیای واقعی می‌افتد و غلت می‌خورد'];
    if (b.solidTag) parts.push(`روی ${group(b.solidTag)} می‌ایستد`);
    if (b.material && b.material !== 'custom') parts.push(`جنسش ${MATERIAL_LABEL[b.material]} است`);
    if (b.breaks) parts.push('با ضربه‌ی محکم می‌شکند');
    if (b.shape && b.shape !== 'auto') parts.push({ outline: 'دقیقاً با شکل عکسش به چیزها می‌خورد', capsule: 'شکل کپسولی دارد و به لبه‌ها گیر نمی‌کند', triangle: 'مثل مثلث به چیزها می‌خورد', hexagon: 'مثل شش‌ضلعی به چیزها می‌خورد' }[b.shape]);
    if (b.passTag) parts.push(`از ${group(b.passTag)} رد می‌شود`);
    if (b.bounce >= 0.5) parts.push('بعد از برخورد بالا می‌پرد');
    if (!b.rotates) parts.push('همیشه سرپا می‌ماند');
    if (b.drag === 'grab') parts.push('بازیکن می‌تواند برش دارد و جابه‌جایش کند');
    if (b.drag === 'sling') parts.push(b.reload === false ? 'بازیکن عقب می‌کشدش و رها می‌کند تا پرتاب شود، مثل تیرکمان' : 'در هوا منتظر می‌ماند تا بازیکن مثل تیرکمان عقب بکشد و رها کند، و بعد از هر پرتاب به همان‌جا برمی‌گردد');
    return parts.join('، ');
  },
  check: (b, { object, say }) => {
    if (!(b.weight > 0)) say(`"${object.id}" needs a weight above zero.`);
  },
});
