import type { Action, Behavior, Condition, GameObject, GameProject, Place, Scene, Trigger } from '../format/types';
import { actionBlocks, triggerBlocks } from '../blocks/registry';
import { amountText, describeRef, OP_WORD, type Subjects } from '../blocks/say';

export { describeRef, type Subjects };
import { fa } from './labels';

/**
 * Rules said as plain Persian sentences, so a list of them can be read like a
 * description of the game instead of a list of settings.
 */




/** What "first" and "second" mean in a rule's actions, said in terms of its trigger. */
export function subjectsOf(scene: Scene, when: Trigger): Subjects {
  // Every trigger is a block in its own file (src/blocks/triggers/), which says itself.
  return triggerBlocks.get(when.type)?.subjects?.(when as never, { scene }) ?? {};
}

export function triggerSentence(scene: Scene, w: Trigger): string {
  return triggerBlocks.get(w.type)?.sentence(w as never, { scene }) ?? '';
}


const MATERIAL_LABEL: Record<string, string> = { wood: 'چوب', stone: 'سنگ', metal: 'فلز', ice: 'یخ', rubber: 'لاستیک', glass: 'شیشه' };

export function actionSentence(project: GameProject, scene: Scene, a: Action, subjects: Subjects): string {
  const who = (target: Place) =>
    target === 'tap' ? 'جایی که لمس شد' : target === 'first' ? (subjects.first ?? 'همان شیء') : target === 'second' ? (subjects.second ?? 'همان شیء دوم') : describeRef(scene, target);
  // Every action is a block in its own file (src/blocks/actions/), which says itself.
  return actionBlocks.get(a.type)?.sentence(a as never, { project, scene, who }) ?? '';
}

