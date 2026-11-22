import { useState } from 'react';
import { musicWav, type Piece } from '../runtime/music';
import { Select, Slider, TextField } from './controls';
import { Dialog } from './Pick';

/** Chord sequences that sound good over and over, as steps of the scale, one per bar. */
const PROGRESSIONS: Record<string, { label: string; chords: number[] }> = {
  bright: { label: 'شاد و ساده', chords: [0, 4, 5, 3] },
  hero: { label: 'قهرمانانه', chords: [0, 5, 3, 4] },
  calm: { label: 'آرام', chords: [0, 3, 0, 4] },
  journey: { label: 'سفر', chords: [0, 2, 5, 4] },
  dark: { label: 'تیره', chords: [0, 1, 5, 4] },
};

/** Makes a looping piece of music from a few choices, with the same music writer as the built-in pieces. */
export function MusicMaker(props: { onAdd: (name: string, src: string) => void; onClose: () => void }) {
  const [piece, setPiece] = useState<Piece>({ bpm: 120, root: 60, minor: false, chords: PROGRESSIONS.bright.chords, lead: 'square', drums: 'full', bed: 'arp', seed: 7 });
  const [progression, setProgression] = useState('bright');
  const [name, setName] = useState('My tune');
  const [playing, setPlaying] = useState<HTMLAudioElement | null>(null);
  const set = (patch: Partial<Piece>) => {
    setPiece((p) => ({ ...p, ...patch }));
    stop();
  };
  const stop = () => {
    playing?.pause();
    setPlaying(null);
  };
  const listen = () => {
    if (playing) return stop();
    const audio = new Audio(musicWav(piece));
    audio.loop = true;
    void audio.play().catch(() => undefined);
    setPlaying(audio);
  };
  return (
    <Dialog title="ساختن موسیقی" about="یک موسیقی برای بازی بساز که پشت‌سرهم پخش می‌شود. حال، سرعت و ساز را انتخاب کن، «🎲 ملودی تازه» بزن تا آهنگ‌های دیگر بشنوی، و وقتی خوشت آمد «+ اضافه کن». موسیقی در فهرست «موسیقی این صحنه» می‌آید." onClose={() => { stop(); props.onClose(); }}>
      <Select label="حال و هوا" value={piece.minor ? 'minor' : 'major'} options={[{ value: 'major', label: 'شاد و روشن' }, { value: 'minor', label: 'غمگین، مرموز یا هیجانی' }]}
        onChange={(v) => set({ minor: v === 'minor' })} />
      <Select label="ترتیب آکوردها" value={progression} options={Object.entries(PROGRESSIONS).map(([value, p]) => ({ value, label: p.label }))}
        onChange={(v) => { setProgression(v); set({ chords: PROGRESSIONS[v].chords }); }} />
      <Slider label="سرعت" unit="ضرب در دقیقه" min={60} max={180} step={2} value={piece.bpm} onChange={(bpm) => set({ bpm })} />
      <Select label="زیر و بمی" value={String(piece.root)} options={[{ value: '53', label: 'بم' }, { value: '60', label: 'میانه' }, { value: '67', label: 'زیر' }]}
        onChange={(v) => set({ root: Number(v) })} />
      <Select label="ساز اصلی" value={piece.lead} options={[
        { value: 'square', label: 'بازی‌های قدیمی (مربعی)' }, { value: 'triangle', label: 'نرم مثل فلوت' }, { value: 'sine', label: 'خیلی نرم' }, { value: 'saw', label: 'تیز و پرانرژی' },
      ]} onChange={(v) => set({ lead: v as Piece['lead'] })} />
      <Select label="طبل" value={piece.drums} options={[
        { value: 'full', label: 'کامل' }, { value: 'soft', label: 'آرام' }, { value: 'sparse', label: 'کم' }, { value: 'none', label: 'بدون طبل' },
      ]} onChange={(v) => set({ drums: v as Piece['drums'] })} />
      <Select label="زیر ملودی" value={piece.bed} options={[{ value: 'arp', label: 'نت‌های شکسته‌ی تند' }, { value: 'pad', label: 'آکوردهای کشیده' }]}
        onChange={(v) => set({ bed: v as Piece['bed'] })} />
      <TextField label="نام موسیقی" value={name} onChange={setName} />
      <div className="adders">
        <button type="button" className="chip" data-music-play onClick={listen}>{playing ? '■ قطع' : '▶ گوش بده'}</button>
        <button type="button" className="chip" data-music-new onClick={() => set({ seed: Math.floor(Math.random() * 100000) })}>🎲 ملودی تازه</button>
        <button type="button" className="chip" data-music-add onClick={() => { stop(); props.onAdd(name.trim() || 'My tune', musicWav(piece)); }}>+ اضافه کن</button>
      </div>
    </Dialog>
  );
}
