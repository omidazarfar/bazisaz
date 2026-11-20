import { useEffect, useRef, useState, type RefObject } from 'react';
import type { GameProject } from '../format/types';
import type { DebugInfo, Game } from '../runtime/Game';
import { fa } from './labels';
import { triggerSentence } from './sentences';

const SPEEDS = [
  { value: 1, label: 'عادی' },
  { value: 0.5, label: 'آهسته' },
  { value: 0.25, label: 'خیلی آهسته' },
];

/**
 * What goes on inside the game during a try-out, shown beside it: the values
 * as they change, the rules that just ran (or were stopped by their
 * conditions), and tools to freeze the game, move it on a frame at a time,
 * slow it down and see the shapes that count for touching.
 */
export function DebugPanel({ game, project, onOpenRule }: { game: RefObject<Game | null>; project: GameProject; onOpenRule: (sceneId: string, ruleId: string) => void }) {
  const [info, setInfo] = useState<DebugInfo | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const before = useRef<Record<string, number | string>>({});

  useEffect(() => {
    const read = () => {
      const next = game.current?.getDebug() ?? null;
      if (!next) return;
      // A value that has just changed is lit up for a moment, so the eye goes to it.
      const moved = new Set(Object.keys(next.variables).filter((k) => before.current[k] !== undefined && before.current[k] !== next.variables[k]));
      before.current = next.variables;
      setChanged(moved);
      setInfo(next);
    };
    read();
    const timer = setInterval(read, 200);
    return () => clearInterval(timer);
  }, [game]);

  const set = (patch: Parameters<Game['setDebug']>[0]) => {
    game.current?.setDebug(patch);
    const next = game.current?.getDebug();
    if (next) setInfo(next);
  };

  if (!info) return null;
  const sceneOf = (id: string) => project.scenes.find((s) => s.id === id);
  const names = Object.keys(info.variables);

  return (
    <div className="debug" aria-label="نمایشگر بازی">
      <header className="panel-head">
        <h2>نمایشگر بازی</h2>
        <p>تا بازی اجرا می‌شود، این‌جا می‌بینی درونش چه می‌گذرد. برای ویرایش، بازی را متوقف کن.</p>
      </header>

      <div className="debug-tools">
        <button type="button" className="chip" aria-pressed={info.paused} onClick={() => set({ paused: !info.paused })}>
          {info.paused ? '▶ ادامه' : '⏸ نگه دار'}
        </button>
        <button type="button" className="chip" disabled={!info.paused} title="بازی را فقط یک لحظه (یک فریم) جلو می‌برد" onClick={() => game.current?.stepFrame()}>
          یک قدم جلو
        </button>
      </div>
      <div className="segmented debug-speed" role="group" aria-label="سرعت بازی">
        {SPEEDS.map((s) => (
          <button key={s.value} type="button" aria-pressed={info.speed === s.value} onClick={() => set({ speed: s.value })}>{s.label}</button>
        ))}
      </div>
      <label className="check debug-shapes">
        <input type="checkbox" checked={info.shapes} onChange={(e) => set({ shapes: e.target.checked })} />
        <span>شکل برخورد اشیا را نشان بده</span>
      </label>
      {info.shapes && <p className="control-hint">سبز: فیزیک واقعی. نارنجی: چیزهایی که محکم سر جایشان‌اند. آبی: جسم فیزیکی ساده. سفید: بقیه.</p>}

      <section className="debug-section">
        <h3>مقدارها</h3>
        {names.length === 0 ? (
          <p className="control-hint">این بازی هنوز مقداری ندارد.</p>
        ) : (
          <dl className="debug-values">
            {names.map((name) => (
              <div key={name} className={changed.has(name) ? 'debug-value debug-changed' : 'debug-value'} data-variable={name}>
                <dt><bdi dir="ltr">{name}</bdi></dt>
                <dd>{typeof info.variables[name] === 'number' ? fa(info.variables[name]) : <bdi>{info.variables[name]}</bdi>}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="debug-section">
        <h3>قانون‌هایی که همین حالا کار کردند</h3>
        {info.log.length === 0 ? (
          <p className="control-hint">هنوز هیچ قانونی اجرا نشده. اگر انتظار داشتی قانونی کار کند، اتفاقش را دوباره نگاه کن.</p>
        ) : (
          <ol className="debug-log">
            {[...info.log].reverse().slice(0, 14).map((entry, i) => {
              const scene = sceneOf(entry.scene);
              const rule = scene?.rules.find((r) => r.id === entry.rule);
              if (!scene || !rule) return null;
              const here = entry.scene === info.log.at(-1)?.scene;
              const ago = here ? Math.max(0, info.time - entry.time) : null;
              return (
                <li key={`${entry.rule}.${i}`}>
                  <button type="button" className={entry.ran ? 'debug-rule' : 'debug-rule debug-rule-stopped'} data-debug-rule={entry.rule} title="برو به این قانون" onClick={() => onOpenRule(entry.scene, entry.rule)}>
                    <span dir="rtl">{triggerSentence(scene, rule.when)}</span>
                    <small>
                      {entry.ran ? 'کارهایش انجام شد' : rule.otherwise?.length ? 'شرطش برقرار نبود؛ «وگرنه» انجام شد' : 'شرطش برقرار نبود؛ کاری نکرد'}
                      {entry.count > 1 ? ` · ${fa(entry.count)} بار` : ''}
                      {ago === null ? ' · صحنه‌ی قبل' : ago < 0.5 ? ' · همین الان' : ` · ${fa(Math.round(ago * 10) / 10)} ثانیه پیش`}
                    </small>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <p className="debug-foot">{fa(info.objects)} شیء در صحنه · {fa(info.fps)} فریم در ثانیه</p>
    </div>
  );
}
