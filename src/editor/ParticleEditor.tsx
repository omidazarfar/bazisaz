import { useEffect, useRef, useState } from 'react';
import { Application, Graphics } from 'pixi.js';
import type { ParticlesBehavior } from '../format/types';
import { advanceParticle, spawnParticle, type Particle } from '../runtime/particleView';
import { PARTICLE_COLORS } from '../runtime/particles';
import { Select } from './controls';
import { Fields } from './Fields';
import { BEHAVIORS, type Context } from './labels';
import { Dialog } from './Pick';

export function changeParticleSetting(b: ParticlesBehavior, key: string, value: unknown): ParticlesBehavior {
  const next = { ...b, [key]: value };
  if (key === 'preset' && b.color === PARTICLE_COLORS[b.preset]) next.color = PARTICLE_COLORS[next.preset];
  return next;
}

/** An isolated emitter. Canvas 2D shares the game's particle drawing and motion without a second WebGL context. */
function ParticlePreview({ settings, width, height }: { settings: ParticlesBehavior; width: number; height: number }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(settings);
  const [failed, setFailed] = useState(false);
  useEffect(() => { latest.current = settings; }, [settings]);
  useEffect(() => {
    const app = new Application();
    let closed = false;
    let ready = false;
    void app.init({ preference: 'canvas', width: 440, height: 320, backgroundAlpha: 0, autoStart: false }).then(() => {
      if (closed) { app.destroy({ removeView: true }, { children: true }); return; }
      ready = true;
      host.current!.appendChild(app.canvas);
      const zoom = Math.min(1, 220 / Math.max(1, width), 110 / Math.max(1, height));
      app.stage.scale.set(zoom);
      const box = { x: (440 / zoom - width) / 2, y: (320 / zoom - height) / 2, width, height };
      const outline = new Graphics().rect(box.x, box.y, box.width, box.height).stroke({ color: '#7683aa', width: 1 / zoom });
      app.stage.addChild(outline);
      let live: Particle[] = [];
      let previous = latest.current;
      let due = 0;
      app.ticker.maxFPS = 30;
      app.ticker.add(ticker => {
        const b = latest.current;
        if (b !== previous) {
          for (const p of live) p.view.destroy();
          live = [];
          due = 0;
          previous = b;
        }
        const dt = Math.min(ticker.deltaMS / 1000, 0.05);
        due -= dt;
        while (due <= 0) {
          due += 1 / Math.max(0.2, b.rate);
          if (live.length >= 400) break;
          const p = spawnParticle(b, box);
          app.stage.addChild(p.view);
          live.push(p);
        }
        due = Math.max(0, due);
        for (const p of live) advanceParticle(p, dt);
        live = live.filter(p => p.life > 0);
      });
      app.start();
    }).catch(() => { if (!closed) setFailed(true); });
    return () => {
      closed = true;
      // The editor stage still uses Pixi's global batch pool after the preview closes.
      if (ready) app.destroy({ removeView: true }, { children: true });
    };
  }, [width, height]);
  return <div className="particle-preview" ref={host} role="img" aria-label="پیش‌نمایش زنده‌ی ذرات">{failed && 'نمایش ذرات در این مرورگر در دسترس نیست.'}</div>;
}

export function ParticleEditor(props: {
  initial: ParticlesBehavior; width: number; height: number; ctx: Context;
  onApply: (settings: ParticlesBehavior) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(props.initial);
  const fields = BEHAVIORS.particles.fields;
  const preset = fields.find(f => f.key === 'preset');
  const set = (key: string, value: unknown) => setDraft(b => changeParticleSetting(b, key, value));
  return <Dialog title="ویرایش جلوه‌ی ذرات" wide onClose={props.onClose}>
    <div className="particle-workbench">
      <figure><ParticlePreview settings={draft} width={props.width} height={props.height} />
        <figcaption>خط دور، جای شیء را نشان می‌دهد.</figcaption>
      </figure>
      <div>
        {preset?.kind === 'choice' && <Select label={preset.label} options={preset.options} value={draft.preset} onChange={v => set('preset', v)} />}
        <Fields fields={fields.filter(f => f !== preset)} value={{ ...draft }} ctx={props.ctx} onChange={set} />
      </div>
    </div>
    <div className="adders">
      <button type="button" className="btn primary" data-apply-particles onClick={() => props.onApply(draft)}>ثبت روی شیء</button>
      <button type="button" className="btn" onClick={props.onClose}>انصراف</button>
    </div>
  </Dialog>;
}
