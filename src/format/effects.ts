/**
 * Visual effects on anything (item 4 of the 2026-11-27 roadmap): the effects of pixi-filters (and Pixi's own blur and
 * noise) that make sense in a game without pictures or positions of their own, each with its Persian name and the
 * settings a user can change. An object, a layer of the scene or the whole scene can have any of them, one of each
 * kind; a rule can change a setting during play. How each is drawn is in src/runtime/effects.ts; this file is plain
 * data so the format, the checks and the editor can read it.
 */

/** Where in a scene an effect is: on everything the player sees, or on one layer of it. */
export const EFFECT_PLACES = ['all', 'sky', 'world', 'screen'] as const;
export type EffectPlace = (typeof EFFECT_PLACES)[number];

export const EFFECT_PLACE_LABEL: Record<EffectPlace, string> = {
  all: 'همه‌ی صحنه',
  sky: 'لایه‌ی آسمان (پس‌زمینه‌ی نقاشی‌شده)',
  world: 'لایه‌ی دنیا (اشیایی که با دوربین می‌روند)',
  screen: 'لایه‌ی صفحه (امتیاز، دکمه‌ها و هرچه به صفحه چسبیده)',
};

/** A number setting, as a slider; or a colour. Every effect also has "on" (1 on, 0 off), which rules can change. */
export type EffectSetting =
  | { key: string; label: string; min: number; max: number; step: number; initial: number }
  | { key: string; label: string; color: true; initial: string };

export interface EffectInfo {
  label: string;
  about: string;
  settings: EffectSetting[];
  /** Costs a lot on a weak phone: turned off when the game has to lighten (Game.lighten). */
  heavy?: boolean;
  /** Moves by itself (noise, film scratches, rays), so it is drawn again every frame. */
  animated?: boolean;
}

const n = (key: string, label: string, min: number, max: number, step: number, initial: number): EffectSetting => ({ key, label, min, max, step, initial });
const c = (key: string, label: string, initial: string): EffectSetting => ({ key, label, color: true, initial });

