import { startTween, readProperty, type TweenProperty } from '../../runtime/tweens';
import { fa, firstRef, slider, TARGET } from '../fields';
import { amountText } from '../say';
import { actionBlock } from '../types';
import { EASE_OPTIONS } from './glide';

// Tween any number (roadmap item 1, 2026-11-27): see src/runtime/tweens.ts.
declare module '../../format/types' {
  interface MoreActions {
    tween: {
      type: 'tween';
      target: Target;
      property: TweenProperty;
      /** For "value": which of the object's own values. */
      value?: string;
      /** For "variable": which game value. */
      variable?: string;
      /** "to": to `amount`; "by": `amount` added to what it is. A number, or (item 3) a value, such as a custom behavior's setting. */
      mode: 'to' | 'by';
      amount: Amount;
      seconds: number;
      ease?: Ease;
      /** Rounds in all; 0 for ever. */
      times?: number;
      /** There and back each round. */
      yoyo?: boolean;
      /** A name for "a tween finished" to tell tweens apart. */
      label?: string;
    };
  }
}

const PROPERTY_LABEL: Record<TweenProperty, string> = {
  x: 'فاصله از چپ',
  y: 'فاصله از بالا',
  width: 'پهنا',
  height: 'بلندی',
  angle: 'زاویه (درجه)',
  opacity: 'پررنگی (۰ تا ۱)',
  scale: 'بزرگی (۱ یعنی اندازه‌ی خودش)',
  value: 'یکی از مقدارهای خود شیء',
  variable: 'یک مقدار بازی',
};
/** The number's name in a sentence, without what is in brackets. */
const shortName = (p: TweenProperty) => PROPERTY_LABEL[p].replace(/ \(.*\)$/, '');

export const tween = actionBlock({
  type: 'tween',
  editor: {
    title: 'تغییر نرم یک عدد',
    short: 'هر عددِ یک شیء (جا، اندازه، زاویه، پررنگی، بزرگی، یکی از مقدارهایش) یا یک مقدار بازی را در چند ثانیه نرم به عددی می‌رساند؛ یک بار، چند بار یا همیشه، و اگر بخواهی رفت و برگشت.',
    // (The game's first value is ready in case "a game value" is chosen.)
    make: (ctx) => ({ type: 'tween', target: firstRef(ctx), property: 'angle', variable: ctx.project.variables.find((v) => !v.item)?.name ?? '', value: '', mode: 'by', amount: 360, seconds: 1, ease: 'smooth', times: 1, yoyo: false, label: '' }),
    fields: [
      TARGET,
      { key: 'property', label: 'کدام عدد', kind: 'choice', options: Object.entries(PROPERTY_LABEL).map(([value, label]) => ({ value, label })) },
      { key: 'value', label: 'کدام مقدارِ شیء', kind: 'valueName', fallback: '', showIf: (v) => v.property === 'value' },
      { key: 'variable', label: 'کدام مقدار بازی', kind: 'variable', fallback: '', showIf: (v) => v.property === 'variable' },
      { key: 'mode', label: 'چطور', kind: 'choice', options: [
        { value: 'to', label: 'برسد به این عدد' },
        { value: 'by', label: 'این‌قدر به آن اضافه شود' },
      ] },
      { key: 'amount', label: 'عدد', hint: 'برای «اضافه شود» می‌تواند منفی باشد؛ منفی یعنی کم شود. می‌تواند یک مقدار هم باشد؛ مثلاً یکی از تنظیم‌های رفتار خودت.', kind: 'amount' },
      slider('seconds', 'چقدر طول بکشد', 0.1, 10, 0.1, undefined, 'ثانیه'),
      { key: 'ease', label: 'چطور تغییر کند', kind: 'choice', fallback: 'smooth', options: EASE_OPTIONS },
      { key: 'times', label: 'چند بار', hint: '۰ یعنی همیشه، تا وقتی صحنه هست.', kind: 'number', fallback: 1 },
      { key: 'yoyo', label: 'رفت و برگشت', hint: 'هر بار می‌رود و برمی‌گردد، مثل تاب خوردن.', kind: 'bool', fallback: false },
      { key: 'label', label: 'یک نام برای این تغییر', hint: 'اگر برای «تغییر نرم تمام می‌شود» لازم است چند تغییر را از هم جدا کنی.', kind: 'text', fallback: '', advanced: true },
    ],
  },
  sentence: (a, { who }) => {
    const what = a.property === 'value' ? `مقدار ${a.value || '؟'} از ${who(a.target)}` : a.property === 'variable' ? `مقدار ${a.variable || '؟'}` : `${shortName(a.property)} ${who(a.target)}`;
    const how =
      typeof a.amount !== 'number'
        ? a.mode === 'to' ? `را نرم به ${amountText(a.amount, who)} برسان` : `را نرم به اندازه‌ی ${amountText(a.amount, who)} زیاد کن`
        : a.mode === 'to' ? `را نرم به ${fa(a.amount)} برسان` : `را نرم ${fa(Math.abs(a.amount))} ${a.amount < 0 ? 'کم کن' : 'زیاد کن'}`;
    const n = a.times ?? 1;
    const times = n === 0 ? '، همیشه' : n > 1 ? `، ${fa(n)} بار` : '';
    return `${what} ${how} (در ${fa(a.seconds)} ثانیه${a.yoyo ? '، رفت و برگشت' : ''}${times})`;
  },
  check: (a, { say, needVariable }) => {
    if (!(a.seconds > 0)) say('has a tween that takes no time.');
    if (a.property === 'variable') needVariable(a.variable ?? '');
    if (a.property === 'value' && !a.value) say('has a tween of an object value with no value named.');
    if (typeof a.amount === 'object' && 'variable' in a.amount) needVariable(a.amount.variable);
  },
  run: (game, a, context) => {
    const name = a.property === 'value' ? (a.value ?? '') : a.property === 'variable' ? (a.variable ?? '') : '';
    const common = { property: a.property, name, seconds: Math.max(0.01, a.seconds), ease: a.ease, times: Math.max(0, Math.round(a.times ?? 1)), yoyo: Boolean(a.yoyo), by: a.mode === 'by', label: a.label ?? '' };
    const targets = game.targets(a.target, context);
    const amount = game.amount(a.amount, context);
    // A game value is one number: changed once, the tween belonging to the first object named (for its trigger).
    if (a.property === 'variable') {
      const from = readProperty(game, null, 'variable', name);
      startTween(game, { ...common, entity: targets[0] ?? null, from, to: a.mode === 'to' ? amount : from + amount });
      return;
    }
    for (const e of targets) {
      const from = readProperty(game, e, a.property, name);
      startTween(game, { ...common, entity: e, from, to: a.mode === 'to' ? amount : from + amount });
    }
  },
});
