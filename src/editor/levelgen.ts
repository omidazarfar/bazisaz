import type { Action, Behavior, GameObject, GameProject, Rule, Scene, Sky, TileStyle, Weather } from '../format/types';
import { EMPTY_TILE, ruleActions } from '../format/types';
import { DANGER, PLAYER, PRIZE } from './presets';
import { describeChange, findElements, placesEnemies, remix, REMIX_SAID, remixKind, type RemixKind } from './levelremix';
import { duplicateScene, getScene, newId } from './state';

/**
 * Making the next levels of a game from the one that is there, without any AI:
 * copies of the level, each a little harder by the chosen curve. What works
 * for every game: enemies faster and more of them, prizes in new places,
 * fewer moves or shots, a new look. What a kind of game can also have: a new
 * layout (rooftops and gaps, pipes, a wall of bricks). The levels lead into
 * each other: where the level led on to (its win), the first new one comes
 * instead, and the last one goes on to that win.
 */

export interface LevelOptions {
  count: number;
  curve: 'gentle' | 'normal' | 'steep';
  faster: boolean;
  moreEnemies: boolean;
  movePrizes: boolean;
  newLayout: boolean;
  fewerTries: boolean;
  newLook: boolean;
  seed: number;
}

export const DEFAULT_LEVEL_OPTIONS: LevelOptions = { count: 5, curve: 'normal', faster: true, moreEnemies: true, movePrizes: true, newLayout: true, fewerTries: true, newLook: true, seed: 1 };

/**
 * The kinds of game whose layout can be made afresh. Three are known by their
 * parts' names; the rest are found from what the level's rules make of its
 * objects (see levelremix.ts), so a game made from scratch can have one too.
 */
export type LayoutKind = 'runner' | 'hopper' | 'bricks' | RemixKind | null;

export function layoutKind(scene: Scene): LayoutKind {
  const names = new Set(scene.objects.map((o) => o.name));
  if (names.has('دونده') && scene.objects.some((o) => o.name.startsWith('بام'))) return 'runner';
  if (names.has('پرنده') && scene.objects.some((o) => o.name.startsWith('دروازه'))) return 'hopper';
  if (scene.objects.some((o) => o.name.startsWith('آجر ')) && names.has('راکت')) return 'bricks';
  return remixKind(scene, findElements(scene));
}

