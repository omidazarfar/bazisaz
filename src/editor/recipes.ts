import type { Action, Amount, Behavior, GameObject, GameProject, Rule, Scene, Visual } from '../format/types';
import { CRATE, DANGER, GROUND, LOSE, physics, PLAYER, PRIZE, THROWN, withTouchRule, withVariable } from './presets';
import { useSprite } from './sprites';
import { addObject, getScene, makeObject, newId, updateScene } from './state';

/**
 * Ready-made parts. A part is a few ordinary objects and rules added in one
 * step: a pause button, a game-over screen, obstacles that keep coming. It is
 * not a kind of game; it goes into whatever the user is building, and every
 * piece of it can be changed or removed afterwards like anything made by hand.
 */
export interface Recipe {
  id: string;
  title: string;
  about: string;
  apply: (project: GameProject, sceneId: string, centre: { x: number; y: number }) => Promise<RecipeResult>;
}

export interface RecipeResult {
  project: GameProject;
  /** What to select afterwards. */
  select: string | null;
  /** Something the user should know or do next, said in one or two sentences. */
  note?: string;
}

const INK = '#1b3a4b';
export const rule = (when: Rule['when'], then: Action[]): Rule => ({ id: newId('rule'), when, condition: null, then });
export const withRules = (project: GameProject, sceneId: string, ...rules: Rule[]) => updateScene(project, sceneId, (s) => ({ ...s, rules: [...s.rules, ...rules] }));
export const byId = (id: string) => ({ by: 'id' as const, id });
export const byTag = (tag: string) => ({ by: 'tag' as const, tag });

/** White letters with a dark line around them and a soft shadow under them: readable on any background. */
export const label = (name: string, text: string, size: number, x: number, y: number, extra: Partial<GameObject> = {}): GameObject =>
  makeObject(name, { kind: 'text', text, color: '#ffffff', size, weight: 'bold', outline: INK, shadow: true }, 0, 0, { x, y }, { fixed: true, ...extra });
/** A big golden heading, for the name of the game and the titles of menus. */
export const title = (name: string, text: string, size: number, x: number, y: number): GameObject =>
  makeObject(name, { kind: 'text', text, color: '#ffd23f', size, weight: 'bold', outline: '#5a2a00', shadow: true }, 0, 0, { x, y }, { behaviors: [{ type: 'pulse', amount: 0.04, seconds: 1.6 }] });

export async function picture(project: GameProject, sprite: string, name: string, width: number, height: number, centre: { x: number; y: number }, extra: Partial<GameObject> = {}) {
  const placed = await useSprite(project, sprite);
  const object = makeObject(name, { kind: 'image', asset: placed.asset }, width, height, centre, extra);
  return { project: placed.project, object };
}

/**
 * A number on the screen the way games show it: in a dark glassy frame with a
 * gold edge, an icon at its left (a coin, a clock), the number beside it. All
 * three stay put when the camera moves; the text is what gets selected.
 */
export async function badge(project: GameProject, icon: string, name: string, text: string, at: { x: number; y: number }, size: { w: number; h: number }) {
  const frame = await picture(project, 'hud', `قاب ${name}`, size.w, size.h, at, { fixed: true });
  const mark = await picture(frame.project, icon, `نشان ${name}`, size.h * 0.78, size.h * 0.78, { x: at.x - size.w / 2 + size.h * 0.5, y: at.y }, { fixed: true });
  const font = Math.round(size.h * 0.6);
  const words = label(name, text, font, at.x + size.h * 0.3, at.y - font * 0.6);
  return { project: mark.project, objects: [frame.object, mark.object, words], text: words };
}

/** A thing to carry shown with a picture: the game's own if it has one already, otherwise a new one named after `base`. */
export function withItem(project: GameProject, asset: string, base: string): { project: GameProject; item: string } {
  const have = project.variables.find((v) => v.item?.asset === asset)?.name;
  if (have) return { project, item: have };
  let item = base;
  for (let n = 2; project.variables.some((v) => v.name === item); n++) item = `${base}${n}`;
  return { project: { ...project, variables: [...project.variables, { name: item, initial: 0, saved: false, item: { asset } }] }, item };
}

/** A bag across the top of the screen, if the scene has none yet. */
export const bagIfNone = (project: GameProject, sceneId: string): GameObject[] =>
  getScene(project, sceneId).objects.some((o) => o.visual.kind === 'bag')
    ? []
    : [makeObject('کوله‌پشتی', { kind: 'bag', slots: 5 }, Math.min(450, project.meta.width - 40), 90, { x: project.meta.width / 2, y: 250 }, { fixed: true })];

const playersOf = (scene: Scene) => [...scene.objects, ...scene.prefabs].filter((o) => o.tags.includes(PLAYER));

/**
 * Where the ground's top is under a point, for parts that stand things on it.
 * A scene with no ground gets one: a strip along the bottom of the view, the
 * whole width of the world.
 */
async function withGround(project: GameProject, sceneId: string, centre: { x: number; y: number }): Promise<{ project: GameProject; top: number }> {
  const scene = getScene(project, sceneId);
  const grounds = scene.objects.filter((o) => o.tags.includes(GROUND) && o.visual.kind !== 'text');
  const under = grounds.find((o) => o.x <= centre.x && o.x + o.width >= centre.x) ?? grounds[0];
  if (under) {
    if (under.visual.kind !== 'terrain') return { project, top: under.y };
    const samples = under.visual.heights;
    const i = Math.max(0, Math.min(1, (centre.x - under.x) / under.width)) * (samples.length - 1);
    const h = samples[Math.floor(i)] + (samples[Math.ceil(i)] - samples[Math.floor(i)]) * (i % 1);
    return { project, top: under.y + under.height * h };
  }
  const height = 80;
  const top = Math.round(centre.y + project.meta.height / 2 - height);
  // Grass on earth, repeated along the whole world.
  const placed = await useSprite(project, 'ground');
  const ground = makeObject('زمین', { kind: 'image', asset: placed.asset, repeat: 'x' }, scene.width, height, { x: 0, y: 0 }, { x: 0, y: top, tags: [GROUND] });
  return { project: addObject(placed.project, sceneId, 'objects', ground), top };
}

/** A small pyramid of crates with real physics, its bottom row standing on `top` around `x`. */
async function crateTower(project: GameProject, x: number, top: number, rows: number): Promise<{ project: GameProject; crates: GameObject[] }> {
  const placed = await useSprite(project, 'crate');
  const size = 90;
  const crates: GameObject[] = [];
  for (let row = 0; row < rows; row++) {
    const count = rows - row;
    for (let i = 0; i < count; i++) {
      const cx = x + (i - (count - 1) / 2) * size;
      crates.push(makeObject(`جعبه ${crates.length + 1}`, { kind: 'image', asset: placed.asset }, size, size, { x: cx, y: top - size * row - size / 2 }, { tags: [CRATE], behaviors: [physics()] }));
    }
  }
  return { project: placed.project, crates };
}

export const addAll = (project: GameProject, sceneId: string, objects: GameObject[]) => objects.reduce((p, o) => addObject(p, sceneId, 'objects', o), project);

/** Each assembly uses local joint targets so adjacent copies stay independent. */
export function addRescueRig(p: GameProject, sceneId: string, x: number, y: number) {
  const parts: GameObject[] = [];
  const piece = (name: string, dx: number, dy: number, w: number, h: number, color: string, parent?: GameObject, limit = 65) => {
    const o = makeObject(name, { kind: 'rect', color, radius: Math.min(9, w / 2), shade: true }, w, h, { x: x + dx, y: y + dy }, {
      behaviors: [physics(parent ? { bounce: 0, drag: 'grab' } : { kind: 'still' })],
    });
    o.tags.push(name + '-' + o.id);
    if (parent) o.behaviors.push({ type: 'joint', kind: 'hinge', targetTag: parent.tags[0], at: 'between', limit, motor: 0 });
    parts.push(o);
    return o;
  };
  const pin = piece('قلاب نجات', 0, 0, 60, 30, '#ffb843');
  let end = pin;
  for (let i = 1; i <= 5; i++) end = piece('حلقه ' + i, 0, i * 21, i % 2 ? 12 : 19, 23, i % 2 ? '#7299b1' : '#c4e6ef', end);
  const head = piece('کلاه نجات', 0, 134, 44, 42, '#ffb743', end, 28);
  const torso = piece('تنه', 0, 183, 49, 62, '#f07a3f', head, 24);
  const boots = ([-1, 1] as const).map(side => {
    const name = side === -1 ? 'چپ' : 'راست';
    const arm = piece('بازوی ' + name, side * 37, 168, 17, 36, '#ffb743', torso, 80);
    piece('ساعد ' + name, side * 38, 201, 17, 33, '#477489', arm, 70);
    const thigh = piece('ران ' + name, side * 14, 230, 19, 39, '#477489', torso, 50);
    return piece('ساق ' + name, side * 15, 267, 19, 38, '#204259', thigh, 60);
  });
  const project = withRules(addAll(p, sceneId, parts), sceneId, rule({ type: 'tapObject', target: byId(pin.id) }, [{ type: 'cut', target: byId(pin.id) }]));
  return { project, select: torso.id, boot: boots[1].id };

}

/**
 * A geared lift: the player's crank (a small gear) turns a big gear, whose
 * teeth push a rack up, with a capsule-shaped pod riding on top. Hold right
 * (or the right half of the screen) to wind it up; let go and the weight
 * winds it back down. `x, y` is the middle of the crank.
 */
export async function addClockwork(p: GameProject, sceneId: string, x: number, y: number) {
  const GEAR = 'دنده';
  const small = 100, big = 180;
  // Teeth reach into each other a little, so the two drawn gears look meshed.
  const bigX = x + small / 2 + big / 2 - 12;
  const rackX = bigX + big / 2 - 10 + 45;
  const rackTop = y - 170;
  const pin = (name: string, cx: number, cy: number) => {
    const o = makeObject(name, { kind: 'ellipse', color: '#2d2f38', outline: '#14151a' }, 22, 22, { x: cx, y: cy });
    o.tags.push(name + '-' + o.id);
    return o;
  };
  const crankPin = pin('محور دسته', x, y);
  const bigPin = pin('محور چرخ بزرگ', bigX, y);
  const base = makeObject('پایه‌ی آسانسور', { kind: 'rect', color: '#4a4e5a', radius: 6, shade: true }, 120, 40, { x: rackX, y: rackTop + 360 + 20 });
  base.tags.push('پایه-' + base.id);
  const rack = await picture(p, 'gear-rack', 'دنده‌ی شانه‌ای', 90, 360, { x: rackX, y: rackTop + 180 }, {
    behaviors: [physics({ rotates: false, gravity: false, weight: 0.3, passTag: GEAR, solidTag: base.tags[0], edges: false }),
      // The rail is the big gear's pin: joined bodies never meet, and the rack must stand on its base.
      { type: 'joint', kind: 'slider', targetTag: bigPin.tags[0], at: 'self', axis: 90, range: 420, motor: 0 }],
  });
  rack.object.tags.push(GEAR, 'شانه-' + rack.object.id);
  const wheel = (name: string, size: number, cx: number, behaviors: Behavior[]) => picture(rack.project, 'gear', name, size, size, { x: cx, y }, {
    round: true, behaviors: [physics({ weight: 4, passTag: GEAR, solidTag: '', edges: false, gravity: false }), ...behaviors],
  });
  const bigGear = await wheel('چرخ‌دنده‌ی بزرگ', big, bigX, [
    { type: 'joint', kind: 'hinge', targetTag: bigPin.tags[0], at: 'self', motor: 0 },
    { type: 'joint', kind: 'gear', targetTag: rack.object.tags[1], at: 'self', motor: 0 },
  ]);
  bigGear.object.tags.push(GEAR, 'بزرگ-' + bigGear.object.id);
  const crank = await picture(bigGear.project, 'gear', 'دسته‌ی چرخ‌دنده', small, small, { x, y }, {
    round: true, behaviors: [physics({ weight: 4, passTag: GEAR, solidTag: '', edges: false, gravity: false }),
      { type: 'joint', kind: 'hinge', targetTag: crankPin.tags[0], at: 'self', motor: 220, drive: 'player' },
      { type: 'joint', kind: 'gear', targetTag: bigGear.object.tags[1], at: 'self', motor: 0 }],
  });
  crank.object.tags.push(GEAR);
  const pod = await picture(crank.project, 'rescue-pod', 'کپسول نجات', 120, 66, { x: rackX, y: rackTop - 33 }, {
    behaviors: [physics({ shape: 'capsule', weight: 0.6, solidTag: '', bounce: 0 })],
  });
  const parts = [base, rack.object, bigGear.object, crank.object, crankPin, bigPin, pod.object];
  return { project: addAll(pod.project, sceneId, parts), select: crank.object.id, pod: pod.object.id, rackTop, rackX };
}

