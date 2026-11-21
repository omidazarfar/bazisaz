import { useState } from 'react';
import { Select, Slider, TextField } from './controls';
import { Dialog } from './Pick';
import { SFX_PRESETS, synth, toWav, vary, type SfxSettings } from './sfx';

const PRESET_NAMES: Record<string, string> = {
  coin: 'سکه', jump: 'پرش', laser: 'لیزر', explosion: 'انفجار', powerup: 'قدرت گرفتن', hit: 'ضربه', blip: 'دکمه', magic: 'جادو',
};

/** Makes a sound effect from a preset and a few sliders, to hear and then add to the game's sounds. */
export function SfxMaker(props: { onAdd: (name: string, src: string) => void; onClose: () => void }) {
  const [settings, setSettings] = useState<SfxSettings>(SFX_PRESETS.coin);
  const [name, setName] = useState('coin');
  const set = (patch: Partial<SfxSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const play = (s = settings) => {
    const audio = new Audio(toWav(synth(s)));
    void audio.play().catch(() => undefined);
  };
  return (
    <Dialog title="ساختن صدا" about="یک صدای کوتاه برای بازی بساز: یک نوع را انتخاب کن، با «تکان بده» نمونه‌های تازه بشنو، با لغزنده‌ها درستش کن و بعد «اضافه کن». صدا در بخش «صداها» می‌آید و با کار «پخش صدا» پخش می‌شود." onClose={props.onClose}>
      <div className="adders sfx-presets">
        {Object.keys(SFX_PRESETS).map((id) => (
          <button key={id} type="button" className="chip" data-sfx={id} onClick={() => { setSettings(SFX_PRESETS[id]); setName(id); play(SFX_PRESETS[id]); }}>{PRESET_NAMES[id]}</button>
        ))}
      </div>
      <Select label="موج" value={settings.wave} options={[
        { value: 'square', label: 'مربعی (بازی‌های قدیمی)' }, { value: 'saw', label: 'اره‌ای (تیزتر)' }, { value: 'sine', label: 'نرم' }, { value: 'noise', label: 'خش (انفجار و ضربه)' },
      ]} onChange={(wave) => set({ wave: wave as SfxSettings['wave'] })} />
      <Slider label="زیر و بمی" unit="هرتز" min={60} max={2400} step={10} value={settings.pitch} onChange={(pitch) => set({ pitch })} />
      <Slider label="لغزیدن صدا" hint="مثبت یعنی صدا بالا می‌رود (پرش)، منفی یعنی پایین می‌آید (لیزر)." min={-0.95} max={3} step={0.05} value={settings.slide} onChange={(slide) => set({ slide })} />
      <Slider label="بلندی (مدت)" unit="ثانیه" min={0.05} max={2} step={0.01} value={settings.length} onChange={(length) => set({ length })} />
      <Slider label="لرزش" min={0} max={1} step={0.05} value={settings.vibrato} onChange={(vibrato) => set({ vibrato })} />
      <Slider label="پرش صدا در وسط (دینگ‌دینگ)" min={0} max={1} step={0.05} value={settings.jump} onChange={(jump) => set({ jump })} />
      <Slider label="بلندی صدا" min={0.1} max={1} step={0.05} value={settings.volume} onChange={(volume) => set({ volume })} />
      <TextField label="نام صدا" value={name} onChange={setName} />
      <div className="adders">
        <button type="button" className="chip" data-sfx-play onClick={() => play()}>▶ گوش بده</button>
        <button type="button" className="chip" onClick={() => { const next = vary(settings); setSettings(next); play(next); }}>🎲 تکان بده</button>
        <button type="button" className="chip" data-sfx-add onClick={() => props.onAdd(name.trim() || 'sound', toWav(synth(settings)))}>+ اضافه کن</button>
      </div>
    </Dialog>
  );
}
