import { BlurFilter, NoiseFilter, type Filter } from 'pixi.js';
import {
  AdjustmentFilter, AdvancedBloomFilter, AsciiFilter, BevelFilter, BulgePinchFilter, ColorOverlayFilter, CRTFilter, CrossHatchFilter, DotFilter,
  DropShadowFilter, EmbossFilter, GlitchFilter, GlowFilter, GodrayFilter, GrayscaleFilter, HslAdjustmentFilter, MotionBlurFilter, OldFilmFilter,
  OutlineFilter, PixelateFilter, ReflectionFilter, RGBSplitFilter, SimplexNoiseFilter,
} from 'pixi-filters';
import { EFFECTS, settingOf, type EffectInfo, type EffectKind, type VisualEffect } from '../format/effects';

/**
 * How each visual effect of src/format/effects.ts is drawn (item 4 of the 2026-11-27 roadmap): the filter that makes
 * it, how a setting is put on that filter, and what moves by itself every frame.
 */

/** A filter made for an effect, with what it is and its settings as they are now (rules change them). */
export interface LiveEffect {
  kind: EffectKind;
  filter: Filter;
  values: Record<string, number | string>;
  /** For an effect that moves by itself: when its noise or scratches were last drawn anew. */
  clock: number;
}

const num = (v: number | string | undefined, fallback = 0): number => (typeof v === 'number' ? v : Number(v) || fallback);
const colour = (v: number | string | undefined): string => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#ffffff');

function make(kind: EffectKind, effect: VisualEffect): Filter {
  switch (kind) {
    case 'blur': return new BlurFilter({ strength: 6, quality: 3 });
    case 'motionBlur': return new MotionBlurFilter({ velocity: { x: 30, y: 0 }, kernelSize: 9 });
    case 'adjust': return new AdjustmentFilter();
    case 'hue': return new HslAdjustmentFilter();
    case 'grayscale': return new GrayscaleFilter();
    case 'tint': return new ColorOverlayFilter();
    case 'outline': return new OutlineFilter({ thickness: 3, quality: 0.2 });
    // The glow's width is fixed when it is made (its shader is built for it).
    case 'glow': return new GlowFilter({ distance: Math.round(Math.max(1, num(settingOf(effect, 'distance'), 14))), outerStrength: 2.5, innerStrength: 0, quality: 0.25 });
    case 'shadow': return new DropShadowFilter({ blur: 3, quality: 3 });
    case 'bevel': return new BevelFilter();
    case 'emboss': return new EmbossFilter(5);
    case 'pixelate': return new PixelateFilter(8);
    case 'ascii': return new AsciiFilter({ size: 8 });
    case 'dots': return new DotFilter({ scale: 1, angle: 5 });
    case 'hatch': return new CrossHatchFilter();
    case 'crt': return new CRTFilter({ vignetting: 0 });
    case 'film': return new OldFilmFilter({ vignetting: 0.2 });
    case 'glitch': return new GlitchFilter({ fillMode: 2 });
    case 'split': return new RGBSplitFilter();
    case 'bulge': return new BulgePinchFilter({ center: { x: 0.5, y: 0.5 } });
    case 'noise': return new NoiseFilter({ noise: 0.4 });
    case 'bloom': return new AdvancedBloomFilter({ quality: 4 });
    case 'rays': return new GodrayFilter({ parallel: true });
    case 'reflection': return new ReflectionFilter({ mirror: true });
    case 'clouds': return new SimplexNoiseFilter({ strength: 0.5, noiseScale: 10 });
  }
}

/** Puts one setting on an effect's filter ("on" turns it on and off). */
export function setEffectValue(live: LiveEffect, key: string, value: number | string): void {
  live.values[key] = value;
  const f = live.filter as unknown as Record<string, unknown>;
  const v = live.values;
  if (key === 'on') {
    live.filter.enabled = num(value, 1) > 0;
    return;
  }
  switch (live.kind) {
    case 'motionBlur':
      (live.filter as MotionBlurFilter).velocity = { x: num(v.x), y: num(v.y) };
      return;
    case 'tint':
      if (key === 'color') (live.filter as ColorOverlayFilter).color = colour(value);
      else (live.filter as ColorOverlayFilter).alpha = num(value);
      return;
    case 'outline':
      if (key === 'color') (live.filter as OutlineFilter).color = colour(value);
      else (live.filter as OutlineFilter).thickness = num(value, 1);
      return;
    case 'glow':
      if (key === 'color') (live.filter as GlowFilter).color = colour(value);
      else if (key === 'strength') (live.filter as GlowFilter).outerStrength = num(value);
      // The width is fixed when it is made: changed during play, the effect is made again (see remadeFor).
      return;
    case 'shadow': {
      const s = live.filter as DropShadowFilter;
      if (key === 'color') s.color = colour(value);
      else if (key === 'distance') s.offset = { x: num(value) * 0.6, y: num(value) * 0.8 };
      else if (key === 'blur') s.blur = num(value);
      else s.alpha = num(value);
      return;
    }
    case 'split': {
      const a = num(value);
      const s = live.filter as RGBSplitFilter;
      s.red = { x: -a, y: 0 };
      s.green = { x: 0, y: a / 2 };
      s.blue = { x: a, y: 0 };
      return;
    }
    case 'glitch': {
      const g = live.filter as GlitchFilter;
      if (key === 'slices') g.slices = Math.max(2, Math.round(num(value, 2)));
      else g.offset = num(value);
      g.refresh();
      return;
    }
    case 'rays':
      if (key === 'angle') (live.filter as GodrayFilter).angle = num(value);
      else f[key] = num(value);
      return;
    default:
      f[key] = num(value);
  }
}

/** A filter for an effect, with its settings: its own, or the kind's. */
export function makeEffect(effect: VisualEffect): LiveEffect {
  const live: LiveEffect = { kind: effect.kind, filter: make(effect.kind, effect), values: {}, clock: 0 };
  for (const s of [{ key: 'on' }, ...(EFFECTS[effect.kind] as EffectInfo).settings]) {
    const value = settingOf(effect, s.key);
    if (value !== undefined) setEffectValue(live, s.key, value);
  }
  return live;
}

/** Moves an effect that moves by itself on by `dt` seconds: noise and scratches drawn anew, rays and water flowing. */
export function animateEffect(live: LiveEffect, dt: number): void {
  if (!(EFFECTS[live.kind] as EffectInfo).animated || !live.filter.enabled) return;
  live.clock += dt;
  switch (live.kind) {
    case 'crt': {
      const f = live.filter as CRTFilter;
      f.time += dt * 3;
      f.seed = Math.random();
      return;
    }
    case 'film':
      (live.filter as OldFilmFilter).seed = Math.random();
      return;
    case 'noise':
      (live.filter as NoiseFilter).seed = Math.random();
      return;
    case 'rays':
      (live.filter as GodrayFilter).time += dt;
      return;
    case 'reflection':
      (live.filter as ReflectionFilter).time += dt;
      return;
    case 'glitch':
      // A new tear a few times a second, not every frame, so it can be seen.
      if (live.clock >= 0.12) {
        live.clock = 0;
        const g = live.filter as GlitchFilter;
        g.seed = Math.random();
        g.refresh();
      }
      return;
  }
}

/** Whether an effect costs a lot on a weak phone. */
export const isHeavy = (kind: EffectKind): boolean => Boolean((EFFECTS[kind] as EffectInfo).heavy);

/** Whether changing this setting needs the effect made again (a glow's width), rather than set on its filter. */
export const remadeFor = (kind: EffectKind, key: string): boolean => kind === 'glow' && key === 'distance';