export const RECIPES: Recipe[] = [
  {
    id: 'cutout', title: 'آدمک تکه‌تکه‌ی متحرک',
    about: 'یک آدمک از تکه‌ها: بدن، سر، دو دست و دو پا. هر تکه به بدن وصل است و با «انیمیشن (خط زمان)» دور مفصل خودش (شانه، لگن) تاب می‌خورد، پس آدمک راه می‌رود. برای هر تکه می‌توانی عکس خودت را بگذاری؛ حرکت همان می‌ماند.',
    apply: async (p, s, centre) => {
      const BODY = 'بدن آدمک';
      const k = (t: number, angle: number, y = 0) => ({ t, x: 0, y, angle, scale: 1, opacity: 1 });
      const swing = (from: number, to: number, pivot: { x: number; y: number }): Behavior => ({ type: 'animate', repeat: 'bounce', ease: 'smooth', pivot, keys: [k(0, from), k(0.5, to)] });
      const body = makeObject('بدن', { kind: 'rect', color: '#2f7cf6', radius: 16, shade: true }, 60, 90, { x: centre.x, y: centre.y }, {
        tags: [BODY], behaviors: [{ type: 'patrol', axis: 'x', distance: 260, speed: 90 }, { type: 'animate', repeat: 'loop', ease: 'smooth', keys: [k(0, 0), k(0.25, 0, -5), k(0.5, 0)] }],
      });
      const part = (name: string, visual: Visual, w: number, h: number, dx: number, dy: number, extra: Behavior[] = []) =>
        makeObject(name, visual, w, h, { x: centre.x + dx, y: centre.y + dy }, { behaviors: [{ type: 'attach', targetTag: BODY, offsetX: (60 - w) / 2 + dx, offsetY: (90 - h) / 2 + dy }, ...extra] });
      const skin = { kind: 'ellipse' as const, color: '#ffcf9e', shade: true };
      const limb = (color: string) => ({ kind: 'rect' as const, color, radius: 9, shade: true });
      const shoulder = { x: 0.5, y: 0.1 };
      const hip = { x: 0.5, y: 0.05 };
      // Drawn back to front: the far arm and leg first, then the body, the near ones, the head.
      const parts = [
        part('دست پشتی', limb('#1f5bb8'), 18, 60, -26, -10, [swing(30, -30, shoulder)]),
        part('پای پشتی', limb('#24324a'), 20, 64, -10, 62, [swing(-25, 25, hip)]),
        body,
        part('پای جلویی', limb('#2f3e5a'), 20, 64, 10, 62, [swing(25, -25, hip)]),
        part('دست جلویی', limb('#2f7cf6'), 18, 60, 26, -10, [swing(-30, 30, shoulder)]),
        part('سر', skin, 56, 56, 0, -72),
      ];
      return { project: addAll(p, s, parts), select: body.id, note: 'آدمک ساخته شد. هر تکه یک شیء جداست با «چسبیدن به» بدن و «انیمیشن» خودش؛ نقطه‌ی چرخش دست‌ها روی شانه و پاها روی لگن است. در «امتحان کن» راه می‌رود.' };
    },
  },
  {
    id: 'boss', title: 'غول آخر با الگوی حمله',
    about: 'یک غول بزرگ با نوار جان که چپ و راست می‌رود و به نوبت حمله می‌کند: هر چند ثانیه یک حلقه‌ی گوی دور تا دور، و بادبزنی از سه گوی رو به بازیکن. گوی‌ها به بازیکن آسیب می‌زنند (پیام «آسیب»). وقتی جانش تمام شد، با موج انفجار از بین می‌رود و دستاورد «Boss down» داده می‌شود.',
    apply: async (p, s, centre) => {
      const BOSS = 'غول';
      const boss = await picture(p, 'ufo', 'غول آخر', 260, 170, { x: centre.x, y: centre.y - 200 }, {
        tags: [BOSS, DANGER], health: 30, healthBar: true, invincible: 0.05, glow: '#b07cff',
        behaviors: [{ type: 'patrol', axis: 'x', distance: 260, speed: 120 }, { type: 'pulse', amount: 0.05, seconds: 1.4 }],
      });
      const orb = makeObject('گوی غول', { kind: 'ellipse', color: '#c77dff', shade: true }, 28, 28, { x: 0, y: 0 }, {
        x: 0, y: 0, tags: [DANGER, 'گوی غول'], round: true, glow: '#c77dff', behaviors: [{ type: 'lifetime', seconds: 5 }],
      });
      let project = addObject(addObject(boss.project, s, 'objects', boss.object), s, 'prefabs', orb);
      project = withRules(project, s,
        rule({ type: 'every', seconds: 2.6 }, [{ type: 'shoot', from: byId(boss.object.id), prefab: orb.id, pattern: 'ring', count: 12, direction: 90, spread: 0, speed: 220, aimTag: '' }, { type: 'playSound', sound: 'laser', volume: 30 }]),
        rule({ type: 'every', seconds: 1.4 }, [{ type: 'shoot', from: byId(boss.object.id), prefab: orb.id, pattern: 'aimed', count: 3, direction: 90, spread: 30, speed: 300, aimTag: PLAYER }]),
        rule({ type: 'touch', a: byTag(PLAYER), b: byTag('گوی غول') }, [{ type: 'destroy', target: 'second' }, { type: 'send', name: 'آسیب' }]),
        rule({ type: 'dead', target: byTag(BOSS) }, [
          { type: 'shockwave', at: 'first', size: 700 }, { type: 'zoomPunch', amount: 1.15, seconds: 0.6 }, { type: 'shake', strength: 16 },
          { type: 'burst', target: 'first', color: '#c77dff', count: 40 }, { type: 'playSound', sound: 'boom' }, { type: 'achieve', name: 'Boss down' },
          { type: 'effect', target: 'first', kind: 'dissolve', seconds: 0.8 },
        ]),
      );
      return { project, select: boss.object.id, note: 'غول آماده است. برای اینکه بازیکن به آن ضربه بزند، در یک قانون کار «آسیب زدن» را روی «غول» بگذار (مثلاً وقتی تیر بازیکن به غول خورد). اگر پیام «آسیب» قانونی ندارد، قطعه‌ی جان‌ها را هم اضافه کن.' };
    },
  },
  {
    id: 'waves', title: 'موج دشمن‌ها',
    about: 'دشمن‌ها موج به موج از دو طرف صفحه می‌آیند و دنبال بازیکن می‌کنند. هر ۱۵ ثانیه موج بعدی می‌رسد و دشمن‌ها زودتر می‌آیند. شماره‌ی موج بالای صفحه است (مقدار wave).',
    apply: async (p, s, centre) => {
      const ENEMY_WAVE = 'دشمن موج';
      const SPAWN = 'دروازه‌ی دشمن';
      const scene = getScene(p, s);
      let project = withVariable(p, 'wave');
      project = { ...project, variables: project.variables.map((v) => (v.name === 'wave' ? { ...v, initial: 1 } : v)) };
      const enemy = await picture(project, 'slime', 'دشمن موج', 80, 58, { x: 0, y: 0 }, {
        x: 0, y: 0, tags: [ENEMY_WAVE, DANGER], health: 2, behaviors: [{ type: 'chase', targetTag: PLAYER, speed: 120 }],
      });
      project = enemy.project;
      const gates = [60, scene.width - 60].map((x, i) => makeObject(`${SPAWN} ${i + 1}`, { kind: 'rect', color: '#8f5ff0' }, 40, 40, { x, y: centre.y }, { tags: [SPAWN], opacity: 0 }));
      const sign = makeObject('شماره‌ی موج', { kind: 'text', text: 'Wave {wave}', color: '#ffd23f', size: 52, weight: 'bold', outline: '#5a2a00', shadow: true }, 0, 0, { x: p.meta.width / 2, y: 170 }, { fixed: true });
      project = addAll(addObject(project, s, 'prefabs', enemy.object), s, [...gates, sign]);
      const spawn = (seconds: number, from: number) => ({
        ...rule({ type: 'every', seconds }, [{ type: 'spawn', prefab: enemy.object.id, at: byTag(SPAWN) }]),
        condition: { name: 'wave', op: '>=' as const, value: from },
      });
      project = withRules(project, s,
        spawn(3.5, 1), spawn(2.5, 2), spawn(1.8, 3),
        rule({ type: 'every', seconds: 15 }, [
          { type: 'setVariable', name: 'wave', op: 'add', amount: 1 },
          { type: 'effect', target: byId(sign.id), kind: 'pop', seconds: 0.5 },
          { type: 'playSound', sound: 'powerup' },
        ]),
        rule({ type: 'touch', a: byTag(PLAYER), b: byTag(ENEMY_WAVE) }, [{ type: 'send', name: 'آسیب' }]),
        rule({ type: 'dead', target: byTag(ENEMY_WAVE) }, [{ type: 'burst', target: 'first', color: '#8be04e', count: 16 }, { type: 'destroy', target: 'first' }]),
      );
      return { project, select: sign.id, note: 'موج‌ها آماده‌اند: دشمن‌ها از دو دروازه‌ی نامرئی کنار صفحه می‌آیند. برای کشتنشان، کار «آسیب زدن» را روی «دشمن موج» بگذار.' };
    },
  },
  {
    id: 'gears', title: 'چرخ‌دنده و آسانسور', about: 'دسته‌ی کوچک چرخ‌دنده‌ی بزرگ را می‌چرخاند و آن دنده‌ی شانه‌ای را با کپسول بالا می‌برد. راست را نگه دار تا بالا برود؛ رها کنی، پایین برمی‌گردد.',
    apply: async (p, s, centre) => addClockwork(p, s, centre.x - 150, centre.y + 120),
  },
  ...(['bike', 'tank'] as const).map((id): Recipe => ({
    id, title: id === 'bike' ? 'موتور کوهستان' : 'خودروی شنی‌دار امداد',
    about: 'با کلید یا لمس راست و چپ بران. هر چرخ اتصال و موتور خودش را دارد.',
    apply: async (p, s, centre) => {
      const bike = id === 'bike';
      const ground = await withGround(p, s, centre);
      const cx = centre.x, cy = ground.top - 78;
      const shell = await picture(ground.project, bike ? 'trail-bike' : 'rescue-tank', bike ? 'بدنه‌ی موتور' : 'بدنه‌ی شنی‌دار',
        bike ? 152 : 186, bike ? 58 : 65, { x: cx, y: cy }, { hitboxInset: bike ? 0 : 8, behaviors: [physics({ weight: bike ? 0.65 : 2, friction: 0.2 })] });
      const body = shell.object;
      const axle = 'محور-' + body.id;
      body.tags.push(axle);
      const tire = await useSprite(shell.project, 'tire');
      const size = bike ? 47 : 43;
      const wheels = (bike ? [-57, 56] : [-66, -22, 22, 66]).map((dx, i) => makeObject('چرخ ' + (i + 1),
        { kind: 'image', asset: tire.asset }, size, size, { x: cx + dx, y: cy + 26 }, { round: true,
          behaviors: [physics({ friction: 1.1, bounce: 0 }), { type: 'joint', kind: 'wheel', targetTag: axle, at: 'self', drive: 'player', motor: bike ? 690 : 530 }] }));
      if (bike) wheels[0].behaviors.push({ type: 'particles', preset: 'dust', color: '#d6ad77', rate: 32, size: 10, speed: 1.2, onGroundMove: true });
      return { project: addAll(tire.project, s, [body, ...wheels]), select: body.id };
    },
  })),
  {
    id: 'boat', title: 'قایق موتوری', about: 'قایق و آب را اضافه می‌کند. با لمس نیمه‌ی راست یا چپ صفحه روی آب بران.',
    apply: async (p, s, centre) => {
      const world = getScene(p, s);
      const top = centre.y + 18;
      const h = Math.max(100, world.height - top);
      const water = await picture(p, 'water', 'آب بندر', world.width, h, { x: world.width / 2, y: top + h / 2 },
        { locked: true, opacity: 0.65, behaviors: [{ type: 'field', kind: 'water', strength: 1, direction: 0 }] });
      const hull = await picture(water.project, 'harbor-boat', 'قایق نجات', 170, 65, centre,
        { behaviors: [physics({ weight: 0.65, propeller: 1400, bounce: 0.03 })] });
      return { project: addAll(hull.project, s, [water.object, hull.object]), select: hull.object.id };
    },
  },
  {
    id: 'rescue-chain', title: 'زنجیر و آدمک مفصلی', about: 'آدمک با پنج حلقه از قلاب آویزان است. دست و پاهایش را بکش یا قلاب را لمس کن تا روی تشک بیفتد.',
    apply: async (p, s, centre) => addRescueRig(p, s, centre.x, centre.y - 120),
  },
  {
    id: 'score',
    title: 'امتیاز بالای صفحه',
    about: 'عدد امتیاز در یک قاب شیشه‌ای با لبه‌ی طلایی و نشان سکه، بالای صفحه؛ با حرکت دوربین سر جایش می‌ماند.',
    apply: async (p, s) => {
      const made = await badge(withVariable(p, 'score'), 'coin', 'امتیاز', '{score}', { x: p.meta.width / 2, y: 70 }, { w: 230, h: 80 });
      return { project: addAll(made.project, s, made.objects), select: made.text.id };
    },
  },
  {
    id: 'best',
    title: 'بهترین امتیاز',
    about: 'بالاترین امتیازی که بازیکن تا حالا گرفته، روی گوشی می‌ماند و در قابی با نشان جام زیر امتیاز نشان داده می‌شود.',
    apply: async (p, s) => {
      const scored = withVariable(p, 'score');
      const project = scored.variables.some((v) => v.name === 'best') ? scored : { ...scored, variables: [...scored.variables, { name: 'best', initial: 0, saved: true }] };
      const made = await badge(project, 'trophy', 'بهترین امتیاز', '{best}', { x: p.meta.width / 2, y: 148 }, { w: 190, h: 60 });
      const keep = rule({ type: 'every', seconds: 0.25 }, [{ type: 'setVariable', name: 'best', op: 'max', amount: { variable: 'score' } }]);
      return { project: withRules(addAll(made.project, s, made.objects), s, keep), select: made.text.id };
    },
  },
  {
    id: 'pause',
    title: 'دکمه‌ی مکث',
    about: 'دکمه‌ای گوشه‌ی صفحه که بازی را نگه می‌دارد، و دکمه‌ای وسط صفحه که ادامه‌اش می‌دهد.',
    apply: async (p, s) => {
      const { width, height } = p.meta;
      const a = await picture(p, 'btn-pause', 'دکمه‌ی مکث', 90, 90, { x: width - 75, y: 75 }, { fixed: true });
      const b = await picture(a.project, 'btn-play', 'دکمه‌ی ادامه', 220, 220, { x: width / 2, y: height / 2 }, { fixed: true, visible: false, locked: true });
      const placed = addObject(addObject(b.project, s, 'objects', a.object), s, 'objects', b.object);
      const project = withRules(
        placed,
        s,
        rule({ type: 'tapObject', target: byId(a.object.id) }, [{ type: 'show', target: byId(b.object.id) }, { type: 'pause' }]),
        rule({ type: 'tapObject', target: byId(b.object.id) }, [{ type: 'hide', target: byId(b.object.id) }, { type: 'resume' }]),
      );
      return { project, select: a.object.id, note: 'دکمه‌ی «ادامه» وسط صفحه است، از اول پنهان است و در ویرایشگر کم‌رنگ دیده می‌شود. قفل است تا جلوی کلیک روی چیزهای زیرش را نگیرد؛ از فهرست سمت راست انتخابش کن.' };
    },
  },
  {
    id: 'sound',
    title: 'دکمه‌ی صدا',
    about: 'دکمه‌ای گوشه‌ی صفحه که صدا و موسیقی را خاموش و روشن می‌کند. انتخاب بازیکن روی گوشی می‌ماند.',
    apply: async (p, s) => {
      // Remembered on the phone: 1 while the player has turned the sound off.
      const project = p.variables.some((v) => v.name === 'muted') ? p : { ...p, variables: [...p.variables, { name: 'muted', initial: 0, saved: true }] };
      const at = { x: 75, y: 75 };
      const on = await picture(project, 'btn-sound', 'دکمه‌ی صدا (روشن)', 90, 90, at, { fixed: true });
      const off = await picture(on.project, 'btn-mute', 'دکمه‌ی صدا (خاموش)', 90, 90, at, { fixed: true, visible: false });
      const placed = addObject(addObject(off.project, s, 'objects', on.object), s, 'objects', off.object);
      const mute: Action[] = [{ type: 'setSound', on: false }, { type: 'hide', target: byId(on.object.id) }, { type: 'show', target: byId(off.object.id) }];
      return {
        project: withRules(
          placed,
          s,
          { ...rule({ type: 'start' }, mute), condition: { name: 'muted', op: '>=', value: 1 } },
          rule({ type: 'tapObject', target: byId(on.object.id) }, [{ type: 'setVariable', name: 'muted', op: 'set', amount: 1 }, ...mute]),
          rule({ type: 'tapObject', target: byId(off.object.id) }, [
            { type: 'setVariable', name: 'muted', op: 'set', amount: 0 },
            { type: 'setSound', on: true },
            { type: 'hide', target: byId(off.object.id) },
            { type: 'show', target: byId(on.object.id) },
          ]),
        ),
        select: on.object.id,
        note: 'دو دکمه روی هم هستند: «روشن» دیده می‌شود و «خاموش» از اول پنهان است. اگر بازی چند صحنه دارد، این قطعه را در هر صحنه اضافه کن.',
      };
    },
  },
  {
    id: 'memory',
    title: 'کارت‌های حافظه',
    about: 'دوازده کارت پشت‌ورو که بازیکن باید جفت‌هایشان را پیدا کند. نمونه‌ای از کار با «مقدارهای شیء»: هر کارت نوع (kind) و باز بودن (open) خودش را دارد.',
    apply: async (p, s) => {
      const CARD = 'کارت';
      const faces = ['star', 'heart', 'gem', 'coin', 'apple', 'ball'];
      let project = withVariable(p, 'score');
      for (const name of ['opened', 'kindA', 'kindB']) {
        if (!project.variables.some((v) => v.name === name)) project = { ...project, variables: [...project.variables, { name, initial: 0, saved: false }] };
      }
      const back = await useSprite(project, 'card');
      project = back.project;
      const cell = 170;
      const left = Math.round((p.meta.width - cell * 3) / 2 + 10);
      const cards: GameObject[] = [];
      for (let i = 0; i < 12; i++) {
        const kind = Math.floor(i / 2) + 1;
        const face = await useSprite(project, faces[kind - 1]);
        project = face.project;
        // The picture follows the value "open": 0 shows the back, 1 the face.
        cards.push(makeObject(`کارت ${i + 1}`, { kind: 'image', asset: back.asset, frames: [face.asset], frameBy: 'open' }, 150, 150, { x: 0, y: 0 }, {
          x: left + (i % 3) * cell, y: 300 + Math.floor(i / 3) * cell, tags: [CARD], values: { kind, open: 0 },
        }));
      }
      const closed = { by: 'tag' as const, tag: CARD, where: { name: 'open', op: '==' as const, value: 0 } };
      const open = { by: 'tag' as const, tag: CARD, where: { name: 'open', op: '==' as const, value: 1 } };
      const set = (name: string, amount: Amount): Action => ({ type: 'setVariable', name, op: 'set', amount });
      const turn = (which: string, step: number): Action[] => [
        { type: 'setValue', target: 'first', name: 'open', op: 'set', amount: 1 },
        set(which, { value: 'kind', of: 'first' }),
        set('opened', step),
        { type: 'playSound', sound: 'click' },
      ];
      const placed = cards.reduce((next, card) => addObject(next, s, 'objects', card), project);
      return {
        project: withRules(
          placed,
          s,
          rule({ type: 'start' }, [{ type: 'shuffle', target: byTag(CARD) }, set('opened', 0)]),
          { ...rule({ type: 'tapObject', target: closed }, turn('kindA', 1)), condition: { name: 'opened', op: '==', value: 0 } },
          { ...rule({ type: 'tapObject', target: closed }, turn('kindB', 2)), condition: { name: 'opened', op: '==', value: 1 } },
          {
            ...rule({ type: 'variable', name: 'opened', op: '>=', value: 2 }, [
              { type: 'wait', seconds: 0.5 },
              { type: 'playSound', sound: 'coin' },
              { type: 'destroy', target: open },
              { type: 'setVariable', name: 'score', op: 'add', amount: 1 },
              set('opened', 0),
            ]),
            condition: { name: 'kindA', op: '==', value: { variable: 'kindB' } },
          },
          {
            ...rule({ type: 'variable', name: 'opened', op: '>=', value: 2 }, [
              { type: 'wait', seconds: 0.8 },
              { type: 'setValue', target: open, name: 'open', op: 'set', amount: 0 },
              set('opened', 0),
            ]),
            condition: { name: 'kindA', op: '!=', value: { variable: 'kindB' } },
          },
          rule({ type: 'noneLeft', target: byTag(CARD) }, [{ type: 'playSound', sound: 'win' }, { type: 'wait', seconds: 1 }, { type: 'resetVariables' }, { type: 'restartScene' }]),
        ),
        select: cards[0].id,
        note: 'کارت‌ها با شروع بازی بُر می‌خورند. برای عوض کردن عکس یک جفت، هر دو کارتِ هم‌نوع را عوض کن؛ نوع هر کارت در «مقدارهای این شیء» با نام kind است.',
      };
    },
  },
  {
    id: 'tictactoe',
    title: 'دوز (ضربدر و دایره)',
    about: 'نُه خانه برای دو بازیکن که نوبتی می‌زنند؛ سه‌تایی در یک خط یعنی برد. نمونه‌ای از «چند شیء در یک خط» و «عکس از روی مقدار».',
    apply: async (p, s) => {
      const CELL = 'خانه';
      // Three cells of 240 are exactly as wide as an upright screen, so the board is centred and on the grid at once.
      const cell = getScene(p, s).cell || 240;
      let project = updateScene(p, s, (scene) => ({ ...scene, cell }));
      for (const [name, initial] of [['turn', 1], ['over', 0]] as const) {
        if (!project.variables.some((v) => v.name === name)) project = { ...project, variables: [...project.variables, { name, initial, saved: false }] };
      }
      const pictures: string[] = [];
      for (const id of ['tile-empty', 'tile-x', 'tile-o']) {
        const made = await useSprite(project, id);
        project = made.project;
        pictures.push(made.asset);
      }
      // Whole cells from the left edge, so the board sits on the scene's grid.
      const left = Math.max(0, Math.floor((p.meta.width - cell * 3) / 2 / cell)) * cell;
      const top = Math.max(1, Math.round(340 / cell)) * cell;
      const cells = Array.from({ length: 9 }, (_, i) =>
        makeObject(`خانه ${i + 1}`, { kind: 'image', asset: pictures[0], frames: [pictures[1], pictures[2]], frameBy: 'mark' }, cell - 10, cell - 10, { x: left + (i % 3) * cell + cell / 2, y: top + Math.floor(i / 3) * cell + cell / 2 }, { tags: [CELL], values: { mark: 0 } }));
      const turn = label('نوبت', 'Player {turn}', 56, left + cell * 1.5, top - 110, { fixed: false });
      const empty = { by: 'tag' as const, tag: CELL, where: { name: 'mark', op: '==' as const, value: 0 } };
      const set = (name: string, amount: number): Action => ({ type: 'setVariable', name, op: 'set', amount });
      const move = (player: number): Rule => ({
        ...rule({ type: 'tapObject', target: empty }, [{ type: 'setValue', target: 'first', name: 'mark', op: 'set', amount: player }, set('turn', 3 - player), { type: 'playSound', sound: 'click' }]),
        condition: { name: 'turn', op: '==', value: player },
        also: [{ name: 'over', op: '==', value: 0 }],
      });
      const placed = [...cells, turn].reduce((next, o) => addObject(next, s, 'objects', o), project);
      return {
        project: withRules(
          placed,
          s,
          rule({ type: 'start' }, [set('turn', 1), set('over', 0)]),
          move(1),
          move(2),
          rule({ type: 'line', target: byTag(CELL), name: 'mark', length: 3, diagonal: true }, [set('over', 1), { type: 'effect', target: 'first', kind: 'pop', seconds: 0.4 }, { type: 'playSound', sound: 'win' }, { type: 'wait', seconds: 1.5 }, { type: 'restartScene' }]),
          rule({ type: 'noneLeft', target: empty }, [{ type: 'wait', seconds: 1.5 }, { type: 'restartScene' }]),
        ),
        select: cells[0].id,
        note: 'هر خانه مقدار mark دارد: ۰ یعنی خالی، ۱ ضربدر و ۲ دایره. عکس خانه از روی همین مقدار انتخاب می‌شود.',
      };
    },
  },
  {
    id: 'match3',
    title: 'سه‌تایی جور کن',
    about: 'صفحه‌ای از مهره‌ها: روی یک مهره و بعد روی مهره‌ی کناری‌اش بزن تا جا عوض کنند. سه مهره‌ی هم‌نوع در یک ردیف یا ستون حذف می‌شوند و مهره‌های تازه از بالا می‌ریزند.',
    apply: async (p, s) => {
      const GEM = 'مهره';
      const MARK = 'نشانگر';
      const cell = getScene(p, s).cell || 120;
      const cols = Math.min(6, Math.floor(p.meta.width / cell));
      const rows = 7;
      const size = cell - 18;
      let project = updateScene(withVariable(p, 'score'), s, (scene) => ({ ...scene, cell }));
      if (!project.variables.some((v) => v.name === 'picked')) project = { ...project, variables: [...project.variables, { name: 'picked', initial: 0, saved: false }] };
      const pictures: string[] = [];
      for (const id of ['star', 'heart', 'gem', 'coin', 'apple']) {
        const made = await useSprite(project, id);
        project = made.project;
        pictures.push(made.asset);
      }
      const ring = await useSprite(project, 'ring');
      project = ring.project;
      const piece = (name: string, kind: number, centre: { x: number; y: number }, extra: Partial<GameObject> = {}) =>
        makeObject(name, { kind: 'image', asset: pictures[kind] }, size, size, centre, { tags: [GEM], values: { kind: kind + 1, sel: 0 }, ...extra });
      const left = Math.max(0, Math.floor((p.meta.width - cell * cols) / 2 / cell)) * cell;
      const top = Math.max(1, Math.round(330 / cell)) * cell;
      // The board starts with no three alike in a line, so nothing vanishes before the first move.
      const kinds: number[][] = [];
      const pieces: GameObject[] = [];
      for (let row = 0; row < rows; row++) {
        kinds.push([]);
        for (let col = 0; col < cols; col++) {
          let kind = Math.floor(Math.random() * pictures.length);
          const repeats = (k: number) => (col >= 2 && kinds[row][col - 1] === k && kinds[row][col - 2] === k) || (row >= 2 && kinds[row - 1][col] === k && kinds[row - 2][col] === k);
          while (repeats(kind)) kind = (kind + 1) % pictures.length;
          kinds[row].push(kind);
          pieces.push(piece(`مهره ${row * cols + col + 1}`, kind, { x: left + col * cell + cell / 2, y: top + row * cell + cell / 2 }));
        }
      }
      const fresh = pictures.map((_, kind) => piece(`مهره‌ی تازه ${kind + 1}`, kind, { x: 0, y: 0 }, { x: 0, y: 0 }));
      const marker = makeObject('نشانگر انتخاب', { kind: 'image', asset: ring.asset }, cell, cell, { x: 0, y: 0 }, { x: 0, y: 0, tags: [MARK] });
      const chosen = { by: 'tag' as const, tag: GEM, where: { name: 'sel', op: '==' as const, value: 1 } };
      const others = { by: 'tag' as const, tag: GEM, where: { name: 'sel', op: '==' as const, value: 0 } };
      const set = (name: string, amount: number): Action => ({ type: 'setVariable', name, op: 'set', amount });
      const scene = getScene(project, s);
      const showsScore = scene.objects.some((o) => o.visual.kind === 'text' && o.visual.text.includes('{score}'));
      let placed = pieces.reduce((next, o) => addObject(next, s, 'objects', o), project);
      placed = [...fresh, marker].reduce((next, o) => addObject(next, s, 'prefabs', o), placed);
      if (!showsScore) placed = addObject(placed, s, 'objects', label('امتیاز', 'Score: {score}', 56, p.meta.width / 2, 60));
      return {
        project: withRules(
          placed,
          s,
          rule({ type: 'start' }, [set('picked', 0)]),
          {
            ...rule({ type: 'tapObject', target: byTag(GEM) }, [{ type: 'setValue', target: 'first', name: 'sel', op: 'set', amount: 1 }, set('picked', 1), { type: 'spawn', prefab: marker.id, at: 'first' }, { type: 'playSound', sound: 'click' }]),
            condition: { name: 'picked', op: '==', value: 0 },
          },
          {
            ...rule({ type: 'tapObject', target: others }, [
              { type: 'swap', target: 'first', other: chosen, near: true, match: 3, matchBy: 'kind' },
              { type: 'setValue', target: chosen, name: 'sel', op: 'set', amount: 0 },
              set('picked', 0),
              { type: 'destroy', target: byTag(MARK) },
            ]),
            condition: { name: 'picked', op: '==', value: 1 },
          },
          rule({ type: 'line', target: byTag(GEM), name: 'kind', length: 3, diagonal: false }, [
            { type: 'burst', target: 'first', color: '#ffd54a', count: 6 },
            { type: 'destroy', target: 'first' },
            { type: 'setVariable', name: 'score', op: 'add', amount: 1 },
            { type: 'playSound', sound: 'coin' },
          ]),
          rule({ type: 'every', seconds: 0.4 }, [{ type: 'settle', target: byTag(GEM), prefabs: fresh.map((o) => o.id) }]),
        ),
        select: null,
        note: 'روی یک مهره و بعد روی مهره‌ی کناری‌اش بزن. اگر جابه‌جایی سه‌تایی نسازد، مهره‌ها سر جایشان می‌مانند. اندازه‌ی خانه‌های این صحنه برای صفحه تنظیم شد.',
      };
    },
  },
  {
    id: 'g2048',
    title: 'کاشی‌های ۲۰۴۸',
    about: 'صفحه‌ی چهار در چهار: با کشیدن انگشت همه‌ی کاشی‌ها به یک طرف سُر می‌خورند و دو کاشی یکسان یکی می‌شوند. هدف رسیدن به ۲۰۴۸ است.',
    apply: async (p, s) => {
      const SLOT = 'خانه‌ی صفحه';
      const TILE = 'کاشی';
      // Four cells of 180 are exactly as wide as an upright screen.
      const cell = getScene(p, s).cell || 180;
      let project = updateScene(p, s, (scene) => ({ ...scene, cell }));
      const slotPicture = await useSprite(project, 'tile-empty');
      project = slotPicture.project;
      const faces: string[] = [];
      for (let level = 0; level < 11; level++) {
        const made = await useSprite(project, `n-${2 ** (level + 1)}`);
        project = made.project;
        faces.push(made.asset);
      }
      const left = Math.max(0, Math.floor((p.meta.width - cell * 4) / 2 / cell)) * cell;
      const top = Math.max(1, Math.round(360 / cell)) * cell;
      const centre = (col: number, row: number) => ({ x: left + col * cell + cell / 2, y: top + row * cell + cell / 2 });
      const slots = Array.from({ length: 16 }, (_, i) => makeObject(`خانه ${i + 1}`, { kind: 'image', asset: slotPicture.asset }, cell - 8, cell - 8, centre(i % 4, Math.floor(i / 4)), { tags: [SLOT], locked: true, opacity: 0.5 }));
      // The picture is the one numbered by "level": 0 shows 2, 1 shows 4, and so on up to 2048 at 10.
      const tile = (name: string, at: { x: number; y: number }, extra: Partial<GameObject> = {}) =>
        makeObject(name, { kind: 'image', asset: faces[0], frames: faces.slice(1), frameBy: 'level' }, cell - 24, cell - 24, at, { tags: [TILE], values: { level: 0 }, ...extra });
      const fresh = tile('کاشی تازه', { x: 0, y: 0 }, { x: 0, y: 0 });
      const again = await picture(project, 'btn-restart', 'دکمه‌ی دوباره', 90, 90, { x: p.meta.width - 75, y: 75 }, { fixed: true });
      let placed = [...slots, tile('کاشی ۱', centre(0, 0)), tile('کاشی ۲', centre(2, 1)), again.object].reduce((next, o) => addObject(next, s, 'objects', o), again.project);
      placed = addObject(placed, s, 'prefabs', fresh);
      const move = (direction: 'left' | 'right' | 'up' | 'down') =>
        rule({ type: 'swipe', direction }, [{ type: 'slideAll', target: byTag(TILE), direction, boardTag: SLOT, mergeBy: 'level', prefab: fresh.id }, { type: 'playSound', sound: 'tick' }]);
      return {
        project: withRules(
          placed,
          s,
          move('left'),
          move('right'),
          move('up'),
          move('down'),
          rule({ type: 'value', target: byTag(TILE), name: 'level', op: '>=', value: 10 }, [{ type: 'playSound', sound: 'win' }, { type: 'effect', target: 'first', kind: 'pop', seconds: 0.5 }]),
          rule({ type: 'tapObject', target: byId(again.object.id) }, [{ type: 'playSound', sound: 'click' }, { type: 'restartScene' }]),
        ),
        select: null,
        note: 'در پیش‌نمایش با موس روی صفحه سریع بکش. خانه‌های صفحه قفل‌اند تا جلوی کلیک روی کاشی‌ها را نگیرند. بازی نمی‌فهمد که دیگر حرکتی نمانده؛ برای همین دکمه‌ی «دوباره» هست.',
      };
    },
  },
  {
    id: 'startscreen',
    title: 'صفحه‌ی شروع',
    about: 'یک صحنه‌ی تازه با نام بازی و دکمه‌ی Play که بازی از آن شروع می‌شود و به صحنه‌ی فعلی می‌آید.',
    apply: async (p, s) => {
      const { width, height } = p.meta;
      const id = newId('scene');
      const button = await picture(p, 'btn-play', 'دکمه‌ی شروع', 240, 240, { x: width / 2, y: height * 0.55 }, { behaviors: [{ type: 'pulse', amount: 0.08, seconds: 1 }] });
      // "Continue" picks up saved progress; the game scene saves it each time it starts.
      const more = await picture(button.project, 'btn-wide', 'دکمه‌ی ادامه', 300, 100, { x: width / 2, y: height * 0.76 });
      const start: Scene = {
        id,
        name: 'Start',
        width,
        height,
        background: null,
        music: null,
        gravity: 2400,
        sky: 'sunset',
        bloom: true,
        vignette: true,
        objects: [
          title('نام بازی', p.meta.name, 110, width / 2, height * 0.25),
          button.object,
          more.object,
          label('نوشته‌ی ادامه', 'Continue', 44, width / 2, height * 0.76 - 32, { fixed: false }),
        ],
        prefabs: [],
        rules: [
          rule({ type: 'tapObject', target: byId(button.object.id) }, [{ type: 'playSound', sound: 'click' }, { type: 'resetVariables' }, { type: 'goToScene', scene: s }]),
          rule({ type: 'tapObject', target: byId(more.object.id) }, [{ type: 'playSound', sound: 'click' }, { type: 'loadGame', scene: s }]),
        ],
      };
      const saved = withRules(more.project, s, rule({ type: 'start' }, [{ type: 'saveGame' }]));
      return {
        project: { ...saved, scenes: [...saved.scenes, start], startScene: id },
        select: null,
        note: 'صحنه‌ی «Start» ساخته شد و بازی حالا از آن شروع می‌شود. «Play» بازی تازه است؛ «Continue» از آخرین جایی که بازی ذخیره شده ادامه می‌دهد (این صحنه هر بار که شروع شود بازی را ذخیره می‌کند؛ در صحنه‌های دیگر هم کار «ذخیره‌ی بازی» را بگذار).',
      };
    },
  },
  {
    id: 'gameover',
    title: 'صفحه‌ی باخت',
    about: 'یک صحنه‌ی تازه با نوشته‌ی Game Over، امتیاز و دکمه‌ی «دوباره». قانون‌های باخت این صحنه به آن وصل می‌شوند.',
    apply: async (p, s) => {
      const { width, height } = p.meta;
      const id = newId('scene');
      const button = await picture(withVariable(p, 'score'), 'btn-wide', 'دکمه‌ی دوباره', 340, 116, { x: width / 2, y: height * 0.62 });
      const over: Scene = {
        id,
        name: 'Game over',
        width,
        height,
        background: null,
        music: null,
        gravity: 2400,
        sky: 'night',
        vignette: true,
        objects: [
          title('نوشته‌ی باخت', 'Game Over', 110, width / 2, height * 0.3),
          label('امتیاز پایانی', 'Score: {score}', 56, width / 2, height * 0.3 + 150, { fixed: false }),
          button.object,
          label('نوشته‌ی دکمه', 'Play again', 48, width / 2, height * 0.62 - 6, { fixed: false }),
        ],
        prefabs: [],
        rules: [rule({ type: 'tapObject', target: byId(button.object.id) }, [{ type: 'playSound', sound: 'click' }, { type: 'resetVariables' }, { type: 'goToScene', scene: s }])],
      };
      // Losing used to start the scene again; now it leads here, with the score still on show.
      let rewired = 0;
      const scenes = button.project.scenes.map((scene) => {
        if (scene.id !== s) return scene;
        return {
          ...scene,
          rules: scene.rules.map((r) => {
            const losing = r.when.type === 'touch' && [r.when.a, r.when.b].some((x) => x.by === 'tag' && x.tag === DANGER);
            if (!losing || !r.then.some((a) => a.type === 'restartScene')) return r;
            rewired += 1;
            return { ...r, then: r.then.filter((a) => a.type !== 'resetVariables').map((a): Action => (a.type === 'restartScene' ? { type: 'goToScene', scene: id } : a)) };
          }),
        };
      });
      const note = rewired > 0
        ? 'صحنه‌ی «Game over» ساخته شد و قانون باخت این صحنه حالا به آن می‌رود. از فهرست «صحنه» می‌توانی آن را باز و عوض کنی.'
        : 'صحنه‌ی «Game over» ساخته شد. در قانونی که بازیکن می‌بازد، کار «رفتن به صحنه‌ی دیگر» را بگذار و «Game over» را انتخاب کن.';
      return { project: { ...button.project, scenes: [...scenes, over] }, select: null, note };
    },
  },
  {
    id: 'obstacles',
    title: 'مانع‌هایی که پشت‌سرهم می‌آیند',
    about: 'مانع‌ها از سمت راست صفحه می‌آیند و اگر به بازیکن بخورند، بازیکن می‌بازد. مثل بازی‌های دونده.',
    apply: async (p, s, centre) => {
      const scene = getScene(p, s);
      const ground = scene.objects.find((o) => o.tags.includes(GROUND));
      const placed = await useSprite(p, 'cactus');
      const obstacle = makeObject('مانع', { kind: 'image', asset: placed.asset }, 90, 130, { x: 0, y: 0 }, {
        x: 0, y: 0, tags: [DANGER], hitboxInset: 8,
        behaviors: [{ type: 'mover', vx: -420, vy: 0, speedVariable: '', atEdge: 'remove' }],
      });
      // New things appear with their bottom-left corner on the maker's top-left corner: just past the right edge, on the ground.
      const spawner = makeObject('سازنده‌ی مانع', { kind: 'rect', color: '#2e7d32', radius: 8 }, 40, 40, { x: 0, y: 0 }, {
        x: Math.round(centre.x + p.meta.width / 2 + 20),
        y: ground ? ground.y : Math.round(centre.y + p.meta.height * 0.25),
        visible: false,
        behaviors: [{ type: 'spawner', prefabs: [obstacle.id], minInterval: 1.2, maxInterval: 2.4, spreadX: 0, spreadY: 0, everyDistance: 0 }],
      });
      const project = withTouchRule(addObject(addObject(placed.project, s, 'prefabs', obstacle), s, 'objects', spawner), s, PLAYER, DANGER, LOSE);
      const note = playersOf(scene).length === 0 ? 'مانع‌ها آماده‌اند. حالا به یکی از اشیا نقش «بازیکن» بده تا برخورد با مانع یعنی باخت.' : 'سازنده‌ی مانع بیرون از لبه‌ی راست صفحه است و کم‌رنگ دیده می‌شود؛ برای دیدنش دید را کوچک کن.';
      return { project, select: obstacle.id, note };
    },
  },
  {
    id: 'falling',
    title: 'جایزه‌هایی که از بالا می‌افتند',
    about: 'سکه‌ها از بالای صفحه می‌افتند و هر کدام را که بازیکن بگیرد یک امتیاز دارد.',
    apply: async (p, s, centre) => {
      const placed = await useSprite(withVariable(p, 'score'), 'coin');
      const coin = makeObject('سکه', { kind: 'image', asset: placed.asset }, 80, 80, { x: 0, y: 0 }, {
        x: 0, y: 0, tags: [PRIZE], round: true,
        behaviors: [{ type: 'mover', vx: 0, vy: 320, speedVariable: '', atEdge: 'remove' }],
      });
      const spawner = makeObject('سازنده‌ی سکه', { kind: 'rect', color: '#ffb300', radius: 8 }, 40, 40, { x: 0, y: 0 }, {
        x: Math.round(centre.x - 40),
        y: Math.round(centre.y - p.meta.height / 2 - 20),
        visible: false,
        behaviors: [{ type: 'spawner', prefabs: [coin.id], minInterval: 0.8, maxInterval: 1.8, spreadX: Math.round(p.meta.width / 2 - 80), spreadY: 0, everyDistance: 0 }],
      });
      const project = withTouchRule(addObject(addObject(placed.project, s, 'prefabs', coin), s, 'objects', spawner), s, PLAYER, PRIZE, [
        { type: 'setVariable', name: 'score', op: 'add', amount: 1 },
        { type: 'burst', target: 'second', color: '#ffd54a', count: 8 },
        { type: 'destroy', target: 'second' },
        { type: 'playSound', sound: 'coin' },
      ]);
      const note = playersOf(getScene(p, s)).length === 0 ? 'سکه‌ها آماده‌اند. حالا به یکی از اشیا نقش «بازیکن» بده تا بتواند آن‌ها را بگیرد.' : undefined;
      return { project, select: coin.id, note };
    },
  },
  {
    id: 'controls',
    title: 'دکمه‌های چپ، راست و پرش',
    about: 'سه دکمه پایین صفحه. بازیکن‌های این صحنه با آن‌ها راه می‌روند و می‌پرند.',
    apply: async (p, s) => {
      const { width, height } = p.meta;
      const [LEFT, RIGHT, JUMP] = ['دکمه‌ی چپ', 'دکمه‌ی راست', 'دکمه‌ی پرش'];
      const y = height - 110;
      const look = { fixed: true, opacity: 0.85 };
      const a = await picture(p, 'btn-left', LEFT, 140, 140, { x: 100, y }, { ...look, tags: [LEFT] });
      const b = await picture(a.project, 'btn-right', RIGHT, 140, 140, { x: 260, y }, { ...look, tags: [RIGHT] });
      const c = await picture(b.project, 'btn-up', JUMP, 140, 140, { x: width - 100, y }, { ...look, tags: [JUMP] });
      const players = playersOf(getScene(p, s)).map((o) => o.id);
      const wire = (o: GameObject): GameObject => {
        if (!players.includes(o.id)) return o;
        const walker: Behavior = { type: 'walker', speed: 320, control: 'buttons', leftTag: LEFT, rightTag: RIGHT };
        const behaviors = o.behaviors.map((x): Behavior => {
          if (x.type === 'walker') return { ...x, control: 'buttons', leftTag: LEFT, rightTag: RIGHT };
          return x.type === 'jumper' ? { ...x, on: 'button', buttonTag: JUMP } : x;
        });
        // Something that follows the finger is steered another way; it is left as it is.
        const walks = behaviors.some((x) => x.type === 'walker' || x.type === 'followFinger');
        return { ...o, behaviors: walks ? behaviors : [...behaviors, walker] };
      };
      const placed = [a.object, b.object, c.object].reduce((next, o) => addObject(next, s, 'objects', o), c.project);
      const project = updateScene(placed, s, (scene) => ({ ...scene, objects: scene.objects.map(wire), prefabs: scene.prefabs.map(wire) }));
      const note = players.length === 0
        ? 'دکمه‌ها ساخته شدند ولی هنوز بازیکنی نیست. به بازیکن‌ات رفتار «حرکت چپ و راست» بده و کنترلش را «با دکمه» بگذار.'
        : 'دکمه‌ها به بازیکن وصل شدند.';
      return { project, select: a.object.id, note };
    },
  },
  {
    id: 'timer',
    title: 'زمان معکوس',
    about: 'از ۳۰ ثانیه پایین می‌آید، در قابی با نشان ساعت گوشه‌ی صفحه، و وقتی تمام شود صحنه از اول شروع می‌شود.',
    apply: async (p, s) => {
      const project = p.variables.some((v) => v.name === 'time') ? p : { ...p, variables: [...p.variables, { name: 'time', initial: 30, saved: false }] };
      const made = await badge(project, 'clock', 'زمان', '{time}', { x: 120, y: 70 }, { w: 190, h: 80 });
      const text = made.text;
      return {
        project: withRules(
          addAll(made.project, s, made.objects),
          s,
          rule({ type: 'start' }, [{ type: 'setVariable', name: 'time', op: 'set', amount: 30 }]),
          rule({ type: 'every', seconds: 1 }, [{ type: 'setVariable', name: 'time', op: 'subtract', amount: 1 }]),
          rule({ type: 'variable', name: 'time', op: '<=', value: 0 }, [{ type: 'playSound', sound: 'lose' }, { type: 'wait', seconds: 0.4 }, { type: 'restartScene' }]),
        ),
        select: text.id,
      };
    },
  },
  {
    id: 'pause-menu',
    title: 'منوی مکث کامل',
    about: 'دکمه‌ی مکث گوشه‌ی صفحه که روی بازی را تیره می‌کند و یک منو با «ادامه»، «از نو»، روشن و خاموش کردن صدا (که روی گوشی یادش می‌ماند) و (اگر صفحه‌ی مرحله‌ها یا شروع داری) «منو» نشان می‌دهد.',
    apply: async (p, s) => {
      const MENU = 'منوی مکث';
      const { width, height } = p.meta;
      const menuScene = p.scenes.find((x) => x.name === 'Levels') ?? p.scenes.find((x) => x.name === 'Start');
      const hidden = { fixed: true, visible: false, locked: true, tags: [MENU] };
      const pause = await picture(p, 'btn-pause', 'دکمه‌ی مکث', 90, 90, { x: width - 75, y: 75 }, { fixed: true });
      let project = pause.project;
      const dim = makeObject('پرده‌ی تیره', { kind: 'rect', color: '#0b1620' }, width, height, { x: width / 2, y: height / 2 }, { ...hidden, opacity: 0.6 });
      const board = await picture(project, 'panel', 'صفحه‌ی منو', Math.min(520, width - 80), 740, { x: width / 2, y: height / 2 }, hidden);
      project = board.project;
      const panel = board.object;
      const heading = makeObject('نوشته‌ی مکث', { kind: 'text', text: 'Paused', color: '#ffd23f', size: 84, weight: 'bold', outline: '#5a2a00', shadow: true }, 0, 0, { x: width / 2, y: height / 2 - 320 }, hidden);
      const buttons: { name: string; text: string; then: Action[] }[] = [
        { name: 'دکمه‌ی ادامه', text: 'Resume', then: [{ type: 'hide', target: byTag(MENU) }, { type: 'resume' }] },
        { name: 'دکمه‌ی از نو', text: 'Restart', then: [{ type: 'resume' }, { type: 'restartScene' }] },
        ...(menuScene ? [{ name: 'دکمه‌ی منو', text: 'Menu', then: [{ type: 'resume' }, { type: 'goToScene', scene: menuScene.id }] as Action[] }] : []),
      ];
      const objects: GameObject[] = [dim, panel, heading];
      const rules: Rule[] = [rule({ type: 'tapObject', target: byId(pause.object.id) }, [{ type: 'playSound', sound: 'click' }, { type: 'show', target: byTag(MENU) }, { type: 'pause' }])];
      for (const [i, b] of buttons.entries()) {
        const y = height / 2 - 170 + i * 130;
        const made = await picture(project, 'btn-wide', b.name, 340, 110, { x: width / 2, y }, hidden);
        project = made.project;
        objects.push(made.object, label(`نوشته‌ی ${b.name}`, b.text, 46, width / 2, y - 30, { ...hidden }));
        rules.push(rule({ type: 'tapObject', target: byId(made.object.id) }, [{ type: 'playSound', sound: 'click' }, ...b.then]));
      }
      // Sound on and off, remembered on the phone in the saved value "sound" (1 on, 0 off).
      const soundY = height / 2 - 170 + buttons.length * 130;
      const soundButton = await picture(project, 'btn-wide', 'دکمه‌ی صدا', 340, 110, { x: width / 2, y: soundY }, hidden);
      project = soundButton.project;
      const soundLabel = label('نوشته‌ی دکمه‌ی صدا', 'Sound: on', 46, width / 2, soundY - 30, { ...hidden });
      objects.push(soundButton.object, soundLabel);
      if (!project.variables.some((v) => v.name === 'sound')) project = { ...project, variables: [...project.variables, { name: 'sound', initial: 1, saved: true }] };
      const off: Action[] = [{ type: 'setSound', on: false }, { type: 'setVariable', name: 'sound', op: 'set', amount: 0 }, { type: 'setText', target: byId(soundLabel.id), text: 'Sound: off' }];
      const on: Action[] = [{ type: 'setSound', on: true }, { type: 'setVariable', name: 'sound', op: 'set', amount: 1 }, { type: 'setText', target: byId(soundLabel.id), text: 'Sound: on' }, { type: 'playSound', sound: 'click' }];
      rules.push(
        { ...rule({ type: 'tapObject', target: byId(soundButton.object.id) }, off), condition: { name: 'sound', op: '==', value: 1 }, otherwise: on },
        { ...rule({ type: 'start' }, off), condition: { name: 'sound', op: '==', value: 0 } },
      );
      project = withRules(addAll(addObject(project, s, 'objects', pause.object), s, objects), s, ...rules);
      return {
        project,
        select: pause.object.id,
        note: 'همه‌ی تکه‌های منو در گروه «منوی مکث»اند و از اول پنهان. در ویرایشگر کم‌رنگ دیده می‌شوند و قفل‌اند تا جلوی کلیک روی بازی را نگیرند؛ از فهرست سمت راست انتخابشان کن.',
      };
    },
  },
  {
    id: 'levels',
    title: 'صفحه‌ی انتخاب مرحله',
    about: 'یک صحنه‌ی تازه با یک دکمه برای هر مرحله (هر صحنه‌ی دیگر بازی). اول فقط مرحله‌ی ۱ باز است؛ هر مرحله که برده شود، بعدی باز می‌شود و این روی گوشی می‌ماند.',
    apply: async (p) => {
      const WIN = 'برد';
      const { width, height } = p.meta;
      const menus = new Set(['Start', 'Game over', 'Levels']);
      const levels = p.scenes.filter((x) => !menus.has(x.name));
      if (levels.length === 0) return { project: p, select: null, note: 'اول دست‌کم یک صحنه برای مرحله بساز.' };
      const id = newId('scene');
      let project = p.variables.some((v) => v.name === 'unlocked') ? p : { ...p, variables: [...p.variables, { name: 'unlocked', initial: 1, saved: true }] };
      const cols = 3;
      const size = 150;
      const gap = 40;
      const left = (width - (cols * size + (cols - 1) * gap)) / 2 + size / 2;
      const objects: GameObject[] = [title('عنوان مرحله‌ها', 'Levels', 100, width / 2, height * 0.12)];
      const rules: Rule[] = [];
      const face = await useSprite(project, 'btn-level');
      project = face.project;
      levels.forEach((level, i) => {
        const n = i + 1;
        const at = { x: left + (i % cols) * (size + gap), y: height * 0.3 + Math.floor(i / cols) * (size + gap) };
        const button = makeObject(`دکمه‌ی مرحله‌ی ${n}`, { kind: 'image', asset: face.asset }, size, size, at);
        objects.push(button, label(`شماره‌ی مرحله‌ی ${n}`, String(n), 70, at.x, at.y - 52, { fixed: false }));
        // A locked level answers a tap with a shake of "no"; an open one starts.
        rules.push({
          ...rule({ type: 'tapObject', target: byId(button.id) }, [{ type: 'playSound', sound: 'click' }, { type: 'goToScene', scene: level.id }]),
          condition: { name: 'unlocked', op: '>=', value: n },
          otherwise: [{ type: 'playSound', sound: 'hit' }, { type: 'effect', target: 'first', kind: 'pop', seconds: 0.25 }],
        });
        if (n > 1) rules.push({ ...rule({ type: 'start' }, [{ type: 'setOpacity', target: byId(button.id), opacity: 0.35 }]), condition: { name: 'unlocked', op: '<', value: n } });
      });
      const menu: Scene = { id, name: 'Levels', width, height, background: null, music: null, gravity: 2400, sky: 'space', bloom: true, vignette: true, objects, prefabs: [], rules };
      // Each level, once won, opens the next and comes back here.
      const scenes = project.scenes.map((scene) => {
        const n = levels.findIndex((l) => l.id === scene.id) + 1;
        if (n === 0) return scene;
        const won = rule({ type: 'message', name: WIN }, [
          { type: 'setVariable', name: 'unlocked', op: 'max', amount: n + 1 },
          { type: 'playSound', sound: 'win' },
          { type: 'wait', seconds: 1 },
          { type: 'goToScene', scene: id },
        ]);
        return { ...scene, rules: [...scene.rules, won] };
      });
      // A start screen made earlier now leads here; otherwise the game opens on the levels.
      const start = scenes.find((x) => x.id === project.startScene && x.name === 'Start');
      const rewired = scenes.map((x) => (x === start ? { ...x, rules: x.rules.map((r) => ({ ...r, then: r.then.map((a): Action => (a.type === 'goToScene' ? { ...a, scene: id } : a)) })) } : x));
      project = { ...project, scenes: [...rewired, menu], startScene: start ? project.startScene : id };
      return {
        project,
        select: null,
        note: `صحنه‌ی «Levels» با ${levels.length} مرحله ساخته شد. در هر مرحله یک قانون «وقتی پیام «${WIN}» می‌رسد» اضافه شد. حالا در هر مرحله، جایی که بازیکن می‌برد (مثلاً وقتی سکه‌ای نماند)، کار «فرستادن پیام» با نام «${WIN}» را بگذار.`,
      };
    },
  },
  {
    id: 'tower',
    title: 'برج جعبه‌ها',
    about: 'شش جعبه‌ی «فیزیک واقعی» که روی هم چیده شده‌اند و با یک ضربه می‌ریزند. اگر صحنه زمین ندارد، یک زمین هم ساخته می‌شود.',
    apply: async (p, s, centre) => {
      const ground = await withGround(p, s, centre);
      const tower = await crateTower(ground.project, centre.x, ground.top, 3);
      return {
        project: addAll(tower.project, s, tower.crates),
        select: tower.crates[0].id,
        note: 'جعبه‌ها روی «زمین» می‌ایستند. برای ریختنشان یک توپ یا «سنگ تیرکمان» بساز، یا در یک قانون کار «انفجار» را بگذار.',
      };
    },
  },
  {
    id: 'sling-tower',
    title: 'پرتاب سنگ به برج',
    about: 'سنگی که در تیرکمان منتظر است و با کشیدن پرتاب می‌شود، و برجی از جعبه با سه ستاره رویش. هر ستاره‌ای که محکم ضربه بخورد یا زمین بیفتد امتیاز دارد. سنگ بعد از هر پرتاب به تیرکمان برمی‌گردد؛ وقتی ستاره‌ای نماند، صحنه از نو شروع می‌شود.',
    apply: async (p, s, centre) => {
      const W = p.meta.width;
      const TARGET = 'هدف';
      const ground = await withGround(withVariable(p, 'score'), s, centre);
      const towerX = centre.x + W * 0.2;
      // Three columns of two crates, a star on top of each: a star that reaches the ground has been knocked off.
      const crate = await useSprite(ground.project, 'crate');
      let project = crate.project;
      const columns = [-120, 0, 120].map((dx) => towerX + dx);
      const crates = columns.flatMap((x, c) => [0, 1].map((row) =>
        makeObject(`جعبه ${c * 2 + row + 1}`, { kind: 'image', asset: crate.asset }, 90, 90, { x, y: ground.top - 90 * row - 45 }, { tags: [CRATE], behaviors: [physics()] })));
      const tower = { crates };
      const star = await useSprite(project, 'star');
      project = star.project;
      const stars = columns.map((x, i) => makeObject(`ستاره ${i + 1}`, { kind: 'image', asset: star.asset }, 70, 70, { x, y: ground.top - 180 - 35 }, { tags: [TARGET], round: true, behaviors: [physics({ weight: 0.5 })] }));
      const stone = await useSprite(project, 'rock');
      const fork = await useSprite(stone.project, 'slingshot');
      project = fork.project;
      // The stone waits in the fork of a wooden slingshot (the slingshot is only for looks), and comes back there after each throw.
      const from = { x: Math.round(centre.x - W * 0.32), y: ground.top - 192 };
      const post = makeObject('تیرکمان', { kind: 'image', asset: fork.asset }, 150, 240, { x: from.x, y: ground.top - 120 }, { locked: true });
      const thrown = makeObject('سنگ', { kind: 'image', asset: stone.asset }, 70, 70, from, {
        tags: [THROWN], round: true, behaviors: [physics({ drag: 'sling', power: 8, reload: true, weight: 2, friction: 0.8 })],
      });
      const score: Action[] = [{ type: 'burst', target: 'first', color: '#ffd54a', count: 14 }, { type: 'destroy', target: 'first' }, { type: 'setVariable', name: 'score', op: 'add', amount: 1 }, { type: 'playSound', sound: 'pop' }];
      project = withRules(
        addAll(project, s, [...tower.crates, ...stars, post, thrown]),
        s,
        rule({ type: 'hit', a: byTag(TARGET), b: byTag(THROWN), speed: 150 }, score),
        rule({ type: 'hit', a: byTag(TARGET), b: byTag(CRATE), speed: 350 }, score),
        rule({ type: 'touch', a: byTag(TARGET), b: byTag(GROUND) }, score),
        rule({ type: 'noneLeft', target: byTag(TARGET) }, [{ type: 'playSound', sound: 'win' }, { type: 'wait', seconds: 1.5 }, { type: 'resetVariables' }, { type: 'restartScene' }]),
        rule({ type: 'thrown', target: byTag(THROWN) }, [{ type: 'playSound', sound: 'laser' }]),
      );
      return {
        project,
        select: thrown.id,
        note: 'در پیش‌نمایش، سنگ را با موس عقب بکش و رها کن؛ نقطه‌های سفید نشان می‌دهند کجا می‌رود. هر ستاره‌ای که محکم ضربه بخورد یا به زمین برسد امتیاز دارد. سنگ خودش به تیرکمان برمی‌گردد. برای دیدن امتیاز، قطعه‌ی «امتیاز بالای صفحه» را اضافه کن.',
      };
    },
  },
  {
    id: 'pendulum',
    title: 'آونگ',
    about: 'یک وزنه که با طناب از یک میخ آویزان است و تاب می‌خورد، و هرچه سر راهش باشد را می‌زند.',
    apply: async (p, s, centre) => {
      const PIN = 'میخ';
      const peg = await useSprite(p, 'peg');
      const ball = await useSprite(peg.project, 'ball');
      const pinAt = { x: centre.x, y: Math.round(centre.y - p.meta.height * 0.3) };
      const pin = makeObject('میخ', { kind: 'image', asset: peg.asset }, 34, 34, pinAt, { tags: [PIN], round: true, behaviors: [physics({ kind: 'still' })] });
      // Started out to one side, it swings from the first moment.
      const weight = makeObject('وزنه', { kind: 'image', asset: ball.asset }, 90, 90, { x: pinAt.x + 240, y: pinAt.y + 140 }, {
        tags: ['وزنه'], round: true,
        behaviors: [physics({ solidTag: GROUND, weight: 4, bounce: 0.2 }), { type: 'joint', kind: 'rope', targetTag: PIN, at: 'self', motor: 0 }],
      });
      return { project: addAll(ball.project, s, [pin, weight]), select: weight.id, note: 'طول طناب همان فاصله‌ی وزنه تا میخ در ویرایشگر است. وزنه را جابه‌جا کن تا طناب بلندتر یا کوتاه‌تر شود.' };
    },
  },
  {
    id: 'car',
    title: 'ماشین قابل رانندگی',
    about: 'یک ماشین که دو چرخش با کمک‌فنر به بدنه وصل‌اند. بازیکن با لمس نیمه‌ی راست صفحه (یا کلید راست) گاز می‌دهد و با نیمه‌ی چپ عقب می‌رود؛ روی تپه و دست‌انداز بالا و پایین می‌شود و ممکن است چپ کند. دوربین دنبالش می‌آید.',
    apply: async (p, s, centre) => {
      const CAR = 'ماشین';
      const ground = await withGround(p, s, centre);
      const y = ground.top - 120;
      const shell = await useSprite(ground.project, 'car-body');
      const tire = await useSprite(shell.project, 'tire');
      const body = makeObject('بدنه‌ی ماشین', { kind: 'image', asset: shell.asset }, 230, 86, { x: centre.x, y }, {
        tags: [CAR], shadow: true, behaviors: [physics({ friction: 0.4 }), { type: 'camera', lock: 'free', smooth: 0.3 }],
      });
      // The wheels sit in the arches of the body.
      const wheel = (name: string, dx: number) => makeObject(name, { kind: 'image', asset: tire.asset }, 70, 70, { x: centre.x + dx, y: y + 35 }, {
        tags: ['چرخ'], round: true,
        behaviors: [physics({ friction: 1, bounce: 0.05 }), { type: 'joint', kind: 'wheel', targetTag: CAR, at: 'self', motor: 600, drive: 'player' }],
      });
      return {
        project: addAll(tire.project, s, [body, wheel('چرخ عقب', -58), wheel('چرخ جلو', 64)]),
        select: body.id,
        note: 'نیمه‌ی راست صفحه گاز است و نیمه‌ی چپ دنده‌عقب. قدرت موتور در رفتار «اتصال» هر چرخ است؛ اگر «همیشه روشن» کنی، خودش می‌رود. برای جاده‌ی طولانی، دنیای صحنه را پهن‌تر کن.',
      };
    },
  },
  {
    id: 'bridge',
    title: 'پل طنابی',
    about: 'چند تخته که با لولا پشت‌سرهم به هم و به دو میخ در دو طرف وصل‌اند؛ زیر وزن خم می‌شود و تاب می‌خورد. یک توپ هم رویش می‌افتد.',
    apply: async (p, s, centre) => {
      const ANCHOR = 'میخ پل';
      const count = 8;
      const plank = { w: 62, h: 18 };
      const left = Math.round(centre.x - (count * plank.w) / 2);
      const y = Math.round(centre.y);
      const pegLook = await useSprite(p, 'peg');
      const wood = await useSprite(pegLook.project, 'plank');
      const peg = (name: string, x: number) => makeObject(name, { kind: 'image', asset: pegLook.asset }, 34, 34, { x, y }, { tags: [ANCHOR], round: true, behaviors: [physics({ kind: 'still' })] });
      const planks = Array.from({ length: count }, (_, i) =>
        makeObject(`تخته ${i + 1}`, { kind: 'image', asset: wood.asset }, plank.w, plank.h, { x: left + plank.w * (i + 0.5), y }, {
          tags: [`تخته ${i + 1}`],
          // Each plank hangs from the one before it (the first from the left peg), pinned where they meet.
          behaviors: [physics({ friction: 0.9 }), { type: 'joint', kind: 'hinge', targetTag: i === 0 ? ANCHOR : `تخته ${i}`, at: 'between', motor: 0 }],
        }));
      const leftPeg = peg('میخ چپ', left - 15);
      // The right peg holds the last plank.
      const rightPeg = { ...peg('میخ راست', left + count * plank.w + 15), behaviors: [physics({ kind: 'still' }), { type: 'joint' as const, kind: 'hinge' as const, targetTag: `تخته ${count}`, at: 'between' as const, motor: 0 }] };
      const ball = await useSprite(wood.project, 'ball');
      const dropped = makeObject('توپ', { kind: 'image', asset: ball.asset }, 70, 70, { x: centre.x, y: y - 300 }, { round: true, behaviors: [physics({ weight: 3, bounce: 0.3, solidTag: '' })] });
      return {
        project: addAll(ball.project, s, [leftPeg, rightPeg, ...planks, dropped]),
        select: planks[0].id,
        note: 'هر تخته گروه خودش را دارد تا بداند به کدام تخته وصل است. برای پل بلندتر، آخرین تخته را کپی کن، در گروه تازه بگذار و «اتصال» میخ راست را به آن وصل کن.',
      };
    },
  },
  {
    id: 'conveyor',
    title: 'تسمه‌ی نقاله',
    about: 'یک تسمه که جعبه‌های رویش را به یک طرف می‌برد و از لبه پایین می‌اندازد. سرعتش در «فیزیک واقعی»ِ تسمه است.',
    apply: async (p, s, centre) => {
      const ground = await withGround(p, s, centre);
      const band = await useSprite(ground.project, 'belt');
      const belt = makeObject('تسمه', { kind: 'image', asset: band.asset }, 420, 36, { x: centre.x - 60, y: centre.y }, { behaviors: [physics({ kind: 'still', surfaceSpeed: 180 })] });
      const crate = await useSprite(band.project, 'crate');
      const crates = [-150, -60].map((dx, i) => makeObject(`جعبه ${i + 1}`, { kind: 'image', asset: crate.asset }, 70, 70, { x: centre.x - 60 + dx, y: centre.y - 50 }, { tags: [CRATE], behaviors: [physics()] }));
      return { project: addAll(crate.project, s, [belt, ...crates]), select: belt.id, note: 'سرعت تسمه را در «فیزیک واقعی» ← «تسمه‌ی نقاله» عوض کن؛ منفی یعنی به چپ.' };
    },
  },
  {
    id: 'pool',
    title: 'استخر آب',
    about: 'آبی که چیزهای سبک رویش شناور می‌مانند و سنگین‌ها ته آن می‌روند: یک جعبه‌ی سبک، یک جعبه‌ی سنگین و یک توپ که از بالا در آن می‌افتند.',
    apply: async (p, s, centre) => {
      const ground = await withGround(p, s, centre);
      const width = Math.min(560, p.meta.width - 80);
      const depth = 320;
      const top = ground.top - depth;
      const stone = await useSprite(ground.project, 'stone');
      // Stone blocks stacked up into a wall.
      const wall = (name: string, x: number) => makeObject(name, { kind: 'image', asset: stone.asset, repeat: 'y' }, 30, depth + 40, { x, y: ground.top - (depth + 40) / 2 }, { tags: [GROUND] });
      const crate = await useSprite(stone.project, 'crate');
      const pool = await useSprite(crate.project, 'water');
      const ball = await useSprite(pool.project, 'ball');
      const light = makeObject('جعبه‌ی سبک', { kind: 'image', asset: crate.asset }, 80, 80, { x: centre.x - 150, y: top - 160 }, { behaviors: [physics({ weight: 0.4 })] });
      const heavy = makeObject('جعبه‌ی سنگین', { kind: 'image', asset: crate.asset }, 80, 80, { x: centre.x, y: top - 260 }, { behaviors: [physics({ weight: 4 })] });
      const floater = makeObject('توپ', { kind: 'image', asset: ball.asset }, 70, 70, { x: centre.x + 150, y: top - 360 }, { round: true, behaviors: [physics({ weight: 0.5, bounce: 0.3 })] });
      // Drawn last, over what is in it, and see-through.
      const water = makeObject('آب', { kind: 'image', asset: pool.asset }, width, depth, { x: centre.x, y: top + depth / 2 }, { opacity: 0.7, locked: true, behaviors: [{ type: 'field', kind: 'water', direction: 0, strength: 1 }] });
      return {
        project: addAll(ball.project, s, [wall('دیواره‌ی چپ', centre.x - width / 2 - 15), wall('دیواره‌ی راست', centre.x + width / 2 + 15), light, heavy, floater, water]),
        select: heavy.id,
        note: 'شناور ماندن به «سنگینی» در «فیزیک واقعی» بستگی دارد: کمتر از حدود ۱٫۵ شناور می‌ماند، بیشتر غرق می‌شود. آب قفل است تا جلوی کلیک روی چیزهای داخلش را نگیرد.',
      };
    },
  },
  {
    id: 'cut-rope',
    title: 'طنابی که بریده می‌شود',
    about: 'یک آب‌نبات که با طناب آویزان است و تاب می‌خورد. با لمس صفحه طناب بریده می‌شود؛ اگر آب‌نبات در سبد بیفتد، امتیاز دارد. لحظه‌ی بریدن مهم است.',
    apply: async (p, s, centre) => {
      const PIN = 'میخ طناب';
      const GOAL = 'سبد';
      const ground = await withGround(withVariable(p, 'score'), s, centre);
      const pinAt = { x: centre.x, y: Math.round(centre.y - p.meta.height * 0.32) };
      const peg = await useSprite(ground.project, 'peg');
      const sweet = await useSprite(peg.project, 'candy');
      const hamper = await useSprite(sweet.project, 'basket');
      const pin = makeObject('میخ طناب', { kind: 'image', asset: peg.asset }, 30, 30, pinAt, { tags: [PIN], round: true, behaviors: [physics({ kind: 'still' })] });
      const candy = makeObject('آب‌نبات', { kind: 'image', asset: sweet.asset }, 80, 64, { x: pinAt.x - 260, y: pinAt.y + 180 }, {
        tags: ['آب‌نبات'], round: true, glow: '#ff8cc6', behaviors: [physics({ weight: 1, bounce: 0.2 }), { type: 'joint', kind: 'rope', targetTag: PIN, at: 'self', motor: 0 }],
      });
      const basket = makeObject('سبد', { kind: 'image', asset: hamper.asset }, 160, 90, { x: centre.x + 190, y: ground.top - 45 }, { tags: [GOAL] });
      const project = withRules(
        addAll(hamper.project, s, [pin, candy, basket]),
        s,
        rule({ type: 'tap' }, [{ type: 'cut', target: byId(candy.id) }]),
        rule({ type: 'touch', a: byTag('آب‌نبات'), b: byTag(GOAL) }, [{ type: 'setVariable', name: 'score', op: 'add', amount: 1 }, { type: 'burst', target: 'second', color: '#ffd54a', count: 16 }, { type: 'playSound', sound: 'win' }, { type: 'wait', seconds: 1.2 }, { type: 'restartScene' }]),
        rule({ type: 'touch', a: byTag('آب‌نبات'), b: byTag(GROUND) }, [{ type: 'playSound', sound: 'lose' }, { type: 'wait', seconds: 0.8 }, { type: 'restartScene' }]),
      );
      return { project, select: candy.id, note: 'در پیش‌نمایش، وقتی آب‌نبات بالای سبد است، روی صفحه بزن. جای سبد و طول طناب را عوض کن تا مرحله‌ی سخت‌تر بسازی.' };
    },
  },
  {
    id: 'key-door',
    title: 'کلید و در قفل',
    about: 'یک کلید که بازیکن برمی‌دارد و به کوله‌پشتی می‌رود، و دری که فقط با کلید باز می‌شود؛ بدون کلید، در می‌لرزد و راه نمی‌دهد. اگر صحنه کوله‌پشتی ندارد، یکی هم گذاشته می‌شود.',
    apply: async (p, s, centre) => {
      const KEY = 'کلید';
      const DOOR = 'در قفل';
      const { width } = p.meta;
      const ground = await withGround(p, s, centre);
      const keyPicture = await useSprite(ground.project, 'key');
      const doorPicture = await useSprite(keyPicture.project, 'door');
      let project = doorPicture.project;
      // The thing the player carries: the game's key if it already has one, otherwise a new one.
      let item = project.variables.find((v) => v.item?.asset === keyPicture.asset)?.name;
      if (!item) {
        item = 'Key';
        for (let n = 2; project.variables.some((v) => v.name === item); n++) item = `Key${n}`;
        project = { ...project, variables: [...project.variables, { name: item, initial: 0, saved: false, item: { asset: keyPicture.asset } }] };
      }
      const key = makeObject('کلید', { kind: 'image', asset: keyPicture.asset }, 100, 46, { x: centre.x - 170, y: ground.top - 130 }, {
        tags: [KEY], glow: '#ffd23f', behaviors: [{ type: 'pulse', amount: 0.1, seconds: 1 }],
      });
      // The door stands on the ground and is part of it, so a player cannot walk through it.
      const door = makeObject('در قفل', { kind: 'image', asset: doorPicture.asset }, 120, 180, { x: centre.x + 190, y: ground.top - 90 }, { tags: [DOOR, GROUND] });
      const objects = [key, door];
      const scene = getScene(project, s);
      if (!scene.objects.some((o) => o.visual.kind === 'bag')) {
        objects.push(makeObject('کوله‌پشتی', { kind: 'bag', slots: 5 }, Math.min(450, width - 40), 90, { x: width / 2, y: 250 }, { fixed: true }));
      }
      const open: Rule = {
        ...rule({ type: 'near', a: byTag(PLAYER), b: byTag(DOOR), distance: 150 }, [
          { type: 'take', item, amount: 1 },
          { type: 'playSound', sound: 'powerup' },
          { type: 'burst', target: 'second', color: '#ffd23f', count: 20 },
          { type: 'effect', target: 'second', kind: 'shrink', seconds: 0.4 },
        ]),
        condition: { name: item, op: '>=', value: 1 },
        otherwise: [{ type: 'flash', target: 'second', color: '#ff3b47', seconds: 0.3 }, { type: 'playSound', sound: 'hit' }, { type: 'shake', strength: 6 }],
      };
      project = withRules(
        addAll(project, s, objects),
        s,
        rule({ type: 'touch', a: byTag(PLAYER), b: byTag(KEY) }, [
          { type: 'give', item, amount: 1, from: 'second' },
          { type: 'destroy', target: 'second' },
          { type: 'playSound', sound: 'coin' },
        ]),
        open,
      );
      const note = playersOf(scene).length === 0
        ? `کلید، در و کوله‌پشتی آماده‌اند. حالا به یکی از اشیا نقش «بازیکن» بده. وسیله‌ی «${item}» در برگه‌ی «بازی»، بخش «کوله‌پشتی» است.`
        : `بازیکن کلید را برمی‌دارد و عکسش به کوله‌پشتی پرواز می‌کند؛ در فقط با کلید باز می‌شود. وسیله‌ی «${item}» در برگه‌ی «بازی»، بخش «کوله‌پشتی» است.`;
      return { project, select: key.id, note };
    },
  },
  {
    id: 'player-laser',
    title: 'شلیک سفینه و هدف',
    about: 'بازیکن خودکار رو به بالا تیر می‌زند. با زدن سیارک، یک امتیاز می‌گیرد. از هدف برای چیدن مرحله کپی بگیر.',
    apply: async (p, s, centre) => {
      const bolt = makeObject('تیر بازیکن', { kind: 'ellipse', color: '#6cf2ff', shade: true }, 12, 44, { x: 0, y: 0 }, {
        behaviors: [{ type: 'launch', vx: 0, vy: -850 }, { type: 'lifetime', seconds: 2 }],
      });
      const target = await picture(p, 'asteroid', 'هدف فضایی', 82, 82, { x: centre.x, y: Math.max(50, centre.y - 280) }, { tags: [DANGER] });
      const project = addObject(addObject(withVariable(target.project, 'score'), s, 'prefabs', bolt), s, 'objects', target.object);
      return { project: withRules(project, s,
        rule({ type: 'eachEvery', target: byTag(PLAYER), seconds: 0.45 }, [{ type: 'spawn', prefab: bolt.id, at: 'first' }]),
        rule({ type: 'touch', a: byId(bolt.id), b: byTag(DANGER) }, [
          { type: 'burst', target: 'second', color: '#ffbf50', count: 12 }, { type: 'destroy', target: 'second' },
          { type: 'destroy', target: 'first' }, { type: 'setVariable', name: 'score', op: 'add', amount: 1 },
          { type: 'playSound', sound: 'hit', volume: 65 },
        ])), select: target.object.id };
    },
  },
  {
    id: 'sword',
    title: 'زدن با شمشیر',
    about: 'یک دکمه‌ی شمشیر گوشه‌ی صفحه. با هر لمس، برق ضربه‌ای جلوی بازیکن (به طرفی که نگاه می‌کند) می‌زند؛ دشمن‌هایی که «جان» دارند با هر ضربه جان از دست می‌دهند و عقب پرت می‌شوند، و وقتی جانشان تمام شود منفجر می‌شوند.',
    apply: async (p, s) => {
      const HIT = 'ضربه';
      const { width, height } = p.meta;
      const slashLook = await useSprite(p, 'slash');
      const slash = makeObject('ضربه‌ی شمشیر', { kind: 'image', asset: slashLook.asset }, 110, 110, { x: 0, y: 0 }, {
        tags: [HIT], glow: '#7fe8ff', behaviors: [{ type: 'lifetime', seconds: 0.25 }],
      });
      const button = await picture(slashLook.project, 'btn-sword', 'دکمه‌ی شمشیر', 130, 130, { x: width - 100, y: height - 280 }, { fixed: true, opacity: 0.9, tags: ['دکمه‌ی شمشیر'] });
      const project = withRules(
        addObject(addObject(button.project, s, 'prefabs', slash), s, 'objects', button.object),
        s,
        rule({ type: 'tapObject', target: byId(button.object.id) }, [{ type: 'spawn', prefab: slash.id, at: byTag(PLAYER), ahead: true }, { type: 'playSound', sound: 'laser' }]),
        rule({ type: 'touch', a: byTag(HIT), b: byTag(DANGER) }, [
          { type: 'damage', target: 'second', amount: 1, push: 500 },
          { type: 'flash', target: 'second', color: '#ffffff', seconds: 0.15 },
          { type: 'playSound', sound: 'hit' },
        ]),
        rule({ type: 'dead', target: byTag(DANGER) }, [{ type: 'burst', target: 'first', color: '#ff7a1a', count: 24 }, { type: 'playSound', sound: 'boom' }, { type: 'destroy', target: 'first' }]),
      );
      const scene = getScene(p, s);
      const note = playersOf(scene).length === 0
        ? 'دکمه‌ی شمشیر آماده است. حالا به یکی از اشیا نقش «بازیکن» بده.'
        : 'فقط دشمن‌هایی که «جان» دارند (برگه‌ی «شیء»، بخش «جان») زخمی می‌شوند؛ نقش‌های «دشمن نگهبان»، «دشمن تیرانداز» و «غول آخر» از اول جان دارند. خار و چیزهای بی‌جان آسیب نمی‌بینند.';
      return { project, select: button.object.id, note };
    },
  },
  {
    id: 'checkpoints',
    title: 'ایست بازرسی',
    about: 'دو پرچم در طول مرحله. بازیکن به هر پرچم که برسد، آن‌جا ایست بازرسی‌اش می‌شود؛ وقتی به خطر بخورد، به‌جای شروع دوباره‌ی کل مرحله، به آخرین پرچم برمی‌گردد.',
    apply: async (p, s, centre) => {
      const FLAG = 'ایست بازرسی';
      const ground = await withGround(p, s, centre);
      const flag = await useSprite(ground.project, 'flag');
      const flags = [-120, 220].map((dx, i) => makeObject(`ایست بازرسی ${i + 1}`, { kind: 'image', asset: flag.asset }, 70, 100, { x: centre.x + dx, y: ground.top - 50 }, { tags: [FLAG] }));
      const project = withRules(
        addAll(flag.project, s, flags),
        s,
        rule({ type: 'touch', a: byTag(PLAYER), b: byTag(FLAG) }, [
          { type: 'checkpoint', target: 'first' },
          { type: 'effect', target: 'second', kind: 'pop', seconds: 0.35 },
          { type: 'burst', target: 'second', color: '#ffd23f', count: 12 },
          { type: 'playSound', sound: 'powerup' },
        ]),
        rule({ type: 'touch', a: byTag(PLAYER), b: byTag(DANGER) }, [
          { type: 'flash', target: 'first', color: '#ff3b47', seconds: 0.3 },
          { type: 'playSound', sound: 'hit' },
          { type: 'respawn', target: 'first' },
        ]),
      );
      return {
        project,
        select: flags[0].id,
        note: 'پرچم‌ها را در مرحله جابه‌جا کن یا کپی کن؛ هر چیزی در گروه «ایست بازرسی» پرچم حساب می‌شود. اگر قانون دیگری داری که با خوردن به خطر صحنه را از نو شروع می‌کند، حذفش کن. با قطعه‌ی «جان با قلب‌ها» هم کار می‌کند.',
      };
    },
  },
  {
    id: 'hearts',
    title: 'جان با قلب‌ها',
    about: 'سه قلب گوشه‌ی صفحه. هر بار که بازیکن به خطر بخورد، یک قلب خالی می‌شود و بازیکن قرمز می‌شود؛ وقتی قلبی نماند، صحنه از نو شروع می‌شود. قلب‌ها با زیاد شدن lives دوباره پر می‌شوند.',
    apply: async (p, s) => {
      const MAX = 3;
      let project = p.variables.some((v) => v.name === 'lives') ? p : { ...p, variables: [...p.variables, { name: 'lives', initial: MAX, saved: false }] };
      const heart = await useSprite(project, 'heart');
      project = heart.project;
      const hearts = Array.from({ length: MAX }, (_, i) =>
        makeObject(`قلب ${i + 1}`, { kind: 'image', asset: heart.asset }, 62, 56, { x: 50 + i * 70, y: 160 }, { fixed: true }));
      const rules: Rule[] = hearts.flatMap((h, i) => [
        // A heart beyond the lives left is shown empty (faint), and fills again with a pop.
        rule({ type: 'variable', name: 'lives', op: '<', value: i + 1 }, [{ type: 'setOpacity', target: byId(h.id), opacity: 0.25 }, { type: 'effect', target: byId(h.id), kind: 'pop', seconds: 0.3 }]),
        rule({ type: 'variable', name: 'lives', op: '>=', value: i + 1 }, [{ type: 'setOpacity', target: byId(h.id), opacity: 1 }, { type: 'effect', target: byId(h.id), kind: 'pop', seconds: 0.3 }]),
      ]);
      rules.push(
        rule({ type: 'touch', a: byTag(PLAYER), b: byTag(DANGER) }, [
          { type: 'setVariable', name: 'lives', op: 'subtract', amount: 1 },
          { type: 'flash', target: 'first', color: '#ff3b47', seconds: 0.4 },
          { type: 'playSound', sound: 'hit' },
          { type: 'shake', strength: 8 },
        ]),
        rule({ type: 'variable', name: 'lives', op: '<=', value: 0 }, [{ type: 'playSound', sound: 'lose' }, { type: 'wait', seconds: 0.8 }, { type: 'resetVariables' }, { type: 'restartScene' }]),
      );
      project = withRules(addAll(project, s, hearts), s, ...rules);
      return {
        project,
        select: hearts[0].id,
        note: 'جان در مقدار lives است. اگر قانون دیگری داری که با خوردن به خطر صحنه را از نو شروع می‌کند، آن را حذف کن تا اول قلب‌ها کم شوند. برای قلب اضافه، در یک قانون lives را یکی زیاد کن.',
      };
    },
  },
  {
    id: 'dialogue',
    title: 'جعبه‌ی گفت‌وگو',
    about: 'یک جعبه‌ی گفت‌وگو پایین صفحه با عکس گوینده؛ با هر لمس جعبه، جمله‌ی بعدی می‌آید و بعد از آخری جعبه بسته می‌شود. جمله‌ها را در قانون‌ها عوض کن.',
    apply: async (p, s) => {
      const TALK = 'گفت‌وگو';
      const { width, height } = p.meta;
      const lines = ['Hello, traveler!', 'A key is hidden nearby.', 'Good luck, hero!'];
      const project0 = p.variables.some((v) => v.name === 'talk') ? p : { ...p, variables: [...p.variables, { name: 'talk', initial: 1, saved: false }] };
      const box = await picture(project0, 'panel', 'جعبه‌ی گفت‌وگو', width - 60, 250, { x: width / 2, y: height - 170 }, { fixed: true, tags: [TALK] });
      const face = await picture(box.project, 'hero', 'گوینده', 120, 132, { x: 110, y: height - 182 }, { fixed: true, tags: [TALK] });
      const text = makeObject('جمله', { kind: 'text', text: lines[0], color: '#ffffff', size: 40, weight: 'bold', align: 'left', outline: INK, shadow: true }, 0, 0, { x: 190, y: height - 222 }, { fixed: true, tags: [TALK] });
      const more = makeObject('ادامه', { kind: 'text', text: 'tap ▼', color: '#ffd23f', size: 30, weight: 'bold', align: 'right', shadow: true }, 0, 0, { x: width - 70, y: height - 110 }, { fixed: true, tags: [TALK], behaviors: [{ type: 'pulse', amount: 0.12, seconds: 0.8 }] });
      // Newest step first, so one tap moves the talk on by one step only.
      const step = (n: number, then: Action[]): Rule => ({
        ...rule({ type: 'tapObject', target: byId(box.object.id) }, [{ type: 'playSound', sound: 'click' }, ...then]),
        condition: { name: 'talk', op: '==', value: n },
      });
      const rules: Rule[] = [
        rule({ type: 'start' }, [{ type: 'setVariable', name: 'talk', op: 'set', amount: 1 }]),
        step(lines.length, [{ type: 'hide', target: byTag(TALK) }, { type: 'setVariable', name: 'talk', op: 'set', amount: lines.length + 1 }]),
      ];
      // At step k the box shows line k; a tap shows line k + 1.
      for (let k = lines.length - 1; k >= 1; k--) {
        rules.push(step(k, [{ type: 'setText', target: byId(text.id), text: lines[k] }, { type: 'setVariable', name: 'talk', op: 'set', amount: k + 1 }]));
      }
      const project = withRules(addAll(face.project, s, [box.object, face.object, text, more]), s, ...rules);
      return {
        project,
        select: text.id,
        note: 'جمله‌ی اول در خود متن است و جمله‌های بعدی در قانون‌های «وقتی روی جعبه‌ی گفت‌وگو زده می‌شود» (کار «عوض کردن متن»). عکس گوینده را مثل هر عکس دیگری عوض کن. جمله‌ها کوتاه باشند تا در جعبه جا شوند.',
      };
    },
  },
  {
    id: 'shop',
    title: 'فروشگاه',
    about: 'یک دکمه‌ی فروشگاه گوشه‌ی صفحه که فروشگاهی باز می‌کند: قلب به ۵ سکه و سپر به ۱۰ سکه. با سکه‌ی کافی، وسیله به کوله‌پشتی پرواز می‌کند؛ وگرنه دکمه قرمز می‌شود.',
    apply: async (p, s) => {
      const SHOP = 'فروشگاه';
      const { width, height } = p.meta;
      let project = withVariable(p, 'score');
      if (!project.variables.some((v) => v.name === 'shopOpen')) project = { ...project, variables: [...project.variables, { name: 'shopOpen', initial: 0, saved: false }] };
      const hidden = { fixed: true, visible: false, locked: true, tags: [SHOP] };
      const opener = await picture(project, 'coin', 'دکمه‌ی فروشگاه', 90, 90, { x: width - 75, y: 180 }, { fixed: true, behaviors: [{ type: 'pulse', amount: 0.06, seconds: 1.2 }] });
      const panel = await picture(opener.project, 'panel', 'صفحه‌ی فروشگاه', Math.min(560, width - 60), 520, { x: width / 2, y: height / 2 }, hidden);
      project = panel.project;
      const objects: GameObject[] = [opener.object, panel.object, makeObject('عنوان فروشگاه', { kind: 'text', text: 'Shop', color: '#ffd23f', size: 80, weight: 'bold', outline: '#5a2a00', shadow: true }, 0, 0, { x: width / 2, y: height / 2 - 235 }, hidden)];
      const rules: Rule[] = [{
        ...rule({ type: 'tapObject', target: byId(opener.object.id) }, [{ type: 'playSound', sound: 'click' }, { type: 'show', target: byTag(SHOP) }, { type: 'setVariable', name: 'shopOpen', op: 'set', amount: 1 }]),
        condition: { name: 'shopOpen', op: '==', value: 0 },
        otherwise: [{ type: 'playSound', sound: 'click' }, { type: 'hide', target: byTag(SHOP) }, { type: 'setVariable', name: 'shopOpen', op: 'set', amount: 0 }],
      }];
      const offers = [{ sprite: 'heart', base: 'Heart', price: 5 }, { sprite: 'shield', base: 'Shield', price: 10 }];
      for (const [i, offer] of offers.entries()) {
        const y = height / 2 - 80 + i * 170;
        const look = await useSprite(project, offer.sprite);
        const made = withItem(look.project, look.asset, offer.base);
        const icon = makeObject(`${offer.base} در فروشگاه`, { kind: 'image', asset: look.asset }, 100, 100, { x: width / 2 - 170, y }, hidden);
        const buy = await picture(made.project, 'btn-wide', `خرید ${offer.base}`, 230, 80, { x: width / 2 + 110, y }, hidden);
        const coin = await picture(buy.project, 'coin', `سکه‌ی ${offer.base}`, 46, 46, { x: width / 2 + 60, y: y - 4 }, hidden);
        project = coin.project;
        objects.push(icon, buy.object, coin.object, label(`قیمت ${offer.base}`, String(offer.price), 44, width / 2 + 125, y - 30, hidden));
        rules.push({
          ...rule({ type: 'tapObject', target: byId(buy.object.id) }, [
            { type: 'setVariable', name: 'score', op: 'subtract', amount: offer.price },
            { type: 'give', item: made.item, amount: 1, from: { by: 'id', id: icon.id } },
            { type: 'playSound', sound: 'coin' },
          ]),
          condition: { name: 'score', op: '>=', value: offer.price },
          otherwise: [{ type: 'flash', target: 'first', color: '#ff3b47', seconds: 0.3 }, { type: 'playSound', sound: 'hit' }],
        });
      }
      objects.push(...bagIfNone(project, s));
      project = withRules(addAll(project, s, objects), s, ...rules);
      return {
        project,
        select: opener.object.id,
        note: 'قیمت‌ها با مقدار score پرداخت می‌شوند؛ با قطعه‌ی «جایزه‌هایی که از بالا می‌افتند» یا هر قانونی که score را زیاد کند، سکه جمع کن. قیمت هر وسیله در شرط قانون خریدش است. وسیله‌ها در برگه‌ی «بازی»، بخش «کوله‌پشتی» هستند.',
      };
    },
  },
];

// Kept in one place so the parts and the roles agree on what a group is called.
export const GROUP_NAMES = { PLAYER, GROUND, PRIZE, DANGER };
export const tagRef = byTag;
