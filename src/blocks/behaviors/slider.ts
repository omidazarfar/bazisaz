import { setVolumes } from '../../runtime/sound';
import { clamp } from '../../runtime/math';
import type { Entity } from '../../runtime/Game';
import { group } from '../say';
import { behaviorBlock } from '../types';

// A slider's knob (flagship Phase D, the UI kit): dragged along its track, it sets a game value, or how loud the
// sounds or the music are. It starts where that value is.
declare module '../../format/types' {
  interface MoreBehaviors {
    slider: { type: 'slider'; trackTag: string; sets: 'value' | 'effects' | 'music'; variable: string; min: number; max: number };
  }
}

/** The loudness each slider has set, so sounds and music keep theirs when the other changes. */
const volumes = { effects: 1, music: 1 };
/** Where each knob is along its track (0 to 1): it stays there when the screen is laid out anew (a tablet). */
const along = new WeakMap<Entity, number>();

export const slider = behaviorBlock({
  type: 'slider',
  editor: {
    title: 'دستگیره‌ی اسلایدر',
    about: 'این شیء دستگیره است و روی شیء «ریل» با انگشت چپ و راست می‌رود: یک مقدار بازی را از کم تا زیاد تنظیم می‌کند، یا بلندی صداها یا موسیقی را. ریل را یک عکس دراز بگذار (مثلاً اسلایدر بسته‌ی UI) و این را روی آن.',
    make: () => ({ type: 'slider', trackTag: '', sets: 'effects', variable: '', min: 0, max: 100 }),
    fields: [
      { key: 'trackTag', label: 'ریلش (گروه)', hint: 'شیئی که دستگیره رویش می‌لغزد.', kind: 'tag' },
      { key: 'sets', label: 'چه چیزی را تنظیم کند', kind: 'choice', options: [
        { value: 'effects', label: 'بلندی صداها' },
        { value: 'music', label: 'بلندی موسیقی' },
        { value: 'value', label: 'یک مقدار بازی' },
      ] },
      { key: 'variable', label: 'کدام مقدار', kind: 'variable', optional: true, showIf: (v) => v.sets === 'value' },
      { key: 'min', label: 'کمترین (سمت چپ)', kind: 'number', showIf: (v) => v.sets === 'value' },
      { key: 'max', label: 'بیشترین (سمت راست)', kind: 'number', showIf: (v) => v.sets === 'value' },
    ],
  },
  sentence: (b) => `دستگیره‌ای روی ${group(b.trackTag)} که ${b.sets === 'effects' ? 'بلندی صداها' : b.sets === 'music' ? 'بلندی موسیقی' : `مقدار ${b.variable || '؟'}`} را تنظیم می‌کند`,
  check: (b, { object, say, needVariable }) => {
    if (!b.trackTag) say(`"${object.id}" is a slider knob with no track.`);
    if (b.sets === 'value') needVariable(b.variable);
  },
  step: (game, e, b) => {
    const track = game.nearest(e, b.trackTag);
    if (!track) return;
    const [low, high] = [track.x, track.x + track.width - e.width];
    const share = (x: number) => (high > low ? clamp((x - low) / (high - low), 0, 1) : 0);
    const read = () => (b.sets === 'value' ? clamp(((game.variables.get(b.variable) ?? b.min) - b.min) / ((b.max - b.min) || 1), 0, 1) : volumes[b.sets]);
    // Centred on the track's height, at its value, the first time.
    if (!along.has(e)) along.set(e, read());
    // On its track every moment: the track may have moved with the screen's edges.
    e.y = track.y + track.height / 2 - e.height / 2;
    e.x = low + along.get(e)! * (high - low);
    // A finger that came down on the track or the knob drags it.
    const reach = { x: track.x - e.width / 2, y: Math.min(track.y, e.y) - 20, width: track.width + e.width, height: Math.max(track.height, e.height) + 40 };
    for (const p of game.pointers.values()) {
      const start = game.inSpaceOf(e, { x: p.startX, y: p.startY });
      if (start.x < reach.x || start.x > reach.x + reach.width || start.y < reach.y || start.y > reach.y + reach.height) continue;
      e.x = clamp(game.inSpaceOf(e, p).x - e.width / 2, low, high);
      const s = share(e.x);
      along.set(e, s);
      if (b.sets === 'value') game.setValueOf(b.variable, Math.round(b.min + s * (b.max - b.min)));
      else {
        volumes[b.sets] = s;
        setVolumes(volumes.effects, volumes.music);
      }
      game.valuesChanged = true;
    }
  },
});
