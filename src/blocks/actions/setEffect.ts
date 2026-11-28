import { EFFECT_KINDS, EFFECT_PLACE_LABEL, EFFECTS, effectSettings, type EffectKind, type EffectPlace } from '../../format/effects';
import { amountText } from '../say';
import { fa, firstRef } from '../fields';
import { actionBlock } from '../types';

// Visual effects on anything (item 4 of the 2026-11-27 roadmap): see src/format/effects.ts and src/runtime/effects.ts.
declare module '../../format/types' {
  interface MoreActions {
    setEffect: {
      type: 'setEffect';
      /** On an object (`target`), or on everything the player sees, or on one layer of the scene. */
      place: 'object' | EffectPlace;
      /** The object, when `place` is "object"; kept (and unused) otherwise. */
      target: Target;
      kind: EffectKind;
      /** One of the kind's settings, or "on" (1 on, 0 off). */
      setting: string;
      /** The new number. */
      amount: Amount;
      /** The new colour, for a colour setting. */
      color?: string;
      /** Over how many seconds a number changes; 0 or absent for at once. */
      seconds?: number;
    };
  }
}

/** Whether an action's setting is a colour. */
const isColour = (v: Record<string, unknown>) => effectSettings(v.kind as EffectKind).some((s) => s.key === v.setting && 'color' in s);

export const setEffect = actionBlock({
  type: 'setEffect',
  still: true,
  editor: {
    title: 'عوض کردن یک جلوه',
    short: 'یکی از تنظیم‌های یک جلوه‌ی تصویری را، روی یک شیء، یک لایه یا همه‌ی صحنه، حین بازی عوض می‌کند؛ یک‌باره یا نرم. مثلاً وقتی بازیکن ضربه می‌خورد، صحنه محو شود. اگر آن جلوه آنجا نباشد، گذاشته می‌شود.',
    make: (ctx) => ({ type: 'setEffect', place: 'all', target: firstRef(ctx), kind: 'blur', setting: 'strength', amount: 10, seconds: 0.3 }),
    fields: [
      { key: 'place', label: 'روی چه چیزی', kind: 'choice', options: [{ value: 'object', label: 'یک شیء' }, ...Object.entries(EFFECT_PLACE_LABEL).map(([value, label]) => ({ value, label }))] },
      { key: 'target', label: 'کدام شیء', kind: 'target', showIf: (v) => v.place === 'object' },
      { key: 'kind', label: 'کدام جلوه', kind: 'choice', options: EFFECT_KINDS.map((k) => ({ value: k, label: EFFECTS[k].label })) },
      { key: 'setting', label: 'کدام تنظیمش', kind: 'effectSetting' },
      { key: 'amount', label: 'عدد تازه', hint: 'برای «روشن یا خاموش»، ۱ یعنی روشن و ۰ خاموش.', kind: 'amount', showIf: (v) => !isColour(v) },
      { key: 'color', label: 'رنگ تازه', kind: 'color', fallback: '#ffffff', showIf: isColour },
      { key: 'seconds', label: 'در چند ثانیه', hint: '۰ یعنی یک‌باره.', kind: 'number', fallback: 0, showIf: (v) => !isColour(v) && v.setting !== 'on' },
    ],
  },
  sentence: (a, { who }) => {
    const on = a.place === 'object' ? who(a.target) : `«${EFFECT_PLACE_LABEL[a.place as EffectPlace]?.replace(/ \(.*\)$/, '') ?? a.place}»`;
    const effect = `جلوه‌ی «${EFFECTS[a.kind]?.label ?? a.kind}» روی ${on}`;
    if (a.setting === 'on') return typeof a.amount === 'number' ? `${effect} را ${a.amount > 0 ? 'روشن' : 'خاموش'} کن` : `${effect} را با ${amountText(a.amount, who)} روشن یا خاموش کن`;
    const label = effectSettings(a.kind).find((s) => s.key === a.setting)?.label ?? a.setting;
    const to = isColour(a as unknown as Record<string, unknown>) ? `رنگ ${a.color ?? ''}` : typeof a.amount === 'number' ? fa(a.amount) : amountText(a.amount, who);
    return `«${label}»ِ ${effect} را ${to} کن${a.seconds ? ` (نرم، در ${fa(a.seconds)} ثانیه)` : ''}`;
  },
  check: (a, { say, checkRef, needVariable }) => {
    if (!(EFFECT_KINDS as string[]).includes(a.kind)) return say(`changes an effect of a kind Bazisaz does not have ("${a.kind}").`);
    if (!effectSettings(a.kind).some((s) => s.key === a.setting)) say(`changes the setting "${a.setting}", which the effect "${a.kind}" does not have.`);
    if (a.place === 'object') checkRef(a.target);
    if (typeof a.amount === 'object' && 'variable' in a.amount) needVariable(a.amount.variable);
  },
  run: (game, a, context) => {
    if (!effectSettings(a.kind).some((s) => s.key === a.setting)) return;
    const value = isColour(a as unknown as Record<string, unknown>) ? (a.color ?? '#ffffff') : game.amount(a.amount, context);
    const seconds = Math.max(0, a.seconds ?? 0);
    if (a.place !== 'object') return game.setEffect(a.place, a.kind, a.setting, value, seconds);
    for (const e of game.targets(a.target, context)) game.setEffect(e, a.kind, a.setting, value, seconds);
  },
});