export const EFFECTS = {
  blur: { label: 'محو', about: 'تار و محو می‌کند؛ مثل وقتی بازیکن گیج است یا پشت مِه.', heavy: true, settings: [n('strength', 'چقدر محو', 0, 30, 0.5, 6)] },
  motionBlur: { label: 'محوِ حرکت', about: 'مثل عکسی که در حرکت گرفته شده؛ برای سرعت زیاد.', heavy: true, settings: [n('x', 'به چپ و راست', -100, 100, 1, 30), n('y', 'به بالا و پایین', -100, 100, 1, 0)] },
  adjust: { label: 'روشنی و رنگ', about: 'روشنی، تضاد، پررنگی رنگ‌ها و نور را عوض می‌کند.', settings: [n('brightness', 'روشنی', 0, 3, 0.05, 1.2), n('contrast', 'تضاد', 0, 3, 0.05, 1), n('saturation', 'پررنگی رنگ‌ها', 0, 3, 0.05, 1), n('gamma', 'نور سایه‌ها', 0.1, 3, 0.05, 1)] },
  hue: { label: 'چرخاندن رنگ‌ها', about: 'همه‌ی رنگ‌ها را می‌چرخاند؛ مثلاً سبز را بنفش می‌کند. برای دشمنِ رنگ دیگر یا دنیای جادویی.', settings: [n('hue', 'چرخش رنگ (درجه)', -180, 180, 1, 90), n('saturation', 'پررنگی', -1, 1, 0.05, 0), n('lightness', 'روشنی', -1, 1, 0.05, 0)] },
  grayscale: { label: 'سیاه‌وسفید', about: 'رنگ‌ها را برمی‌دارد.', settings: [] },
  tint: { label: 'رنگ روی همه', about: 'یک رنگ را روی همه‌چیز می‌کشد؛ مثل قرمزی ضربه یا آبیِ زیر آب.', settings: [c('color', 'رنگ', '#ff3b3b'), n('alpha', 'چقدر', 0, 1, 0.05, 0.35)] },
  outline: { label: 'دورخط', about: 'یک خط رنگی دور شکل می‌کشد؛ برای شیئی که باید دیده شود.', settings: [n('thickness', 'پهنای خط', 1, 12, 0.5, 3), c('color', 'رنگ', '#ffffff')] },
  glow: { label: 'هاله‌ی رنگی', about: 'هاله‌ای رنگی و قابل تنظیم دورش؛ پررنگ‌تر از «درخشش» ساده.', settings: [n('distance', 'پهنای هاله', 2, 40, 1, 14), n('strength', 'شدت', 0, 8, 0.1, 2.5), c('color', 'رنگ', '#ffe066')] },
  shadow: { label: 'سایه‌ی قابل تنظیم', about: 'سایه‌ای که فاصله، نرمی و رنگش را خودت تعیین می‌کنی.', settings: [n('distance', 'فاصله', 0, 40, 1, 8), n('blur', 'نرمی', 0, 10, 0.5, 3), n('alpha', 'پررنگی', 0, 1, 0.05, 0.5), c('color', 'رنگ', '#000000')] },
  bevel: { label: 'برجسته', about: 'لبه‌ها را مثل دکمه‌ی برجسته روشن و تاریک می‌کند.', settings: [n('thickness', 'پهنا', 1, 12, 0.5, 3), n('rotation', 'جهت نور (درجه)', 0, 360, 5, 45)] },
  emboss: { label: 'حکاکی', about: 'مثل نقشی که روی سنگ یا فلز کنده شده.', settings: [n('strength', 'شدت', 0, 20, 0.5, 5)] },
  pixelate: { label: 'پیکسلی', about: 'تصویر را درشت‌دانه می‌کند؛ مثل بازی‌های قدیمی.', settings: [n('size', 'اندازه‌ی دانه', 2, 40, 1, 8)] },
  ascii: { label: 'حروفی', about: 'تصویر را با حروف و علامت‌ها می‌کشد.', settings: [n('size', 'اندازه‌ی حروف', 4, 30, 1, 8)] },
  dots: { label: 'نقطه‌ای (روزنامه‌ای)', about: 'تصویر را مثل چاپ روزنامه با نقطه می‌سازد.', settings: [n('scale', 'درشتی نقطه', 0.3, 3, 0.05, 1), n('angle', 'زاویه', 0, 10, 0.1, 5)] },
  hatch: { label: 'هاشور', about: 'مثل طرحی که با مداد هاشور زده شده؛ جاهای تیره هاشور می‌خورند.', settings: [] },
  crt: { label: 'تلویزیون قدیمی', about: 'صفحه‌ی خمیده با خط‌های افقی و برفک.', heavy: true, animated: true, settings: [n('curvature', 'خمیدگی', 0, 10, 0.1, 1), n('lineWidth', 'پهنای خط‌ها', 0, 5, 0.1, 1), n('noise', 'برفک', 0, 1, 0.01, 0.1)] },
  film: { label: 'فیلم قدیمی', about: 'رنگ قهوه‌ای، برفک و خراش مثل فیلم‌های قدیمی.', heavy: true, animated: true, settings: [n('sepia', 'قهوه‌ای', 0, 1, 0.05, 0.3), n('noise', 'برفک', 0, 1, 0.05, 0.3), n('scratch', 'خراش', -1, 1, 0.05, 0.5)] },
  glitch: { label: 'خرابی تصویر', about: 'تصویر تکه‌تکه و جابه‌جا می‌شود؛ برای ضربه، جادو یا دنیای دیجیتال.', animated: true, settings: [n('slices', 'تعداد تکه‌ها', 2, 30, 1, 8), n('offset', 'جابه‌جایی', 0, 200, 1, 40)] },
  split: { label: 'جدا شدن رنگ‌ها', about: 'سه رنگ تصویر کمی از هم جدا می‌شوند؛ برای ضربه یا گیجی.', settings: [n('amount', 'فاصله', 0, 30, 0.5, 6)] },
  bulge: { label: 'بادکردن', about: 'وسط تصویر باد می‌کند (یا با عدد منفی فرو می‌رود)؛ مثل ذره‌بین.', settings: [n('radius', 'اندازه', 10, 800, 5, 200), n('strength', 'شدت (منفی یعنی فرو رفتن)', -1, 1, 0.05, 0.6)] },
  noise: { label: 'برفک', about: 'دانه‌های ریز روی تصویر، مثل تلویزیون بی‌آنتن.', animated: true, settings: [n('noise', 'شدت', 0, 1, 0.05, 0.4)] },
  bloom: { label: 'تابش نور', about: 'جاهای روشن نور پخش می‌کنند؛ قوی‌تر و قابل تنظیم‌تر از «درخشش صحنه».', heavy: true, settings: [n('threshold', 'از چه روشنی‌ای', 0, 1, 0.05, 0.5), n('bloomScale', 'شدت', 0, 3, 0.05, 1), n('brightness', 'روشنی', 0, 3, 0.05, 1)] },
  rays: { label: 'پرتوهای نور', about: 'پرتوهای نور از بالا، مثل نور خورشید از لای درخت‌ها. روی همه‌ی صحنه یا لایه‌ی آسمان بهتر است.', heavy: true, animated: true, settings: [n('angle', 'زاویه', -60, 60, 1, 30), n('gain', 'شدت', 0, 1, 0.05, 0.5), n('lacunarity', 'ریزی', 0, 5, 0.1, 2.5)] },
  reflection: { label: 'بازتاب در آب', about: 'نیمه‌ی پایین، بازتابِ موج‌دار نیمه‌ی بالاست؛ مثل دریاچه. روی همه‌ی صحنه بهتر است.', animated: true, settings: [n('boundary', 'جای خط آب (۰ بالا، ۱ پایین)', 0, 1, 0.01, 0.6)] },
  clouds: { label: 'نقش ابری', about: 'لکه‌های نرم و ابری روی تصویر؛ برای مِه یا جادو.', settings: [n('strength', 'شدت', 0, 1, 0.05, 0.5), n('noiseScale', 'درشتی لکه‌ها', 1, 30, 0.5, 10)] },
} satisfies Record<string, EffectInfo>;

