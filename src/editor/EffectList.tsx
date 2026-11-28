import { EFFECTS, effectSettings, settingOf, type EffectKind, type VisualEffect } from '../format/effects';
import { Check, ColorField, Slider } from './controls';
import { PickButton, type PickGroup } from './Pick';

/**
 * The visual effects of an object, a layer of a scene or a whole scene (item 4 of the 2026-11-27 roadmap): each with
 * its settings, which show in the scene at once as they change; and a list to add more from, one of each kind.
 */

/** The effects in groups, for the pick list. */
const EFFECT_GROUPS: { title: string; kinds: EffectKind[] }[] = [
  { title: 'رنگ و نور', kinds: ['adjust', 'hue', 'grayscale', 'tint', 'bloom', 'rays'] },
  { title: 'لبه و برجستگی', kinds: ['outline', 'glow', 'shadow', 'bevel', 'emboss'] },
  { title: 'محو و موج', kinds: ['blur', 'motionBlur', 'bulge', 'reflection', 'clouds'] },
  { title: 'سبک تصویر', kinds: ['pixelate', 'ascii', 'dots', 'hatch', 'crt', 'film', 'glitch', 'split', 'noise'] },
];

export function EffectList({ effects, onChange, name }: {
  effects: VisualEffect[];
  /** The new list, and a key that names what changed (so a slider drag is one undo step). */
  onChange: (effects: VisualEffect[], key: string) => void;
  /** Says whose effects these are, for tests and screen readers. */
  name: string;
}) {
  const groups: PickGroup[] = EFFECT_GROUPS.map((g) => ({
    title: g.title,
    items: g.kinds.filter((k) => !effects.some((e) => e.kind === k)).map((k) => ({ value: k, title: EFFECTS[k].label, about: EFFECTS[k].about, why: null })),
  })).filter((g) => g.items.length > 0);
  const put = (index: number, next: VisualEffect, key: string) => onChange(effects.map((e, i) => (i === index ? next : e)), key);
  return (
    <div className="effect-list" data-effects={name}>
      {effects.length === 0 && <p className="control-hint">هنوز جلوه‌ای ندارد.</p>}
      {effects.map((effect, index) => {
        const info = EFFECTS[effect.kind];
        return (
          <div key={effect.kind} className="action effect" data-effect={effect.kind}>
            <div className="action-head">
              <strong>{info?.label ?? effect.kind}</strong>
              <button type="button" className="link" onClick={() => onChange(effects.filter((_, i) => i !== index), `effects.remove.${effect.kind}`)}>حذف</button>
            </div>
            {info && <p className="control-hint">{info.about}{'heavy' in info && info.heavy ? ' روی گوشی ضعیف خودکار خاموش می‌شود.' : ''}</p>}
            <Check
              label="روشن از اول"
              hint="خاموشش کن تا یک قانون، با «عوض کردن یک جلوه»، روشنش کند."
              value={!effect.off}
              onChange={(on) => {
                const { off: _old, ...rest } = effect;
                put(index, on ? rest : { ...rest, off: true }, `effects.${effect.kind}.off`);
              }}
            />
            {effectSettings(effect.kind).filter((s) => s.key !== 'on').map((s) => {
              const set = (value: number | string) => put(index, { ...effect, settings: { ...effect.settings, [s.key]: value } }, `effects.${effect.kind}.${s.key}`);
              const value = settingOf(effect, s.key);
              return 'color' in s ? (
                <ColorField key={s.key} label={s.label} value={String(value)} onChange={set} />
              ) : (
                <Slider key={s.key} label={s.label} min={s.min} max={s.max} step={s.step} value={Number(value)} onChange={set} />
              );
            })}
          </div>
        );
      })}
      {groups.length > 0 && (
        <PickButton label={`اضافه کردن جلوه به ${name}`} className="chip" title="چه جلوه‌ای؟" about="هر جلوه را بعد از اضافه کردن با تنظیم‌هایش عوض کن؛ همان لحظه در صحنه دیده می‌شود." groups={groups} onPick={(kind) => onChange([...effects, { kind: kind as EffectKind }], `effects.add.${kind}`)}>
          + یک جلوه
        </PickButton>
      )}
    </div>
  );
}
