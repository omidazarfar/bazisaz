import { useEffect, useRef, useState } from 'react';
import type { AnimateBehavior, AnimKey, GameObject, GameProject } from '../format/types';
import { ANIMATION_PRESETS, lengthOf, localTime, poseAt, REST } from '../runtime/animate';
import { Select, Slider } from './controls';
import { fa } from './labels';
import { Dialog } from './Pick';

/** The object as it looks, for the preview: its picture, or its colour and shape. */
function Look({ object, project }: { object: GameObject; project: GameProject }) {
  const v = object.visual;
  if (v.kind === 'image' && project.assets[v.asset]?.type === 'image') return <img src={project.assets[v.asset].src} alt="" draggable={false} />;
  const color = v.kind === 'rect' || v.kind === 'ellipse' || v.kind === 'text' ? v.color : '#9aa7c0';
  if (v.kind === 'text') return <span style={{ color, fontSize: 28, fontWeight: 700, whiteSpace: 'nowrap' }}>{v.text}</span>;
  return <span style={{ display: 'block', width: '100%', height: '100%', background: color, borderRadius: v.kind === 'ellipse' ? '50%' : v.kind === 'rect' ? (v.radius ?? 0) : 8 }} />;
}

/**
 * The timeline of an object's animation: a live preview that plays or can be
 * moved through with the slider, the keys along the time line (tap one to
 * change it), ready-made animations, and Apply or Cancel for all of it at once.
 */