/** What one behavior makes an object do, as a short sentence. */
export function behaviorSentence(scene: Scene, b: Behavior): string {
  const group = (tag: string) => `«${tag || '؟'}»`;
  switch (b.type) {
    case 'body': {
      const parts = [b.gravity ? 'وزن دارد و می‌افتد' : 'وزن ندارد'];
      if (b.solidTag) parts.push(`از ${group(b.solidTag)} رد نمی‌شود`);
      if (b.bounce > 0) parts.push('بعد از برخورد برمی‌گردد');
      if (b.pushable) parts.push('با هل دادن جابه‌جا می‌شود');
      if (b.bumpTag) parts.push(`به ${group(b.bumpTag)} می‌خورد و در آن فرو نمی‌رود`);
      return parts.join('، ');
    }
    case 'jumper': {
      const how = b.on === 'tap' ? 'با لمس صفحه' : b.on === 'button' ? `با دکمه‌ی ${group(b.buttonTag)}` : 'وقتی قانونی بگوید';
      return `${how} می‌پرد${b.maxJumps > 1 ? `؛ تا ${fa(b.maxJumps)} بار پشت‌سرهم` : ''}`;
    }
    case 'walker':
      return b.control === 'auto' ? 'خودش به راست می‌رود' : b.control === 'halves' ? 'با لمس نیمه‌ی چپ یا راست صفحه، به همان طرف می‌رود' : 'با دکمه‌های چپ و راست حرکت می‌کند';
    case 'steer':
      return b.control === 'buttons' ? 'با چهار دکمه به هر طرف می‌رود' : b.control === 'swipe' ? 'با کشیدن انگشت به آن طرف راه می‌افتد' : 'با کشیدن انگشت روی صفحه به هر طرف می‌رود';
    case 'followFinger': return 'دنبال انگشت بازیکن می‌رود';
    case 'mover': {
      const ways = [b.vx < 0 ? 'چپ' : b.vx > 0 ? 'راست' : '', b.vy < 0 ? 'بالا' : b.vy > 0 ? 'پایین' : ''].filter(Boolean);
      return ways.length > 0 ? `با سرعت ثابت به ${ways.join(' و ')} می‌رود` : 'ساکن است';
    }
    case 'patrol': return b.axis === 'x' ? 'به چپ و راست رفت و برگشت می‌کند' : 'بالا و پایین رفت و برگشت می‌کند';
    case 'chase': {
      const what = b.away ? `از ${group(b.targetTag)} فرار می‌کند` : `دنبال ${group(b.targetTag)} می‌رود`;
      return `${what}${b.range ? `، وقتی نزدیک‌تر از ${fa(b.range)} پیکسل باشد` : ''}${b.avoidTag && !b.away ? `، و دیوارهای ${group(b.avoidTag)} را دور می‌زند` : ''}${b.sight && !b.away ? '، فقط وقتی ببیندش' : ''}`;
    }
    case 'moves': {
      const can = [b.wallJump ? 'از دیوار می‌پرد' : '', b.dash ? 'تیز می‌رود' : '', b.climbTag ? `از ${group(b.climbTag)} بالا می‌رود` : '', b.pound ? 'به زمین می‌کوبد' : '', b.crouch ? 'می‌نشیند' : ''].filter(Boolean);
      return can.length ? can.join('، ') : 'حرکت ویژه‌ای ندارد';
    }
    case 'animate': {
      const length = Math.max(0, ...b.keys.map((k) => k.t));
      return `انیمیشن ${fa(b.keys.length)} کلیدی دارد، ${fa(Math.round(length * 10) / 10)} ثانیه، ${b.repeat === 'once' ? 'یک بار' : b.repeat === 'bounce' ? 'رفت و برگشت' : 'پشت سر هم'}`;
    }
    case 'homing': return `به طرف نزدیک‌ترین ${group(b.targetTag)} می‌پیچد، مثل موشک`;
    case 'route': return `روی نشانه‌های ${group(b.tag)} راه می‌رود`;
    case 'rotate': return 'دور خودش می‌چرخد';
    case 'draggable': return 'بازیکن می‌تواند آن را با انگشت بکشد';
    case 'lifetime': return `بعد از ${fa(b.seconds)} ثانیه ناپدید می‌شود`;
    case 'spawner': {
      const names = b.prefabs.map((id) => `«${scene.prefabs.find((p) => p.id === id)?.name ?? '؟'}»`).join(' یا ');
      return `هر ${fa(b.minInterval)} تا ${fa(b.maxInterval)} ثانیه یک ${names} می‌سازد`;
    }
    case 'camera': return 'دوربین دنبالش می‌آید';
    case 'launch': return b.toward === 'tap' ? 'به طرف جایی که لمس شد پرتاب می‌شود' : b.toward === 'group' ? `به طرف ${group(b.targetTag ?? '')} پرتاب می‌شود` : 'از همان اول با سرعت راه می‌افتد';
    case 'wave': return 'آرام تاب می‌خورد';
    case 'attach': return `به ${group(b.targetTag)} می‌چسبد`;
    case 'blink': return 'چشمک می‌زند';
    case 'scrollImage': return 'عکسش پیوسته می‌لغزد';
    case 'pulse': return 'آرام بزرگ و کوچک می‌شود';
    case 'trail': return 'پشت سرش رد رنگی می‌گذارد';
    case 'particles': {
      const kinds: Record<typeof b.preset, string> = { fire: 'آتش', smoke: 'دود', rain: 'باران', snow: 'برف', sparkle: 'برق و ستاره', bubbles: 'حباب', confetti: 'کاغذ رنگی', sparks: 'جرقه', petals: 'گلبرگ', feathers: 'پَر', poison: 'حباب سم', frost: 'یخ‌زدگی', glitter: 'اکلیل', coins: 'سکه', ash: 'خاکستر', rainbow: 'رنگین‌کمان', splash: 'آب', sand: 'شن', embers: 'جرقه‌ی آتش', leaves: 'برگ پاییزی', dust: 'گرد و خاک', magic: 'ذره‌های جادویی', hearts: 'قلب', steam: 'بخار', electric: 'جرقه‌ی برق', portal: 'ذره‌های چرخان', waterfall: 'آبشار', fireflies: 'کرم شب‌تاب', stars: 'ستاره', drip: 'چکه' };
      if (b.onGroundMove) return `فقط هنگام حرکت روی زمین از آن ${kinds[b.preset]} بیرون می‌آید`;
      return b.preset === 'rain' || b.preset === 'snow' || b.preset === 'leaves' || b.preset === 'drip' || b.preset === 'petals' || b.preset === 'ash' || b.preset === 'waterfall' ? `از آن ${kinds[b.preset]} می‌بارد` : `از آن ${kinds[b.preset]} بیرون می‌آید`;
    }
    case 'light': return `در تاریکی دورش را روشن می‌کند${b.flicker ? '، مثل شعله‌ای که می‌لرزد' : ''}${b.shadowTag ? `؛ ${group(b.shadowTag)} سایه می‌اندازد` : ''}`;
    case 'field': {
      if (b.kind === 'water') return 'آب است: چیزهای فیزیکی سبک در آن شناور می‌مانند و سنگین‌ها غرق می‌شوند';
      if (b.kind === 'gravity') return b.strength === 0 ? 'منطقه‌ی بی‌وزنی است: چیزهای فیزیکی داخلش معلق می‌مانند' : `جاذبه‌ی خودش را دارد: چیزهای فیزیکی داخلش ${b.direction <= -60 && b.direction >= -120 ? 'به بالا' : 'به طرف دیگری'} می‌افتند`;
      if (b.kind === 'planet') return 'جاذبه‌ی سیاره‌ای دارد؛ اجسام نزدیک را با نیروی بیشتری به مرکز می‌کشد';
      if (b.kind === 'magnet') return b.strength >= 0 ? 'آهن‌رباست: چیزهای فیزیکی را به وسطش می‌کشد' : 'چیزهای فیزیکی را از وسطش دور می‌کند';
      return 'بادی دارد که چیزهای فیزیکی داخلش را هل می‌دهد';
    }
    case 'physics': {
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
    }
    case 'joint': {
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
    }
  }
}

/** Everything an object does or is, in plain sentences: for the top of its settings and its row in the list. */
export function describeObject(scene: Scene, object: GameObject): string[] {
  const lines = object.behaviors.map((b) => behaviorSentence(scene, b));
  if (object.visual.kind === 'tiles') lines.unshift('نقشه‌ای که با قلم رویش می‌کشی؛ هر خانه حین بازی یک تکه است');
  if (object.tags.length > 0) lines.push(`در گروه ${object.tags.map((t) => `«${t}»`).join(' و ')} است؛ قانون‌ها با این نام پیدایش می‌کنند`);
  if (object.health !== undefined) lines.push(`${fa(object.health)} جان دارد`);
  if (object.fixed) lines.push('به صفحه چسبیده و با دوربین حرکت نمی‌کند');
  if (!object.visible) lines.push('اول پنهان است تا قانونی نشانش بدهد');
  if (object.slope) lines.push('سراشیبی است؛ می‌شود رویش بالا و پایین رفت');
  return lines;
}

/** One of a rule's conditions, as the words that follow "only if". */
export function conditionSentence(scene: Scene, c: Condition, subjects: Subjects): string {
  const who = (target: Place) =>
    target === 'tap' ? 'جای لمس' : target === 'first' ? (subjects.first ?? 'همان شیء') : target === 'second' ? (subjects.second ?? 'همان شیء دوم') : describeRef(scene, target);
  const left = c.of === undefined ? c.name : `${c.name}ِ ${who(c.of)}`;
  return `${left} ${OP_WORD[c.op]} ${amountText(c.value, who)} باشد`;
}
