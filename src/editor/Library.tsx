import { useState } from 'react';
import type { GameObject, Visual } from '../format/types';
import type { Editor } from './editor';
import { pickFile, readImage } from './images';
import { fa, PALETTE } from './labels';
import { Dialog } from './Pick';
import { PixelEditor } from './PixelEditor';
import { PLAYER, PRESETS } from './presets';
import { SheetCutter } from './SheetCutter';
import { RECIPES } from './recipes';
import { SPRITE_CATEGORIES, SPRITES, spriteUrl, useSprite, type Sprite } from './sprites';
import { addObject, freeSpot, makeObject, newId, newTileMap, updateObject, type ObjectList as ListName } from './state';

/** The library pictures as a grid to choose from, under their category headings. */
export function SpriteGrid({ onPick }: { onPick: (sprite: Sprite) => void }) {
  return (
    <div className="pick-list">
      {SPRITE_CATEGORIES.map((category) => (
        <section key={category.id}>
          <h3 className="pick-group">{category.title}</h3>
          <div className="sprite-grid">
            {SPRITES.filter((s) => s.category === category.id).map((sprite) => (
              <button key={sprite.id} type="button" className="sprite" data-sprite={sprite.id} onClick={() => onPick(sprite)}>
                <img src={spriteUrl(sprite)} alt="" />
                <span>{sprite.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** The look of an object that shows a library picture, with its animations if it has any. */
export async function spriteVisual(editorProject: Editor['project'], sprite: Sprite) {
  const placed = await useSprite(editorProject, sprite.id);
  const animated = placed.frames.length > 0 || placed.move.length > 0;
  const visual: Visual = {
    kind: 'image',
    asset: placed.asset,
    ...(placed.frames.length > 0 ? { frames: placed.frames } : {}),
    ...(placed.move.length > 0 ? { moveFrames: placed.move } : {}),
    ...(placed.jump ? { airFrames: [placed.jump] } : {}),
    ...(placed.hurt ? { hurtFrames: [placed.hurt] } : {}),
    ...(animated ? { fps: 8 } : {}),
    // Characters are drawn facing right and turn to face the way they go.
    ...(sprite.category === 'character' ? { flip: true } : {}),
    // The long ground repeats when it is made longer, instead of stretching.
    ...(sprite.id === 'ground' ? { repeat: 'x' as const } : {}),
  };
  return { project: placed.project, visual };
}

/** Which library picture a new object with a ready-made role starts with. */
const ROLE_SPRITE: Record<string, string> = {
  'jump-player': 'hero',
  'finger-player': 'hero',
  'steer-player': 'hero',
  ground: 'ground',
  prize: 'coin',
  danger: 'spikeball',
  chaser: 'ghost',
  button: 'btn-play',
  'physics-crate': 'crate',
  'physics-ball': 'ball',
  'sling-stone': 'rock',
  'patrol-enemy': 'slime',
  'shooter-enemy': 'ufo',
  boss: 'bat',
};
/** The library picture shown on the card of each ready-made part, so the list reads at a glance. */
const PART_ICON: Record<string, string> = {
  'player-laser': 'space-ship', score: 'coin', best: 'trophy', pause: 'btn-pause', sound: 'btn-sound', memory: 'card', tictactoe: 'tile-x', match3: 'gem',
  g2048: 'n-2048', startscreen: 'btn-play', gameover: 'btn-restart', obstacles: 'cactus', falling: 'apple', controls: 'btn-right',
  timer: 'clock', 'pause-menu': 'btn-home', levels: 'star', tower: 'crate', 'sling-tower': 'slingshot', pendulum: 'ball', car: 'car',
  bridge: 'plank', conveyor: 'belt', pool: 'water', 'cut-rope': 'candy', 'key-door': 'door', hearts: 'heart', dialogue: 'hero', shop: 'coin', checkpoints: 'flag', sword: 'btn-sword',
};
const ROLE_ICON: Record<string, string> = { ...ROLE_SPRITE, button: 'btn-play', 'score-text': 'coin' };

/** A library picture as a small icon at the side of a card. */
function CardIcon({ sprite: id }: { sprite?: string }) {
  const sprite = id ? SPRITES.find((s) => s.id === id) : undefined;
  return sprite ? <img className="card-icon" src={spriteUrl(sprite)} alt="" /> : null;
}

/** Pictures of round things, which touch as circles. */
const ROUND_SPRITES = new Set(['coin', 'ball', 'rock', 'tire', 'peg', 'bomb', 'spikeball']);

const genres = [
  { id: 'platform', title: 'سکوبازی', role: 'jump-player', sprite: 'hero', parts: ['controls', 'checkpoints'], about: 'راه رفتن و پرش با سه دکمه و دو پرچم برای برگشت به مسیر.' },
  { id: 'adventure', title: 'ماجراجویی از بالا', role: 'steer-player', sprite: 'knight', parts: ['key-door'], about: 'شوالیه را با دسته‌ی لمسی حرکت بده؛ کلید را بردار و در را باز کن.' },
  { id: 'shooter', title: 'تیراندازی', role: 'finger-player', sprite: 'space-ship', parts: ['player-laser'], about: 'سفینه دنبال انگشت می‌آید و رو به بالا تیر می‌زند. با زدن سیارک امتیاز می‌گیری؛ از آن کپی بگیر تا مرحله را بچینی.' },
  { id: 'puzzle', title: 'معمایی', role: 'finger-player', sprite: 'cat', parts: ['key-door'], about: 'گربه را با انگشت به کلید برسان؛ از کلید برای باز کردن در استفاده کن.' },
  { id: 'physics', title: 'فیزیکی', role: 'sling-stone', sprite: 'rock', parts: ['tower'], about: 'سنگ را عقب بکش و رها کن تا به برج جعبه‌ها بخورد.' },
];

type Tab = 'genre' | 'pictures' | 'basic' | 'roles' | 'parts';

/**
 * Everything that can be added to a scene, in one place: ready-made pictures,
 * plain shapes and texts, objects that already play a role, and ready-made parts.
 */
export function Library(props: { editor: Editor; list: ListName; onClose: () => void; onNote: (text: string) => void }) {
  const { editor, list, onClose } = props;
  const { project, scene, change } = editor;
  const [tab, setTab] = useState<Tab>('pictures');
  const [busy, setBusy] = useState(false);
  /** The painter or the sheet cutter, when one of them is open in place of the tabs. */
  const [tool, setTool] = useState<null | { kind: 'draw' } | { kind: 'sheet'; src: string; width: number; height: number }>(null);
  const placed = list === 'objects';
  const centre = (width = 0, height = 0) => (placed ? freeSpot(scene, editor.viewCentre(), width, height) : { x: 0, y: 0 });
  const count = scene.objects.length + scene.prefabs.length;

  const finish = (next: Editor['project'], object: GameObject) => {
    change(addObject(next, scene.id, list, placed ? object : { ...object, x: 0, y: 0 }), `add.${object.id}`, object.id);
    onClose();
  };
  /** Runs one addition; a second press while it is being prepared does nothing. */
  const run = (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    void work().finally(() => setBusy(false));
  };

  const addSprite = (sprite: Sprite) =>
    run(async () => {
      const { project: next, visual } = await spriteVisual(project, sprite);
      finish(next, makeObject(sprite.name, visual, sprite.width, sprite.height, centre(sprite.width, sprite.height), ROUND_SPRITES.has(sprite.id) ? { round: true } : {}));
    });

  const addBasic = (name: string, visual: Visual, width: number, height: number) => finish(project, makeObject(`${name} ${fa(count + 1)}`, visual, width, height, centre(width, height)));

  const addOwnImage = () =>
    run(async () => {
      const file = await pickFile('image/*');
      if (!file) return;
      const image = await readImage(file, 512);
      const asset = newId('img');
      const scale = Math.min(1, 240 / image.width);
      const next = { ...project, assets: { ...project.assets, [asset]: { type: 'image' as const, src: image.src } } };
      finish(next, makeObject(file.name.replace(/\.[^.]+$/, ''), { kind: 'image', asset }, Math.round(image.width * scale), Math.round(image.height * scale), centre()));
    });

  const pickSheet = () =>
    run(async () => {
      const file = await pickFile('image/*');
      if (!file) return;
      const image = await readImage(file, 4096);
      setTool({ kind: 'sheet', ...image });
    });

  const addRole = (presetId: string) =>
    run(async () => {
      const preset = PRESETS.find((p) => p.id === presetId)!;
      const sprite = SPRITES.find((s) => s.id === ROLE_SPRITE[presetId]);
      let next = project;
      let object: GameObject;
      if (sprite) {
        const made = await spriteVisual(project, sprite);
        next = made.project;
        // Named like a plain shape, so the role's own name ("بازیکن") takes its place.
        // The ground lies along the bottom of the view, where a ground belongs; everything else goes in the middle.
        const view = editor.viewCentre();
        const at = presetId === 'ground' ? { x: view.x, y: Math.round(view.y + project.meta.height / 2 - sprite.height / 2) } : centre(sprite.width, sprite.height);
        object = makeObject(`شکل ${fa(count + 1)}`, made.visual, sprite.width, sprite.height, at, ROUND_SPRITES.has(sprite.id) ? { round: true } : {});
      } else {
        object = makeObject(`متن ${fa(count + 1)}`, { kind: 'text', text: 'Text', color: '#1b3a4b', size: 60 }, 0, 0, centre());
      }
      change(preset.apply(addObject(next, scene.id, 'objects', object), scene.id, object.id), `add.${object.id}`, object.id);
      onClose();
    });

  const addGenre = (genre: typeof genres[number]) => run(async () => {
    const sprite = SPRITES.find(s => s.id === genre.sprite)!;
    const made = await spriteVisual(project, sprite);
    const player = makeObject(sprite.name, made.visual, sprite.width, sprite.height,
      centre(sprite.width, sprite.height), { tags: [PLAYER] });
    const preset = PRESETS.find(p => p.id === genre.role)!;
    let next = preset.apply(addObject(made.project, scene.id, 'objects', player), scene.id, player.id);
    next = updateObject(next, scene.id, player.id, o => ({
      ...o, behaviors: [...o.behaviors, { type: 'camera', lock: 'free', smooth: 0.3 }],
    }));
    for (const id of [...genre.parts, 'score', 'hearts']) {
      const part = RECIPES.find(r => r.id === id)!;
      next = (await part.apply(next, scene.id, editor.viewCentre())).project;
    }
    if (change(next, `genre.${newId('x')}`, player.id)) props.onNote(genre.about);
    onClose();
  });

  const addPart = (id: string) =>
    run(async () => {
      const result = await RECIPES.find((r) => r.id === id)!.apply(project, scene.id, editor.viewCentre());
      const added = change(result.project, `part.${id}.${newId('x')}`, result.select);
      if (added && result.note) props.onNote(result.note);
      onClose();
    });

  const tabs: { id: Tab; label: string }[] = [
    ...(placed ? [{ id: 'genre' as const, label: 'راهنمای سبک' }] : []),
    { id: 'pictures', label: 'عکس‌های آماده' },
    { id: 'basic', label: 'شکل، متن و عکس خودت' },
    ...(placed ? [{ id: 'roles' as const, label: 'با نقش آماده' }, { id: 'parts' as const, label: 'قطعه‌های آماده' }] : []),
  ];

  if (tool?.kind === 'draw') {
    return (
      <Dialog wide title="نقاشی کن" about="روی خانه‌ها بکش تا شکل خودت را بسازی؛ مثل یک شخصیت، دشمن یا سکه. بعداً هم می‌توانی دوباره نقاشی‌اش کنی." onClose={onClose}>
        <PixelEditor
          onCancel={() => setTool(null)}
          onDone={(art, src) => {
            const asset = newId('img');
            const next = { ...project, assets: { ...project.assets, [asset]: { type: 'image' as const, src, pixel: art.size } } };
            finish(next, makeObject(`نقاشی ${fa(count + 1)}`, { kind: 'image', asset }, 128, 128, centre()));
          }}
        />
      </Dialog>
    );
  }
  if (tool?.kind === 'sheet') {
    return (
      <Dialog wide title="انیمیشن از یک عکس چندتکه" about="بگو عکس چند ستون و چند ردیف دارد. خط‌های نارنجی نشان می‌دهند عکس کجا بریده می‌شود و گوشه‌ی صفحه انیمیشن را پخش می‌کند." onClose={onClose}>
        <SheetCutter
          src={tool.src}
          width={tool.width}
          height={tool.height}
          onCancel={() => setTool(null)}
          onDone={(frames, fps, size) => {
            const ids = frames.map(() => newId('img'));
            const assets = { ...project.assets };
            ids.forEach((id, i) => (assets[id] = { type: 'image', src: frames[i] }));
            const scale = Math.min(1, 200 / Math.max(size.width, size.height));
            const visual: Visual = { kind: 'image', asset: ids[0], ...(ids.length > 1 ? { frames: ids.slice(1), fps } : {}) };
            finish({ ...project, assets }, makeObject(`انیمیشن ${fa(count + 1)}`, visual, Math.round(size.width * scale), Math.round(size.height * scale), centre()));
          }}
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      wide
      title={placed ? 'چه چیزی به صحنه اضافه شود؟' : 'چه چیزی حین بازی ساخته شود؟'}
      about={placed ? 'هر چیزی را که اضافه کنی، بعداً می‌توانی کامل عوضش کنی.' : 'این شیء در صحنه گذاشته نمی‌شود؛ یک رفتار «ساخت خودکار» یا یک قانون آن را وارد بازی می‌کند.'}
      onClose={onClose}
    >
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" data-library-tab={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'genre' && <div className="pick-list">
        <h3>چه سبکی می‌سازی؟</h3>
        <p>با انتخاب سبک، بازیکن و قطعه‌های زیر به همین صحنه اضافه می‌شوند. دوربین بازیکن را دنبال می‌کند، سه قلب جان را نشان می‌دهند و قاب امتیاز مقدار score را نمایش می‌دهد.</p>
        <div className="pick-items">{genres.map(g =>
          <button key={g.id} type="button" className="card card-with-icon" disabled={busy} data-genre={g.id} onClick={() => addGenre(g)}>
            <CardIcon sprite={g.sprite} /><strong>{g.title}</strong><span>{g.about}</span>
          </button>)}</div>
      </div>}

      {tab === 'pictures' && <SpriteGrid onPick={addSprite} />}

      {tab === 'basic' && (
        <div className="pick-list">
          <div className="pick-items">
            <button type="button" className="card" data-basic="rect" onClick={() => addBasic('شکل', { kind: 'rect', color: PALETTE[count % PALETTE.length], radius: 12, shade: true }, 120, 120)}>
              <strong>مستطیل</strong>
              <span>یک شکل ساده‌ی رنگی؛ برای زمین، دیوار، سکو یا هر چیزی که بعداً عکس می‌گیرد.</span>
            </button>
            <button type="button" className="card" data-basic="ellipse" onClick={() => addBasic('شکل', { kind: 'ellipse', color: PALETTE[count % PALETTE.length], shade: true }, 120, 120)}>
              <strong>دایره</strong>
              <span>برای توپ، سکه یا حباب.</span>
            </button>
            <button type="button" className="card" data-basic="text" onClick={() => addBasic('متن', { kind: 'text', text: 'Text', color: '#1b3a4b', size: 60 }, 0, 0)}>
              <strong>متن</strong>
              <span>نوشته‌ای روی صفحه؛ می‌تواند امتیاز یا هر مقدار دیگری را هم نشان بدهد.</span>
            </button>
            {placed && (
              <button
                type="button"
                className="card"
                data-basic="bar"
                disabled={project.variables.length === 0}
                onClick={() => addBasic('نوار', { kind: 'bar', variable: project.variables[0].name, max: 10, color: '#43a047', back: '#1b3a4b' }, 320, 36)}
              >
                <strong>نوار</strong>
                <span>{project.variables.length === 0 ? 'اول در برگه‌ی «بازی» یک مقدار بساز.' : 'با یک مقدار پر و خالی می‌شود؛ مثل نوار جان یا زمان.'}</span>
              </button>
            )}
            {placed && (
              <button
                type="button"
                className="card"
                data-basic="bag"
                onClick={() => {
                  // Across the bottom of the screen, fixed to it, like the bags of most games.
                  const { width, height } = project.meta;
                  finish(project, makeObject(`کوله‌پشتی ${fa(count + 1)}`, { kind: 'bag', slots: 5 }, Math.min(500, width - 40), 100, { x: width / 2, y: height - 90 }, { fixed: true }));
                }}
              >
                <strong>کوله‌پشتی</strong>
                <span>{project.variables.some((v) => v.item) ? 'خانه‌هایی که وسیله‌های بازیکن را با عکس و تعداد نشان می‌دهند؛ با لمس هر وسیله می‌شود از آن استفاده کرد.' : 'خانه‌هایی برای وسیله‌های بازیکن، مثل کلید و معجون. وسیله‌ها را در برگه‌ی «بازی»، بخش «کوله‌پشتی» بساز.'}</span>
              </button>
            )}
            {placed && (
              <button
                type="button"
                className="card"
                data-basic="tiles"
                onClick={() => {
                  // One map over the whole world, cut into cells of the scene's grid (or of a handy size).
                  // Whole cells only, so the row of ground along the bottom is inside the world.
                  const cell = scene.cell || 60;
                  const cols = Math.max(1, Math.min(300, Math.floor(scene.width / cell)));
                  const rows = Math.max(2, Math.min(300, Math.floor(scene.height / cell)));
                  const map = makeObject(`نقشه ${fa(count + 1)}`, newTileMap(cell, cols, rows), cols * cell, rows * cell, { x: (cols * cell) / 2, y: (rows * cell) / 2 });
                  finish(project, map);
                  editor.paint('a');
                }}
              >
                <strong>نقشه‌ی خانه‌خانه</strong>
                <span>برای ساختن مرحله با کشیدن روی خانه‌ها، مثل نقاشی: زمین، دیوار، سکو، سراشیبی و سکه. حین بازی هر خانه یک تکه‌ی جدا است.</span>
              </button>
            )}
            <button type="button" className="card" data-basic="image" onClick={addOwnImage}>
              <strong>عکس از کامپیوتر خودت</strong>
              <span>یک فایل عکس (PNG با پس‌زمینه‌ی شفاف بهترین است) انتخاب کن.</span>
            </button>
            <button type="button" className="card" data-basic="draw" onClick={() => setTool({ kind: 'draw' })}>
              <strong>نقاشی کن</strong>
              <span>شکل خودت را خانه‌به‌خانه بکش، مثل بازی‌های قدیمی؛ با مداد، سطل رنگ و حالت آینه‌ای.</span>
            </button>
            <button type="button" className="card" data-basic="sheet" onClick={pickSheet}>
              <strong>انیمیشن از یک عکس چندتکه</strong>
              <span>عکسی که همه‌ی حرکت‌های یک شخصیت را کنار هم دارد (sprite sheet) به یک شیء متحرک تبدیل می‌شود.</span>
            </button>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="pick-list">
          <div className="pick-items">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="card card-with-icon" data-block={p.id} onClick={() => addRole(p.id)}>
                <CardIcon sprite={ROLE_ICON[p.id]} />
                <strong>{p.title}</strong>
                <span>{p.about}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'parts' && (
        <div className="pick-list">
          <div className="pick-items">
            {RECIPES.map((r) => (
              <button key={r.id} type="button" className="card card-with-icon" data-block={r.id} onClick={() => addPart(r.id)}>
                <CardIcon sprite={PART_ICON[r.id]} />
                <strong>{r.title}</strong>
                <span>{r.about}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}
