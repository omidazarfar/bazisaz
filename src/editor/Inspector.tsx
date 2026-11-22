import { useState } from 'react';
import { TerrainEditor } from './TerrainEditor';
import { ruleActions, type Behavior, type GameObject, type Rule, type Trigger, type Visual } from '../format/types';
import { Check, Choice, ColorField, NumberField, Section, Select, Slider, TextField } from './controls';
import type { Editor } from './editor';
import { Fields } from './Fields';
import { pickFile, pickFiles, readImage } from './images';
import { BEHAVIOR_GROUPS, BEHAVIORS, COMMON_BEHAVIORS, fa, whyNot, type Context } from './labels';
import { SpriteGrid, spriteVisual } from './Library';
import { ParticleEditor, changeParticleSetting } from './ParticleEditor';
import { emptyArt, PixelEditor, pngToArt, type PixelArt } from './PixelEditor';
import { TilesPanel } from './TilesPanel';
import { Dialog, PickButton } from './Pick';
import { PRESETS } from './presets';
import { actionSentence, describeObject, subjectsOf, triggerSentence } from './sentences';
import { allTags, duplicateObjects, findObject, newId, removeObject, removeObjects, tileObject, updateObject, updateScene, valueNames } from './state';

/** Settings of the selected object: name, groups, looks, place, and behaviors. */
/**
 * Templates: an object made into a template gets live copies. Whatever is
 * changed on any copy (looks, behaviors, groups, health) changes on all of
 * them; each keeps its own place, size and name.
 */
function TemplateTools({ editor, object }: { editor: Editor; object: GameObject }) {
  const { project, scene, change } = editor;
  const template = object.template ? scene.prefabs.find((p) => p.id === object.template) : undefined;
  const copies = template ? scene.objects.filter((o) => o.template === template.id).length : 0;
  if (!template) {
    return (
      <div className="adders" title="مثلاً یک دشمن را یک بار درست کن و بعد هر چند تا کپی که خواستی بگذار؛ تغییر یکی، همه را عوض می‌کند.">
        <button
          type="button"
          className="chip"
          data-make-template
          onClick={() => {
            const { template: _none, ...plain } = object;
            const made = { ...plain, id: newId('obj'), name: `نمونه‌ی ${object.name}`, x: 0, y: 0 };
            change(updateScene(project, scene.id, (s) => ({ ...s, prefabs: [...s.prefabs, made], objects: s.objects.map((o) => (o.id === object.id ? { ...o, template: made.id } : o)) })), `template.${object.id}`);
          }}
        >
          تبدیل به نمونه (برای کپی‌های زنده)
        </button>
      </div>
    );
  }
  return (
    <div className="field-warning template-note">
      کپیِ زنده‌ی «{template.name}» ({fa(copies)} تا در صحنه). هر تغییری اینجا، به‌جز جا و اندازه و نام، روی همه‌ی کپی‌ها انجام می‌شود.
      <div className="adders">
        <button
          type="button"
          className="chip"
          data-add-copy
          onClick={() => {
            const copy = { ...object, id: newId('obj'), name: `${template.name.replace(/^نمونه‌ی /, '')} ${fa(copies + 1)}`, x: object.x + object.width + 20 };
            change(updateScene(project, scene.id, (s) => ({ ...s, objects: [...s.objects, copy] })), `copy.${copy.id}`, copy.id);
          }}
        >
          + یک کپی دیگر
        </button>
        <button type="button" className="chip" onClick={() => change(updateObject(project, scene.id, object.id, ({ template: _t, ...o }) => o), `untemplate.${object.id}`)}>
          جدا کردن از نمونه
        </button>
      </div>
    </div>
  );
}

