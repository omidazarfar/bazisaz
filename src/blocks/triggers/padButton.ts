import { triggerBlock } from '../types';

// Gamepad (item 6 of the 2026-11-27 roadmap): see Game.pollPads.
declare module '../../format/types' {
  interface MoreTriggers {
    /** A gamepad button is pressed: one by name, or any. The stick counts as up, down, left and right. */
    padButton: { type: 'padButton'; button: 'any' | 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'lt' | 'rt' | 'back' | 'start' | 'up' | 'down' | 'left' | 'right' };
  }
}

const BUTTON_LABEL = {
  any: 'هر دکمه‌ای',
  a: 'A (پایین، معمولاً پرش)',
  b: 'B (راست)',
  x: 'X (چپ)',
  y: 'Y (بالا)',
  lb: 'شانه‌ی چپ (LB)',
  rb: 'شانه‌ی راست (RB)',
  lt: 'ماشه‌ی چپ (LT)',
  rt: 'ماشه‌ی راست (RT)',
  back: 'Back / Select',
  start: 'Start',
  up: 'بالا (چلیپا یا دسته)',
  down: 'پایین (چلیپا یا دسته)',
  left: 'چپ (چلیپا یا دسته)',
  right: 'راست (چلیپا یا دسته)',
} as const;

export const padButton = triggerBlock({
  type: 'padButton',
  editor: {
    title: 'یک دکمه‌ی دسته‌ی بازی زده می‌شود',
    about: 'دسته‌ی بازی (گیم‌پد) بدون هیچ تنظیمی مثل صفحه‌کلید کار می‌کند: دسته و چلیپا مثل کلیدهای جهت، A مثل پرش. این اتفاق برای هر دکمه‌ی دیگری است؛ مثلاً Start برای مکث.',
    make: () => ({ type: 'padButton', button: 'start' }),
    fields: [{ key: 'button', label: 'کدام دکمه', kind: 'choice', options: Object.entries(BUTTON_LABEL).map(([value, label]) => ({ value, label })) }],
  },
  sentence: (w) => `وقتی دکمه‌ی ${BUTTON_LABEL[w.button] ?? w.button} دسته‌ی بازی زده می‌شود`,
  fired: (game, w) => (w.button === 'any' ? game.padPressed.length > 0 : game.padPressed.includes(w.button)) ? [{}] : [],
});
