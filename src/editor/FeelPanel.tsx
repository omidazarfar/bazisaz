import type { Behavior, GameProject } from '../format/types';
import { Section, Slider } from './controls';
import type { Editor } from './editor';

/**
 * Game feel in one place (flagship Phase F): how high and how long the hero jumps, how fast it runs and how
 * quickly it gets there, and how far the camera looks ahead. Written into the blocks they belong to (the scenes'
 * gravity, the jumper, the walker, the camera), for every scene with a jumping hero, so the whole game feels the
 * same; three presets to try.
 */

export interface Feel {
  /** Pixels, at the top of a single jump. */
  height: number;
  /** Seconds from leaving the ground to landing back at the same height. */
  airTime: number;
  speed: number;
  /** Seconds from standing to full speed (and back). */
  accel: number;
  lookAhead: number;
}

export const FEEL_PRESETS: { id: string; title: string; about: string; feel: Feel }[] = [
  { id: 'floaty', title: 'شناور', about: 'پرش بلند و آرام، مثل ماه؛ برای بازی آسان و آرام.', feel: { height: 300, airTime: 1.1, speed: 300, accel: 0.25, lookAhead: 120 } },
  { id: 'tight', title: 'دقیق', about: 'پرش تند و دقیق؛ دکمه را که ول کنی می‌ایستد. حس بیشتر بازی‌های پرشی خوب.', feel: { height: 260, airTime: 0.75, speed: 380, accel: 0.08, lookAhead: 160 } },
  { id: 'heavy', title: 'سنگین', about: 'پرش کوتاه و زود پایین آمدن، کمی دیر راه افتادن؛ مثل شخصیتی بزرگ و سنگین.', feel: { height: 200, airTime: 0.6, speed: 320, accel: 0.18, lookAhead: 100 } },
];

type Found = { gravity: number; jumper?: Extract<Behavior, { type: 'jumper' }>; walker?: Extract<Behavior, { type: 'walker' }>; camera?: Extract<Behavior, { type: 'camera' }> };

/** The hero of a scene: the first object, not fixed to the screen, that jumps. */
function heroOf(project: GameProject, sceneId: string): Found | null {
  const scene = project.scenes.find((s) => s.id === sceneId);
  const hero = scene?.objects.find((o) => !o.fixed && o.behaviors.some((b) => b.type === 'jumper'));
  if (!scene || !hero) return null;
  const of = <T extends Behavior['type']>(type: T) => hero.behaviors.find((b): b is Extract<Behavior, { type: T }> => b.type === type);
  return { gravity: scene.gravity, jumper: of('jumper'), walker: of('walker'), camera: of('camera') };
}

/** The feel a scene's hero has now. */
export function feelOf(project: GameProject, sceneId: string): Feel | null {
  const h = heroOf(project, sceneId);
  if (!h?.jumper || !(h.gravity > 0)) return null;
  const v = h.jumper.jumpSpeed;
  return { height: Math.round((v * v) / (2 * h.gravity)), airTime: Math.round(((2 * v) / h.gravity) * 100) / 100, speed: h.walker?.speed ?? 0, accel: h.walker?.ease ?? 0, lookAhead: h.camera?.lookAhead ?? 0 };
}

/** The game with this feel: every scene that has a jumping hero gets the gravity, and its hero the jump, run and camera. */
export function withFeel(project: GameProject, feel: Feel): GameProject {
  // A jump this high that lasts this long: g = 8h / T², v = 4h / T.
  const gravity = Math.round((8 * feel.height) / (feel.airTime * feel.airTime));
  const jumpSpeed = Math.round((4 * feel.height) / feel.airTime);
  return {
    ...project,
    scenes: project.scenes.map((s) => {
      if (!s.objects.some((o) => !o.fixed && o.behaviors.some((b) => b.type === 'jumper'))) return s;
      return {
        ...s,
        gravity,
        objects: s.objects.map((o) => (o.fixed || !o.behaviors.some((b) => b.type === 'jumper') ? o : {
          ...o,
          behaviors: o.behaviors.map((b): Behavior => {
            if (b.type === 'jumper') return { ...b, jumpSpeed };
            if (b.type === 'walker') return { ...b, speed: feel.speed, ease: feel.accel };
            if (b.type === 'camera') return { ...b, lookAhead: feel.lookAhead };
            return b;
          }),
        })),
      };
    }),
  };
}

export function FeelPanel({ editor }: { editor: Editor }) {
  const { project, scene, change } = editor;
  const feel = feelOf(project, scene.id);
  if (!feel) return null;
  const set = (patch: Partial<Feel>, key: string) => change(withFeel(project, { ...feel, ...patch }), `feel.${key}`);
  return (
    <Section title="حس بازی" about="پرش و دویدن قهرمان و دوربین، همه این‌جا. برای همه‌ی مرحله‌هایی که قهرمانِ پرنده دارند یک‌جا عوض می‌شود. یکی از سه حس آماده را امتحان کن، بعد عددها را کم‌وزیاد کن و «امتحان کن» را بزن.">
      <div className="adders" data-feel-presets>
        {FEEL_PRESETS.map((p) => (
          <button key={p.id} type="button" className="chip" data-feel={p.id} title={p.about} onClick={() => change(withFeel(project, p.feel), `feel.preset.${p.id}`)}>
            {p.title}
          </button>
        ))}
      </div>
      <Slider label="بلندی پرش" unit="پیکسل" min={80} max={500} step={10} value={feel.height} onChange={(height) => set({ height }, 'height')} />
      <Slider label="مدت پرش در هوا" unit="ثانیه" min={0.4} max={1.6} step={0.05} value={feel.airTime} onChange={(airTime) => set({ airTime }, 'airTime')} />
      <Slider label="سرعت دویدن" unit="پیکسل در ثانیه" min={100} max={800} step={10} value={feel.speed} onChange={(speed) => set({ speed }, 'speed')} />
      <Slider label="زمان رسیدن به سرعت کامل" hint="صفر یعنی یک‌باره؛ بیشتر یعنی نرم راه می‌افتد و نرم می‌ایستد." unit="ثانیه" min={0} max={0.6} step={0.02} value={feel.accel} onChange={(accel) => set({ accel }, 'accel')} />
      <Slider label="دوربین جلوتر را نشان بدهد" unit="پیکسل" min={0} max={400} step={10} value={feel.lookAhead} onChange={(lookAhead) => set({ lookAhead }, 'lookAhead')} />
    </Section>
  );
}
