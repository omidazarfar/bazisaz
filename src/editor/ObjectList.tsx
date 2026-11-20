import { useState } from 'react';
import type { GameObject, Visual } from '../format/types';
import type { Editor } from './editor';
import { pickFile, readImage } from './images';
import { fa, PALETTE } from './labels';
import { Library } from './Library';
import { describeObject } from './sentences';
import { addObject, duplicateScene, freeSpot, makeObject, newId, type ObjectList as ListName } from './state';

/** The scene picker and everything in the current scene, as a list to pick from and add to. */
export function ObjectList({ editor, onNote }: { editor: Editor; onNote: (text: string) => void }) {
  const { project, scene, selected, change, select, setScene } = editor;
  const [library, setLibrary] = useState<ListName | null>(null);
  // The scene is stored back-to-front; listing it front-to-back puts what is drawn on top first.
  const placed = [...scene.objects].reverse();

  const add = (list: ListName, name: string, visual: Visual, w: number, h: number, next = project) => {
    const object = makeObject(name, visual, w, h, list === 'prefabs' ? { x: 0, y: 0 } : freeSpot(scene, editor.viewCentre(), w, h), list === 'prefabs' ? { x: 0, y: 0 } : {});
    change(addObject(next, scene.id, list, object), `add.${object.id}`, object.id);
  };

  const addImage = async (list: ListName) => {
    const file = await pickFile('image/*');
    if (!file) return;
    const image = await readImage(file, 512);
    const asset = newId('img');
    // Start at a size that fits the screen comfortably, keeping the picture's shape.
    const scale = Math.min(1, 240 / image.width);
    const withAsset = { ...project, assets: { ...project.assets, [asset]: { type: 'image' as const, src: image.src } } };
    add(list, file.name.replace(/\.[^.]+$/, ''), { kind: 'image', asset }, Math.round(image.width * scale), Math.round(image.height * scale), withAsset);
  };

  const addScene = () => {
    const id = newId('scene');
    const created = { id, name: `صحنه‌ی ${project.scenes.length + 1}`, width: project.meta.width, height: project.meta.height, background: null, music: null, gravity: 2400, sky: 'day' as const, objects: [], prefabs: [], rules: [] };
    change({ ...project, scenes: [...project.scenes, created] }, `scene.${id}`);
    setScene(id);
  };
  const copyScene = () => {
    const made = duplicateScene(project, scene.id, `${scene.name} (کپی)`);
    change(made.project, `scene.${made.id}`);
    setScene(made.id);
  };

  // New things get a number and their own colour, so two of them are never confused for one another.
  const count = scene.objects.length + scene.prefabs.length;
  const adders = (list: ListName) => (
    <>
      <button type="button" className="btn btn-wide btn-library" data-library={list} onClick={() => setLibrary(list)}>
        + اضافه کردن از کتابخانه…
      </button>
      <div className="adders" aria-label="اضافه کردن سریع">
        <button type="button" className="chip" onClick={() => add(list, `شکل ${fa(count + 1)}`, { kind: 'rect', color: PALETTE[count % PALETTE.length], radius: 12, shade: true }, 120, 120)}>
          + شکل
        </button>
        <button type="button" className="chip" onClick={() => add(list, `متن ${fa(count + 1)}`, { kind: 'text', text: 'Text', color: '#1b3a4b', size: 60 }, 0, 0)}>
          + متن
        </button>
        <button type="button" className="chip" onClick={() => void addImage(list)}>
          + عکس
        </button>
        {list === 'objects' && project.variables.length > 0 && (
          <button
            type="button"
            className="chip"
            title="نواری که با یک مقدار پر و خالی می‌شود، مثل نوار جان"
            onClick={() => add(list, `نوار ${fa(count + 1)}`, { kind: 'bar', variable: project.variables[0].name, max: 10, color: '#43a047', back: '#1b3a4b' }, 320, 36)}
          >
            + نوار
          </button>
        )}
      </div>
    </>
  );
  const row = (object: GameObject) => (
    <Row key={object.id} object={object} project={project} about={describeObject(scene, object).join('\n')} selected={selected.includes(object.id)} onSelect={(add) => select(object.id, add)} />
  );

  return (
    <nav className="object-list" aria-label="اشیای این صحنه">
      <div className="scene-picker">
        <label htmlFor="scene-select">صحنه</label>
        <select id="scene-select" value={scene.id} onChange={(e) => setScene(e.target.value)}>
          {project.scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.id === project.startScene ? ' (شروع بازی)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="adders scene-adders">
        <button type="button" className="chip" onClick={addScene}>
          + صحنه
        </button>
        <button type="button" className="chip" title="یک صحنه‌ی تازه با همه‌ی اشیا و قانون‌های همین صحنه؛ برای ساختن مرحله‌ی بعد" onClick={copyScene}>
          کپی این صحنه
        </button>
      </div>

      <h3 className="list-title">چیزهایی که در این صحنه هستند</h3>
      {placed.length === 0 && <p className="empty">این صحنه خالی است. با دکمه‌ی زیر اولین چیز بازی‌ات را اضافه کن.</p>}
      {placed.map(row)}
      {adders('objects')}

      <h3 className="list-title">چیزهایی که حین بازی ساخته می‌شوند</h3>
      {scene.prefabs.length === 0 && (
        <p className="empty">مثل مانع، سکه یا تیر. این‌ها را رفتار «ساخت خودکار» یا یک قانون وارد بازی می‌کند.</p>
      )}
      {scene.prefabs.map(row)}
      {adders('prefabs')}

      {library && <Library editor={editor} list={library} onClose={() => setLibrary(null)} onNote={onNote} />}
    </nav>
  );
}

function Row(props: { object: GameObject; project: Editor['project']; about: string; selected: boolean; onSelect: (add: boolean) => void }) {
  const { object } = props;
  return (
    <button type="button" className="row" title={props.about || 'هنوز کاری نمی‌کند'} aria-current={props.selected} onClick={(e) => props.onSelect(e.shiftKey || e.ctrlKey || e.metaKey)}>
      <Thumb object={object} project={props.project} />
      <span className="row-name">{object.name}</span>
      {object.template && <span className="row-note" title="کپی زنده‌ی یک نمونه">کپی</span>}
      {object.locked && <span className="row-note">قفل</span>}
      {!object.visible && <span className="row-note">پنهان</span>}
    </button>
  );
}

/** A tiny picture of the object: its picture, its color and rough shape, or a letter for text. */
function Thumb({ object, project }: { object: GameObject; project: Editor['project'] }) {
  const v = object.visual;
  if (v.kind === 'text') {
    return (
      <span className="thumb thumb-text" style={{ color: v.color }}>
        T
      </span>
    );
  }
  if (v.kind === 'image') {
    const asset = project.assets[v.asset];
    return <span className="thumb thumb-image" style={asset ? { backgroundImage: `url("${asset.src}")` } : undefined} />;
  }
  if (v.kind === 'bar') return <span className="thumb thumb-bar" style={{ background: `linear-gradient(90deg, ${v.color} 65%, ${v.back} 65%)` }} />;
  if (v.kind === 'bag') return <span className="thumb thumb-bag" style={{ background: 'repeating-linear-gradient(90deg, #232d55 0 7px, #ffd23f 7px 8px)', borderRadius: '4px' }} />;
  if (v.kind === 'tiles') {
    // A map shows as a little checkerboard of its first two kinds.
    const [a = '#6d4c41', b = a] = Object.values(v.kinds).map((k) => k.color);
    return <span className="thumb" style={{ background: `repeating-conic-gradient(${a} 0 25%, ${b} 0 50%) 0 0 / 10px 10px` }} />;
  }
  return <span className="thumb" style={{ background: v.color, borderRadius: v.kind === 'ellipse' ? '50%' : v.radius ? '6px' : '2px' }} />;
}
