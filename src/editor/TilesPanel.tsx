import { useState } from 'react';
import { EMPTY_TILE, type GameObject, type GameProject, type TileKind, type TilesVisual, type TileStyle } from '../format/types';
import { Check, Choice, ColorField, NumberField, Section, Select, Slider, TextField } from './controls';
import type { Editor } from './editor';
import { pickFile, readImage } from './images';
import { fa, PALETTE, TILE_STYLE_OPTIONS } from './labels';
import { SpriteGrid } from './Library';
import { Dialog } from './Pick';
import { useSprite } from './sprites';
import { newId, resizeRows } from './state';

/** Characters given to new kinds of cell, in turn. "." is kept for empty cells. */
const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
/** A map larger than this many cells is slow to paint and to play on a weak phone. */
const MAX_SIDE = 300;

interface Props {
  editor: Editor;
  object: GameObject;
  /** Changes the object in one undo step named by `key`, starting from `base` when a picture was added to the game. */
  update: (key: string, next: (o: GameObject) => GameObject, base?: GameProject) => void;
}

/** The settings of a tile map: its grid, the kinds of cell it is painted with, and the brush. */
export function TilesPanel({ editor, object, update }: Props) {
  const v = object.visual as TilesVisual;
  const cols = Math.max(1, ...v.rows.map((r) => r.length));
  const [choosing, setChoosing] = useState<string | null>(null);

  const setTiles = (key: string, patch: Partial<TilesVisual>, base?: GameProject) =>
    update(`tiles.${key}`, (o) => {
      const next = { ...(o.visual as TilesVisual), ...patch };
      const width = Math.max(1, ...next.rows.map((r) => r.length)) * next.cell;
      // The object's box is always the grid's.
      return { ...o, visual: next, width, height: next.rows.length * next.cell };
    }, base);
  const setKind = (key: string, patch: Partial<TileKind>, base?: GameProject) =>
    setTiles(`kind.${key}.${Object.keys(patch).join('.')}`, { kinds: { ...v.kinds, [key]: { ...v.kinds[key], ...patch } } }, base);

  const addKind = () => {
    const key = [...KEYS].find((k) => !v.kinds[k]);
    if (!key) return;
    const count = Object.keys(v.kinds).length;
    setTiles(`kind.add.${key}`, { kinds: { ...v.kinds, [key]: { name: `نوع ${fa(count + 1)}`, color: PALETTE[(count + 3) % PALETTE.length], tags: [] } } });
    editor.paint(key);
  };
  const removeKind = (key: string) => {
    const { [key]: _gone, ...kinds } = v.kinds;
    // Its cells are rubbed out with it.
    setTiles(`kind.remove.${key}`, { kinds, rows: v.rows.map((r) => r.split(key).join(EMPTY_TILE)) });
    if (editor.brush === key) editor.paint(EMPTY_TILE);
  };

  const setPicture = async (key: string, from: 'library' | 'computer', sprite?: string) => {
    if (from === 'library' && sprite) {
      const placed = await useSprite(editor.project, sprite);
      setKind(key, { asset: placed.asset }, placed.project);
      return;
    }
    const file = await pickFile('image/*');
    if (!file) return;
    const id = newId('img');
    const image = await readImage(file, 256);
    setKind(key, { asset: id }, { ...editor.project, assets: { ...editor.project.assets, [id]: { type: 'image', src: image.src } } });
  };

  /**
   * A second map behind this one, the same size and grid, for scenery: it scrolls a little slower than the
   * world (it seems further away), is a little faded, and nothing meets it. Painted like any map.
   */
  const addBackLayer = () => {
    const { project, scene } = editor;
    const layer: GameObject = {
      ...object, id: newId('obj'), name: object.name + ' - لایه‌ی پشت', tags: [], parallax: 0.7, opacity: 0.85, behaviors: [],
      visual: { ...v, rows: resizeRows([], cols, v.rows.length), kinds: Object.fromEntries(Object.entries(v.kinds).map(([key, kind]) => [key, { ...kind, tags: [] }])) },
    };
    const at = scene.objects.findIndex((o) => o.id === object.id);
    const objects = [...scene.objects.slice(0, Math.max(0, at)), layer, ...scene.objects.slice(Math.max(0, at))];
    editor.change({ ...project, scenes: project.scenes.map((s) => (s.id === scene.id ? { ...s, objects } : s)) }, 'tiles.backLayer.' + layer.id);
  };

  return (
    <>
      <Section title="نقشه‌ی خانه‌خانه" about="مرحله را مثل نقاشی روی خانه‌ها بکش. هر خانه‌ی پر، حین بازی یک تکه‌ی جدا است که با گروه‌های نوعش کار می‌کند؛ مثلاً گروه «زمین» برای «از این گروه رد نشود» بازیکن.">
        <div className="pair">
          <NumberField label="چند ستون" value={cols} onChange={(n) => setTiles('cols', { rows: resizeRows(v.rows, clampSide(n), v.rows.length) })} />
          <NumberField label="چند ردیف" value={v.rows.length} onChange={(n) => setTiles('rows', { rows: resizeRows(v.rows, cols, clampSide(n)) })} />
        </div>
        <Slider label="اندازه‌ی هر خانه" unit="پیکسل" min={10} max={200} step={2} value={v.cell} onChange={(cell) => setTiles('cell', { cell })} />
        <p className="control-hint">
          {editor.brush === null
            ? 'برای کشیدن، یک نوع خانه را زیر «قلم» انتخاب کن.'
            : 'روی خانه‌ها در صحنه بکش. دکمه‌ی راست موس پاک می‌کند. برای جابه‌جا کردن کل نقشه، «انتخاب» را در بالای صحنه بزن.'}
        </p>
        <div className="adders" role="group" aria-label="قلم">
          {Object.entries(v.kinds).map(([key, kind]) => (
            <button key={key} type="button" className="chip brush" data-brush={key} aria-pressed={editor.brush === key} onClick={() => editor.paint(key)}>
              <span className="brush-swatch" style={{ background: kind.asset ? `url("${editor.project.assets[kind.asset]?.src ?? ''}") center / cover` : kind.color }} />
              {kind.name}
            </button>
          ))}
          <button type="button" className="chip brush" data-brush="." aria-pressed={editor.brush === EMPTY_TILE} onClick={() => editor.paint(EMPTY_TILE)}>پاک‌کن</button>
          {editor.brush !== null && <button type="button" className="chip" onClick={() => editor.paint(null)}>کنار گذاشتن قلم</button>}
        </div>
        <div className="adders">
          <button type="button" className="chip" onClick={() => setTiles('clear', { rows: resizeRows([], cols, v.rows.length) })}>پاک کردن همه‌ی خانه‌ها</button>
          <button type="button" className="chip" data-back-layer onClick={addBackLayer}>+ لایه‌ی پشت</button>
        </div>
      </Section>

      {Object.entries(v.kinds).map(([key, kind]) => (
        <Section key={key} title={`خانه‌ی «${kind.name}»`} action={<button type="button" className="link" onClick={() => removeKind(key)}>حذف این نوع</button>}>
          <TextField label="نام" value={kind.name} onChange={(name) => setKind(key, { name })} />
          {!kind.asset && (
            <Select
              label="از چه ساخته شده"
              hint="با جنس، هر خانه بافت و سایه‌روشن دارد؛ چمن فقط روی خانه‌هایی می‌روید که بالایشان خالی است."
              value={kind.style ?? 'flat'}
              options={TILE_STYLE_OPTIONS}
              onChange={(style) => setKind(key, { style: style as TileStyle })}
            />
          )}
          {!kind.asset && (kind.style ?? 'flat') === 'flat' && <ColorField label="رنگ" value={kind.color} onChange={(color) => setKind(key, { color })} />}
          <div className="adders">
            <button type="button" className="chip" onClick={() => setChoosing(key)}>عکس از عکس‌های آماده</button>
            <button type="button" className="chip" onClick={() => void setPicture(key, 'computer')}>عکس از کامپیوتر</button>
            {kind.asset && (
              <button type="button" className="chip" onClick={() => setKind(key, { asset: undefined })}>برداشتن عکس</button>
            )}
          </div>
          <KindTags tags={kind.tags} onChange={(tags) => setKind(key, { tags })} />
          <Check
            label="هر خانه جدا باشد"
            hint="برای سکه یا آجری که تک‌تک برداشته می‌شود. اگر خاموش باشد، خانه‌های کنار هم یک تکه‌ی بلند می‌شوند که بازی را روی گوشی سبک‌تر می‌کند."
            value={kind.separate ?? false}
            onChange={(separate) => setKind(key, { separate })}
          />
          <Choice
            label="شکل خانه"
            hint="سراشیبی یعنی بازیکن رویش بالا و پایین می‌رود."
            value={kind.slope ?? 'box'}
            options={[{ value: 'box', label: 'مربع' }, { value: 'rise', label: 'سراشیبی رو به راست ◢' }, { value: 'fall', label: 'سراشیبی رو به چپ ◣' }]}
            onChange={(shape) => setKind(key, { slope: shape === 'box' ? undefined : (shape as 'rise' | 'fall') })}
          />
        </Section>
      ))}

      <div className="adders">
        <button type="button" className="chip" disabled={Object.keys(v.kinds).length >= KEYS.length} onClick={addKind}>+ نوع خانه‌ی تازه</button>
      </div>

      {choosing && (
        <Dialog wide title="یک عکس آماده انتخاب کن" onClose={() => setChoosing(null)}>
          <SpriteGrid
            onPick={(sprite) => {
              const key = choosing;
              setChoosing(null);
              void setPicture(key, 'library', sprite.id);
            }}
          />
        </Dialog>
      )}
    </>
  );
}

/** The groups of one kind of cell: each a chip that takes it away, and a box to add another. */
function KindTags({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <div className="control">
      <div className="control-head">
        <span>گروه‌ها</span>
      </div>
      <div className="chips">
        {tags.map((tag) => (
          <button key={tag} type="button" className="chip" title="برداشتن از این گروه" onClick={() => onChange(tags.filter((t) => t !== tag))}>
            {tag} ×
          </button>
        ))}
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const tag = draft.trim();
          if (tag && !tags.includes(tag)) onChange([...tags, tag]);
          setDraft('');
        }}
      >
        <input type="text" dir="auto" aria-label="نام گروه خانه" placeholder="نام گروه" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="chip">اضافه کن</button>
      </form>
      <p className="control-hint">قانون‌ها و رفتارها با این نام‌ها کار می‌کنند؛ مثلاً «زمین» برای «از این گروه رد نشود».</p>
    </div>
  );
}

function clampSide(n: number): number {
  return Math.max(1, Math.min(MAX_SIDE, Math.round(n) || 1));
}
