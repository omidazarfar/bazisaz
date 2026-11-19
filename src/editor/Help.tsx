import type { GameProject } from '../format/types';
import { Dialog } from './Pick';

/** The first steps of making a game, ticked off as they are done, and the keys and mouse moves worth knowing. */
/** The few words the editor uses everywhere, each with an example. Knowing these is most of knowing the editor. */
const WORDS: [string, string, string][] = [
  ['شیء', 'هر چیزی که در بازی دیده می‌شود.', 'بازیکن، زمین، سکه، دکمه، متن امتیاز'],
  ['نقش آماده', 'یک میان‌بر: با یک انتخاب، گروه، رفتار و قانون لازم را به یک شیء می‌دهد.', '«جایزه‌ای که امتیاز می‌دهد»'],
  ['رفتار', 'کاری که شیء خودش، بدون قانون، انجام می‌دهد.', 'پرش، حرکت چپ و راست، دنبال کردن بازیکن'],
  ['گروه', 'نامی که چند شیء با هم دارند، تا قانون‌ها و رفتارها همه‌شان را با هم پیدا کنند.', 'همه‌ی سکه‌ها در گروه «جایزه»'],
  ['قانون', 'یک جمله: «وقتی این اتفاق افتاد، این کارها را بکن».', 'وقتی بازیکن به سکه خورد، یک امتیاز اضافه کن'],
  ['مقدار', 'عددی که بازی نگه می‌دارد و می‌تواند روی صفحه نشانش بدهد.', 'score (امتیاز)، lives (جان)'],
  ['پیام', 'خبری که یک قانون به قانون‌های دیگر می‌دهد، تا کاری را که از چند جا لازم است یک بار بنویسی.', 'سه قانون باخت فقط پیام «باخت» می‌فرستند؛ یک قانون با رسیدن آن صدا پخش می‌کند و صحنه را از نو شروع می‌کند'],
  ['صحنه', 'یک صفحه یا مرحله از بازی.', 'صفحه‌ی شروع، مرحله‌ی ۱، صفحه‌ی باخت'],
  ['چیزی که حین بازی ساخته می‌شود', 'شیئی که اول در صحنه نیست و یک قانون یا «ساخت خودکار» آن را می‌سازد.', 'تیر، مانعی که پشت‌سرهم می‌آید'],
];

export function Help({ project, tried, onTutor, onClose }: { project: GameProject; tried: boolean; onTutor: () => void; onClose: () => void }) {
  const all = project.scenes.flatMap((s) => [...s.objects, ...s.prefabs]);
  const rules = project.scenes.flatMap((s) => s.rules);
  const steps: [boolean, string, string][] = [
    [all.length > 0, 'یک چیز به صحنه اضافه کن', 'دکمه‌ی «+ اضافه کردن از کتابخانه…» در ستون راست. از «عکس‌های آماده» یک شخصیت بردار.'],
    [all.some((o) => o.behaviors.length > 0), 'به آن یک نقش یا رفتار بده', 'روی شیء بزن؛ در برگه‌ی «شیء» بخش «نقش آماده» را باز کن و مثلاً «بازیکنی که با لمس صفحه می‌پرد» را انتخاب کن.'],
    [all.some((o) => o.tags.includes('زمین')), 'یک زمین بگذار', 'از کتابخانه، برگه‌ی «با نقش آماده»، «زمین یا دیوار» را اضافه کن و زیر بازیکن بکش.'],
    [rules.some((r) => r.then.length > 0), 'یک قانون بساز', 'از کتابخانه «جایزه‌ای که امتیاز می‌دهد» را اضافه کن؛ قانونش خودکار ساخته می‌شود. در برگه‌ی «قانون‌ها» می‌توانی آن را ببینی.'],
    [tried, 'بازی را امتحان کن', 'دکمه‌ی سبز «امتحان کن» زیر صفحه‌ی گوشی. موس جای انگشت است.'],
  ];
  const keys: [string, string][] = [
    ['کشیدن روی یک شیء', 'جابه‌جا کردن آن. خط‌های صورتی یعنی با چیز دیگری هم‌راستا شده.'],
    ['مربع‌های سفید گوشه‌ها', 'تغییر اندازه. عکس شکلش را نگه می‌دارد؛ با Shift آزاد می‌شود.'],
    ['کشیدن روی جای خالی', 'انتخاب همه‌ی چیزهایی که داخل کادر می‌افتند.'],
    ['Shift + کلیک', 'اضافه یا کم کردن یک شیء از انتخاب.'],
    ['چرخ موس', 'بالا و پایین بردن دید. با Shift چپ و راست می‌رود.'],
    ['Ctrl + چرخ موس', 'بزرگ و کوچک کردن دید.'],
    ['Space + کشیدن', 'جابه‌جا کردن دید با دست.'],
    ['Ctrl+Z / Ctrl+Y', 'یک قدم به عقب / جلو.'],
    ['Ctrl+C / Ctrl+V', 'کپی و چسباندن؛ در صحنه‌ی دیگر هم کار می‌کند.'],
    ['Ctrl+D', 'یک کپی از انتخاب، کنار خودش.'],
    ['Ctrl+A', 'انتخاب همه‌ی اشیای صحنه.'],
    ['Delete', 'حذف انتخاب.'],
    ['کلیدهای جهت', 'جابه‌جایی یک پیکسل؛ با Shift ده پیکسل.'],
    ['Alt هنگام کشیدن', 'بدون چسبیدن به خط‌ها و شبکه.'],
    ['Esc', 'برداشتن انتخاب، یا توقف بازی.'],
  ];
  return (
    <Dialog wide title="راهنما" about="کلمه‌هایی که ویرایشگر به کار می‌برد، قدم‌های اولین بازی، و میان‌برها." onClose={onClose}>
      <div className="pick-list">
        <button type="button" className="block help-tutor" onClick={onTutor}>شروع آموزش قدم‌به‌قدم</button>
        <h3 className="pick-group">نُه کلمه که همه‌جا می‌بینی</h3>
        <dl className="words">
          {WORDS.map(([word, what, example]) => (
            <div key={word}>
              <dt>{word}</dt>
              <dd>
                {what}
                <small>مثال: {example}</small>
              </dd>
            </div>
          ))}
        </dl>
        <h3 className="pick-group">قدم‌های اولین بازی</h3>
        <ol className="steps">
          {steps.map(([done, title, how]) => (
            <li key={title} className={done ? 'step step-done' : 'step'}>
              <strong>{done ? '✓ ' : ''}{title}</strong>
              <span>{how}</span>
            </li>
          ))}
        </ol>
        <h3 className="pick-group">موس و صفحه‌کلید</h3>
        <dl className="keys">
          {keys.map(([key, what]) => (
            <div key={key}>
              <dt><bdi>{key}</bdi></dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Dialog>
  );
}
