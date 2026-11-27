import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FONTS, isBuiltinMusic, nameGroups, ruleActions, VALUE_NAME, type Look, type Retro, type Sky, type Weather } from '../format/types';
import { builtinMusic } from '../runtime/music';
import { setMusic } from '../runtime/sound';
import { BUILTIN_MUSIC_OPTIONS, LOOK_OPTIONS, RETRO_OPTIONS, SKY_OPTIONS, WEATHER_OPTIONS } from './labels';
import { APP_ID } from '../format/validate';
import { Check, Choice, ColorField, NumberField, Section, Select, Slider, TextField } from './controls';
import type { GameProject } from '../format/types';
import type { Editor } from './editor';
import { pickFile, pickFiles, readDataUrl, readImage } from './images';
import { isListUsed, isVariableUsed, keepVersion, listVersions, makeObject, newId, removeScene, updateScene, type Version } from './state';
import { animatedVisual, importAtlas } from './atlas';
import { placeTiled } from './tiled';
import { FeelPanel } from './FeelPanel';
import { PlaytestPanel } from './PlaytestPanel';
import { SfxMaker } from './SfxMaker';
import { MusicMaker } from './MusicMaker';
import { SceneMap } from './SceneMap';
import { SpriteGrid } from './Library';
import { Dialog } from './Pick';
import { useSprite } from './sprites';

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** A name for a thing made from a library picture: "key" gives Key, "car-body" CarBody. */
const nameFromSprite = (id: string) => id.replace(/^btn-/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('').replace(/[^A-Za-z0-9_]/g, '') || 'Thing';

type GameAssets = GameProject['assets'];

/**
 * A list's first items, typed with commas between them. What is typed is kept as it is while typing (a comma
 * that has nothing after it yet would otherwise vanish); each change is saved as the items it gives.
 */
function ListItems({ initial, kind, onChange }: { initial: (number | string)[]; kind: 'number' | 'text'; onChange: (items: (number | string)[]) => void }) {
  const [draft, setDraft] = useState(() => initial.map(String).join('، '));
  const read = (text: string) => {
    const parts = text.split(/[,،]/).map((s) => s.trim()).filter((s) => s !== '');
    return kind === 'number' ? parts.map(Number).filter((n) => Number.isFinite(n)) : parts;
  };
  return (
    <TextField
      label="چیزهای اول بازی (با ویرگول جدا کن)"
      dir={kind === 'text' ? 'auto' : 'ltr'}
      value={draft}
      onChange={(text) => {
        setDraft(text);
        onChange(read(text));
      }}
    />
  );
}

/**
 * What is wrong with a name for a new value, with parts or without (item 2), next to the values the game has; null
 * when it is fine. A value cannot also be a group of others: with player.hp, "player" is a group.
 */
function nameProblem(name: string, all: { name: string }[]): string | null {
  if (!VALUE_NAME.test(name)) return 'نام باید با حروف انگلیسی باشد، بدون فاصله؛ مثل lives، یا چند بخش با نقطه، مثل player.hp';
  if (all.some((v) => v.name === name)) return 'این نام قبلاً استفاده شده است.';
  if (all.some((v) => nameGroups(v.name).includes(name))) return `«${name}» چند بخش دارد و خودش نمی‌تواند یک مقدار باشد.`;
  const taken = nameGroups(name).find((g) => all.some((v) => v.name === g));
  return taken ? `«${taken}» خودش یک مقدار است و نمی‌تواند بخش داشته باشد.` : null;
}

/** Whether a value is one of the parts of a value with parts. */
const hasParts = (name: string) => name.includes('.');

/**
 * A value with named parts (item 2): every number, text and list whose name starts with `group.`, under one
 * heading, each part set in under the parts it is inside (player › stats › hp), with one setting that keeps
 * them all on the phone, and a form for another part.
 */
function ValueGroup({ group, editor }: { group: string; editor: Editor }) {
  const { project, change } = editor;
  const [part, setPart] = useState('');
  const [kind, setKind] = useState('number');
  const texts = project.textVariables ?? [];
  const lists = project.lists ?? [];
  const inGroup = (name: string) => name.startsWith(group + '.');
  const numbers = project.variables.filter((v) => !v.item && inGroup(v.name));
  const words = texts.filter((v) => inGroup(v.name));
  const parts = [
    ...numbers.map((v) => ({ name: v.name, kind: 'number' as const })),
    ...words.map((v) => ({ name: v.name, kind: 'text' as const })),
    ...lists.filter((l) => inGroup(l.name)).map((l) => ({ name: l.name, kind: 'list' as const })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const keepable = [...numbers, ...words];
  const allSaved = keepable.length > 0 && keepable.every((v) => v.saved);
  const isUsed = (p: { name: string; kind: string }) => (p.kind === 'list' ? isListUsed(project, p.name) : isVariableUsed(project, p.name));
  const used = parts.some(isUsed);
  const full = `${group}.${part}`;
  const error = part === '' ? null : nameProblem(full, [...project.variables, ...texts, ...lists]);
  const without = (names: Set<string>) => ({
    ...project,
    variables: project.variables.filter((v) => !names.has(v.name)),
    textVariables: texts.filter((v) => !names.has(v.name)),
    lists: lists.filter((l) => !names.has(l.name)),
  });
  const addPart = () => {
    if (error || part === '') return;
    const next = kind === 'text'
      ? { ...project, textVariables: [...texts, { name: full, initial: '', saved: allSaved }] }
      : kind === 'list' || kind === 'textList'
        ? { ...project, lists: [...lists, { name: full, kind: kind === 'list' ? ('number' as const) : ('text' as const), initial: [] }] }
        : { ...project, variables: [...project.variables, { name: full, initial: 0, saved: allSaved }] };
    change(next, `variable.add.${full}`);
    setPart('');
  };
  // Each part under the parts it is inside, those named once above it, as the list is in order of names.
  const rows: ReactNode[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const inner = p.name.slice(group.length + 1).split('.');
    inner.slice(0, -1).forEach((segment, depth) => {
      const path = inner.slice(0, depth + 1).join('.');
      if (seen.has(path)) return;
      seen.add(path);
      rows.push(<div key={`group.${path}`} className="variable-subgroup" style={{ marginInlineStart: depth * 16 }}><bdi dir="ltr" className="variable-name">{segment}</bdi></div>);
    });
    const partUsed = isUsed(p);
    const list = lists.find((l) => l.name === p.name);
    rows.push(
      <div key={p.name} className="variable-part" data-variable={p.name} style={{ marginInlineStart: (inner.length - 1) * 16 }}>
        <div className="variable-head">
          <bdi dir="ltr" className="variable-name">{inner[inner.length - 1]}</bdi>
          <span className="control-hint">{p.kind === 'number' ? 'عدد' : p.kind === 'text' ? 'متن' : list?.kind === 'text' ? 'فهرست متنی' : 'فهرست عددی'}</span>
          <button type="button" className="link link-danger" disabled={partUsed} title={partUsed ? 'یک قانون یا رفتار از این بخش استفاده می‌کند.' : undefined}
            onClick={() => change(without(new Set([p.name])), `variable.remove.${p.name}`)}>
            {partUsed ? 'در حال استفاده' : 'حذف'}
          </button>
        </div>
        {p.kind === 'number' && (
          <NumberField label="مقدار اول بازی" value={numbers.find((v) => v.name === p.name)!.initial}
            onChange={(initial) => change({ ...project, variables: project.variables.map((v) => (v.name === p.name ? { ...v, initial } : v)) }, `variable.${p.name}.initial`)} />
        )}
        {p.kind === 'text' && (
          <TextField label="متن اول بازی" dir="ltr" value={words.find((v) => v.name === p.name)!.initial}
            onChange={(initial) => change({ ...project, textVariables: texts.map((v) => (v.name === p.name ? { ...v, initial } : v)) }, `text.${p.name}.initial`)} />
        )}
        {list && <ListItems initial={list.initial} kind={list.kind} onChange={(initial) => change({ ...project, lists: lists.map((x) => (x.name === p.name ? { ...x, initial } : x)) }, `list.${p.name}.initial`)} />}
      </div>,
    );
  }
  return (
    <div className="variable variable-group" data-value-group={group}>
      <div className="variable-head">
        <bdi dir="ltr" className="variable-name">{group}</bdi>
        <button type="button" className="link link-danger" disabled={used} title={used ? 'یک قانون یا رفتار از یکی از بخش‌هایش استفاده می‌کند.' : undefined}
          onClick={() => change(without(new Set(parts.map((p) => p.name))), `variable.remove.${group}`)}>
          {used ? 'در حال استفاده' : 'حذف'}
        </button>
      </div>
      <p className="control-hint">چند بخشی؛ در قانون‌ها و متن‌ها با نام کامل، مثل <bdi dir="ltr">{`{${parts[0]?.name ?? group + '.hp'}}`}</bdi></p>
      {rows}
      {keepable.length > 0 && (
        <Check label="همه‌ی بخش‌ها روی گوشی بمانند" hint="با بستن بازی پاک نمی‌شوند؛ بخشی که بعداً اضافه شود هم می‌ماند." value={allSaved}
          onChange={(saved) => change({
            ...project,
            variables: project.variables.map((v) => (!v.item && inGroup(v.name) ? { ...v, saved } : v)),
            textVariables: texts.map((v) => (inGroup(v.name) ? { ...v, saved } : v)),
          }, `variable.${group}.saved`)} />
      )}
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); addPart(); }}>
        <select aria-label={`نوع بخش تازه‌ی ${group}`} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="number">عدد</option><option value="text">متن</option><option value="list">فهرست عددها</option><option value="textList">فهرست متن‌ها</option>
        </select>
        <input type="text" dir="ltr" aria-label={`نام بخش تازه‌ی ${group}`} placeholder="hp" value={part} onChange={(e) => setPart(e.target.value.trim())} />
        <button type="submit" className="chip" data-add-part={group} disabled={Boolean(error) || part === ''}>+ بخش تازه</button>
      </form>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/** Settings of the whole game: identity, the current scene, variables, the Android app, and ads. */
export function GamePanel({ editor }: { editor: Editor }) {
  const { project, scene, change } = editor;
  const { meta, app, ads } = project;
  const [newVariable, setNewVariable] = useState('');
  const [variableKind, setVariableKind] = useState('number');
  const texts = project.textVariables ?? [];
  const lists = project.lists ?? [];
  const allVariables = [...project.variables, ...texts, ...lists];
  const variableError =
    newVariable === '' ? null
    : nameProblem(newVariable, allVariables);
  // Values with parts (item 2), each group once, in the order they were made.
  const groups = [...new Set([...project.variables.filter((v) => !v.item), ...texts, ...lists].filter((v) => hasParts(v.name)).map((v) => v.name.split('.')[0]))];

  const setMeta = (patch: Partial<typeof meta>, key: string) => change({ ...project, meta: { ...meta, ...patch } }, `meta.${key}`);
  const setApp = (patch: Partial<typeof app>, key: string) => change({ ...project, app: { ...app, ...patch } }, `app.${key}`);
  const setAds = (patch: Partial<typeof ads>, key: string) => change({ ...project, ads: { ...ads, ...patch } }, `ads.${key}`);
  const setScene = (patch: Partial<typeof scene>, key: string) => change(updateScene(project, scene.id, (s) => ({ ...s, ...patch })), `scene.${key}`);

  const setOrientation = (orientation: typeof meta.orientation) => {
    if (orientation === meta.orientation) return;
    // Turning the screen swaps its two sides, and each scene's world with it, so no world ends up
    // smaller than the screen. Objects keep their positions and may need rearranging.
    change(
      {
        ...project,
        meta: { ...meta, orientation, width: meta.height, height: meta.width },
        scenes: project.scenes.map((s) => ({ ...s, width: s.height, height: s.width })),
      },
      'meta.orientation',
    );
  };

  const addVariable = () => {
    if (variableError || newVariable === '') return;
    const next = variableKind === 'text'
      ? { ...project, textVariables: [...texts, { name: newVariable, initial: '', saved: false }] }
      : variableKind === 'list' || variableKind === 'textList'
        ? { ...project, lists: [...lists, { name: newVariable, kind: variableKind === 'list' ? ('number' as const) : ('text' as const), initial: [] }] }
        : { ...project, variables: [...project.variables, { name: newVariable, initial: 0, saved: false }] };
    change(next, `variable.add.${newVariable}`);
    setNewVariable('');
  };
  const setVariable = (name: string, patch: { initial?: number; saved?: boolean; item?: { asset: string } }, key: string) =>
    change({ ...project, variables: project.variables.map((v) => (v.name === name ? { ...v, ...patch } : v)) }, `variable.${name}.${key}`);

  // A sprite sheet or texture atlas from another tool (TexturePacker, Aseprite, Kenney's XML): every picture on it
  // becomes a picture of the game; if it has animations (Aseprite tags, or frames named walk_a, walk_b…), an
  // object that plays them is added to the scene.
  const [sheetNote, setSheetNote] = useState<string | null>(null);
  const importSheet = async () => {
    const files = await pickFiles('.png,.webp,.json,.xml,image/png,application/json,text/xml');
    const picture = files.find((f) => f.type.startsWith('image/'));
    const atlasFile = files.find((f) => /\.(json|xml)$/i.test(f.name));
    if (!picture || !atlasFile) return setSheetNote('دو فایل را با هم انتخاب کن: عکس ورق (PNG) و فایل JSON یا XML کنارش.');
    try {
      const prefix = picture.name.replace(/\.[a-z]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sheet';
      const made = await importAtlas(project, await readDataUrl(picture), await atlasFile.text(), prefix);
      let next = made.project;
      const roles = (['rest', 'run', 'jump', 'hurt'] as const).filter((r) => made.animations[r]?.length);
      if (roles.length && (made.animations.run?.length || (made.animations.rest?.length ?? 0) > 1)) {
        const first = made.keys.values().next().value as string;
        const object = makeObject(prefix, animatedVisual(made.animations, first), 120, 120, { x: scene.width / 2, y: scene.height / 2 });
        next = updateScene(next, scene.id, (s) => ({ ...s, objects: [...s.objects, object] }));
      }
      change(next, 'assets.importAtlas');
      const words = { rest: 'ایستادن', run: 'راه رفتن', jump: 'پریدن', hurt: 'ضربه خوردن' };
      setSheetNote(`${made.keys.size.toLocaleString('fa-IR')} عکس اضافه شد.${roles.length ? ` انیمیشن‌ها: ${roles.map((r) => words[r]).join('، ')}؛ یک شیء با همین انیمیشن‌ها در صحنه گذاشته شد.` : ''}`);
    } catch (error) {
      setSheetNote(`این ورق خوانده نشد: ${(error as Error).message}`);
    }
  };

  // A level made in Tiled: its .tmj, and the pictures of its tilesets if they are to be used (flagship Phase E).
  const importLevel = async () => {
    const files = await pickFiles('.tmj,.json,.png,application/json,image/png');
    const map = files.find((f) => /\.(tmj|json)$/i.test(f.name));
    if (!map) return setSheetNote('فایل نقشه‌ی Tiled را انتخاب کن (با پسوند .tmj)، و اگر می‌خواهی عکس‌های خانه‌ها هم بیایند، عکس tileset را هم همراهش.');
    try {
      const images = new Map<string, string>();
      for (const f of files) if (f.type.startsWith('image/')) images.set(f.name, await readDataUrl(f));
      const made = await placeTiled(project, scene.id, await map.text(), images);
      change(made.project, 'scene.importTiled');
      setSheetNote(`از Tiled: ${made.maps.toLocaleString('fa-IR')} نقشه و ${made.things.toLocaleString('fa-IR')} شیء به همین صحنه آمد. هر شیء در گروهی به نام class خودش است.`);
    } catch (error) {
      setSheetNote(`این نقشه خوانده نشد: ${(error as Error).message}`);
    }
  };

  // Things the player carries: numbers with a picture, shown in a bag.
  const items = project.variables.filter((v) => v.item);
  const [itemName, setItemName] = useState('');
  /** The picture dialog: open to make a new thing, or to change the picture of `replace`. */
  const [picking, setPicking] = useState<null | { replace?: string }>(null);
  const itemError =
    itemName === '' ? null
    : !NAME.test(itemName) ? 'نام باید با حروف انگلیسی باشد، بدون فاصله؛ مثل Key'
    : allVariables.some((v) => v.name === itemName) ? 'این نام قبلاً استفاده شده است.'
    : null;
  const pickItemPicture = async (picture: { sprite: string } | { src: string }) => {
    const target = picking;
    setPicking(null);
    if (!target) return;
    let next = project;
    let asset: string;
    if ('sprite' in picture) {
      const placed = await useSprite(project, picture.sprite);
      [next, asset] = [placed.project, placed.asset];
    } else {
      asset = newId('img');
      next = { ...project, assets: { ...project.assets, [asset]: { type: 'image', src: picture.src } } };
    }
    if (target.replace) {
      change({ ...next, variables: next.variables.map((v) => (v.name === target.replace ? { ...v, item: { asset } } : v)) }, `item.${target.replace}.picture`);
      return;
    }
    // Without a name of its own, the thing is named after its picture, made unique if need be.
    const base = itemName || ('sprite' in picture ? nameFromSprite(picture.sprite) : 'Thing');
    let name = base;
    for (let n = 2; [...next.variables, ...(next.textVariables ?? [])].some((v) => v.name === name); n++) name = `${base}${n}`;
    change({ ...next, variables: [...next.variables, { name, initial: 0, saved: false, item: { asset } }] }, `item.add.${name}`);
    setItemName('');
  };

  const sounds = Object.entries(project.assets).flatMap(([id, a]) => (a.type === 'sound' ? [{ id, name: a.name }] : []));
  const [soundError, setSoundError] = useState<string | null>(null);
  const addSounds = async () => {
    const added: GameAssets = {};
    setSoundError(null);
    for (const file of await pickFiles('audio/*')) {
      // Sounds live inside the game file; a very large one would bloat the game and its download.
      if (file.size > 6 * 1024 * 1024) setSoundError(`«${file.name}» از ۶ مگابایت بزرگ‌تر است و اضافه نشد.`);
      else added[newId('snd')] = { type: 'sound', name: file.name, src: await readDataUrl(file) };
    }
    if (Object.keys(added).length > 0) change({ ...project, assets: { ...project.assets, ...added } }, `sound.add.${Object.keys(added)[0]}`);
  };
  const [makingSound, setMakingSound] = useState(false);
  const [makingMusic, setMakingMusic] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const refreshVersions = () => void listVersions().then(setVersions);
  useEffect(refreshVersions, []);
  const isSoundUsed = (id: string) =>
    project.scenes.some((s) => s.music === id || s.rules.some((r) => ruleActions(r).some((a) => (a.type === 'playSound' && a.sound === id) || (a.type === 'playMusic' && a.music === id))));
  const removeSound = (id: string) => {
    const assets = { ...project.assets };
    delete assets[id];
    change({ ...project, assets }, `sound.remove.${id}`);
  };

  /** Plays a scene's music here in the panel, to hear it before choosing; a second press stops it. */
  const [listening, setListening] = useState(false);
  const heard = useRef(false);
  const listen = (id: string) => {
    if (listening) {
      setMusic(null);
      setListening(false);
      heard.current = false;
      return;
    }
    const src = isBuiltinMusic(id) ? builtinMusic(id) : project.assets[id]?.type === 'sound' ? project.assets[id].src : null;
    setMusic(src);
    setListening(Boolean(src));
    heard.current = Boolean(src);
  };
  // Leaving the panel stops what was being listened to (and only that).
  useEffect(() => () => {
    if (heard.current) setMusic(null);
  }, []);

  const setIcon = async () => {
    const file = await pickFile('image/*');
    if (file) setApp({ icon: (await readImage(file, 512)).src }, 'icon');
  };

  return (
    <>
      <Section title="مشخصات بازی">
        <TextField label="نام بازی" hint="همین نام زیر آیکون بازی روی گوشی نوشته می‌شود." value={meta.name} onChange={(name) => setMeta({ name }, 'name')} />
        <Choice label="جهت صفحه" value={meta.orientation} options={[{ value: 'portrait', label: 'عمودی' }, { value: 'landscape', label: 'افقی' }]} onChange={setOrientation} />
        <ColorField label="رنگ پس‌زمینه" value={meta.background} onChange={(background) => setMeta({ background }, 'background')} />
        <Select
          label="فونت متن‌های بازی"
          value={meta.fontFamily}
          options={[
            { value: FONTS[0], label: 'Fredoka — گرد و دوستانه' },
            { value: FONTS[1], label: 'Bangers — کمیک و پرانرژی' },
            { value: FONTS[2], label: 'Press Start 2P — پیکسلی، قدیمی' },
            { value: FONTS[3], label: 'Kenney Future — گرد و مرتب، برای منو' },
          ]}
          onChange={(fontFamily) => setMeta({ fontFamily }, 'font')}
        />
        <Choice
          label="رفتن از صحنه‌ای به صحنه‌ی دیگر"
          value={meta.transition ?? 'fade'}
          options={[{ value: 'fade', label: 'با محو شدن نرم' }, { value: 'none', label: 'یک‌دفعه' }]}
          onChange={(transition) => setMeta({ transition }, 'transition')}
        />
        <Check label="صدا داشته باشد" value={project.sound} onChange={(sound) => change({ ...project, sound }, 'sound')} />
      </Section>

      <Section title={`صحنه‌ی «${scene.name}»`}>
        <TextField label="نام صحنه" value={scene.name} onChange={(name) => setScene({ name }, 'name')} />
        <Slider label="جاذبه" hint="فقط روی اشیایی اثر دارد که «جسم فیزیکی» هستند. صفر یعنی بدون جاذبه." min={0} max={6000} step={100} value={scene.gravity} onChange={(gravity) => setScene({ gravity }, 'gravity')} />
        <NumberField
          label="اندازه‌ی خانه‌ها"
          hint="برای بازی‌های صفحه‌ای مثل کارت حافظه و دوز. صفر یعنی بدون خانه‌بندی. با خانه‌بندی، اشیا در ویرایشگر به خانه‌ها می‌چسبند."
          value={scene.cell ?? 0}
          onChange={(cell) => setScene({ cell: Math.max(0, cell) }, 'cell')}
        />
        <div className="pair">
          <NumberField label="پهنای دنیا" value={scene.width} onChange={(n) => setScene({ width: Math.max(meta.width, Math.round(n)) }, 'width')} />
          <NumberField label="بلندی دنیا" value={scene.height} onChange={(n) => setScene({ height: Math.max(meta.height, Math.round(n)) }, 'height')} />
        </div>
        <p className="control-hint">
          صفحه <bdi dir="ltr">{meta.width}×{meta.height}</bdi> است. اگر دنیا را بزرگ‌تر کنی، به بازیکن رفتار «دوربین دنبالش بیاید» بده. در ویرایشگر با کشیدن جای خالی، دنیا را جابه‌جا می‌بینی.
        </p>
        <Check label="این صحنه رنگ پس‌زمینه‌ی خودش را داشته باشد" value={scene.background !== null} onChange={(on) => setScene({ background: on ? meta.background : null }, 'background.on')} />
        {scene.background !== null && <ColorField label="رنگ پس‌زمینه‌ی این صحنه" value={scene.background} onChange={(background) => setScene({ background }, 'background')} />}
        <Select
          label="موسیقی این صحنه"
          hint="تا وقتی بازی در این صحنه است، پشت‌سرهم پخش می‌شود. «موسیقی آماده» همراه بازی‌ساز است؛ موسیقی خودت را در بخش «صداها» اضافه کن."
          value={scene.music ?? ''}
          options={[{ value: '', label: 'بدون موسیقی' }, ...BUILTIN_MUSIC_OPTIONS, ...sounds.map((s) => ({ value: s.id, label: s.name }))]}
          onChange={(id) => setScene({ music: id || null }, 'music')}
        />
        <div className="adders">
          {scene.music && <button type="button" className="chip" onClick={() => listen(scene.music!)}>{listening ? '■ قطع' : '▶ گوش بده'}</button>}
          <button type="button" className="chip" data-make-music onClick={() => setMakingMusic(true)}>🎵 ساختن موسیقی</button>
        </div>
        {makingMusic && (
          <MusicMaker
            onClose={() => setMakingMusic(false)}
            onAdd={(name, src) => {
              // The new piece becomes this scene's music at once.
              const id = newId('snd');
              const withMusic = { ...project, assets: { ...project.assets, [id]: { type: 'sound' as const, name, src } } };
              change(updateScene(withMusic, scene.id, (s) => ({ ...s, music: id })), `music.make.${id}`);
              setMakingMusic(false);
            }}
          />
        )}
        <Select
          label="پس‌زمینه‌ی نقاشی‌شده"
          hint="آسمان و منظره‌ای چندلایه پشت بازی؛ لایه‌های دورتر با حرکت دوربین آهسته‌تر می‌روند و ابر، ستاره، حباب یا برف زنده‌اند."
          value={scene.sky ?? 'none'}
          options={SKY_OPTIONS}
          onChange={(sky) => setScene({ sky: sky as Sky }, 'sky')}
        />
        <Select
          label="آب و هوا"
          hint="روی کل صفحه: باران، طوفان با رعد و برق، برف، برگ‌ریزان، جرقه‌ی آتش یا مه. فقط برای دیدن است و به چیزی نمی‌خورد."
          value={scene.weather ?? 'none'}
          options={WEATHER_OPTIONS}
          onChange={(weather) => setScene({ weather: weather as Weather }, 'weather')}
        />
        <Slider
          label="شب و روز"
          hint="چند ثانیه طول بکشد تا یک روز و یک شب کامل بگذرد؛ صحنه آرام تاریک می‌شود، شب می‌شود و دوباره روز. صفر یعنی همیشه همین‌طور. در شب فقط اشیایی که «نور» دارند روشن‌اند."
          min={0}
          max={300}
          step={5}
          value={scene.dayLength ?? 0}
          onChange={(dayLength) => setScene({ dayLength }, 'dayLength')}
        />
        <Select label="ظاهر قدیمی" hint="کل بازی را مثل بازی‌های قدیمی نشان می‌دهد. روی گوشی ضعیف، صفحه‌ی تلویزیون و فیلم قدیمی خودکار خاموش می‌شوند." value={scene.retro ?? 'none'} options={RETRO_OPTIONS} onChange={(retro) => setScene({ retro: retro as Retro }, 'retro')} />
        <Check label="درخشش نورها" hint="چیزهای روشن (آتش، نور، ستاره، خورشید) هاله‌ی نرمی دورشان دارند. روی گوشی ضعیف کمی سنگین است." value={scene.bloom ?? false} onChange={(bloom) => setScene({ bloom }, 'bloom')} />
        <Slider
          label="تاریکی صحنه"
          hint="صفر یعنی روشن. با تاریکی، فقط اطراف اشیایی که رفتار «نور» دارند دیده می‌شود. در ویرایشگر نصفِ تاریکی نشان داده می‌شود تا بتوانی کار کنی."
          min={0}
          max={1}
          step={0.05}
          value={scene.darkness ?? 0}
          onChange={(darkness) => setScene({ darkness }, 'darkness')}
        />
        <Select label="حال و هوای تصویر" hint="مثل فیلتر عکس، رنگ کل تصویر را عوض می‌کند." value={scene.look ?? 'none'} options={LOOK_OPTIONS} onChange={(look) => setScene({ look: look as Look }, 'look')} />
        <Check label="گوشه‌های صفحه تیره باشد" hint="چشم به وسط صفحه می‌رود؛ حس سینمایی می‌دهد." value={scene.vignette ?? false} onChange={(vignette) => setScene({ vignette }, 'vignette')} />
        <Check label="بازی با این صحنه شروع شود" value={project.startScene === scene.id} disabled={project.startScene === scene.id} onChange={() => change({ ...project, startScene: scene.id }, 'startScene')} />
        {project.scenes.length > 1 && (
          <button type="button" className="link link-danger" onClick={() => change(removeScene(project, scene.id), `scene.remove.${scene.id}`)}>
            حذف این صحنه
          </button>
        )}
      </Section>

      <Section title="عکس‌ها" about="همه‌ی عکس‌هایی که در این بازی هستند، و اینکه در چند جا به کار رفته‌اند. عکسی که دیگر جایی به کار نمی‌رود فقط فایل بازی را سنگین می‌کند؛ «حذف عکس‌های بی‌استفاده» همه‌شان را با هم برمی‌دارد (با «یک قدم به عقب» برمی‌گردند).">
        {(() => {
          const images = Object.entries(project.assets).filter(([, a]) => a.type === 'image');
          // An image is used wherever its id appears in the game outside the list of pictures itself.
          const rest = JSON.stringify({ ...project, assets: {} });
          const uses = (id: string) => rest.split(JSON.stringify(id)).length - 1;
          const unused = images.filter(([id]) => uses(id) === 0).map(([id]) => id);
          const kb = (src: string) => Math.max(1, Math.round((src.length * 0.75) / 1024));
          return (
            <>
              <div className="asset-grid">
                {images.map(([id, a]) => (
                  <figure key={id} className={uses(id) === 0 ? 'asset unused' : 'asset'} data-asset={id} title={uses(id) === 0 ? 'به کار نرفته' : 'در ' + uses(id).toLocaleString('fa-IR') + ' جا'}>
                    <img src={a.src} alt="" />
                    <figcaption>{uses(id) === 0 ? 'بی‌استفاده' : uses(id).toLocaleString('fa-IR') + ' جا'} · {kb(a.src).toLocaleString('fa-IR')}KB</figcaption>
                  </figure>
                ))}
              </div>
              {images.length === 0 && <p className="hint">هنوز عکسی در بازی نیست.</p>}
              <div className="adders">
                <button type="button" className="chip" data-import-atlas onClick={() => void importSheet()}>+ ورق عکس (PNG با JSON یا XML)</button>
                <button type="button" className="chip" data-import-tiled onClick={() => void importLevel()}>+ مرحله از Tiled (.tmj)</button>
              </div>
              {sheetNote && <p className="hint" data-atlas-note>{sheetNote}</p>}
              {unused.length > 0 && (
                <div className="adders">
                  <button type="button" className="chip" data-remove-unused onClick={() => {
                    const assets = { ...project.assets };
                    for (const id of unused) delete assets[id];
                    change({ ...project, assets }, 'assets.removeUnused');
                  }}>🧹 حذف {unused.length.toLocaleString('fa-IR')} عکس بی‌استفاده</button>
                </div>
              )}
            </>
          );
        })()}
      </Section>

      <Section title="صداها" about="فایل‌های صدا و موسیقی خودت (mp3، ogg یا wav). صدا را با کار «پخش صدا» در قانون‌ها پخش کن و موسیقی را برای هر صحنه انتخاب کن.">
        {sounds.map((s) => {
          const used = isSoundUsed(s.id);
          return (
            <div key={s.id} className="variable-head">
              <bdi dir="ltr" className="variable-name">{s.name}</bdi>
              <button type="button" className="link link-danger" disabled={used} title={used ? 'یک قانون یا صحنه از این صدا استفاده می‌کند.' : undefined} onClick={() => removeSound(s.id)}>
                {used ? 'در حال استفاده' : 'حذف'}
              </button>
            </div>
          );
        })}
        <div className="adders">
          <button type="button" className="chip" onClick={() => void addSounds()}>+ صدا یا موسیقی</button>
          <button type="button" className="chip" data-make-sound onClick={() => setMakingSound(true)}>🔊 ساختن صدا</button>
        </div>
        {soundError && <p className="field-error">{soundError}</p>}
      </Section>

      {makingSound && (
        <SfxMaker
          onClose={() => setMakingSound(false)}
          onAdd={(name, src) => {
            const id = newId('snd');
            change({ ...project, assets: { ...project.assets, [id]: { type: 'sound', name, src } } }, `sound.add.${id}`);
            setMakingSound(false);
          }}
        />
      )}

      <Section title="نقشه‌ی صحنه‌ها" about="همه‌ی صحنه‌های بازی و اینکه کدام به کدام می‌رود (با کار «رفتن به صحنه» یا «صحنه‌ی بعد»). صحنه‌ی شروع ستاره دارد. روی هر صحنه بزن تا بازش کنی.">
        <SceneMap project={project} current={scene.id} onOpen={(id) => editor.setScene(id)} />
      </Section>

      <Section title="نسخه‌های قبلی" about="بازی هر چند دقیقه یک بار خودش یک نسخه نگه می‌دارد؛ قبل از یک تغییر بزرگ، خودت هم «نگه داشتن این نسخه» را بزن. «برگرداندن» بازی را به همان نسخه برمی‌گرداند، و با «واگرد» می‌شود دوباره برگشت.">
        <div className="adders">
          <button type="button" className="chip" data-keep-version onClick={() => void keepVersion(project, 'دستی').then(refreshVersions)}>💾 نگه داشتن این نسخه</button>
        </div>
        {versions.map((v) => (
          <div key={v.at} className="variable-head" data-version={v.at}>
            <span className="variable-name">{new Date(v.at).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {v.label} · {v.project.scenes.reduce((n, s) => n + s.objects.length, 0).toLocaleString('fa-IR')} شیء</span>
            <button type="button" className="link" data-restore={v.at} onClick={() => change(v.project, `version.restore.${v.at}`)}>برگرداندن</button>
          </div>
        ))}
        {versions.length === 0 && <p className="hint">هنوز نسخه‌ای نگه داشته نشده.</p>}
      </Section>

      <Section
        title="کوله‌پشتی"
        about="وسیله‌هایی که بازیکن برمی‌دارد و با خودش دارد، مثل کلید، معجون یا شمشیر. هر وسیله یک نام و یک عکس دارد و تعدادش مثل یک مقدار است: در متن {Key} تعداد را نشان می‌دهد و در شرط می‌شود پرسید «Key دست‌کم ۱ باشد». برای نشان دادنشان، از کتابخانه «کوله‌پشتی» را به صحنه اضافه کن."
      >
        {items.map((v) => {
          const used = isVariableUsed(project, v.name);
          const picture = v.item ? project.assets[v.item.asset] : undefined;
          return (
            <div key={v.name} className="variable item" data-item={v.name}>
              <div className="variable-head">
                <span className="item-picture">{picture?.type === 'image' && <img src={picture.src} alt="" />}</span>
                <bdi dir="ltr" className="variable-name">{v.name}</bdi>
                <button
                  type="button"
                  className="link link-danger"
                  disabled={used}
                  title={used ? 'یک قانون از این وسیله استفاده می‌کند.' : undefined}
                  onClick={() => change({ ...project, variables: project.variables.filter((x) => x.name !== v.name) }, `variable.remove.${v.name}`)}
                >
                  {used ? 'در حال استفاده' : 'حذف'}
                </button>
              </div>
              <NumberField label="چند تا از اول دارد" value={v.initial} onChange={(initial) => setVariable(v.name, { initial: Math.max(0, Math.round(initial)) }, 'initial')} />
              <Check label="روی گوشی بماند" hint="با بستن بازی، وسیله‌ها در کوله‌پشتی می‌مانند." value={v.saved} onChange={(saved) => setVariable(v.name, { saved }, 'saved')} />
              <div className="adders">
                <button type="button" className="chip" onClick={() => setPicking({ replace: v.name })}>عوض کردن عکس</button>
              </div>
            </div>
          );
        })}
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (!itemError) setPicking({}); }}>
          <input type="text" dir="ltr" aria-label="نام وسیله‌ی تازه" placeholder="Key" value={itemName} onChange={(e) => setItemName(e.target.value.trim())} />
          <button type="submit" className="chip" data-new-item disabled={Boolean(itemError)}>+ وسیله‌ی تازه</button>
        </form>
        {itemError ? <p className="field-error">{itemError}</p> : <p className="control-hint">نام را خالی بگذاری، از روی عکس انتخاب می‌شود.</p>}
        {picking && (
          <Dialog wide title={picking.replace ? `عکس تازه برای ${picking.replace}` : 'عکس وسیله را انتخاب کن'} onClose={() => setPicking(null)}>
            <div className="adders">
              <button
                type="button"
                className="chip"
                onClick={() =>
                  void (async () => {
                    const file = await pickFile('image/*');
                    if (file) await pickItemPicture({ src: (await readImage(file, 256)).src });
                  })()
                }
              >
                عکس از کامپیوتر
              </button>
            </div>
            <SpriteGrid onPick={(sprite) => void pickItemPicture({ sprite: sprite.id })} />
          </Dialog>
        )}
      </Section>

      <Section title="مقدارها" about="عدد برای امتیاز و جان، یا متن برای نام و هدف مأموریت بساز. برای نمایش مقدار در بازی، نامش را داخل آکولاد بنویس؛ مثل {quest}. برای یک مقدار چند بخشی، بخش‌ها را با نقطه جدا کن؛ مثل player.hp و player.name.">
        {project.variables.filter((v) => !v.item && !hasParts(v.name)).map((v) => {
          const used = isVariableUsed(project, v.name);
          return (
            <div key={v.name} className="variable" data-variable={v.name}>
              <div className="variable-head">
                <bdi dir="ltr" className="variable-name">{v.name}</bdi>
                <button
                  type="button"
                  className="link link-danger"
                  disabled={used}
                  title={used ? 'یک قانون یا رفتار از این مقدار استفاده می‌کند.' : undefined}
                  onClick={() => change({ ...project, variables: project.variables.filter((x) => x.name !== v.name) }, `variable.remove.${v.name}`)}
                >
                  {used ? 'در حال استفاده' : 'حذف'}
                </button>
              </div>
              <NumberField label="مقدار اول بازی" value={v.initial} onChange={(initial) => setVariable(v.name, { initial }, 'initial')} />
              <Check label="روی گوشی بماند" hint="مثل بهترین امتیاز؛ با بستن بازی پاک نمی‌شود." value={v.saved} onChange={(saved) => setVariable(v.name, { saved }, 'saved')} />
            </div>
          );
        })}
        {texts.filter((v) => !hasParts(v.name)).map(v => {
          const used = isVariableUsed(project, v.name);
          const edit = (patch: { initial?: string; saved?: boolean }, field: string) =>
            change({ ...project, textVariables: texts.map(t => t.name === v.name ? { ...t, ...patch } : t) }, `text.${v.name}.${field}`);
          return <div className="variable" key={v.name}>
            <div className="variable-head">
              <bdi dir="ltr" className="variable-name">{v.name}</bdi>
              <button type="button" className="link link-danger" disabled={used}
                onClick={() => change({ ...project, textVariables: texts.filter(t => t.name !== v.name) }, `text.remove.${v.name}`)}>
                {used ? 'در حال استفاده' : 'حذف'}
              </button>
            </div>
            <TextField label="متن اول بازی" dir="ltr" value={v.initial} onChange={initial => edit({ initial }, 'initial')} />
            <Check label="روی گوشی بماند" value={v.saved} onChange={saved => edit({ saved }, 'saved')} />
          </div>;
        })}
        {lists.filter((l) => !hasParts(l.name)).map((l) => {
          const used = isListUsed(project, l.name);
          const setItems = (initial: (number | string)[]) =>
            change({ ...project, lists: lists.map((x) => (x.name === l.name ? { ...x, initial } : x)) }, `list.${l.name}.initial`);
          return (
            <div className="variable" key={l.name} data-list={l.name}>
              <div className="variable-head">
                <bdi dir="ltr" className="variable-name">{l.name}</bdi>
                <span className="control-hint">فهرست {l.kind === 'text' ? 'متنی' : 'عددی'}</span>
                <button type="button" className="link link-danger" disabled={used} title={used ? 'یک قانون از این فهرست استفاده می‌کند.' : undefined}
                  onClick={() => change({ ...project, lists: lists.filter((x) => x.name !== l.name) }, `list.remove.${l.name}`)}>
                  {used ? 'در حال استفاده' : 'حذف'}
                </button>
              </div>
              <ListItems initial={l.initial} kind={l.kind} onChange={setItems} />
            </div>
          );
        })}
        {groups.map((group) => <ValueGroup key={group} group={group} editor={editor} />)}
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); addVariable(); }}>
          <select aria-label="نوع مقدار تازه" value={variableKind} onChange={e => setVariableKind(e.target.value)}>
            <option value="number">عدد</option><option value="text">متن</option><option value="list">فهرست عددها</option><option value="textList">فهرست متن‌ها</option>
          </select>
          <input type="text" dir="ltr" aria-label="نام مقدار تازه" placeholder={variableKind === 'text' ? 'quest' : 'lives'} value={newVariable} onChange={(e) => setNewVariable(e.target.value.trim())} />
          <button type="submit" className="chip" disabled={Boolean(variableError) || newVariable === ''}>مقدار تازه</button>
        </form>
        {variableError && <p className="field-error">{variableError}</p>}
      </Section>

      <FeelPanel editor={editor} />

      <PlaytestPanel editor={editor} />

      <Section title="اپ اندروید" about="این‌ها برای ساختن فایل نصب و گذاشتن بازی در Google Play لازم‌اند.">
        <TextField
          label="شناسه‌ی اپ"
          dir="ltr"
          value={app.appId}
          onChange={(appId) => setApp({ appId: appId.trim().toLowerCase() }, 'appId')}
          hint="یک نام یکتا با حروف کوچک انگلیسی و نقطه، مثل com.yourname.mygame. بعد از انتشار دیگر قابل تغییر نیست."
        />
        {!APP_ID.test(app.appId) && <p className="field-error">این شناسه درست نیست. دست‌کم دو بخش با نقطه لازم است و هر بخش با حرف شروع می‌شود.</p>}
        {app.appId.startsWith('com.example.') && <p className="field-warning">Google Play شناسه‌هایی را که با com.example شروع می‌شوند قبول نمی‌کند. قبل از انتشار عوضش کن.</p>}
        <div className="pair">
          <NumberField label="شماره‌ی نسخه" hint="برای هر بار فرستادن به Google Play یکی زیاد کن." value={app.versionCode} onChange={(n) => setApp({ versionCode: Math.max(1, Math.round(n)) }, 'versionCode')} />
          <TextField label="نام نسخه" dir="ltr" value={app.versionName} onChange={(versionName) => setApp({ versionName }, 'versionName')} />
        </div>
        <div className="icon-row">
          {app.icon ? <img src={app.icon} alt="آیکون بازی" /> : <span className="icon-empty">بدون آیکون</span>}
          <div className="adders">
            <button type="button" className="chip" onClick={() => void setIcon()}>{app.icon ? 'عوض کردن آیکون' : 'انتخاب آیکون'}</button>
            {app.icon && <button type="button" className="chip" onClick={() => setApp({ icon: null }, 'icon')}>برداشتن</button>}
          </div>
        </div>
        <p className="control-hint">یک عکس مربع انتخاب کن. اگر مربع نباشد کشیده می‌شود.</p>
      </Section>

      <Section title="تبلیغات (AdMob)" about="تبلیغ فقط در فایل نصب‌شده روی گوشی دیده می‌شود، نه در این پیش‌نمایش.">
        <Check label="تبلیغات روشن باشد" value={ads.enabled} onChange={(enabled) => setAds({ enabled }, 'enabled')} />
        {ads.enabled && (
          <>
            <Check
              label="تبلیغ آزمایشی گوگل"
              hint="تا وقتی شناسه‌های خودت را نگذاشته‌ای روشن بماند. کلیک روی تبلیغ واقعی خودت باعث بسته شدن حساب می‌شود."
              value={ads.testMode}
              onChange={(testMode) => setAds({ testMode }, 'testMode')}
            />
            <TextField label="شناسه‌ی اپ در AdMob" dir="ltr" value={ads.appId} hint="شبیه ca-app-pub-0000000000000000~0000000000" onChange={(appId) => setAds({ appId: appId.trim() }, 'appId')} />
            <Check label="نوار تبلیغ پایین صفحه (بنر)" hint="روی پایین بازی می‌نشیند؛ دکمه یا متن مهمی آن‌جا نگذار." value={ads.banner} onChange={(banner) => setAds({ banner }, 'banner')} />
            {ads.banner && <TextField label="شناسه‌ی تبلیغ بنری" dir="ltr" value={ads.bannerId} onChange={(bannerId) => setAds({ bannerId: bannerId.trim() }, 'bannerId')} />}
            <TextField label="شناسه‌ی تبلیغ تمام‌صفحه" dir="ltr" value={ads.interstitialId} hint="با کار «نمایش تبلیغ تمام‌صفحه» در قانون‌ها نشان داده می‌شود." onChange={(interstitialId) => setAds({ interstitialId: interstitialId.trim() }, 'interstitialId')} />
            <TextField label="شناسه‌ی تبلیغ جایزه‌ای" dir="ltr" value={ads.rewardedId} hint="با کار «پیشنهاد تبلیغ جایزه‌ای» در قانون‌ها نشان داده می‌شود." onChange={(rewardedId) => setAds({ rewardedId: rewardedId.trim() }, 'rewardedId')} />
            {!ads.testMode && (!ads.appId || !ads.interstitialId) && <p className="field-warning">بدون شناسه‌ی اپ و شناسه‌ی تبلیغ، تبلیغ واقعی نشان داده نمی‌شود.</p>}
          </>
        )}
      </Section>
    </>
  );
}