/** A small, fixed random number source: the same seed makes the same levels. */
function random(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const STEP = { gentle: 0.15, normal: 0.3, steep: 0.5 };

/** How much harder level `n` (1 for the first new one) is than the one made by hand: 1 is the same. */
export const hardness = (curve: LevelOptions['curve'], n: number) => 1 + STEP[curve] * n;

/** Where a level goes when it is won: the scene its rules most often go to, other than a game-over screen. */
function winTarget(project: GameProject, scene: Scene): string | null {
  const counts = new Map<string, number>();
  for (const rule of scene.rules) {
    for (const a of ruleActions(rule)) {
      if (a.type !== 'goToScene' || a.scene === scene.id) continue;
      const to = project.scenes.find((s) => s.id === a.scene);
      if (!to || /game ?over|باخت/i.test(to.name)) continue;
      counts.set(a.scene, (counts.get(a.scene) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Every "go to scene" toward `from` in a scene's rules now goes to `to`. */
function redirect(scene: Scene, from: string, to: string): Scene {
  const fix = (actions: Action[]): Action[] => actions.map((a) => (a.type === 'goToScene' && a.scene === from ? { ...a, scene: to } : a));
  return { ...scene, rules: scene.rules.map((r) => ({ ...r, then: fix(r.then), ...(r.otherwise ? { otherwise: fix(r.otherwise) } : {}) })) };
}

const isPlayer = (o: GameObject) => o.tags.includes(PLAYER);
const isEnemy = (o: GameObject) => !isPlayer(o) && (o.tags.includes(DANGER) || o.tags.includes('دشمن')) && o.behaviors.some((b) => ['patrol', 'chase', 'mover', 'route', 'wave'].includes(b.type));

/** Enemies, shots and things that come along faster; spawners and timed attacks more often. The player is left as it is. */
function faster(scene: Scene, f: number): Scene {
  const speedUp = (b: Behavior): Behavior => {
    switch (b.type) {
      case 'patrol': return { ...b, speed: Math.round(b.speed * f) };
      case 'chase': return { ...b, speed: Math.round(b.speed * f) };
      case 'mover': return { ...b, vx: Math.round(b.vx * f), vy: Math.round(b.vy * f) };
      // A thrown or bounced ball (a launch) speeds up much more gently: the player has to meet it every time
      // (about 12% faster by the third level on the normal curve).
      case 'launch': { const g = Math.pow(f, 0.25); return { ...b, vx: Math.round(b.vx * g), vy: Math.round(b.vy * g), ...(b.speed ? { speed: Math.round(b.speed * g) } : {}) }; }
      case 'spawner': return { ...b, minInterval: +(b.minInterval / f).toFixed(2), maxInterval: +(b.maxInterval / f).toFixed(2) };
      default: return b;
    }
  };
  const object = (o: GameObject): GameObject => (isPlayer(o) ? o : { ...o, behaviors: o.behaviors.map(speedUp) });
  // Timed attacks (an enemy firing every few seconds) come sooner; the player's own timed shots are left alone.
  const rule = (r: Rule): Rule => {
    const w = r.when;
    if ((w.type !== 'every' && w.type !== 'eachEvery') || !r.then.some((a) => a.type === 'spawn' || a.type === 'shoot')) return r;
    if (w.type === 'eachEvery' && w.target.by === 'tag' && w.target.tag === PLAYER) return r;
    return { ...r, when: { ...w, seconds: +(w.seconds / f).toFixed(2) } };
  };
  return { ...scene, objects: scene.objects.map(object), prefabs: scene.prefabs.map(object), rules: scene.rules.map(rule) };
}

/** More of the enemies that walk back and forth: a copy of one walks the other half of its beat. */
function moreEnemies(scene: Scene, f: number, rnd: () => number): Scene {
  const walkers = scene.objects.filter((o) => isEnemy(o) && o.behaviors.some((b) => b.type === 'patrol'));
  const extra = Math.min(walkers.length, Math.floor(walkers.length * (f - 1) * 0.8 + rnd() * 0.6));
  const copies = [...walkers].sort(() => rnd() - 0.5).slice(0, extra).map((o): GameObject => {
    const patrol = o.behaviors.find((b) => b.type === 'patrol');
    const shift = patrol?.type === 'patrol' ? patrol.distance / 2 : o.width * 2;
    return patrol?.type === 'patrol' && patrol.axis === 'y' ? { ...o, id: newId('obj'), y: o.y + shift } : { ...o, id: newId('obj'), x: o.x + shift };
  });
  return { ...scene, objects: [...scene.objects, ...copies] };
}

/** Prizes (coins, gems) swap places with one another: the same good spots, in a new order. */
function movePrizes(scene: Scene, rnd: () => number): Scene {
  const prize = (o: GameObject) => !isPlayer(o) && (o.tags.includes('سکه') || o.tags.includes('الماس') || o.tags.includes(PRIZE));
  const spots = scene.objects.filter(prize).map((o) => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 })).sort(() => rnd() - 0.5);
  let i = 0;
  const objects = scene.objects.map((o) => (prize(o) ? { ...o, x: spots[i].x - o.width / 2, y: spots[i++].y - o.height / 2 } : o));
  return { ...scene, objects: objects.map((o) => (o.visual.kind === 'tiles' ? movePrizeCells(o, rnd) : o)) };
}

/** Coins painted into a tile map: each slides a few cells along its row, into an empty cell. */
function movePrizeCells(o: GameObject, rnd: () => number): GameObject {
  if (o.visual.kind !== 'tiles') return o;
  const kinds = o.visual.kinds;
  const prizeKeys = new Set(Object.entries(kinds).filter(([, k]) => k.tags.includes('سکه') || k.tags.includes('الماس') || k.tags.includes(PRIZE)).map(([key]) => key));
  if (prizeKeys.size === 0) return o;
  const grid = o.visual.rows.map((r) => [...r]);
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (!prizeKeys.has(grid[r][c])) continue;
      const to = c + Math.round((rnd() - 0.5) * 6);
      if (to === c || to < 0 || to >= grid[r].length || grid[r][to] !== EMPTY_TILE) continue;
      grid[r][to] = grid[r][c];
      grid[r][c] = EMPTY_TILE;
    }
  }
  return { ...o, visual: { ...o.visual, rows: grid.map((r) => r.join('')) } };
}

/** Fewer moves, shots or seconds given at the start of the level; a points goal a little higher. Never below one. */
function fewerTries(scene: Scene, f: number): Scene {
  const tries = new Set(['moves', 'shots', 'time', 'seconds', 'timer']);
  const rules = scene.rules.map((r): Rule => {
    let next = r;
    if (r.when.type === 'start') {
      next = { ...next, then: next.then.map((a) => (a.type === 'setVariable' && a.op === 'set' && tries.has(a.name) && typeof a.amount === 'number' ? { ...a, amount: Math.max(1, Math.round(a.amount / Math.sqrt(f))) } : a)) };
    }
    if (r.when.type === 'variable' && r.when.name === 'score' && (r.when.op === '>=' || r.when.op === '>')) next = { ...next, when: { ...r.when, value: Math.round(r.when.value * Math.sqrt(f)) } };
    return next;
  });
  return { ...scene, rules };
}

const THEMES: { sky: Sky; weather: Weather; tiles: TileStyle }[] = [
  { sky: 'forest', weather: 'leaves', tiles: 'grass' },
  { sky: 'desert', weather: 'none', tiles: 'sand' },
  { sky: 'snow', weather: 'snow', tiles: 'snow' },
  { sky: 'sunset', weather: 'none', tiles: 'dirt' },
  { sky: 'night', weather: 'rain', tiles: 'stone' },
  { sky: 'day', weather: 'none', tiles: 'grass' },
];
const NATURAL: readonly string[] = ['grass', 'dirt', 'sand', 'snow', 'stone'];

/** Another place and weather: the backdrop, what falls from the sky, and ground of another material. Dark scenes stay dark. */
function newLook(scene: Scene, n: number, rnd: () => number): Scene {
  if ((scene.darkness ?? 0) > 0.3 || !scene.sky || scene.sky === 'none' || scene.sky === 'space' || scene.sky === 'cave') return scene;
  const theme = THEMES[(n + Math.floor(rnd() * THEMES.length)) % THEMES.length];
  const objects = scene.objects.map((o): GameObject => {
    if (o.visual.kind !== 'tiles') return o;
    const kinds = Object.fromEntries(Object.entries(o.visual.kinds).map(([k, kind]) => [k, kind.style && NATURAL.includes(kind.style) && !kind.asset ? { ...kind, style: theme.tiles } : kind]));
    return { ...o, visual: { ...o.visual, kinds } };
  });
  return { ...scene, sky: theme.sky, weather: theme.weather, objects };
}

/** Rooftop Run: rooftops of new widths with gaps that widen level by level, crates and coins on them, a lamp on each. */
function runnerLayout(scene: Scene, f: number, rnd: () => number): Scene {
  const first = (prefix: string) => scene.objects.find((o) => o.name.startsWith(prefix));
  const roof = first('بام 1')!;
  const [crate, coin, pit, lamp, flag] = [first('جعبه'), first('سکه'), first('چاله'), first('چراغ'), first('پرچم پایان')];
  const removed = (o: GameObject) => ['بام', 'جعبه', 'سکه', 'چاله', 'چراغ', 'پرچم پایان'].some((p) => o.name.startsWith(p));
  const kept = scene.objects.filter((o) => !removed(o));
  const length = Math.round(scene.width * Math.min(1.6, 0.85 + f * 0.15));
  const top = roof.y;
  const H = roof.y + roof.height;
  const made: GameObject[] = [];
  let x = 0;
  let n = 0;
  // Gaps grow along a level and from one level to the next, never wider than a double jump can clear (250).
  const widest = Math.min(250, 150 + 45 * f);
  let gap = Math.min(widest, 110 + 20 * f + 20 * rnd());
  while (x < length - 700) {
    const w = n === 0 ? roof.width : Math.round(640 + rnd() * 520);
    made.push({ ...roof, id: newId('obj'), name: `بام ${n + 1}`, x, width: w });
    if (lamp) made.push({ ...lamp, id: newId('obj'), name: `چراغ ${n + 1}`, x: x + w * 0.2 });
    if (n > 0) {
      if (crate && rnd() < 0.45 + 0.1 * f) made.push({ ...crate, id: newId('obj'), name: `جعبه ${n}`, x: x + w * (0.4 + rnd() * 0.25), y: top - crate.height });
      if (coin) for (let c = 0; c < 3; c++) made.push({ ...coin, id: newId('obj'), name: `سکه ${n}-${c + 1}`, x: x + w * 0.55 - 60 + c * 60, y: top - 200 - coin.height / 2 });
    }
    if (pit) made.push({ ...pit, id: newId('obj'), name: `چاله ${n + 1}`, x: x + w - 40, y: H + 60, width: gap + 80 });
    x += w + gap;
    gap = Math.min(widest, gap + 8 + 16 * rnd());
    n += 1;
  }
  // The last rooftop is always long, with the flag well past its start: a runner landing from a wide gap
  // must not sail over the flag.
  const last = 680;
  made.push({ ...roof, id: newId('obj'), name: 'بام آخر', x, width: last });
  if (flag) made.push({ ...flag, id: newId('obj'), x: x + last - 200 - flag.width / 2 });
  // Rooftops go first so they are drawn behind the runner, as in the level made by hand.
  return { ...scene, width: x + last, objects: [...made, ...kept] };
}

/** Sky Hopper: gaps between the pipes at new heights, a little narrower each level. */
function hopperLayout(scene: Scene, f: number, rnd: () => number): Scene {
  const H = scene.height;
  const gap = Math.max(300, Math.round(420 / Math.sqrt(f)));
  let middle = H * 0.5;
  const plan = new Map<number, { upper: number; lower: number; middle: number }>();
  const index = (o: GameObject) => Number(/(\d+)$/.exec(o.name)?.[1] ?? 0);
  const pipes = scene.objects.filter((o) => o.name.startsWith('دروازه'));
  for (const g of [...pipes].sort((a, b) => index(a) - index(b))) {
    middle = Math.min(H * 0.72, Math.max(H * 0.28, middle + (rnd() - 0.5) * H * 0.36));
    plan.set(index(g), { upper: middle - gap / 2, lower: middle + gap / 2, middle });
  }
  const objects = scene.objects.map((o): GameObject => {
    const p = plan.get(index(o));
    if (!p) return o;
    if (o.name.startsWith('لوله بالا')) return { ...o, y: 0, height: p.upper };
    if (o.name.startsWith('لوله پایین')) return { ...o, y: p.lower, height: H - p.lower };
    if (o.name.startsWith('دروازه')) return { ...o, y: p.upper, height: gap };
    return o;
  });
  return { ...scene, objects };
}

/** Brick Blitz: a new shape of wall (a pyramid, a checkerboard, a diamond, stripes), with more rows as levels go on. */
function bricksLayout(scene: Scene, f: number, rnd: () => number): Scene {
  const bricks = scene.objects.filter((o) => o.name.startsWith('آجر '));
  const sample = bricks[0];
  const colours = [...new Set(bricks.map((b) => (b.visual.kind === 'rect' ? b.visual.color : '#ffd23f')))];
  const cols = 7;
  const rows = Math.min(9, 5 + Math.round(f));
  const shapes = [
    (_r: number, _c: number) => true,
    (r: number, c: number) => Math.abs(c - 3) <= r * 0.6 + 0.4,
    (r: number, c: number) => (r + c) % 2 === 0,
    (r: number, c: number) => Math.abs(c - 3) + Math.abs(r - (rows - 1) / 2) <= 3.6,
    (r: number) => r % 2 === 0,
  ];
  const shape = shapes[Math.floor(rnd() * shapes.length)];
  const left = Math.min(...bricks.map((b) => b.x));
  const topY = Math.min(...bricks.map((b) => b.y));
  const step = { x: bricks.length > 1 ? Math.min(...bricks.filter((b) => b.x > left).map((b) => b.x)) - left : sample.width + 8, y: 50 };
  const made: GameObject[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape(r, c)) continue;
      made.push({ ...sample, id: newId('obj'), name: `آجر ${r + 1}-${c + 1}`, x: left + c * step.x, y: topY + r * step.y,
        visual: sample.visual.kind === 'rect' ? { ...sample.visual, color: colours[r % colours.length] } : sample.visual });
    }
  }
  // At least a handful, whatever the shape.
  if (made.length < 10) return scene;
  return { ...scene, objects: [...scene.objects.filter((o) => !o.name.startsWith('آجر ')), ...made] };
}