export function Inspector({ editor }: { editor: Editor }) {
  const { project, scene, selection, change } = editor;
  const found = selection ? findObject(scene, selection) : null;
  const [particleObject, setParticleObject] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [choosingPicture, setChoosingPicture] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [board, setBoard] = useState({ cols: 3, rows: 3 });
  /** The picture being painted in the pixel painter, while it is open. */
  const [painting, setPainting] = useState<PixelArt | null>(null);

  if (editor.selected.length > 1) return <ManyPanel editor={editor} />;
  if (!found) {
    return (
      <p className="empty">
        روی یک شیء در بازی یا در فهرست بزن تا تنظیماتش اینجا بیاید. برای جابه‌جا کردن، آن را در بازی بگیر و بکش. برای انتخاب چند شیء با هم، Shift را نگه دار و رویشان بزن، یا روی جای خالی صحنه بکش.
      </p>
    );
  }
  const { object, list } = found;
  const ctx: Context = { project, scene };
  const visual = object.visual;

  const update = (key: string, next: (o: GameObject) => GameObject, base = project) =>
    change(updateObject(base, scene.id, object.id, next), `${object.id}.${key}`);
  const setVisual = (key: string, patch: Partial<Visual>) =>
    update(key, (o) => ({ ...o, visual: { ...o.visual, ...patch } as Visual }));

  const setImage = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    const image = await readImage(file, 512);
    const asset = newId('img');
    const base = { ...project, assets: { ...project.assets, [asset]: { type: 'image' as const, src: image.src } } };
    // Keep the object's width and take the picture's shape.
    update('image', (o) => ({ ...o, visual: { kind: 'image', asset }, height: Math.round((o.width || 120) * (image.height / image.width)), width: o.width || 120 }), base);
  };

  /** Adds pictures to one of the object's animations: at rest, moving, or in the air. */
  const addFrames = async (set: 'frames' | 'moveFrames' | 'airFrames' | 'hurtFrames') => {
    if (visual.kind !== 'image') return;
    const files = await pickFiles('image/*');
    if (files.length === 0) return;
    const added: Record<string, { type: 'image'; src: string }> = {};
    for (const file of files) added[newId('img')] = { type: 'image', src: (await readImage(file, 512)).src };
    const base = { ...project, assets: { ...project.assets, ...added } };
    update(set, (o) => ({ ...o, visual: { ...visual, [set]: [...(visual[set] ?? []), ...Object.keys(added)], fps: visual.fps ?? 8 } }), base);
  };

  /** A picture painted here before can be painted again; anything else starts from a blank sheet. */
  const ownPainting = visual.kind === 'image' ? project.assets[visual.asset] : undefined;
  const paintable = ownPainting?.type === 'image' && ownPainting.pixel ? ownPainting : null;
  const startPainting = async () => setPainting(paintable && visual.kind === 'image' ? await pngToArt(paintable.src, paintable.pixel!) : emptyArt(16));
  const savePainting = (art: PixelArt, src: string) => {
    setPainting(null);
    if (paintable && visual.kind === 'image') {
      // Painted again: every object showing this picture changes with it.
      change({ ...project, assets: { ...project.assets, [visual.asset]: { type: 'image', src, pixel: art.size } } }, `${visual.asset}.repaint.${newId('p')}`);
      return;
    }
    const asset = newId('img');
    const base = { ...project, assets: { ...project.assets, [asset]: { type: 'image' as const, src, pixel: art.size } } };
    update('paint', (o) => ({ ...o, visual: { kind: 'image', asset }, width: o.width || 128, height: o.width || 128 }), base);
  };

  const duplicate = () => {
    const made = duplicateObjects(project, scene.id, [object.id]);
    change(made.project, `copy.${made.ids[0]}`, made.ids[0]);
  };

  /** Gives the object a picture from the library, keeping its width. */
  const setLibraryPicture = async (sprite: Parameters<typeof spriteVisual>[1]) => {
    setChoosingPicture(false);
    const made = await spriteVisual(project, sprite);
    const width = object.width || sprite.width;
    update('image', (o) => ({ ...o, visual: made.visual, width, height: Math.round(width * (sprite.height / sprite.width)), behaviors: o.behaviors }), made.project);
  };

  // Rules that mention this object, by itself or through one of its groups.
  const mentions = (ref: unknown): boolean =>
    typeof ref === 'object' && ref !== null && (('id' in ref && ref.id === object.id) || ('tag' in ref && object.tags.includes(ref.tag as string)));
  const involved = scene.rules.filter((r) => {
    const w = r.when;
    const refs = w.type === 'touch' || w.type === 'near' || w.type === 'hit' ? [w.a, w.b] : 'target' in w ? [w.target] : [];
    return refs.some(mentions) || ruleActions(r).some((a) => ('target' in a && mentions(a.target)) || (a.type === 'blast' && mentions(a.at)) || (a.type === 'spawn' && (a.prefab === object.id || mentions(a.at))));
  });
  const addRule = (when: Trigger) => {
    const rule: Rule = { id: newId('rule'), when, condition: null, then: [] };
    change(updateScene(project, scene.id, (s) => ({ ...s, rules: [...s.rules, rule] })), `add.${rule.id}`);
    editor.showRule(rule.id);
  };
  const summary = describeObject(scene, object);
  const me = { by: 'id' as const, id: object.id };
  const other = scene.objects.find((o) => o.id !== object.id);

  const reorder = (toFront: boolean) =>
    change(
      updateScene(project, scene.id, (s) => {
        const rest = s[list].filter((o) => o.id !== object.id);
        return { ...s, [list]: toFront ? [...rest, object] : [object, ...rest] };
      }),
      `order.${object.id}`,
    );

  const setBehavior = (index: number, key: string, value: unknown) => {
    const before = object.behaviors[index];
    const next = before.type === 'particles' ? changeParticleSetting(before, key, value) : { ...before, [key]: value } as Behavior;
    // Water measures its strength on another scale than wind and magnets; each kind starts from a strength that works.
    if (next.type === 'field' && key === 'kind') next.strength = next.kind === 'water' ? 1 : 3000;
    if (next.type === 'spawner') {
      if (key === 'minInterval' && next.minInterval > next.maxInterval) next.maxInterval = next.minInterval;
      if (key === 'maxInterval' && next.maxInterval < next.minInterval) next.minInterval = next.maxInterval;
    }
    update(`${next.type}.${key}`, (o) => ({ ...o, behaviors: o.behaviors.map((b, i) => (i === index ? next : b)) }));
  };
  const removeBehavior = (type: Behavior['type']) =>
    // A jumper cannot exist without a body, so removing the body takes the jumper with it.
    update(`remove.${type}`, (o) => ({ ...o, behaviors: o.behaviors.filter((b) => b.type !== type && !(type === 'body' && b.type === 'jumper')) }));
  const addBehavior = (type: Behavior['type']) => {
    const needsBody = type === 'jumper' && !object.behaviors.some((b) => b.type === 'body');
    const created: Behavior[] = [...(needsBody ? [BEHAVIORS.body.make(ctx)] : []), BEHAVIORS[type].make(ctx)];
    update(`add.${type}`, (o) => ({ ...o, behaviors: [...o.behaviors, ...created] }));
  };
  // Behaviors the object already has are left out; ones that cannot be used yet stay, saying why.
  const behaviorChoices = BEHAVIOR_GROUPS.map((g) => ({
    title: g.title,
    items: g.types
      .filter((type) => !object.behaviors.some((b) => b.type === type))
      .map((type) => ({
        value: type,
        title: BEHAVIORS[type].title,
        about: BEHAVIORS[type].about,
        why: BEHAVIORS[type].needsImage && visual.kind !== 'image' ? 'فقط برای شیئی که عکس دارد.' : whyNot(BEHAVIORS[type], ctx),
      })),
  })).filter((g) => g.items.length > 0);

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !object.tags.includes(tag)) update('tags', (o) => ({ ...o, tags: [...o.tags, tag] }));
    setNewTag('');
  };

  return (
    <>
      <header className="panel-head">
        <TextField label="نام در فهرست" value={object.name} onChange={(name) => update('name', (o) => ({ ...o, name }))} />
        {list === 'prefabs' && <p>این شیء در صحنه نیست؛ حین بازی ساخته می‌شود و هر بار همین تنظیمات را دارد.</p>}
        <div className="adders">
          <button type="button" className="chip" onClick={duplicate}>کپی</button>
          <button type="button" className="chip" onClick={() => reorder(true)}>بیاور جلو</button>
          <button type="button" className="chip" onClick={() => reorder(false)}>ببر عقب</button>
          <button type="button" className="chip chip-danger" onClick={() => change(removeObject(project, scene.id, object.id), `delete.${object.id}`, null)}>
            حذف
          </button>
        </div>
        <Check
          label="قفل باشد"
          hint="با کلیک و کشیدن در صحنه جابه‌جا نمی‌شود؛ برای پس‌زمینه. از فهرست هنوز می‌توانی انتخابش کنی."
          value={object.locked ?? false}
          onChange={(locked) => update('locked', ({ locked: _old, ...o }) => (locked ? { ...o, locked } : o))}
        />
        {list === 'objects' && <TemplateTools editor={editor} object={object} />}
      </header>

      <div className="about-object" aria-label="این شیء چه می‌کند">
        <h3>این شیء چه می‌کند؟</h3>
        {summary.length === 0 && involved.length === 0 ? (
          <p>هنوز هیچ کاری نمی‌کند؛ فقط دیده می‌شود. پایین‌تر یک «نقش آماده» به آن بده، مثلاً «بازیکنی که با لمس صفحه می‌پرد».</p>
        ) : (
          <ul>
            {summary.map((line) => <li key={line}>{line}</li>)}
            {involved.length > 0 && <li>{fa(involved.length)} قانون با آن کار می‌کند؛ در پایین همین برگه هستند.</li>}
          </ul>
        )}
      </div>

      <Section title="نقش آماده" about="با یک انتخاب، گروه، رفتار و قانون‌های لازم خودکار اضافه می‌شوند. بعد می‌توانی هر کدام را عوض کنی.">
        <PickButton
          label="نقش آماده"
          title="این شیء در بازی چه کاره است؟"
          about="نقش فقط یک میان‌بر است: گروه، رفتار و قانون‌های معمولی اضافه می‌کند که بعداً می‌توانی عوضشان کنی."
          groups={[{ title: '', items: PRESETS.filter((p) => p.fits?.(object) ?? true).map((p) => ({ value: p.id, title: p.title, about: p.about })) }]}
          onPick={(id) => {
            const preset = PRESETS.find((p) => p.id === id)!;
            change(preset.apply(project, scene.id, object.id), `preset.${preset.id}.${object.id}`);
          }}
        >
          این شیء چه کاره است؟ انتخاب کن…
        </PickButton>
      </Section>

      <Section title="گروه‌ها" about="قانون‌ها و رفتارها با نام گروه کار می‌کنند؛ مثلاً «هر چیزی از گروه دشمن».">
        <div className="chips">
          {object.tags.map((tag) => (
            <button key={tag} type="button" className="chip" title="برداشتن از این گروه" onClick={() => update('tags', (o) => ({ ...o, tags: o.tags.filter((t) => t !== tag) }))}>
              {tag} ×
            </button>
          ))}
        </div>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); addTag(); }}>
          <input type="text" dir="auto" aria-label="نام گروه" placeholder="نام گروه" list="tag-list" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
          <datalist id="tag-list">{allTags(scene).map((t) => <option key={t} value={t} />)}</datalist>
          <button type="submit" className="chip">اضافه کن</button>
        </form>
      </Section>

      {visual.kind === 'terrain' && <Section title="رسم سطح زمین" about="خطِ بالای زمین را با انگشت یا موس بکش. با رها کردن، شکل و برخورد با هم ثبت می‌شوند.">
        <TerrainEditor heights={visual.heights} color={visual.color} onChange={heights => setVisual(newId('terrain'), { heights })} />
      </Section>}
      {visual.kind === 'tiles' && <TilesPanel editor={editor} object={object} update={update} />}

      {visual.kind !== 'tiles' && <Section title="ظاهر">
        {visual.kind === 'text' && (
          <>
            <TextField
              label="متن"
              value={visual.text}
              onChange={(text) => setVisual('text', { text })}
              hint={(project.variables.length || project.textVariables?.length) ? <>برای نشان دادن یک مقدار، نامش را داخل آکولاد بنویس؛ مثلاً <bdi dir="ltr">{`{${project.variables[0]?.name ?? project.textVariables?.[0]?.name}}`}</bdi></> : undefined}
            />
            <Slider label="اندازه‌ی متن" min={16} max={200} step={1} value={visual.size} onChange={(size) => setVisual('size', { size })} />
            <Choice label="ضخامت" value={visual.weight ?? 'normal'} options={[{ value: 'normal', label: 'معمولی' }, { value: 'bold', label: 'ضخیم' }]} onChange={(weight) => setVisual('weight', { weight })} />
            <Choice
              label="متن از کجا شروع شود"
              hint="وقتی عددِ داخل متن بزرگ می‌شود، متن از این نقطه بلندتر می‌شود."
              value={visual.align ?? 'center'}
              options={[{ value: 'left', label: 'از چپ' }, { value: 'center', label: 'از وسط' }, { value: 'right', label: 'از راست' }]}
              onChange={(align) => setVisual('align', { align })}
            />
          </>
        )}
        {(visual.kind === 'rect' || visual.kind === 'ellipse') && (
          <Choice
            label="شکل"
            value={visual.kind}
            options={[{ value: 'rect', label: 'مستطیل' }, { value: 'ellipse', label: 'دایره' }]}
            onChange={(kind) => update('kind', (o) => ({ ...o, visual: kind === 'rect' ? { kind, color: visual.color, radius: 0 } : { kind, color: visual.color } }))}
          />
        )}
        {visual.kind !== 'image' && visual.kind !== 'bag' && <ColorField label="رنگ" value={visual.color} onChange={(color) => setVisual('color', { color })} />}
        {visual.kind === 'bag' && (
          <>
            <Slider label="چند خانه" hint="وسیله‌ها به ترتیب برداشتن در خانه‌ها می‌نشینند. اگر شیء پهن‌تر از بلندی‌اش باشد، خانه‌ها کنار هم‌اند؛ وگرنه زیر هم." min={1} max={10} step={1} value={visual.slots} onChange={(slots) => setVisual('slots', { slots })} />
            {!project.variables.some((v) => v.item) && <p className="field-warning">هنوز وسیله‌ای نساخته‌ای. در برگه‌ی «بازی»، بخش «کوله‌پشتی» یک وسیله بساز.</p>}
          </>
        )}
        {visual.kind === 'text' && (
          <>
            <Check label="دور حرف‌ها خط داشته باشد" hint="متن روی هر پس‌زمینه‌ای خوانا می‌ماند." value={Boolean(visual.outline)} // The line starts in a colour that contrasts with the letters, or it would swallow them.
              onChange={(on) => setVisual('outline.on', { outline: !on ? null : visual.color.toLowerCase() === '#ffffff' ? '#1b3a4b' : '#ffffff' })} />
            {visual.outline && <ColorField label="رنگ خط دور" value={visual.outline} onChange={(outline) => setVisual('outline', { outline })} />}
          </>
        )}
        {visual.kind === 'image' &&
          ([
            ['frames', 'انیمیشن ایستاده', 1 + (visual.frames?.length ?? 0), '+ عکس‌های بعدی', 'چند عکس از یک حرکت (مثل بال زدن) تا پشت‌سرهم نشان داده شوند. همه هم‌اندازه باشند.'],
            ['moveFrames', 'انیمیشن حرکت', visual.moveFrames?.length ?? 0, '+ عکس‌های دویدن', 'وقتی شیء به چپ یا راست می‌رود، این عکس‌ها نشان داده می‌شوند.'],
            ['hurtFrames', 'انیمیشن آسیب', visual.hurtFrames?.length ?? 0, '+ عکس‌های آسیب', 'بعد از کم شدن جان، برای لحظه‌ای نمایش داده می‌شود.'],
            ['airFrames', 'انیمیشن پرش', visual.airFrames?.length ?? 0, '+ عکس‌های پرش', 'وقتی شیء روی زمین نیست. «جسم فیزیکی» لازم دارد.'],
          ] as const).map(([set, title, count, button, hint]) => (
            <div key={set} className="control">
              <div className="control-head">
                <span>{title}</span>
                <output className="control-value">{fa(count)} عکس</output>
              </div>
              <div className="adders">
                <button type="button" className="chip" onClick={() => void addFrames(set)}>{button}</button>
                {visual[set]?.length ? (
                  <button type="button" className="chip" onClick={() => setVisual(`${set}.clear`, { [set]: [] })}>پاک کردن</button>
                ) : null}
              </div>
              <p className="control-hint">{hint}</p>
            </div>
          ))}
        {visual.kind === 'image' && Boolean(visual.frames?.length || visual.moveFrames?.length || visual.airFrames?.length || visual.hurtFrames?.length) && (
          <Slider label="سرعت انیمیشن" unit="عکس در ثانیه" min={1} max={30} step={1} value={visual.fps ?? 8} onChange={(fps) => setVisual('fps', { fps })} />
        )}
        {visual.kind === 'image' && Boolean(visual.frames?.length) && (
          <Check label="انیمیشن فقط یک بار پخش شود" hint="روی آخرین عکس می‌ماند؛ برای انفجار. با رفتار «عمر کوتاه» بعدش ناپدید می‌شود." value={visual.once ?? false} onChange={(once) => setVisual('once', { once })} />
        )}
        {visual.kind === 'image' && (
          <Choice
            label="وقتی شیء از عکس بزرگ‌تر است"
            hint="با «تکرار»، یک عکس کوچک زمین یا دیواری به هر درازا می‌سازد، بدون اینکه کش بیاید."
            value={visual.repeat ?? 'stretch'}
            options={[{ value: 'stretch', label: 'عکس کش بیاید' }, { value: 'x', label: 'تکرار به پهلو' }, { value: 'y', label: 'تکرار به پایین' }]}
            onChange={(repeat) => update('repeat', (o) => {
              const { repeat: _old, ...rest } = visual;
              return { ...o, visual: repeat === 'stretch' ? rest : { ...rest, repeat } };
            })}
          />
        )}
        {visual.kind === 'image' && (
          <Check label="رو به جهت حرکت برگردد" hint="عکس را رو به راست بکش؛ وقتی به چپ برود خودش برمی‌گردد." value={visual.flip ?? false} onChange={(flip) => setVisual('flip', { flip })} />
        )}
        {visual.kind === 'rect' && (
          <Slider label="گردی گوشه‌ها" min={0} max={Math.floor(Math.min(object.width, object.height) / 2)} step={1} value={visual.radius ?? 0} onChange={(radius) => setVisual('radius', { radius })} />
        )}
        {visual.kind === 'bar' && (
          <>
            <Select label="کدام مقدار را نشان بدهد" value={visual.variable} options={project.variables.map((v) => ({ value: v.name, label: v.name }))} onChange={(variable) => setVisual('variable', { variable })} />
            <NumberField label="با چه عددی پر است" value={visual.max} onChange={(max) => setVisual('max', { max: Math.max(1, max) })} />
            <ColorField label="رنگ بخش خالی" value={visual.back} onChange={(back) => setVisual('back', { back })} />
          </>
        )}
        {visual.kind !== 'text' && visual.kind !== 'bar' && visual.kind !== 'bag' && (
          <div className="adders">
            <button type="button" className="chip" onClick={() => setChoosingPicture(true)}>
              انتخاب از عکس‌های آماده
            </button>
            <button type="button" className="chip" onClick={() => void setImage()}>
              {visual.kind === 'image' ? 'عکس از کامپیوتر' : 'گذاشتن عکس از کامپیوتر'}
            </button>
            <button type="button" className="chip" onClick={() => void startPainting()}>
              {paintable ? 'نقاشی دوباره' : 'نقاشی کن'}
            </button>
            {visual.kind === 'image' && (
              <button type="button" className="chip" onClick={() => update('kind', (o) => ({ ...o, visual: { kind: 'rect', color: '#ff5a5f', radius: 12 }, behaviors: o.behaviors.filter((b) => b.type !== 'scrollImage') }))}>
                برداشتن عکس
              </button>
            )}
          </div>
        )}
        {(visual.kind === 'rect' || visual.kind === 'ellipse') && (
          <>
            <Check label="سایه‌روشن و براق" hint="بالایش روشن‌تر و پایینش تیره‌تر، با یک برق نرم؛ شکل به‌جای صاف، حجم پیدا می‌کند." value={visual.shade ?? false} onChange={(shade) => setVisual('shade', { shade })} />
            <Check label="خط دور" value={Boolean(visual.outline)} onChange={(on) => setVisual('outline.on', { outline: on ? '#1b3a4b' : null })} />
            {visual.outline && <ColorField label="رنگ خط دور" value={visual.outline} onChange={(outline) => setVisual('outline', { outline })} />}
          </>
        )}
        {visual.kind === 'text' && (
          <Check label="سایه زیر حروف" value={visual.shadow ?? false} onChange={(shadow) => setVisual('shadow', { shadow })} />
        )}
        {visual.kind !== 'text' && (
          <>
            <Check label="سایه‌ی نرم زیرش" hint="شیء را از پس‌زمینه جدا می‌کند؛ برای شخصیت‌ها و چیزهای مهم." value={object.shadow ?? false} onChange={(shadow) => update('shadow', (o) => ({ ...o, shadow }))} />
            <Check label="درخشش دورش" hint="هاله‌ای از نور دور شیء؛ برای جایزه، قدرت و چیزهای جادویی." value={Boolean(object.glow)} onChange={(on) => update('glow.on', (o) => ({ ...o, glow: on ? '#ffd54a' : null }))} />
            {object.glow && <ColorField label="رنگ درخشش" value={object.glow} onChange={(glow) => update('glow', (o) => ({ ...o, glow }))} />}
          </>
        )}
        <Slider label="پررنگی" hint="صفر یعنی نامرئی." min={0} max={1} step={0.05} value={object.opacity ?? 1} onChange={(opacity) => update('opacity', (o) => ({ ...o, opacity }))} />
        {visual.kind !== 'text' && (
          <Slider label="چرخش" unit="درجه" min={-180} max={180} step={5} value={object.rotation ?? 0} onChange={(rotation) => update('rotation', (o) => ({ ...o, rotation }))} />
        )}
        <Check label="از اول دیده شود" hint="اگر خاموش باشد، پنهان می‌ماند تا یک قانون نشانش بدهد." value={object.visible} onChange={(visible) => update('visible', (o) => ({ ...o, visible }))} />
      </Section>}

      <Section title="جا و اندازه" about={list === 'objects' && visual.kind !== 'text' ? 'در بازی هم می‌توانی شیء را بکشی و با مربع‌های سفید گوشه‌هایش اندازه‌اش را عوض کنی.' : undefined}>
        <Check
          label="به صفحه چسبیده باشد"
          hint="مثل امتیاز یا دکمه: وقتی دوربین حرکت می‌کند سر جایش می‌ماند."
          value={object.fixed ?? false}
          onChange={(fixed) => update('fixed', (o) => ({ ...o, fixed }))}
        />
        {!object.fixed && (
          <Slider
            label="عمق"
            hint="فقط برای منظره: کمتر از ۱ یعنی دورتر است و با حرکت دوربین کندتر جابه‌جا می‌شود، مثل کوه و ابر پشت بازی."
            min={0}
            max={1}
            step={0.05}
            value={object.parallax ?? 1}
            onChange={(parallax) => update('parallax', ({ parallax: _old, ...o }) => (parallax < 1 ? { ...o, parallax } : o))}
          />
        )}
        {list === 'objects' && (
          <div className="pair">
            <NumberField label="فاصله از چپ" value={object.x} onChange={(x) => update('x', (o) => ({ ...o, x }))} />
            <NumberField label="فاصله از بالا" value={object.y} onChange={(y) => update('y', (o) => ({ ...o, y }))} />
          </div>
        )}
        {visual.kind !== 'text' && visual.kind !== 'bar' && visual.kind !== 'tiles' && visual.kind !== 'terrain' && (
          <Choice
            label="شکل برای راه رفتن"
            hint="سراشیبی یعنی جسم‌هایی که از این شیء رد نمی‌شوند، رویش بالا و پایین می‌روند؛ مثل تپه یا رمپ."
            value={object.slope ?? 'box'}
            options={[{ value: 'box', label: 'جعبه' }, { value: 'rise', label: 'سراشیبی رو به راست ◢' }, { value: 'fall', label: 'سراشیبی رو به چپ ◣' }]}
            onChange={(shape) => update('slope', ({ slope: _old, ...o }) => (shape === 'box' ? o : { ...o, slope: shape as 'rise' | 'fall' }))}
          />
        )}
        {visual.kind !== 'text' && visual.kind !== 'tiles' && (
          <>
            <Slider label="پهنا" min={10} max={Math.max(project.meta.width, object.width)} step={1} value={object.width} onChange={(width) => update('width', (o) => ({ ...o, width }))} />
            <Slider
              label="بلندی"
              min={10}
              max={Math.max(project.meta.height, object.height)}
              step={1}
              value={object.height}
              // A placed object grows upward from its base, so something standing on the ground stays on it.
              onChange={(height) => update('height', (o) => ({ ...o, height, y: list === 'objects' ? o.y + o.height - height : o.y }))}
            />
            <Check label="برخورد دایره‌ای" hint="برای توپ و سکه؛ گوشه‌های خالی شیء دیگر برخورد حساب نمی‌شوند." value={object.round ?? false} onChange={(round) => update('round', (o) => ({ ...o, round }))} />
            <Slider label="حاشیه‌ی برخورد" hint="برخورد کمی دیرتر حساب می‌شود تا بازی منصفانه‌تر به نظر برسد." min={0} max={30} step={1} value={object.hitboxInset ?? 0} onChange={(hitboxInset) => update('inset', (o) => ({ ...o, hitboxInset }))} />
          </>
        )}
      </Section>

      <Section title="جان" about="برای دشمن یا آجری که با چند ضربه از بین می‌رود. کار «کم کردن جان شیء» آن را کم می‌کند.">
        <Check label="این شیء جان داشته باشد" value={object.health !== undefined} onChange={(on) => update('health.on', ({ health: _old, ...o }) => (on ? { ...o, health: 3 } : o))} />
        {object.health !== undefined && <NumberField label="چند ضربه تحمل کند" value={object.health} onChange={(n) => update('health', (o) => ({ ...o, health: Math.max(1, Math.round(n)) }))} />}
        {object.health !== undefined && (
          <Slider
            label="بعد از هر ضربه، چند ثانیه آسیب‌ناپذیر"
            hint="در این مدت چشمک می‌زند و ضربه‌ی دیگری جانش را کم نمی‌کند؛ مثل بیشتر بازی‌ها بعد از خوردن به دشمن. صفر یعنی هیچ."
            min={0}
            max={3}
            step={0.1}
            value={object.invincible ?? 0}
            onChange={(n) => update('invincible', ({ invincible: _old, ...o }) => (n > 0 ? { ...o, invincible: n } : o))}
          />
        )}
        {object.health !== undefined && <Check label="نوار جان بالای سرش" hint="یک نوار کوچک سبز که با هر ضربه کوتاه‌تر و زرد و قرمز می‌شود؛ برای دشمن‌ها و غول آخر." value={object.healthBar ?? false} onChange={(healthBar) => update('healthBar', (o) => ({ ...o, healthBar }))} />}
      </Section>

      {object.behaviors.map((behavior, index) => {
        const info = BEHAVIORS[behavior.type];
        return (
          <Section
            key={behavior.type}
            title={info.title}
            about={info.about}
            action={<button type="button" className="link" onClick={() => removeBehavior(behavior.type)}>حذف رفتار</button>}
          >
            {behavior.type === 'particles' && <>
              <button type="button" className="chip" data-edit-particles onClick={() => setParticleObject(object.id)}>ویرایش جلوه‌ی ذرات</button>
              {particleObject === object.id && <ParticleEditor initial={behavior} width={object.width} height={object.height} ctx={ctx}
                onClose={() => setParticleObject(null)} onApply={draft => {
                  if (draft !== behavior) update(newId('particles'), o => ({ ...o, behaviors: o.behaviors.map((b, i) => i === index ? draft : b) }));
                  setParticleObject(null);
                }} />}
            </>}
            <Fields fields={info.fields} value={behavior as unknown as Record<string, unknown>} ctx={ctx} onChange={(key, value) => setBehavior(index, key, value)} />
            {!['body', 'physics', 'joint'].includes(behavior.type) && (
              <div className="control">
                <div className="control-head"><label htmlFor={`state-${behavior.type}`}>فقط وقتی حالتش (state) این باشد</label></div>
                {/* Kept as typed until the field is left, so "1," can become "1,2". */}
                <input
                  id={`state-${behavior.type}`}
                  type="text"
                  dir="ltr"
                  data-only-in={behavior.type}
                  key={(behavior.onlyIn ?? []).join(',')}
                  defaultValue={(behavior.onlyIn ?? []).join(',')}
                  placeholder="همیشه"
                  onBlur={(e) => {
                    const states = e.target.value.split(/[,،\s]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n));
                    setBehavior(index, 'onlyIn', states.length > 0 ? states : undefined);
                  }}
                />
                <p className="control-hint">خالی یعنی همیشه. مثلاً «0» برای نگهبانی و «1» برای تعقیب؛ چند حالت را با ویرگول جدا کن. حالت را با کار «تغییر مقدار یک شیء» روی مقدار state عوض کن.</p>
              </div>
            )}
          </Section>
        );
      })}

      <Section title="مقدارهای این شیء" about="عددهایی که فقط مال همین شیء‌اند؛ مثل نوع یک کارت (kind) یا باز بودنش (open). قانون‌ها می‌توانند آن‌ها را بخوانند و عوض کنند، و متن شیء می‌تواند با {نام} نشانشان بدهد.">
        {Object.entries(object.values ?? {}).map(([name, number]) => (
          <div key={name} className="pair value-row" data-value={name}>
            <NumberField label={name} value={number} onChange={(n) => update(`value.${name}`, (o) => ({ ...o, values: { ...o.values, [name]: n } }))} />
            <button
              type="button"
              className="link"
              onClick={() =>
                update(`value.remove.${name}`, (o) => {
                  const { [name]: _gone, ...values } = o.values ?? {};
                  const { values: _old, ...rest } = o;
                  return Object.keys(values).length > 0 ? { ...rest, values } : rest;
                })
              }
            >
              حذف
            </button>
          </div>
        ))}
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newValue.trim();
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) update(`value.add.${name}`, (o) => ({ ...o, values: { [name]: 0, ...o.values } }));
            setNewValue('');
          }}
        >
          <input type="text" dir="ltr" aria-label="نام مقدار تازه" placeholder="نام انگلیسی، مثل kind" list="value-name-list" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <datalist id="value-name-list">{valueNames(scene).map((n) => <option key={n} value={n} />)}</datalist>
          <button type="submit" className="chip">اضافه کن</button>
        </form>
        {visual.kind === 'image' && Boolean(visual.frames?.length) && (
          <Select
            label="کدام عکس دیده شود"
            hint="اگر یک مقدار را انتخاب کنی، انیمیشن نمی‌شود: مقدار صفر عکس اول را نشان می‌دهد، ۱ عکس دوم را، و همین‌طور. مثل کارتی که با open=۰ پشتش و با open=۱ رویش دیده می‌شود."
            value={visual.frameBy ?? ''}
            options={[{ value: '', label: 'پشت‌سرهم (انیمیشن)' }, ...Object.keys(object.values ?? {}).map((n) => ({ value: n, label: `از روی مقدار ${n}` }))]}
            onChange={(frameBy) => update('frameBy', (o) => {
              const { frameBy: _old, ...rest } = visual;
              return { ...o, visual: frameBy ? { ...rest, frameBy } : rest };
            })}
          />
        )}
      </Section>

      {list === 'objects' && visual.kind !== 'tiles' && (
        <Section title="چیدن چند تا از این" about="از این شیء در چند ردیف و ستون کپی می‌چیند؛ برای صفحه‌ی کارت‌ها، آجرها یا خانه‌های یک بازی صفحه‌ای.">
          <div className="pair">
            <NumberField label="چند ستون" value={board.cols} onChange={(cols) => setBoard({ ...board, cols: Math.max(1, Math.min(12, Math.round(cols))) })} />
            <NumberField label="چند ردیف" value={board.rows} onChange={(rows) => setBoard({ ...board, rows: Math.max(1, Math.min(12, Math.round(rows))) })} />
          </div>
          <button
            type="button"
            className="btn btn-wide"
            disabled={board.cols * board.rows < 2}
            onClick={() => {
              // With a board, one per cell; without, side by side with a small gap.
              const pitchX = scene.cell || object.width + 12;
              const pitchY = scene.cell || object.height + 12;
              change(tileObject(project, scene.id, object.id, board.cols, board.rows, pitchX, pitchY), `tile.${object.id}.${newId('t')}`);
            }}
          >
            بچین
          </button>
        </Section>
      )}

      <Section title="رفتار تازه" about="رفتار یعنی کاری که شیء خودش انجام می‌دهد، بدون اینکه قانونی بنویسی.">
        <PickButton label="اضافه کردن رفتار" title="این شیء چه رفتاری داشته باشد؟" groups={behaviorChoices} common={COMMON_BEHAVIORS} onPick={(type) => addBehavior(type as Behavior['type'])}>
          + یک رفتار اضافه کن
        </PickButton>
      </Section>

      <Section title="قانون‌های این شیء" about="قانون‌هایی که با این شیء یا گروه‌هایش کار می‌کنند. روی هر کدام بزن تا باز شود.">
        {involved.length === 0 && <p className="empty">هنوز قانونی با این شیء کار نمی‌کند.</p>}
        {involved.map((rule) => (
          <button key={rule.id} type="button" className="rule rule-closed" onClick={() => editor.showRule(rule.id)}>
            <span className="rule-when"><span dir="rtl">{triggerSentence(scene, rule.when)}</span></span>
            <span className="rule-then">
              {rule.then.length === 0 ? 'هنوز کاری انتخاب نشده' : rule.then.map((a) => actionSentence(project, scene, a, subjectsOf(scene, rule.when))).join('، ')}
            </span>
          </button>
        ))}
        <div className="adders">
          <button type="button" className="chip" onClick={() => addRule({ type: 'tapObject', target: me })}>+ وقتی رویش زده شد</button>
          <button type="button" className="chip" onClick={() => addRule({ type: 'touch', a: me, b: other ? { by: 'id', id: other.id } : me })}>+ وقتی به چیزی خورد</button>
          <button type="button" className="chip" onClick={() => addRule({ type: 'offscreen', target: me })}>+ وقتی از صفحه بیرون رفت</button>
        </div>
      </Section>

      {choosingPicture && (
        <Dialog wide title="یک عکس آماده انتخاب کن" onClose={() => setChoosingPicture(false)}>
          <SpriteGrid onPick={(sprite) => void setLibraryPicture(sprite)} />
        </Dialog>
      )}
      {painting && (
        <Dialog wide title={paintable ? 'نقاشی دوباره' : 'نقاشی کن'} about="روی خانه‌ها بکش. با ذخیره، عکس این شیء همین نقاشی می‌شود." onClose={() => setPainting(null)}>
          <PixelEditor initial={painting} onCancel={() => setPainting(null)} onDone={savePainting} />
        </Dialog>
      )}
    </>
  );
}

