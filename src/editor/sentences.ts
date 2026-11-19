import type { Action, Amount, Behavior, Comparison, Condition, GameObject, GameProject, Place, Ref, Scene, Trigger } from '../format/types';
import { ACTIONS, fa, LOOK_OPTIONS, SOUND_LABEL } from './labels';

/**
 * Rules said as plain Persian sentences, so a list of them can be read like a
 * description of the game instead of a list of settings.
 */

export interface Subjects {
  first?: string;
  second?: string;
}

const OP_WORD: Record<Comparison, string> = { '>=': 'دست‌کم', '<=': 'حداکثر', '==': 'برابر', '!=': 'نابرابر با', '>': 'بیشتر از', '<': 'کمتر از' };

export function describeRef(scene: Scene, ref: Ref): string {
  if (ref.by === 'tag') {
    if (!ref.tag) return 'گروهی که هنوز انتخاب نشده';
    const narrowed = ref.where ? ` که ${ref.where.name} آن ${OP_WORD[ref.where.op]} ${fa(ref.where.value)} است` : '';
    const spots = { home: ' که سر جای اولش است', away: ' که از جای اولش رفته', on: ` که روی گروه «${ref.spot?.tag ?? ''}» است`, off: ` که روی گروه «${ref.spot?.tag ?? ''}» نیست` };
    return `${ref.pick === 'random' ? 'یکی تصادفی' : 'چیزی'} از گروه «${ref.tag}»${narrowed}${ref.spot ? spots[ref.spot.is] : ''}`;
  }
  const object = [...scene.objects, ...scene.prefabs].find((o) => o.id === ref.id);
  return `«${object?.name ?? '؟'}»`;
}

/** What "first" and "second" mean in a rule's actions, said in terms of its trigger. */
export function subjectsOf(scene: Scene, when: Trigger): Subjects {
  if (when.type === 'touch') return { first: `همان اولی (${describeRef(scene, when.a)})`, second: `همان دومی (${describeRef(scene, when.b)})` };
  if (when.type === 'tapObject') return { first: 'همان که رویش زده شد' };
  if (when.type === 'offscreen') return { first: 'همان که بیرون رفت' };
  if (when.type === 'dead') return { first: 'همان که جانش تمام شد' };
  if (when.type === 'value') return { first: 'همان که مقدارش عوض شد' };
  if (when.type === 'line') return { first: 'هر کدام از آن‌ها که در خط‌اند' };
  if (when.type === 'land') return { first: 'همان که فرود آمد', second: 'همان که رویش فرود آمد' };
  if (when.type === 'near') return { first: `همان اولی (${describeRef(scene, when.a)})`, second: `همان دومی (${describeRef(scene, when.b)})` };
  if (when.type === 'eachEvery') return { first: 'همان که ساعتش رسید' };
  if (when.type === 'thrown') return { first: 'همان که پرتاب شد' };
  if (when.type === 'rest') return { first: 'همان که ایستاد' };
  if (when.type === 'snap') return { first: 'همان که اتصالش پاره شد', second: 'همان که به آن وصل بود' };
  if (when.type === 'message') return { first: 'همان «اولی» در قانونی که پیام را فرستاد', second: 'همان «دومی» در قانونی که پیام را فرستاد' };
  if (when.type === 'useItem') return { first: 'کوله‌پشتی' };
  if (when.type === 'useItemOn') return { first: `همان که وسیله رویش کشیده شد (${describeRef(scene, when.target)})` };
  if (when.type === 'hit') return { first: `همان اولی (${describeRef(scene, when.a)})`, second: `همان که به آن خورد (${describeRef(scene, when.b)})` };
  return {};
}

