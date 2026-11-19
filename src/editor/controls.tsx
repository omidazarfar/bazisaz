import { useEffect, useId, useState, type ReactNode } from 'react';
import { fa, PALETTE } from './labels';

// Which groups of settings the user has folded away, remembered between visits.
const FOLDED_KEY = 'editor.folded';
const folded = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(FOLDED_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  })(),
);

/** A titled group of settings in the side panel. Pressing its title folds it away. */
export function Section(props: { title: string; about?: string; action?: ReactNode; children?: ReactNode }) {
  const [open, setOpen] = useState(!folded.has(props.title));
  const toggle = () => {
    if (open) folded.add(props.title);
    else folded.delete(props.title);
    try {
      localStorage.setItem(FOLDED_KEY, JSON.stringify([...folded]));
    } catch {
      // Not remembered next time; nothing else is lost.
    }
    setOpen(!open);
  };
  return (
    <section className="section">
      <div className="section-head">
        <h3 className="section-title">
          <button type="button" className="section-toggle" aria-expanded={open} onClick={toggle}>
            <span className="section-arrow" aria-hidden="true">{open ? '▾' : '◂'}</span>
            {props.title}
          </button>
        </h3>
        {open && props.action}
      </div>
      {open && props.about && <p className="section-about">{props.about}</p>}
      {open && props.children}
    </section>
  );
}

function Control(props: { label: string; id?: string; value?: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="control">
      <div className="control-head">
        {props.id ? <label htmlFor={props.id}>{props.label}</label> : <span>{props.label}</span>}
        {props.value !== undefined && <output className="control-value">{props.value}</output>}
      </div>
      {props.children}
      {props.hint && <p className="control-hint">{props.hint}</p>}
    </div>
  );
}

export function Slider(props: {
  label: string;
  hint?: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <Control label={props.label} id={id} hint={props.hint} value={`${fa(props.value)}${props.unit ? ` ${props.unit}` : ''}`}>
      {/* Ranges stay left-to-right so "more" is always toward the right, as on a phone's volume bar. */}
      <input
        id={id}
        type="range"
        dir="ltr"
        min={props.min}
        max={props.max}
        step={props.step}
        value={Math.min(props.max, Math.max(props.min, props.value))}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </Control>
  );
}

/** A typed number. Half-typed input like "-" or "1." is kept on screen but not passed on. */
export function NumberField(props: { label: string; hint?: string; value: number; onChange: (value: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(String(props.value));
  useEffect(() => {
    if (Number(draft) !== props.value) setDraft(String(props.value));
    // Only an outside change (undo, drag) should overwrite what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  return (
    <Control label={props.label} id={id} hint={props.hint}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        dir="ltr"
        className="number"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const value = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(value)) props.onChange(value);
        }}
      />
    </Control>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  hint?: ReactNode;
  /** "ltr" for things that are always Latin, like a package name. */
  dir?: 'auto' | 'ltr';
  list?: string[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Control label={props.label} id={id} hint={props.hint}>
      <input
        id={id}
        type="text"
        dir={props.dir ?? 'auto'}
        list={props.list ? `${id}-list` : undefined}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.list && (
        <datalist id={`${id}-list`}>
          {props.list.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      )}
    </Control>
  );
}

export function Select(props: {
  label: string;
  hint?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Control label={props.label} id={id} hint={props.hint}>
      <select id={id} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Control>
  );
}

export function Check(props: { label: string; hint?: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span>
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </span>
    </label>
  );
}

export function ColorField(props: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const current = props.value.toLowerCase();
  return (
    <div className="control">
      <div className="control-head">
        <span id={id}>{props.label}</span>
      </div>
      <div className="swatches" role="group" aria-labelledby={id}>
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{ background: color }}
            aria-label={`رنگ ${color}`}
            aria-pressed={color === current}
            onClick={() => props.onChange(color)}
          />
        ))}
        <label className="swatch swatch-custom" title="رنگ دلخواه">
          <span aria-hidden="true">+</span>
          <input
            type="color"
            aria-label="رنگ دلخواه"
            value={/^#[0-9a-f]{6}$/.test(current) ? current : '#000000'}
            onChange={(e) => props.onChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

/** A small set of exclusive choices shown side by side. */
export function Choice<T extends string>(props: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="control">
      <div className="control-head">
        <span id={id}>{props.label}</span>
      </div>
      <div className="segmented segmented-wrap" role="group" aria-labelledby={id}>
        {props.options.map((option) => (
          <button key={option.value} type="button" aria-pressed={option.value === props.value} onClick={() => props.onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      {props.hint && <p className="control-hint">{props.hint}</p>}
    </div>
  );
}