/** Shown when several objects are selected: what can be done to all of them at once. */
function ManyPanel({ editor }: { editor: Editor }) {
  const { project, scene, selected, change } = editor;
  const [tag, setTag] = useState('');
  const placed = scene.objects.filter((o) => selected.includes(o.id));
  const key = `many.${selected.join('.')}`;

  const setAll = (name: string, next: (o: GameObject) => GameObject) =>
    change(updateScene(project, scene.id, (s) => ({ ...s, objects: s.objects.map((o) => (selected.includes(o.id) ? next(o) : o)), prefabs: s.prefabs.map((o) => (selected.includes(o.id) ? next(o) : o)) })), `${key}.${name}`);

  /** Lines the objects up on one edge or middle line of the area they cover together. */
  const align = (axis: 'x' | 'y', where: 0 | 0.5 | 1) => {
    const size = axis === 'x' ? 'width' : 'height';
    const from = Math.min(...placed.map((o) => o[axis]));
    const to = Math.max(...placed.map((o) => o[axis] + o[size]));
    setAll(`align.${axis}.${where}`, (o) => (placed.includes(o) ? { ...o, [axis]: Math.round(from + (to - from - o[size]) * where) } : o));
  };
  /** Keeps the two outermost objects where they are and spaces the rest evenly between them. */
  const spread = (axis: 'x' | 'y') => {
    const size = axis === 'x' ? 'width' : 'height';
    const sorted = [...placed].sort((a, b) => a[axis] - b[axis]);
    const span = sorted.at(-1)![axis] + sorted.at(-1)![size] - sorted[0][axis];
    const gap = (span - sorted.reduce((sum, o) => sum + o[size], 0)) / (sorted.length - 1);
    const at = new Map<string, number>();
    let next = sorted[0][axis];
    for (const o of sorted) {
      at.set(o.id, Math.round(next));
      next += o[size] + gap;
    }
    setAll(`spread.${axis}`, (o) => (at.has(o.id) ? { ...o, [axis]: at.get(o.id)! } : o));
  };

  return (
    <>
      <header className="panel-head">
        <h2>{fa(selected.length)} شیء انتخاب شده</h2>
        <p>با موس همه را با هم جابه‌جا کن، یا یکی از کارهای زیر را روی همه انجام بده. برای تنظیم یک شیء، فقط روی همان بزن.</p>
        <div className="adders">
          <button
            type="button"
            className="chip"
            onClick={() => {
              const made = duplicateObjects(project, scene.id, selected);
              change(made.project, `copy.${made.ids.join('.')}`, made.ids);
            }}
          >
            کپی از همه
          </button>
          <button type="button" className="chip chip-danger" onClick={() => change(removeObjects(project, scene.id, selected), `delete.${selected.join('.')}`, null)}>
            حذف همه
          </button>
        </div>
      </header>

      {placed.length > 1 && (
        <Section title="ردیف کردن" about="اشیا را روی یک خط می‌چیند یا فاصله‌شان را یکسان می‌کند.">
          <div className="adders">
            <button type="button" className="chip" onClick={() => align('x', 0)}>لبه‌ی چپ</button>
            <button type="button" className="chip" onClick={() => align('x', 0.5)}>وسط افقی</button>
            <button type="button" className="chip" onClick={() => align('x', 1)}>لبه‌ی راست</button>
          </div>
          <div className="adders">
            <button type="button" className="chip" onClick={() => align('y', 0)}>لبه‌ی بالا</button>
            <button type="button" className="chip" onClick={() => align('y', 0.5)}>وسط عمودی</button>
            <button type="button" className="chip" onClick={() => align('y', 1)}>لبه‌ی پایین</button>
          </div>
          {placed.length > 2 && (
            <div className="adders">
              <button type="button" className="chip" onClick={() => spread('x')}>فاصله‌ی یکسان افقی</button>
              <button type="button" className="chip" onClick={() => spread('y')}>فاصله‌ی یکسان عمودی</button>
            </div>
          )}
        </Section>
      )}

      <Section title="گروه مشترک" about="همه‌ی این اشیا را در یک گروه می‌گذارد تا یک قانون برای همه‌شان کار کند.">
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const name = tag.trim();
            if (name) setAll(`tag.${name}`, (o) => (o.tags.includes(name) ? o : { ...o, tags: [...o.tags, name] }));
            setTag('');
          }}
        >
          <input type="text" dir="auto" aria-label="نام گروه مشترک" placeholder="نام گروه" list="many-tag-list" value={tag} onChange={(e) => setTag(e.target.value)} />
          <datalist id="many-tag-list">{allTags(scene).map((t) => <option key={t} value={t} />)}</datalist>
          <button type="submit" className="chip">اضافه کن</button>
        </form>
      </Section>
    </>
  );
}