export function triggerSentence(scene: Scene, w: Trigger): string {
  const way = { right: 'راست', left: 'چپ', up: 'بالا', down: 'پایین' } as const;
  switch (w.type) {
    case 'start': return 'وقتی صحنه شروع می‌شود';
    case 'tap': return 'وقتی صفحه لمس می‌شود';
    case 'holding': return 'تا وقتی صفحه لمس است';
    case 'swipe': return `وقتی صفحه به ${way[w.direction]} کشیده می‌شود`;
    case 'tapObject': return `وقتی روی ${describeRef(scene, w.target)} زده می‌شود`;
    case 'touch': return `وقتی ${describeRef(scene, w.a)} به ${describeRef(scene, w.b)} می‌خورد`;
    case 'every': return `هر ${fa(w.seconds)} ثانیه`;
    case 'after': return `${fa(w.seconds)} ثانیه بعد از شروع صحنه`;
    case 'offscreen': return `وقتی ${describeRef(scene, w.target)} از صفحه بیرون می‌رود`;
    case 'variable': return `وقتی ${w.name} ${OP_WORD[w.op]} ${fa(w.value)} می‌شود`;
    case 'value': return `وقتی ${w.name} در ${describeRef(scene, w.target)} ${OP_WORD[w.op]} ${fa(w.value)} می‌شود`;
    case 'line': return `وقتی ${fa(w.length)} تا از ${describeRef(scene, w.target)}${w.name ? ` با ${w.name} یکسان` : ''} در یک خط ردیف می‌شوند`;
    case 'noneLeft': return `وقتی دیگر ${describeRef(scene, w.target)} نمانده`;
    case 'dead': return `وقتی جان ${describeRef(scene, w.target)} تمام می‌شود`;
    case 'reward': return 'وقتی بازیکن تبلیغ جایزه‌ای را تا آخر دید';
    case 'land': return `وقتی ${describeRef(scene, w.target)} روی چیزی فرود می‌آید`;
    case 'near': return w.leave
      ? `وقتی ${describeRef(scene, w.a)} از ${describeRef(scene, w.b)} بیش از ${fa(w.distance)} پیکسل دور می‌شود`
      : `وقتی ${describeRef(scene, w.a)} به ${describeRef(scene, w.b)} نزدیک‌تر از ${fa(w.distance)} پیکسل می‌شود`;
    case 'eachEvery': return `هر ${fa(w.seconds)} ثانیه، برای هر ${describeRef(scene, w.target)} جدا`;
    case 'message': return `وقتی پیام «${w.name || '؟'}» می‌رسد`;
    case 'thrown': return `وقتی ${describeRef(scene, w.target)} پرتاب می‌شود`;
    case 'rest': return `وقتی ${describeRef(scene, w.target)} از حرکت می‌ایستد`;
    case 'snap': return `وقتی اتصال ${describeRef(scene, w.target)} پاره می‌شود`;
    case 'hit': return `وقتی ${describeRef(scene, w.a)} محکم به ${describeRef(scene, w.b)} می‌خورد (دست‌کم ${fa(w.speed)} پیکسل در ثانیه)`;
    case 'useItem': return `وقتی بازیکن ${w.item || '؟'} را در کوله‌پشتی لمس می‌کند`;
    case 'useItemOn': return `وقتی بازیکن ${w.item || '؟'} را از کوله‌پشتی روی ${describeRef(scene, w.target)} می‌کشد`;
  }
}

function amountText(amount: Amount, who: (target: Place) => string = () => 'شیء'): string {
  if (typeof amount === 'number') return fa(amount);
  if ('value' in amount) return `${amount.value}ِ ${who(amount.of)}`;
  if ('count' in amount) return `تعداد اشیای گروه «${amount.count}»`;
  return 'random' in amount ? `عددی تصادفی از ${fa(amount.random[0])} تا ${fa(amount.random[1])}` : `مقدار ${amount.variable}`;
}