/** A label that says which level this is, popping in at the start and fading away. */
function levelBanner(scene: Scene, n: number, width: number, height: number): Scene {
  const label: GameObject = {
    id: newId('obj'), name: 'شماره‌ی مرحله', x: width / 2, y: height * 0.2, width: 0, height: 0, fixed: true, tags: [], visible: true, behaviors: [],
    visual: { kind: 'text', text: `Level ${n}`, color: '#ffd23f', size: 76, weight: 'bold', outline: '#5a2a00', shadow: true, align: 'center' },
  };
  const rules: Rule[] = [
    { id: newId('rule'), when: { type: 'start' }, condition: null, then: [{ type: 'effect', target: { by: 'id', id: label.id }, kind: 'pop', seconds: 0.5 }] },
    { id: newId('rule'), when: { type: 'after', seconds: 2 }, condition: null, then: [{ type: 'effect', target: { by: 'id', id: label.id }, kind: 'fadeOut', seconds: 0.6 }] },
  ];
  return { ...scene, objects: [...scene.objects, label], rules: [...scene.rules, ...rules] };
}

/** Makes `options.count` new levels after the scene, each harder than the last, and chains them. */
export function generateLevels(project: GameProject, sceneId: string, options: LevelOptions): { project: GameProject; ids: string[]; layout: LayoutKind; chained: boolean; changes: string[] } {
  const source = getScene(project, sceneId);
  const win = winTarget(project, source);
  const layout = layoutKind(source);
  const scoreGoal = source.rules.some((r) => r.when.type === 'variable' && r.when.name === 'score');
  // Lives the level takes away (a variable some rule subtracts from): each new level gives them all back.
  const lives = project.variables.filter((v) => typeof v.initial === 'number' && v.initial > 0 && /lives|life|جان/.test(v.name)
    && source.rules.some((r) => ruleActions(r).some((a) => a.type === 'setVariable' && a.name === v.name && a.op === 'subtract')));
  const { width: W, height: H } = project.meta;
  // New levels are named after the level they come from: «صحنه‌ی ۱ · مرحله‌ی ۲».
  const base = source.name.replace(/\s*·\s*مرحله‌ی\s*[0-9۰-۹]+$/, '');
  let p = project;
  const ids: string[] = [];
  const changes: string[] = [];
  const before = findElements(source);
  for (let n = 1; n <= options.count; n++) {
    const rnd = random(options.seed * 1009 + n * 7919);
    const f = hardness(options.curve, n);
    const copy = duplicateScene(p, sceneId, `${base} · مرحله‌ی ${(n + 1).toLocaleString('fa-IR')}`);
    p = copy.project;
    let scene = getScene(p, copy.id);
    if (options.newLayout && layout === 'runner') scene = runnerLayout(scene, f, rnd);
    if (options.newLayout && layout === 'hopper') scene = hopperLayout(scene, f, rnd);
    if (options.newLayout && layout === 'bricks') scene = bricksLayout(scene, f, rnd);
    const remixed = options.newLayout && layout && !['runner', 'hopper', 'bricks'].includes(layout);
    if (remixed) scene = remix(scene, layout as RemixKind, f, rnd, { width: W, height: H });
    // Kinds that lay out their own enemies have them where they fit; stray copies could end up in a wall.
    if (options.moreEnemies && !(remixed && placesEnemies(layout as RemixKind))) scene = moreEnemies(scene, f, rnd);
    if (options.faster) scene = faster(scene, f);
    if (options.movePrizes) scene = movePrizes(scene, rnd);
    if (options.fewerTries) scene = fewerTries(scene, f);
    if (options.newLook) scene = newLook(scene, n, rnd);
    // A goal in points counts this level's points: the score starts again at each level.
    if (scoreGoal) scene = { ...scene, rules: [{ id: newId('rule'), when: { type: 'start' }, condition: null, then: [{ type: 'setVariable', name: 'score', op: 'set', amount: 0 }] }, ...scene.rules] };
    if (lives.length) scene = { ...scene, rules: [{ id: newId('rule'), when: { type: 'start' }, condition: null, then: lives.map((v): Action => ({ type: 'setVariable', name: v.name, op: 'set', amount: v.initial as number })) }, ...scene.rules] };
    scene = levelBanner(scene, n + 1, W, H);
    // In a few words, what is new in this level, for the person who made it.
    const hasFoes = before.counts.enemy > 0 || scene.objects.some((o) => o.behaviors.some((b) => b.type === 'spawner'));
    const tries = source.rules.some((r) => r.when.type === 'start' && r.then.some((a) => a.type === 'setVariable' && a.op === 'set' && ['moves', 'shots', 'time', 'seconds', 'timer'].includes(a.name)));
    const said = [
      options.newLayout && layout ? (remixed ? REMIX_SAID[layout as RemixKind] : 'چیدمان تازه') : '',
      describeChange(before, findElements(scene)),
      options.faster && hasFoes ? `دشمن‌ها ${Math.round((f - 1) * 100).toLocaleString('fa-IR')}٪ تندتر` : '',
      options.fewerTries && tries ? 'حرکت یا تیر کمتر' : '',
      options.fewerTries && scoreGoal ? 'امتیاز بیشتری برای برد' : '',
      options.newLook && scene.sky !== source.sky ? 'منظره‌ی تازه' : '',
    ].filter(Boolean).join('، ');
    changes.push(`مرحله‌ی ${(n + 1).toLocaleString('fa-IR')}: ${said || 'مثل قبلی'}`);
    p = { ...p, scenes: p.scenes.map((s) => (s.id === copy.id ? scene : s)) };
    ids.push(copy.id);
  }
  // Each level leads to the next: the hand-made one to the first new one, the last new one to the win.
  if (win) {
    const order = [sceneId, ...ids];
    p = { ...p, scenes: p.scenes.map((s) => { const at = order.indexOf(s.id); return at >= 0 && at < order.length - 1 ? redirect(s, win, order[at + 1]) : s; }) };
  }
  // The new levels sit right after the one they were made from in the list of scenes.
  const made = new Set(ids);
  const rest = p.scenes.filter((s) => !made.has(s.id));
  const at = rest.findIndex((s) => s.id === sceneId);
  p = { ...p, scenes: [...rest.slice(0, at + 1), ...ids.map((id) => getScene(p, id)), ...rest.slice(at + 1)] };
  return { project: p, ids, layout, chained: Boolean(win), changes };
}
