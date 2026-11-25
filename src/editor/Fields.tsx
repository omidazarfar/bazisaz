import { useState } from 'react';
import type { Amount, Comparison, Place, Ref, Spot } from '../format/types';
import { playEffect } from '../runtime/sound';
import { SOUND_NAMES } from '../format/types';
import { Check, Choice, ColorField, NumberField, Select, Slider, TextField } from './controls';
import { pickFile, readImage } from './images';
import { BUILTIN_MUSIC_OPTIONS, SOUND_LABEL, type Context, type Field } from './labels';
import { SpriteGrid } from './Library';
import { Dialog } from './Pick';
import { allTags, messageNames, valueNames } from './state';
import { namesOf } from '../blocks/fields';

/**
 * A picture chosen in a field that the game does not have yet. The panel that
 * owns the field adds it to the game's pictures and stores its new id, in one step.
 */
export type NewPicture = { newImage: string } | { sprite: string };

export function isNewPicture(value: unknown): value is NewPicture {
  return typeof value === 'object' && value !== null && ('newImage' in value || 'sprite' in value);
}

/** The game's pictures to pick one from, and ways to bring in another. */
function PictureField({ label, value, ctx, onChange }: { label: string; value: string; ctx: Context; onChange: (next: string | NewPicture) => void }) {
  const [library, setLibrary] = useState(false);
  const images = Object.entries(ctx.project.assets).filter(([, a]) => a.type === 'image');
  return (
    <div className="control">
      <div className="control-head">
        <span>{label}</span>
      </div>
      <div className="picture-pick">
        {images.map(([id, asset]) => (
          <button key={id} type="button" className="picture-choice" data-image={id} aria-pressed={id === value} onClick={() => onChange(id)}>
            <img src={asset.src} alt="" />
          </button>
        ))}
      </div>
      <div className="adders">
        <button type="button" className="chip" onClick={() => setLibrary(true)}>از عکس‌های آماده</button>
        <button
          type="button"
          className="chip"
          onClick={() =>
            void (async () => {
              const file = await pickFile('image/*');
              if (file) onChange({ newImage: (await readImage(file, 512)).src });
            })()
          }
        >
          از کامپیوتر
        </button>
      </div>
      {library && (
        <Dialog wide title="یک عکس آماده انتخاب کن" onClose={() => setLibrary(false)}>
          <SpriteGrid
            onPick={(sprite) => {
              setLibrary(false);
              onChange({ sprite: sprite.id });
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

const OPS: { value: Comparison; label: string }[] = [
  { value: '==', label: 'مساوی' },
  { value: '!=', label: 'نامساوی' },
  { value: '>=', label: 'بیشتر یا مساوی' },
  { value: '<=', label: 'کمتر یا مساوی' },
  { value: '>', label: 'بیشتر' },
  { value: '<', label: 'کمتر' },
];

type GroupRef = Extract<Ref, { by: 'tag' }>;

/** Narrows a group to the members that pass a test on their own values, or to one of them at random. Folded away until asked for. */
function GroupFilter({ value, names, tags, onChange, onlyValues }: { value: GroupRef; names: string[]; tags: string[]; onChange: (next: GroupRef) => void; onlyValues?: boolean }) {
  const [open, setOpen] = useState(Boolean(value.where || value.pick || value.spot));
  if (!open) {
    return (
      <button type="button" className="link filter-link" onClick={() => setOpen(true)}>
        فقط بعضی از این گروه…
      </button>
    );
  }
  const { where, pick, spot, ...plain } = value;
  const setSpot = (next: Spot | null) => {
    const { spot: _old, ...rest } = value;
    onChange(next ? { ...rest, spot: next } : rest);
  };
  return (
    <div className="filter">
      <Check
        label="فقط آن‌هایی که یک مقدارشان…"
        value={Boolean(where)}
        onChange={(on) => onChange({ ...plain, ...(pick ? { pick } : {}), ...(spot ? { spot } : {}), ...(on ? { where: { name: names[0] ?? 'open', op: '==' as const, value: 1 } } : {}) })}
      />
      {where && (
        <>
          <TextField label="کدام مقدار" value={where.name} list={names} onChange={(name) => onChange({ ...value, where: { ...where, name: name.trim() } })} />
          <div className="pair">
            <Select label="مقایسه" value={where.op} options={OPS} onChange={(op) => onChange({ ...value, where: { ...where, op: op as Comparison } })} />
            <NumberField label="با عدد" value={where.value} onChange={(n) => onChange({ ...value, where: { ...where, value: n } })} />
          </div>
        </>
      )}
      {!onlyValues && (
        <>
          <Select
            label="و جایشان"
            value={spot?.is ?? ''}
            options={[
              { value: '', label: 'مهم نیست' },
              { value: 'home', label: 'سر جای اولشان هستند' },
              { value: 'away', label: 'از جای اولشان رفته‌اند' },
              { value: 'on', label: 'روی چیزی از یک گروه‌اند' },
              { value: 'off', label: 'روی هیچ‌چیز از یک گروه نیستند' },
            ]}
            onChange={(is) => setSpot(is === '' ? null : is === 'on' || is === 'off' ? { is, tag: spot?.tag ?? tags[0] ?? '' } : { is: is as 'home' | 'away' })}
          />
          {(spot?.is === 'on' || spot?.is === 'off') && <TextField label="کدام گروه" value={spot.tag ?? ''} list={tags} onChange={(tag) => setSpot({ is: spot.is, tag: tag.trim() })} />}
          <Check
            label="فقط یکی از آن‌ها، به‌تصادف"
            value={pick === 'random'}
            onChange={(on) => onChange({ ...plain, ...(where ? { where } : {}), ...(spot ? { spot } : {}), ...(on ? { pick: 'random' as const } : {}) })}
          />
        </>
      )}
    </div>
  );
}

interface Props {
  fields: Field[];
  /** The behavior, trigger, condition or action being edited. */
  value: Record<string, unknown>;
  ctx: Context;
  /** What "first" and "second" mean for the rule these fields belong to, if anything. */
  subjects?: { first?: string; second?: string };
  onChange: (key: string, value: unknown) => void;
}

// A reference is edited as one pick list, so it travels through the <select> as a string.
const encode = (ref: Place): string => (typeof ref === 'string' ? ref : ref.by === 'id' ? `id:${ref.id}` : `tag:${ref.tag}`);function decode(value: string): Place {
  if (value === 'first' || value === 'second' || value === 'tap') return value;
  return value.startsWith('id:') ? { by: 'id', id: value.slice(3) } : { by: 'tag', tag: value.slice(4) };
}

/** Draws the editing controls for one block from its field descriptions. Rarely needed ones wait behind "more settings". */
export function Fields(props: Props) {
  const { fields, value } = props;
  const relevant = (f: Field) => !f.showIf || f.showIf(value);
  const advanced = fields.filter((f) => f.advanced && relevant(f));
  // A rarely needed setting that has been changed is never hidden, or its effect would be a mystery.
  const changed = advanced.some((f) => {
    const v = value[f.key];
    return v !== undefined && v !== f.fallback && v !== '' && v !== false && v !== 0;
  });
  const [more, setMore] = useState(false);
  const open = more || changed;
  return (
    <>
      <FieldList {...props} fields={fields.filter((f) => !f.advanced)} />
      {advanced.length > 0 && !open && (
        <button type="button" className="link more-link" onClick={() => setMore(true)}>
          تنظیمات بیشتر ({new Intl.NumberFormat('fa-IR').format(advanced.length)})…
        </button>
      )}
      {advanced.length > 0 && open && (
        <div className="more-fields">
          <FieldList {...props} fields={advanced} />
        </div>
      )}
    </>
  );
}

function FieldList({ fields, value, ctx, subjects, onChange }: Props) {
  const { project, scene } = ctx;
  const tags = allTags(scene);
  const names = valueNames(scene);

  const refOptions = (current: Place, withSubjects: boolean, withTap = false) => {
    const options = [
      ...(withTap ? [{ value: 'tap', label: 'جایی که صفحه لمس شد' }] : []),
      ...(withSubjects && subjects?.first ? [{ value: 'first', label: subjects.first }] : []),
      ...(withSubjects && subjects?.second ? [{ value: 'second', label: subjects.second }] : []),
      ...scene.objects.map((o) => ({ value: `id:${o.id}`, label: `شیء «${o.name}»` })),
      ...scene.prefabs.map((o) => ({ value: `id:${o.id}`, label: `هر «${o.name}»` })),
      ...tags.map((t) => ({ value: `tag:${t}`, label: `گروه «${t}»` })),
    ];
    // Keep whatever is stored selectable, even if it no longer matches anything.
    if (!options.some((o) => o.value === encode(current))) {
      options.unshift({ value: encode(current), label: 'انتخاب کن…' });
    }
    return options;
  };
  // Things the player carries are numbers too (how many they have), and are said as such.
  const variableOptions = project.variables.map((v) => ({ value: v.name, label: v.item ? `${v.name} (تعداد در کوله‌پشتی)` : v.name }));
  const itemOptions = project.variables.filter((v) => v.item).map((v) => ({ value: v.name, label: v.name }));

  return (
    <>
      {fields.map((field) => {
        if (field.showIf && !field.showIf(value)) return null;
        const v = value[field.key] ?? field.fallback;
        const set = (next: unknown) => onChange(field.key, next);
        const common = { key: field.key, label: field.label, hint: field.hint };

        switch (field.kind) {
          case 'slider':
            return <Slider {...common} unit={field.unit} min={field.min} max={field.max} step={field.step} value={v as number} onChange={set} />;
          case 'number':
            return <NumberField {...common} value={v as number} onChange={set} />;
          case 'choice':
            return <Choice {...common} value={v as string} options={field.options} onChange={set} />;
          case 'bool':
            return <Check {...common} value={v as boolean} onChange={set} />;
          case 'color':
            return <ColorField key={field.key} label={field.label} value={v as string} onChange={set} />;
          case 'tag':
            return <TextField {...common} value={v as string} list={tags} onChange={(text) => set(text.trim())} />;
          case 'valueName':
            return <TextField {...common} value={v as string} list={names} onChange={(text) => set(text.trim())} />;
          case 'ref':
          case 'target':
          case 'place':
            return (
              <div key={field.key} className="control-group">
                <Select label={field.label} hint={field.hint} value={encode(v as Place)} options={refOptions(v as Place, field.kind !== 'ref', field.kind === 'place')} onChange={(s) => set(decode(s) as Ref)} />
                {typeof v === 'object' && v !== null && (v as Ref).by === 'tag' && <GroupFilter key={(v as GroupRef).tag} value={v as GroupRef} names={names} tags={tags} onChange={set} />}
              </div>
            );
          case 'item':
            return <Select {...common} value={v as string} options={itemOptions.length > 0 ? itemOptions : [{ value: v as string, label: 'هنوز وسیله‌ای نیست' }]} onChange={set} />;
          case 'flyFrom':
            return (
              <Select
                {...common}
                value={v === undefined ? '' : encode(v as Place)}
                options={[{ value: '', label: 'بدون پرواز' }, ...refOptions((v ?? '') as Place, true).filter((o) => o.value !== '')]}
                onChange={(s) => set(s === '' ? undefined : decode(s))}
              />
            );
          case 'textVariable':
            return <Select {...common} value={String(v)} options={(project.textVariables ?? []).map(x => ({ value: x.name, label: x.name }))} onChange={set} />;
          case 'variable':
            return (
              <Select {...common} value={v as string} options={[...(field.optional ? [{ value: '', label: 'هیچ' }] : []), ...variableOptions]} onChange={set} />
            );
          case 'amount': {
            const amount = v as Amount;
            const kind = typeof amount === 'number' ? '#' : 'random' in amount ? '?' : 'count' in amount ? '*' : 'value' in amount ? '@' : amount.variable;
            return (
              <div key={field.key} className="control">
                <Select
                  label={field.label}
                  value={kind}
                  options={[
                    { value: '#', label: 'یک عدد' },
                    { value: '?', label: 'یک عدد تصادفی' },
                    { value: '*', label: 'تعداد اشیای یک گروه' },
                    { value: '@', label: 'مقدار یک شیء' },
                    ...variableOptions.map((o) => ({ ...o, label: `مقدار ${o.label}` })),
                  ]}
                  onChange={(s) => set(s === '#' ? 1 : s === '?' ? { random: [1, 6] } : s === '*' ? { count: tags[0] ?? '' } : s === '@' ? { value: names[0] ?? 'kind', of: subjects?.first ? 'first' : scene.objects[0] ? { by: 'id', id: scene.objects[0].id } : { by: 'tag', tag: tags[0] ?? '' } } : { variable: s })}
                />
                {typeof amount === 'object' && 'value' in amount && (
                  <>
                    <Select label="مقدارِ کدام شیء" value={encode(amount.of)} options={refOptions(amount.of, true)} onChange={(s) => set({ ...amount, of: decode(s) })} />
                    <TextField label="کدام مقدارش" value={amount.value} list={names} onChange={(text) => set({ ...amount, value: text.trim() })} />
                  </>
                )}
                {typeof amount === 'object' && 'count' in amount && (
                  <>
                    <TextField label="کدام گروه" value={amount.count} list={tags} onChange={(text) => set({ ...amount, count: text.trim() })} />
                    <GroupFilter onlyValues value={{ by: 'tag', tag: amount.count, ...(amount.where ? { where: amount.where } : {}) }} names={names} tags={tags} onChange={(g) => set({ count: g.tag, ...(g.where ? { where: g.where } : {}) })} />
                  </>
                )}
                {typeof amount === 'number' && <NumberField label="عدد" value={amount} onChange={set} />}
                {typeof amount === 'object' && 'random' in amount && (
                  <div className="pair">
                    <NumberField label="از" value={amount.random[0]} onChange={(n) => set({ random: [n, amount.random[1]] })} />
                    <NumberField label="تا" value={amount.random[1]} onChange={(n) => set({ random: [amount.random[0], n] })} />
                  </div>
                )}
              </div>
            );
          }
          case 'scene':
            return <Select {...common} value={v as string} options={project.scenes.map((s) => ({ value: s.id, label: s.name }))} onChange={set} />;
          case 'prefab':
            return <Select {...common} value={v as string} options={scene.prefabs.map((p) => ({ value: p.id, label: p.name }))} onChange={set} />;
          case 'prefabs': {
            const chosen = v as string[];
            return (
              <div key={field.key} className="control">
                <div className="control-head">
                  <span>{field.label}</span>
                </div>
                {scene.prefabs.map((p) => (
                  <Check
                    key={p.id}
                    label={p.name}
                    value={chosen.includes(p.id)}
                    // A spawner with nothing to create is not allowed, so the last one stays ticked.
                    disabled={chosen.length === 1 && chosen[0] === p.id}
                    onChange={(on) => set(on ? [...chosen, p.id] : chosen.filter((id) => id !== p.id))}
                  />
                ))}
              </div>
            );
          }
          case 'image':
            return <PictureField key={field.key} label={field.label} value={v as string} ctx={ctx} onChange={set} />;
          case 'text':
            return <TextField {...common} value={v as string} onChange={set} />;
          case 'message':
            return <TextField {...common} value={v as string} list={messageNames(scene)} onChange={(text) => set(text.trim())} />;
          // Functions and questions (Phase 4): any name, offering the ones the scene already has.
          case 'function':
            return <TextField {...common} value={v as string} list={namesOf(scene, 'called')} onChange={(text) => set(text.trim())} />;
          case 'check':
            return <TextField {...common} value={v as string} list={namesOf(scene, 'asked')} onChange={(text) => set(text.trim())} />;
          case 'list': {
            const lists = (project.lists ?? []).map((l) => ({ value: l.name, label: `${l.name} (${l.kind === 'text' ? 'متنی' : 'عددی'})` }));
            return <Select {...common} value={v as string} options={lists.length ? lists : [{ value: v as string, label: 'هنوز فهرستی نیست' }]} onChange={set} />;
          }
          case 'anyValue':
            return (
              <Select
                {...common}
                value={v as string}
                options={[...variableOptions, ...(project.textVariables ?? []).map((x) => ({ value: x.name, label: `${x.name} (متنی)` }))]}
                onChange={set}
              />
            );
          case 'music':
            return (
              <Select
                {...common}
                value={v as string}
                options={[
                  { value: '', label: 'هیچ (قطع موسیقی)' },
                  ...BUILTIN_MUSIC_OPTIONS,
                  ...Object.entries(project.assets).flatMap(([id, a]) => (a.type === 'sound' ? [{ value: id, label: a.name }] : [])),
                ]}
                onChange={set}
              />
            );
          case 'sound':
            return (
              <div key={field.key}>
                <Select
                  {...common}
                  value={v as string}
                  options={[
                    ...SOUND_NAMES.map((s) => ({ value: s as string, label: SOUND_LABEL[s] })),
                    // Sounds the user added, by the file name they came with.
                    ...Object.entries(project.assets).flatMap(([id, a]) => (a.type === 'sound' ? [{ value: id, label: `صدای تو: ${a.name}` }] : [])),
                  ]}
                  onChange={set}
                />
                <button type="button" className="chip" aria-label="شنیدن نمونه صدا" onClick={() => playEffect(project, String(v), Number(value.volume ?? 100))}>▶ شنیدن</button>
              </div>
            );
        }
      })}
    </>
  );
}