export function actionSentence(project: GameProject, scene: Scene, a: Action, subjects: Subjects): string {
  const who = (target: Place) =>
    target === 'tap' ? 'جایی که لمس شد' : target === 'first' ? (subjects.first ?? 'همان شیء') : target === 'second' ? (subjects.second ?? 'همان شیء دوم') : describeRef(scene, target);
  switch (a.type) {
    case 'setValue': {
      const n = amountText(a.amount, who);
      const what = `${a.name}ِ ${who(a.target)}`;
      if (a.op === 'multiply') return `${what} را در ${n} ضرب کن`;
      return a.op === 'set' ? `${what} را برابر ${n} بگذار` : a.op === 'add' ? `${what} را ${n} تا زیاد کن` : `${what} را ${n} تا کم کن`;
    }
    case 'shuffle': return a.target.by === 'tag' ? `جای اشیای گروه «${a.target.tag}» را بُر بزن` : `جای ${describeRef(scene, a.target)} را بُر بزن`;
    case 'swap': return `جای ${who(a.target)} و ${who(a.other)} را${a.near ? '، اگر کنار هم‌اند،' : ''} با هم عوض کن`;
    case 'settle': return a.target.by === 'tag' ? `مهره‌های گروه «${a.target.tag}» را پایین بریز و جای خالی را پر کن` : 'صفحه را پر کن';
    case 'slideAll': return `همه‌ی مهره‌های ${a.target.by === 'tag' ? `گروه «${a.target.tag}»` : describeRef(scene, a.target)} را به ${{ left: 'چپ', right: 'راست', up: 'بالا', down: 'پایین' }[a.direction]} سُر بده`;
    case 'step': return `${who(a.target)} را یک خانه به ${{ left: 'چپ', right: 'راست', up: 'بالا', down: 'پایین' }[a.direction]} ببر`;
    case 'setVariable': {
      const n = amountText(a.amount, who);
      if (a.op === 'add') return `${a.name} را ${n} تا زیاد کن`;
      if (a.op === 'subtract') return `${a.name} را ${n} تا کم کن`;
      if (a.op === 'set') return `${a.name} را برابر ${n} بگذار`;
      if (a.op === 'multiply') return `${a.name} را در ${n} ضرب کن`;
      if (a.op === 'divide') return `${a.name} را بر ${n} تقسیم کن`;
      return `اگر ${n} بیشتر بود، ${a.name} را برابرش بگذار`;
    }
    case 'resetVariables': return 'همه‌ی مقدارها را از نو کن';
    case 'give': return `${a.amount === 1 ? 'یک' : fa(a.amount)} ${a.item || '؟'} به کوله‌پشتی بده${a.from !== undefined ? ` (از روی ${who(a.from)} پرواز کند)` : ''}`;
    case 'take': return `${a.amount === 1 ? 'یک' : fa(a.amount)} ${a.item || '؟'} از کوله‌پشتی بردار`;
    case 'destroy': return `${who(a.target)} را حذف کن`;
    case 'spawn': return `یک «${scene.prefabs.find((p) => p.id === a.prefab)?.name ?? '؟'}» روی ${who(a.at)} بساز`;
    case 'show': return `${who(a.target)} را نشان بده`;
    case 'hide': return `${who(a.target)} را پنهان کن`;
    case 'moveTo': return `${who(a.target)} را به نقطه‌ی (${fa(a.x)}، ${fa(a.y)}) ببر`;
    case 'glide': return `${who(a.target)} را نرم به نقطه‌ی (${fa(a.x)}، ${fa(a.y)}) ببر`;
    case 'moveBy': return `${who(a.target)} را جابه‌جا کن`;
    case 'moveRandom': return `${who(a.target)} را به جایی تصادفی ببر`;
    case 'wait': return `${fa(a.seconds)} ثانیه صبر کن`;
    case 'push': return `${who(a.target)} را هل بده`;
    case 'kick': return `به ${who(a.target)} ضربه بزن`;
    case 'spin': return `${who(a.target)} را به چرخش بینداز`;
    case 'cut': return `اتصال‌های ${who(a.target)} را ببُر`;
    case 'setPhysics': return a.kind === 'moving' ? `${who(a.target)} را رها کن تا بیفتد` : `${who(a.target)} را همان‌جا محکم کن`;
    case 'blast': return `روی ${who(a.at)} انفجار کن و اشیای فیزیکی دور و برش را پرت کن`;
    case 'jump': return `${who(a.target)} را بپران`;
    case 'goToScene': return `به صحنه‌ی «${project.scenes.find((s) => s.id === a.scene)?.name ?? '؟'}» برو`;
    case 'restartScene': return 'صحنه را از اول شروع کن';
    case 'nextScene': return 'به صحنه‌ی بعد برو';
    case 'setLook': return `حال و هوای تصویر را «${LOOK_OPTIONS.find((o) => o.value === a.look)?.label ?? a.look}» کن`;
    case 'setDarkness': return a.amount <= 0.01 ? 'صحنه را روشن کن' : `صحنه را ${a.amount >= 0.99 ? 'کاملاً' : 'کمی'} تاریک کن`;
    case 'send': return `پیام «${a.name || '؟'}» را بفرست`;
    case 'playSound': {
      const own = project.assets[a.sound];
      return `صدای «${own?.type === 'sound' ? own.name : (SOUND_LABEL[a.sound as keyof typeof SOUND_LABEL] ?? a.sound)}» را پخش کن`;
    }
    case 'burst': return `از ${who(a.target)} جرقه بپران`;
    case 'shake': return 'صفحه را بلرزان';
    case 'effect': return `${who(a.target)}: ${ACTIONS.effect.fields.flatMap((f) => (f.kind === 'choice' ? f.options : [])).find((o) => o.value === a.kind)?.label ?? ''}`;
    case 'damage': return `از جان ${who(a.target)} ${fa(a.amount)} تا کم کن`;
    case 'pause': return 'بازی را نگه دار';
    case 'resume': return 'بازی را ادامه بده';
    case 'setSound': return a.on ? 'صدا را روشن کن' : 'صدا را خاموش کن';
    case 'vibrate': return 'گوشی را بلرزان';
    case 'setGravity': return `جاذبه را ${fa(a.amount)} کن`;
    case 'showAd': return 'تبلیغ تمام‌صفحه نشان بده';
    case 'showRewardedAd': return 'تبلیغ جایزه‌ای پیشنهاد بده';
    case 'setColor': return `رنگ ${who(a.target)} را عوض کن`;
    case 'setImage': return `عکس ${who(a.target)} را عوض کن`;
    case 'setText': return `متن ${who(a.target)} را «${a.text}» کن`;
    case 'resize': return `اندازه‌ی ${who(a.target)} را ${fa(a.width)} در ${fa(a.height)} کن`;
    case 'turn': return a.op === 'set' ? `${who(a.target)} را به زاویه‌ی ${fa(a.degrees)} درجه بچرخان` : `${who(a.target)} را ${fa(a.degrees)} درجه بچرخان`;
    case 'setOpacity': return `پررنگی ${who(a.target)} را ${fa(a.opacity)} کن`;
    case 'flash': return `${who(a.target)} را یک لحظه بدرخشان`;
    case 'layer': return a.to === 'front' ? `${who(a.target)} را جلوی همه بیاور` : `${who(a.target)} را پشت همه ببر`;
    case 'playMusic': {
      const own = project.assets[a.music];
      return own?.type === 'sound' ? `موسیقی «${own.name}» را پخش کن` : 'موسیقی را قطع کن';
    }
    case 'zoom': return `دوربین را ${fa(a.amount)} برابر نزدیک کن`;
  }
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
      return `${what}${b.range ? `، وقتی نزدیک‌تر از ${fa(b.range)} پیکسل باشد` : ''}${b.avoidTag && !b.away ? `، و دیوارهای ${group(b.avoidTag)} را دور می‌زند` : ''}`;
    }
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
      const kinds = { fire: 'آتش', smoke: 'دود', rain: 'باران', snow: 'برف', sparkle: 'برق و ستاره', bubbles: 'حباب', confetti: 'کاغذ رنگی' };
      return b.preset === 'rain' || b.preset === 'snow' ? `از آن ${kinds[b.preset]} می‌بارد` : `از آن ${kinds[b.preset]} بیرون می‌آید`;
    }
    case 'light': return `در تاریکی دورش را روشن می‌کند${b.flicker ? '، مثل شعله‌ای که می‌لرزد' : ''}`;
    case 'field': {
      if (b.kind === 'water') return 'آب است: چیزهای فیزیکی سبک در آن شناور می‌مانند و سنگین‌ها غرق می‌شوند';
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
      if (b.kind === 'wheel') return `چرخی است با کمک‌فنر، وصل به نزدیک‌ترین ${to}${b.motor ? '، با موتور' : ''}`;
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