export function AnimationEditor(props: { initial: AnimateBehavior; object: GameObject; project: GameProject; onApply: (b: AnimateBehavior) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<AnimateBehavior>(props.initial);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const started = useRef(performance.now());
  const length = Math.max(0.1, lengthOf(draft));
  const keys = [...draft.keys].sort((a, b) => a.t - b.t);
  const key = keys[Math.min(selected, keys.length - 1)];

  // Playing: the preview runs on its own clock; paused, the slider says where it is.
  useEffect(() => {
    if (!playing) return;
    started.current = performance.now() - time * 1000;
    let frame = 0;
    const step = () => {
      setTime((performance.now() - started.current) / 1000);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const at = playing ? localTime(draft, time) : Math.min(time, length);
  const pose = poseAt(draft, at);
  // The object fits in the stage at a size that leaves room to move.
  const zoom = Math.min(1, 120 / Math.max(1, props.object.width), 120 / Math.max(1, props.object.height));
  const setKeys = (next: AnimKey[]) => setDraft((d) => ({ ...d, keys: [...next].sort((a, b) => a.t - b.t) }));
  const change = (patch: Partial<AnimKey>) => {
    const next = keys.map((k) => (k === key ? { ...k, ...patch } : k));
    setKeys(next);
    if (patch.t !== undefined) setSelected([...next].sort((a, b) => a.t - b.t).findIndex((k) => k.t === patch.t));
  };
  const addKey = () => {
    // A new key where the slider is, looking the way the animation looks there; never on top of another.
    let t = Math.round(at * 20) / 20;
    while (keys.some((k) => Math.abs(k.t - t) < 0.05)) t = Math.round((t + 0.1) * 20) / 20;
    const made = { t, ...poseAt(draft, Math.min(t, length)) };
    const next = [...keys, made].sort((a, b) => a.t - b.t);
    setKeys(next);
    setSelected(next.indexOf(made));
  };
  const removeKey = () => {
    if (keys.length <= 2) return;
    setKeys(keys.filter((k) => k !== key));
    setSelected(Math.max(0, selected - 1));
  };

  return (
    <Dialog title="ویرایش انیمیشن (خط زمان)" about="هر «کلید» یک لحظه است: شیء در آن لحظه کجاست، چقدر چرخیده، چه اندازه‌ای است و چقدر پیداست. بین کلیدها نرم حرکت می‌کند." wide onClose={props.onClose}>
      <div className="anim-presets adders">
        {Object.entries(ANIMATION_PRESETS).map(([id, p]) => (
          <button key={id} type="button" className="chip" data-anim-preset={id} onClick={() => { setDraft((d) => ({ ...d, ...p.make() })); setSelected(0); setTime(0); started.current = performance.now(); }}>{p.label}</button>
        ))}
      </div>
      <div className="anim-workbench">
        <figure className="anim-stage" data-anim-stage>
          <div className="anim-ghost" style={{ width: props.object.width * zoom, height: props.object.height * zoom }} />
          <div className="anim-object" data-anim-object style={{
            width: props.object.width * zoom, height: props.object.height * zoom, opacity: pose.opacity,
            transform: `translate(${pose.x * zoom}px, ${pose.y * zoom}px) rotate(${pose.angle}deg) scale(${pose.scale})`,
          }}>
            <Look object={props.object} project={props.project} />
          </div>
          <figcaption>خط‌چین، جای خود شیء است.</figcaption>
        </figure>
        <div>
          <div className="anim-controls">
            <button type="button" className="chip" data-anim-play onClick={() => setPlaying(!playing)}>{playing ? '⏸ نگه دار' : '▶ پخش'}</button>
            <span className="anim-time" data-anim-time>{fa(Math.round(at * 100) / 100)} / {fa(Math.round(length * 100) / 100)} ثانیه</span>
          </div>
          {/* The time line: where each key is, and where the preview is now. */}
          <div className="anim-line" dir="ltr">
            <input type="range" min={0} max={length} step={0.01} value={at} aria-label="لحظه‌ی انیمیشن" data-anim-scrub
              onChange={(ev) => { setPlaying(false); setTime(Number(ev.target.value)); }} />
            {keys.map((k, i) => (
              <button key={i} type="button" className={'anim-key' + (k === key ? ' selected' : '')} style={{ left: `${(k.t / length) * 100}%` }}
                data-anim-key={i} title={`کلید در ${fa(k.t)} ثانیه`} onClick={() => { setSelected(i); setPlaying(false); setTime(k.t); }} />
            ))}
          </div>
          <div className="adders">
            <button type="button" className="chip" data-anim-add onClick={addKey}>+ کلید در این لحظه</button>
            <button type="button" className="chip" data-anim-remove disabled={keys.length <= 2} onClick={removeKey}>حذف این کلید</button>
          </div>
          {key && (
            <div className="anim-key-fields" data-anim-fields>
              <Slider label="زمان این کلید" unit="ثانیه" min={0} max={Math.max(10, length)} step={0.05} value={key.t} onChange={(t) => change({ t })} />
              <Slider label="جابه‌جایی به چپ و راست" unit="پیکسل" min={-400} max={400} step={1} value={key.x} onChange={(x) => change({ x })} />
              <Slider label="جابه‌جایی به بالا و پایین" unit="پیکسل" min={-400} max={400} step={1} value={key.y} onChange={(y) => change({ y })} />
              <Slider label="چرخش" unit="درجه" min={-720} max={720} step={5} value={key.angle} onChange={(angle) => change({ angle })} />
              <Slider label="اندازه" unit="برابر" min={0} max={3} step={0.05} value={key.scale} onChange={(scale) => change({ scale })} />
              <Slider label="پیدا بودن" min={0} max={1} step={0.05} value={key.opacity} onChange={(opacity) => change({ opacity })} />
            </div>
          )}
          <Select label="تکرار" value={draft.repeat} options={[{ value: 'loop', label: 'از اول، پشت سر هم' }, { value: 'bounce', label: 'رفت و برگشت' }, { value: 'once', label: 'فقط یک بار' }]}
            onChange={(repeat) => setDraft((d) => ({ ...d, repeat: repeat as AnimateBehavior['repeat'] }))} />
          <Select label="حرکت بین کلیدها" value={draft.ease} options={[{ value: 'smooth', label: 'نرم' }, { value: 'linear', label: 'یکنواخت' }]}
            onChange={(ease) => setDraft((d) => ({ ...d, ease: ease as AnimateBehavior['ease'] }))} />
        </div>
      </div>
      <div className="adders">
        <button type="button" className="btn primary" data-anim-apply onClick={() => props.onApply({ ...draft, keys })}>ثبت روی شیء</button>
        <button type="button" className="btn" onClick={props.onClose}>انصراف</button>
        <button type="button" className="link" onClick={() => setDraft((d) => ({ ...d, keys: [{ t: 0, ...REST }, { t: 1, ...REST }] }))}>از نو</button>
      </div>
    </Dialog>
  );
}