export type EffectKind = keyof typeof EFFECTS;
export const EFFECT_KINDS = Object.keys(EFFECTS) as EffectKind[];

/** The settings of an effect kind, with "on" first. */
export function effectSettings(kind: EffectKind): EffectSetting[] {
  return [{ key: 'on', label: 'روشن (۱) یا خاموش (۰)', min: 0, max: 1, step: 1, initial: 1 }, ...((EFFECTS[kind] as EffectInfo | undefined)?.settings ?? [])];
}

/**
 * One effect on an object, a layer or the whole scene: its kind and the settings changed from the kind's own
 * (a number, or a colour as "#rrggbb"). `off` puts it there turned off, for a rule to turn on.
 */
export interface VisualEffect {
  kind: EffectKind;
  settings?: Record<string, number | string>;
  off?: boolean;
}

/** An effect's setting as it starts: its own, or the kind's. */
export function settingOf(effect: VisualEffect, key: string): number | string | undefined {
  if (key === 'on') return effect.off ? 0 : 1;
  return effect.settings?.[key] ?? effectSettings(effect.kind).find((s) => s.key === key)?.initial;
}

/** Problems with a list of effects, for the checks. */
export function effectProblems(effects: unknown, where: string): string[] {
  if (effects === undefined) return [];
  if (!Array.isArray(effects)) return [`${where}: effects must be a list.`];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const e of effects as VisualEffect[]) {
    if (!e || !(EFFECT_KINDS as string[]).includes(e.kind)) {
      problems.push(`${where}: an effect of a kind Bazisaz does not have ("${String(e?.kind)}").`);
      continue;
    }
    if (seen.has(e.kind)) problems.push(`${where}: the effect "${e.kind}" is there twice.`);
    seen.add(e.kind);
    const known = new Set(effectSettings(e.kind).map((s) => s.key));
    for (const [key, value] of Object.entries(e.settings ?? {})) {
      if (!known.has(key)) problems.push(`${where}: the effect "${e.kind}" has no setting "${key}".`);
      else if (typeof value !== 'number' && typeof value !== 'string') problems.push(`${where}: the setting "${key}" of "${e.kind}" must be a number or a colour.`);
    }
  }
  return problems;
}
