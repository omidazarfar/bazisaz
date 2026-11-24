import type { Action, Behavior, GameObject, Ref, Scene, TilesVisual } from '../format/types';
import { EMPTY_TILE } from '../format/types';
import { DANGER, GROUND, PLAYER, PRIZE } from './presets';
import { newId } from './state';

/**
 * Reading what a level is made of, from its own rules, and making new
 * layouts out of those parts. Nothing here knows a game by name: an object
 * is an enemy because touching it costs the player a life and it moves, a
 * prize because touching it scores and it goes away, the goal because
 * touching it ends the level, and so on.
 */

export type Role = 'player' | 'enemy' | 'hazard' | 'prize' | 'goal' | 'checkpoint' | 'ground' | 'target' | 'piece' | 'decor' | 'other';

export interface Elements {
  player: GameObject | null;
  roleOf: Map<string, Role>;
  /** Tags (and ids) by what touching them does to the player. */
  hazardTags: Set<string>;
  prizeTags: Set<string>;
  goalTags: Set<string>;
  checkpointTags: Set<string>;
  groundTags: Set<string>;
  targetTags: Set<string>;
  pieceTags: Set<string>;
  /** How many of each, prizes painted into a tile map included. */
  counts: Record<Role, number>;
}

const MOVING = ['patrol', 'chase', 'mover', 'route', 'wave', 'homing'];
const moves = (o: GameObject) => o.behaviors.some((b) => MOVING.includes(b.type));
const refKey = (r: Ref) => (r.by === 'tag' ? r.tag : `#${r.id}`);
const keysOf = (o: GameObject) => [...o.tags, `#${o.id}`];
const has = (set: Set<string>, o: GameObject) => keysOf(o).some((k) => set.has(k));

/** Finds the player and what everything else is to them, from the rules of the level. */
export function findElements(scene: Scene): Elements {
  const player = scene.objects.find((o) => o.tags.includes(PLAYER))
    ?? scene.objects.find((o) => o.behaviors.some((b) => ['jumper', 'walker', 'steer', 'followFinger'].includes(b.type))) ?? null;
  const mine = new Set(player ? keysOf(player) : [PLAYER]);
  const groundTags = new Set<string>([GROUND]);
  for (const b of player?.behaviors ?? []) if ((b.type === 'body' || b.type === 'physics') && b.solidTag) groundTags.add(b.solidTag);

  // Messages whose rule costs a life (or the game): sending one of them is getting hurt.
  const hurts = (actions: Action[]) => actions.some((a) =>
    (a.type === 'setVariable' && a.op === 'subtract' && /lives|life|health|جان/.test(a.name)) || (a.type === 'damage' && a.target === 'first') || (a.type === 'respawn' && a.target === 'first'));
  const hurtMessages = new Set(scene.rules.filter((r) => r.when.type === 'message' && hurts(r.then)).map((r) => (r.when.type === 'message' ? r.when.name : '')));
  const isHurt = (actions: Action[]) => hurts(actions) || actions.some((a) => a.type === 'send' && hurtMessages.has(a.name));

  const hazardTags = new Set<string>();
  const prizeTags = new Set<string>();
  const goalTags = new Set<string>();
  const checkpointTags = new Set<string>();
  const targetTags = new Set<string>();
  const pieceTags = new Set<string>();
  for (const r of scene.rules) {
    const w = r.when;
    if (w.type === 'noneLeft' && w.target.by === 'tag') targetTags.add(w.target.tag);
    if (w.type === 'hit' && w.a.by === 'tag' && scene.rules.some((x) => x.when.type === 'noneLeft' && x.when.target.by === 'tag' && x.when.target.tag === (w.a as { tag: string }).tag)) targetTags.add(w.a.tag);
    if (w.type === 'line' && w.target.by === 'tag') pieceTags.add(w.target.tag);
    if (w.type !== 'touch') continue;
    const [me, other] = mine.has(refKey(w.a)) ? [w.a, w.b] : mine.has(refKey(w.b)) ? [w.b, w.a] : [null, null];
    if (!me || !other) continue;
    const key = refKey(other);
    const acts = r.then;
    if (acts.some((a) => a.type === 'checkpoint')) checkpointTags.add(key);
    else if (acts.some((a) => a.type === 'goToScene') || acts.some((a) => a.type === 'playSound' && a.sound === 'win')) goalTags.add(key);
    else if (w.from !== 'above' && isHurt(acts)) hazardTags.add(key);
    else if (acts.some((a) => a.type === 'destroy' && a.target === 'second') || acts.some((a) => a.type === 'setVariable' && a.op === 'add')) prizeTags.add(key);
  }
  for (const t of [PRIZE, 'سکه', 'الماس']) prizeTags.add(t);
  for (const t of [DANGER]) hazardTags.add(t);

  const roleOf = new Map<string, Role>();
  const counts: Record<Role, number> = { player: 0, enemy: 0, hazard: 0, prize: 0, goal: 0, checkpoint: 0, ground: 0, target: 0, piece: 0, decor: 0, other: 0 };
  for (const o of scene.objects) {
    let role: Role = 'other';
    if (o === player) role = 'player';
    else if (o.fixed) role = 'other';
    else if (has(checkpointTags, o)) role = 'checkpoint';
    else if (has(goalTags, o)) role = 'goal';
    else if (has(hazardTags, o)) role = moves(o) ? 'enemy' : 'hazard';
    else if (has(prizeTags, o)) role = 'prize';
    else if (has(targetTags, o)) role = 'target';
    else if (has(pieceTags, o)) role = 'piece';
    else if (o.visual.kind === 'tiles' || has(groundTags, o)) role = 'ground';
    else if (!o.tags.length && !o.behaviors.length && o.visual.kind === 'image') role = 'decor';
    roleOf.set(o.id, role);
    counts[role] += 1;
    // Coins painted into a map count as prizes too, one by one.
    if (o.visual.kind === 'tiles') {
      const kinds = o.visual.kinds;
      for (const row of o.visual.rows) for (const ch of row) if (kinds[ch]?.tags.some((t) => prizeTags.has(t))) counts.prize += 1;
    }
  }
  return { player, roleOf, hazardTags, prizeTags, goalTags, checkpointTags, groundTags, targetTags, pieceTags, counts };
}

const fa = (n: number) => n.toLocaleString('fa-IR');

/** What the level is made of, in words: «۵ دشمن، ۲ تله، ۲۳ جایزه…». */
export function describeElements(e: Elements): string {
  const words: [Role, string][] = [['enemy', 'دشمن'], ['hazard', 'تله و چاله'], ['prize', 'جایزه'], ['target', 'هدف'], ['piece', 'مهره'], ['checkpoint', 'ایست بازرسی'], ['goal', 'پایان'], ['decor', 'منظره']];
  return words.filter(([r]) => e.counts[r] > 0).map(([r, w]) => `${fa(e.counts[r])} ${w}`).join('، ');
}

/** The kinds of level a new layout can be made for, found from what the level is made of. */
export type RemixKind = 'platformer' | 'tower' | 'dungeon' | 'physics' | 'puzzle' | 'shooter' | 'rescue';

const groundMap = (scene: Scene, e: Elements) => scene.objects
  .filter((o): o is GameObject & { visual: TilesVisual } => o.visual.kind === 'tiles' && Object.values(o.visual.kinds).some((k) => k.tags.some((t) => e.groundTags.has(t))))
  .sort((a, b) => b.width * b.height - a.width * a.height)[0];

export function remixKind(scene: Scene, e: Elements): RemixKind | null {
  const p = e.player;
  const has = (type: string) => Boolean(p?.behaviors.some((b) => b.type === type));
  if (scene.rules.some((r) => r.when.type === 'line') && e.pieceTags.size) return 'puzzle';
  if (scene.rules.some((r) => r.when.type === 'thrown') && e.targetTags.size) return 'physics';
  if (scene.rules.some((r) => r.then.some((a) => a.type === 'cut')) && !p) return 'rescue';
  if (has('followFinger') && scene.objects.some((o) => o.behaviors.some((b) => b.type === 'spawner'))) return 'shooter';
  if (scene.gravity > 0 && has('jumper')) {
    const climb = p?.behaviors.find((b) => b.type === 'moves');
    const ladder = climb?.type === 'moves' && climb.climbTag ? climb.climbTag : 'نردبان';
    if (scene.height > scene.width * 1.5 && scene.objects.some((o) => o.tags.includes(ladder))) return 'tower';
    if (scene.width > scene.height * 1.5 && groundMap(scene, e)) return 'platformer';
  }
  if (scene.gravity === 0 && has('steer') && groundMap(scene, e)) return 'dungeon';
  return null;
}

export const REMIX_NAMES: Record<RemixKind, string> = {
  platformer: 'زمین، شکاف‌ها، سکوها، تله‌ها و دشمن‌ها همه از نو چیده می‌شوند',
  tower: 'سوراخ طبقه‌ها و نردبان‌ها جای تازه، سکه‌ها و دشمن‌های بیشتر روی طبقه‌ها',
  dungeon: 'ستون‌ها، سکه‌ها، دشمن‌ها و کلید جای تازه در اتاق‌ها، با دشمن‌های بیشتر',
  physics: 'برج‌های تازه از جعبه، بلندتر، با موجودهای بیشتر',
  puzzle: 'چیدمان تازه‌ی مهره‌ها',
  shooter: 'دشمن‌های سخت‌تر بیشتر می‌آیند و جان بیشتری دارند؛ غول قوی‌تر',
  rescue: 'تشک نجات کوچک‌تر',
};

const copy = (o: GameObject, patch: Partial<GameObject>): GameObject => ({ ...o, id: newId('obj'), ...patch } as GameObject);
const pick = <T,>(list: T[], rnd: () => number): T => list[Math.floor(rnd() * list.length) % list.length];
const renumber = (o: GameObject, n: number) => ({ ...o, name: `${o.name.replace(/\s*[0-9۰-۹]+$/, '')} ${n}` });
const withPatrol = (o: GameObject, distance: number): GameObject => ({
  ...o, behaviors: o.behaviors.map((b): Behavior => (b.type === 'patrol' ? { ...b, distance: Math.max(40, Math.round(distance)) } : b)),
});
const patrolOf = (o: GameObject) => { const b = o.behaviors.find((x) => x.type === 'patrol'); return b?.type === 'patrol' ? b.distance : 0; };

/**
 * A side-on level drawn as a tile map: the ground, its gaps and steps, the
 * floating platforms, coins, spikes, enemies on the ground and in the air,
 * checkpoints and the goal, all laid out afresh and longer. Every gap fits
 * a jump, every platform is in reach of the one below.
 */
function platformer(scene: Scene, e: Elements, f: number, rnd: () => number): Scene {
  const map = groundMap(scene, e)!;
  const { cell, kinds } = map.visual;
  const rowsN = map.visual.rows.length;
  const cols0 = Math.max(...map.visual.rows.map((r) => r.length));
  const isGround = (k: string) => kinds[k]?.tags.some((t) => e.groundTags.has(t));
  const counted = new Map<string, number>();
  for (const row of map.visual.rows) for (const ch of row) if (isGround(ch)) counted.set(ch, (counted.get(ch) ?? 0) + 1);
  const groundKey = [...counted.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!groundKey) return scene;
  const platKey = [...counted.keys()].find((k) => k !== groundKey) ?? groundKey;
  const coinKey = Object.keys(kinds).find((k) => kinds[k].tags.some((t) => e.prizeTags.has(t))) ?? null;
  const top = map.visual.rows.findIndex((r) => [...r].filter((ch) => ch === groundKey).length > cols0 * 0.4);
  if (top < 4) return scene;
  const topY = map.y + top * cell;

  const role = (o: GameObject) => e.roleOf.get(o.id);
  const bottomOf = (o: GameObject) => o.y + o.height;
  const near = (o: GameObject) => Math.abs(bottomOf(o) - topY) < cell * 0.75;
  const spikeT = scene.objects.find((o) => role(o) === 'hazard' && near(o));
  const pitT = scene.objects.find((o) => role(o) === 'hazard' && o.y > topY + cell);
  const walkerT = scene.objects.find((o) => role(o) === 'enemy' && near(o));
  const flyerT = scene.objects.find((o) => role(o) === 'enemy' && bottomOf(o) < topY - cell);
  const gemT = scene.objects.find((o) => role(o) === 'prize');
  const checkT = scene.objects.find((o) => role(o) === 'checkpoint');
  const goalT = scene.objects.find((o) => role(o) === 'goal');
  const liftT = scene.objects.find((o) => role(o) === 'ground' && o.visual.kind !== 'tiles' && o.behaviors.some((b) => b.type === 'patrol'));
  const decorLow = scene.objects.filter((o) => role(o) === 'decor' && near(o));
  const decorHigh = scene.objects.filter((o) => role(o) === 'decor' && !near(o) && bottomOf(o) < topY - cell * 2);
  const replaced = new Set([spikeT, pitT, walkerT, flyerT, gemT, checkT, goalT, liftT].filter(Boolean).flatMap((t) => scene.objects.filter((o) => o.name.replace(/\s*[0-9۰-۹]+$/, '') === t!.name.replace(/\s*[0-9۰-۹]+$/, '') && role(o) === role(t!)).map((o) => o.id)));
  for (const o of [...decorLow, ...decorHigh]) replaced.add(o.id);

  // How many of each the new level has: at least as many as the level made by hand, more as levels go on.
  const countOf = (pred: (o: GameObject) => boolean) => scene.objects.filter(pred).length;
  const more = (n: number) => n + Math.round((f - 1) * Math.max(2, n));
  const walkers = walkerT ? more(countOf((o) => role(o) === 'enemy' && near(o))) : 0;
  const flyers = flyerT ? more(countOf((o) => role(o) === 'enemy' && bottomOf(o) < topY - cell)) : 0;
  const spikes = spikeT ? more(countOf((o) => role(o) === 'hazard' && near(o))) : 0;
  const gaps = Math.max(2, more(pitT ? countOf((o) => role(o) === 'hazard' && o.y > topY + cell) : 2));
  const gems = gemT ? countOf((o) => role(o) === 'prize' && o.visual.kind !== 'tiles') : 0;
  let coins0 = 0;
  for (const row of map.visual.rows) for (const ch of row) if (ch === coinKey) coins0 += 1;
  type Piece = { kind: 'walker' | 'spikes' | 'gap' | 'lift' | 'step' | 'plain'; size: number; flyer?: boolean };
  const wide = () => 2 + (rnd() < Math.min(0.7, (f - 1) * 0.8) ? 1 : 0);
  const pieces = ([
    ...Array.from({ length: walkers }, (): Piece => ({ kind: 'walker', size: 5 })),
    // Two clear cells on each side of the spikes: room to land after a gap and to take off.
    ...Array.from({ length: spikes }, (): Piece => ({ kind: 'spikes', size: 6 })),
    // Flying enemies only over plain ground, never where a jump is needed anyway.
    ...Array.from({ length: flyers }, (): Piece => ({ kind: 'plain', size: 7, flyer: true })),
    ...Array.from({ length: gaps }, (): Piece => { const g = wide(); return { kind: 'gap', size: g + 2 }; }),
    ...(liftT ? [{ kind: 'lift', size: 6 } as Piece] : []),
    { kind: 'step', size: 4 }, ...(f > 1.4 ? [{ kind: 'step', size: 4 } as Piece] : []),
    { kind: 'plain', size: 3 }, { kind: 'plain', size: 3 },
  ] as Piece[]).sort(() => rnd() - 0.5);
  const cols = 6 + pieces.reduce((sum, p) => sum + p.size, 0) + 8;
  const grid = Array.from({ length: rowsN }, () => Array.from({ length: cols }, () => EMPTY_TILE));
  const ground = (c: number, rise = 0) => { for (let r = top - rise; r < rowsN; r++) grid[r][c] = groundKey; };
  const put = (r: number, c: number, k: string | null) => { if (k && r >= 0 && r < rowsN && c >= 0 && c < cols && grid[r][c] === EMPTY_TILE) grid[r][c] = k; };
  const made: GameObject[] = [];
  const add = (t: GameObject | undefined, x: number, y: number, extra: Partial<GameObject> = {}) => { if (t) made.push(copy(t, { x, y, ...extra })); };
  const flat: number[] = [];
  const open: number[] = [];
  const at = (c: number) => map.x + c * cell;

  let c = 0;
  for (; c < 6; c++) { ground(c); open.push(c); }
  const gapsAt: { c: number; g: number }[] = [];
  for (const piece of pieces) {
    if (piece.kind === 'gap' || piece.kind === 'lift') {
      const g = piece.size - 2;
      if (pitT) add(pitT, at(c), pitT.y, { width: g * cell });
      if (piece.kind === 'lift') add(liftT, at(c) - cell * 0.25, liftT!.y);
      else gapsAt.push({ c, g });
      c += g;
      for (let k = 0; k < 2; k++, c++) { ground(c); flat.push(c); open.push(c); }
    } else if (piece.kind === 'walker') {
      for (let k = 0; k < piece.size; k++) { ground(c + k); open.push(c + k); }
      add(withPatrol(walkerT!, (piece.size - 2) * cell - walkerT!.width), at(c) + 10, topY - walkerT!.height);
      c += piece.size;
    } else if (piece.kind === 'spikes') {
      for (let k = 0; k < piece.size; k++) { ground(c + k); open.push(c + k); }
      add(spikeT, at(c + 2), topY - spikeT!.height);
      c += piece.size;
    } else if (piece.kind === 'step') {
      const rise = 1 + (f > 1.5 && rnd() < 0.5 ? 1 : 0);
      for (let k = 0; k < piece.size; k++) ground(c + k, k === 1 || k === 2 ? rise : 0);
      put(top - rise - 2, c + 1, coinKey);
      put(top - rise - 2, c + 2, coinKey);
      c += piece.size;
    } else {
      // (No floating platform over a flying enemy: it flies at about that height.)
      for (let k = 0; k < piece.size; k++) { ground(c + k); flat.push(c + k); if (!piece.flyer) open.push(c + k); }
      // Two clear cells on each side of where it flies: jumping a gap or spikes next to it never meets it.
      if (piece.flyer) add(withPatrol(flyerT!, Math.min(patrolOf(flyerT!) || 100, 100)), at(c + 2), flyerT!.y);
      c += piece.size;
    }
  }
  for (; c < cols; c++) { ground(c); flat.push(c); open.push(c); }

  // Floating platforms over the ground (never over a step, so there is room to stand under them), coins on
  // them; the higher ones carry the gems.
  // Only over solid ground with no gap within three cells: a jump from a gap's edge must never bump into it.
  // (And no step under or beside it: jumping up onto a step must not bump into a platform.)
  const solidBelow = (from: number, n: number) => { for (let k = -3; k < n + 3; k++) if (grid[top]?.[from + k] !== groundKey || grid[top - 1]?.[from + k] !== EMPTY_TILE) return false; return true; };
  const free = (r: number, from: number, n: number) => {
    if (!solidBelow(from, n)) return false;
    for (let k = -1; k <= n; k++) if (grid[r]?.[from + k] !== EMPTY_TILE || grid[r + 1]?.[from + k] !== EMPTY_TILE || grid[r - 1]?.[from + k] !== EMPTY_TILE) return false;
    return true;
  };
  const platforms = Math.max(gems, 3) + Math.round((f - 1) * 3);
  let gemsLeft = gems;
  for (let i = 0, tries = 0; i < platforms && tries < 300; tries++) {
    const from = open[Math.floor(rnd() * open.length)];
    const n = 3 + Math.floor(rnd() * 2);
    // (None in the last stretch before the goal: a jump off one could sail right over it.)
    if (from < 7 || from + n + 5 >= cols - 12 || !open.includes(from + n - 1) || !free(top - 3, from, n)) continue;
    const higher = gemsLeft > 0 && free(top - 5, from + n + 1, 3);
    for (let k = 0; k < n; k++) { grid[top - 3][from + k] = platKey; put(top - 4, from + k, coinKey); }
    if (higher) {
      for (let k = 0; k < 3; k++) grid[top - 5][from + n + 1 + k] = platKey;
      add(gemT, at(from + n + 2) + (cell - gemT!.width) / 2, topY - 5 * cell - gemT!.height - 10);
      gemsLeft -= 1;
    }
    i += 1;
  }
  // Coins over the gaps, then along the ground, until there are at least as many as before.
  let coins = 0;
  const tally = () => { coins = 0; for (const row of grid) for (const ch of row) if (ch === coinKey) coins += 1; };
  for (const { c: g0, g } of gapsAt) for (let k = 0; k < g; k++) put(top - 2 - (k > 0 && k < g - 1 ? 1 : 0), g0 + k, coinKey);
  tally();
  for (let tries = 0; coinKey && coins < coins0 && tries < 200; tries++) {
    const k = flat[Math.floor(rnd() * flat.length)];
    if (k > 6) put(top - 1, k, coinKey);
    tally();
  }

  // Checkpoints a third and two thirds of the way, on flat ground; the goal at the end, on the ground.
  const flats = flat.filter((k) => k > 6 && k < cols - 8 && grid[top - 1][k] === EMPTY_TILE && grid[top - 1][k + 1] === EMPTY_TILE);
  if (checkT && flats.length) {
    for (const share of [1 / 3, 2 / 3]) {
      const k = flats.reduce((best, x) => (Math.abs(x - cols * share) < Math.abs(best - cols * share) ? x : best), flats[0]);
      add(checkT, at(k) + (cell - checkT.width) / 2, topY - checkT.height);
    }
  }
  // (On the ground: in the level made by hand it may stand on steps that are not there any more.)
  if (goalT) add(goalT, at(cols - 6) - goalT.width / 2, topY - goalT.height);
  // Trees and bushes on the ground here and there, clouds spread over the whole sky.
  const spots = flat.filter((k) => grid[top - 1][k] === EMPTY_TILE).sort(() => rnd() - 0.5);
  decorLow.forEach((d, i) => { const k = spots[i % Math.max(1, spots.length)] ?? i * 5; made.push(renumber(copy(d, { x: at(k), y: topY - d.height }), i + 1)); });
  decorHigh.forEach((d, i) => made.push(copy(d, { x: ((i + 0.3 + rnd() * 0.4) * cols * cell) / Math.max(1, decorHigh.length) })));

  const named = made.map((o) => o);
  const serial = new Map<string, number>();
  const numbered = named.map((o) => {
    const base = o.name.replace(/\s*[0-9۰-۹]+$/, '');
    const n = (serial.get(base) ?? 0) + 1;
    serial.set(base, n);
    return { ...o, name: `${base} ${n}` };
  });
  const width = cols * cell;
  const objects = scene.objects.filter((o) => !replaced.has(o.id)).map((o) => (o.id === map.id ? { ...o, width, visual: { ...map.visual, rows: grid.map((r) => r.join('')) } } : o));
  // The map is drawn first (behind), the new things in front of it, then everything else as it was.
  const mapAt = objects.findIndex((o) => o.id === map.id);
  return { ...scene, width, objects: [...objects.slice(0, mapAt + 1), ...numbered, ...objects.slice(mapAt + 1)] };
}

/**
 * A tower of floors joined by ladders: each floor's opening (and the ladder
 * up through it) moves to a new place, the coins are laid along the floors
 * afresh, and higher floors get enemies of their own.
 */
function tower(scene: Scene, e: Elements, f: number, rnd: () => number): Scene {
  const W = scene.width;
  const climb = e.player?.behaviors.find((b) => b.type === 'moves');
  const ladderTag = climb?.type === 'moves' && climb.climbTag ? climb.climbTag : 'نردبان';
  const role = (o: GameObject) => e.roleOf.get(o.id);
  const solid = scene.objects.filter((o) => role(o) === 'ground' && o.visual.kind !== 'tiles' && o.width < W);
  const byY = new Map<number, GameObject[]>();
  for (const o of solid) byY.set(Math.round(o.y), [...(byY.get(Math.round(o.y)) ?? []), o]);
  const floors = [...byY.entries()].filter(([, parts]) => parts.length === 2).sort((a, b) => b[0] - a[0]);
  const ladders = scene.objects.filter((o) => o.tags.includes(ladderTag)).sort((a, b) => b.y - a.y);
  if (floors.length < 2 || ladders.length < floors.length) return scene;
  const changed = new Map<string, GameObject>();
  const holes: { y: number; from: number; to: number }[] = [];
  floors.forEach(([y, parts], i) => {
    const [left, right] = [...parts].sort((a, b) => a.x - b.x);
    const hole = right.x - (left.x + left.width);
    // The opening zigzags from one half to the other, at a new spot each time.
    const half = i % 2 === 0 ? [W - 100 - hole, W - 40 - hole] : [40, 100];
    const x = Math.round(half[0] + rnd() * Math.max(0, half[1] - half[0]));
    changed.set(left.id, { ...left, x: 0, width: x });
    changed.set(right.id, { ...right, x: x + hole, width: W - x - hole });
    const ladder = ladders[i];
    changed.set(ladder.id, { ...ladder, x: x + (hole - ladder.width) / 2 });
    holes.push({ y, from: x, to: x + hole });
  });
  const made: GameObject[] = [];
  // Coins: each row of them slides to a new start along its floor.
  const coins = scene.objects.filter((o) => role(o) === 'prize');
  const rows = new Map<number, GameObject[]>();
  for (const o of coins) rows.set(Math.round(o.y), [...(rows.get(Math.round(o.y)) ?? []), o]);
  for (const [, row] of rows) {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    const gap = 100;
    const span = (sorted.length - 1) * gap + sorted[0].width;
    const start = 40 + rnd() * Math.max(0, W - 80 - span);
    sorted.forEach((o, k) => changed.set(o.id, { ...o, x: Math.round(start + k * gap) }));
  }
  // Enemies: one walks each floor it stood on, at a new spot; with the levels, floors without one get one.
  const enemies = scene.objects.filter((o) => role(o) === 'enemy');
  const template = enemies[0];
  const floorOf = (o: GameObject) => floors.findIndex(([y]) => Math.abs(o.y + o.height - y) < 20);
  const guarded = new Set(enemies.map(floorOf));
  const extra = Math.round((f - 1) * floors.length);
  let added = 0;
  const removed = new Set<string>();
  const goalT = scene.objects.find((o) => role(o) === 'goal');
  const topHole0 = holes[holes.length - 1];
  const goal = goalT && { ...goalT, x: topHole0.from > W / 2 ? 60 : W - 60 - goalT.width };
  floors.forEach(([y], i) => {
    const mine = enemies.filter((o) => floorOf(o) === i);
    const wanted = mine.length || (template && i < floors.length - 1 && !guarded.has(i) && added < extra ? 1 : 0);
    // On this floor the player walks from the opening they came up through to the next ladder (or the goal),
    // and an enemy walks only the middle of that way, never at a ladder's foot or top.
    const exit = (holes[i].from + holes[i].to) / 2;
    const next = i + 1 < holes.length ? (holes[i + 1].from + holes[i + 1].to) / 2 : (goal ? goal.x + goal.width / 2 : W / 2);
    const side = [Math.min(exit, next) + 100, Math.max(exit, next) - 100];
    for (let k = 0; k < wanted; k++) {
      const t = mine[k] ?? template!;
      const room = side[1] - side[0];
      const walk = Math.min(patrolOf(t) || 120, room - t.width);
      if (walk < 40) { if (mine[k]) removed.add(t.id); continue; }
      const x = side[0] + rnd() * Math.max(0, room - t.width - walk);
      const moved = withPatrol({ ...t, x: Math.round(x), y: y - t.height }, walk);
      if (mine[k]) changed.set(t.id, moved);
      else { made.push(copy(moved, { name: `${t.name.replace(/\s*[0-9۰-۹]+$/, '')} ${i + 1}` })); added += 1; }
    }
  });
  // The goal sits on the top floor, away from its opening.
  if (goal) changed.set(goal.id, goal);
  return { ...scene, objects: [...scene.objects.filter((o) => !removed.has(o.id)).map((o) => changed.get(o.id) ?? o), ...made] };
}

/**
 * Rooms drawn as a tile map, walked from above: pillars, coins, gems,
 * enemies and the key each go to a new free spot in their own room, never
 * against a wall or in a doorway; more enemies join in the later levels.
 */
function dungeon(scene: Scene, e: Elements, f: number, rnd: () => number, room: { width: number; height: number }): Scene {
  const map = groundMap(scene, e)!;
  const { cell, kinds, rows } = map.visual;
  const wall = (r: number, c: number) => r < 0 || c < 0 || r >= rows.length || c >= rows[r].length || Boolean(kinds[rows[r][c]]?.tags.some((t) => e.groundTags.has(t)));
  const clear = (r: number, c: number, d: number) => { for (let i = -d; i <= d; i++) for (let j = -d; j <= d; j++) if (wall(r + i, c + j)) return false; return true; };
  const roomOf = (x: number, y: number) => `${Math.floor(x / room.width)}:${Math.floor(y / room.height)}`;
  const role = (o: GameObject) => e.roleOf.get(o.id);
  // What moves: pillars (a block of ground the size of a cell, nothing more), prizes and the key, enemies.
  const pillar = (o: GameObject) => role(o) === 'ground' && o.visual.kind !== 'tiles' && o.tags.every((t) => e.groundTags.has(t)) && o.width <= cell * 1.5 && o.height <= cell * 1.5;
  const movable = (o: GameObject) => !o.fixed && o !== e.player && (pillar(o) || role(o) === 'prize' || role(o) === 'enemy');
  const used = new Set<string>();
  const p = e.player;
  const pr = p ? Math.floor((p.y + p.height / 2 - map.y) / cell) : -99;
  const pc = p ? Math.floor((p.x + p.width / 2 - map.x) / cell) : -99;
  // Places already taken: the player and what stays (the door, the goal, lights on the walls).
  for (const o of scene.objects) {
    if (o.visual.kind === 'tiles' || o.fixed) continue;
    if (!movable(o)) used.add(`${Math.floor((o.y + o.height / 2 - map.y) / cell)}:${Math.floor((o.x + o.width / 2 - map.x) / cell)}`);
  }
  // Doorways: open cells next to an open cell of another room. Enemies keep three cells away from them.
  const doors: [number, number][] = [];
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
    if (wall(r, c)) continue;
    const here = roomOf(map.x + c * cell + cell / 2, map.y + r * cell + cell / 2);
    if ([[0, 1], [1, 0]].some(([i, j]) => !wall(r + i, c + j) && roomOf(map.x + (c + j) * cell + cell / 2, map.y + (r + i) * cell + cell / 2) !== here)) doors.push([r, c]);
  }
  const byDoor = (r: number, c: number) => doors.some(([dr, dc]) => Math.max(Math.abs(dr - r), Math.abs(dc - c)) <= 3);
  const spotIn = (room: string, d: number, awayFromPlayer: number) => {
    for (let tries = 0; tries < 400; tries++) {
      const r = Math.floor(rnd() * rows.length);
      const c = Math.floor(rnd() * rows[0].length);
      const x = map.x + c * cell;
      const y = map.y + r * cell;
      if (roomOf(x + cell / 2, y + cell / 2) !== room || !clear(r, c, d) || used.has(`${r}:${c}`)) continue;
      if (Math.max(Math.abs(r - pr), Math.abs(c - pc)) < awayFromPlayer) continue;
      if (awayFromPlayer > 0 && byDoor(r, c)) continue;
      // Nothing right next to anything else either.
      if ([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([i, j]) => used.has(`${r + i}:${c + j}`))) continue;
      used.add(`${r}:${c}`);
      return { x, y };
    }
    return null;
  };
  const changed = new Map<string, GameObject>();
  const movers = scene.objects.filter(movable);
  // Pillars first, with room around them to walk by; then the rest.
  const order = [...movers].sort((a, b) => Number(pillar(b)) - Number(pillar(a)));
  for (const o of order) {
    const room = roomOf(o.x + o.width / 2, o.y + o.height / 2);
    const isPillar = pillar(o);
    const spot = spotIn(room, isPillar ? 2 : 1, role(o) === 'enemy' ? 4 : 0);
    if (!spot) continue;
    changed.set(o.id, { ...o, x: Math.round(spot.x + (cell - o.width) / 2), y: Math.round(spot.y + (cell - o.height) / 2) });
  }
  // More enemies, in rooms other than the one the player starts in.
  const enemies = movers.filter((o) => role(o) === 'enemy' && o.width <= cell * 1.3);
  const startRoom = p ? roomOf(p.x, p.y) : '';
  const rooms = [...new Set(movers.map((o) => roomOf(o.x + o.width / 2, o.y + o.height / 2)))].filter((r) => r !== startRoom);
  const made: GameObject[] = [];
  const extra = enemies.length ? Math.round(enemies.length * (f - 1) * 0.8) : 0;
  for (let k = 0; k < extra && rooms.length; k++) {
    const t = pick(enemies, rnd);
    const spot = spotIn(pick(rooms, rnd), 1, 5);
    if (spot) made.push(copy(t, { name: `${t.name} +${k + 1}`, x: Math.round(spot.x + (cell - t.width) / 2), y: Math.round(spot.y + (cell - t.height) / 2) }));
  }
  return { ...scene, objects: [...scene.objects.map((o) => changed.get(o.id) ?? o), ...made] };
}

/**
 * Things to knock down with a throw: new towers of blocks, taller as the
 * levels go on, a target on top of each and more on the ground between them.
 */
function physics(scene: Scene, e: Elements, f: number, rnd: () => number): Scene {
  const role = (o: GameObject) => e.roleOf.get(o.id);
  const thrown = scene.rules.find((r) => r.when.type === 'thrown')?.when;
  const throwTag = thrown?.type === 'thrown' && thrown.target.by === 'tag' ? thrown.target.tag : '';
  const floor = scene.objects.filter((o) => o.tags.some((t) => e.groundTags.has(t)) && !o.behaviors.some((b) => b.type === 'physics' && b.kind === 'moving')).sort((a, b) => b.width - a.width)[0];
  if (!floor) return scene;
  const moving = (o: GameObject) => o.behaviors.some((b) => b.type === 'physics' && b.kind === 'moving');
  const blocks = scene.objects.filter((o) => moving(o) && !o.tags.includes(throwTag) && role(o) !== 'target' && !o.tags.some((t) => e.targetTags.has(t)));
  const square = blocks.filter((o) => Math.abs(o.width - o.height) < 4 && o.width >= 60 && !o.tags.some((t) => /انفجار/.test(t)));
  const targetT = scene.objects.find((o) => o.tags.some((t) => e.targetTags.has(t)));
  const beamT = blocks.find((o) => o.width > o.height * 4);
  const stepT = blocks.find((o) => o.width > o.height * 1.5 && o.width < 100);
  const barrelT = blocks.find((o) => o.tags.some((t) => /انفجار/.test(t)));
  const thrower = scene.objects.find((o) => o.tags.includes(throwTag));
  if (!square.length || !targetT) return scene;
  const replaced = new Set([...blocks, ...scene.objects.filter((o) => o.tags.some((t) => e.targetTags.has(t)))].map((o) => o.id));
  const ground = floor.y;
  const size = square[0].width;
  const from = (thrower ? thrower.x + thrower.width : 150) + 160;
  const to = scene.width - 20;
  const n = Math.min(3, 2 + (rnd() < (f - 1) * 1.2 ? 1 : 0));
  const slot = (to - from) / n;
  const made: GameObject[] = [];
  const towers: { x: number; top: number }[] = [];
  // At least as many targets as before, more as levels go on: some sit inside the towers, between blocks.
  const goal = scene.objects.filter((o) => o.tags.some((t) => e.targetTags.has(t))).length + Math.round((f - 1) * 2);
  let inside = Math.max(0, goal - n);
  for (let i = 0; i < n; i++) {
    const x = Math.round(from + i * slot + rnd() * Math.max(0, slot - size - 30));
    const high = Math.min(5, Math.max(2, 1 + Math.floor(rnd() * (1.5 + f))));
    const items: GameObject[] = Array.from({ length: high }, (_, k) => (k === 0 ? square[0] : pick(square, rnd)));
    if (inside > 0) { items.splice(1, 0, targetT); inside -= 1; }
    let y = ground;
    for (const it of items) { y -= it.height; made.push(copy(it, { x: Math.round(x + (size - it.width) / 2), y })); }
    towers.push({ x, top: y });
  }
  // Two towers close enough share a beam, with something that goes off on it; a target stands on top of each tower.
  const [a, b] = towers;
  // (Only when no other tower stands under the beam's length.)
  const beam = Boolean(beamT && b && b.x - a.x + size <= beamT!.width && a.top === b.top
    && towers.slice(2).every((t) => t.x > a.x - 10 + beamT!.width || t.x + size < a.x - 10));
  if (beam) {
    made.push(copy(beamT!, { x: a.x - 10, y: a.top - beamT!.height }));
    a.top -= beamT!.height;
    b.top -= beamT!.height;
  }
  for (const t of towers) made.push(copy(targetT, { x: t.x + (size - targetT.width) / 2, y: t.top - targetT.height }));
  if (beam) {
    if (barrelT) made.push(copy(barrelT, { x: a.x - 10 + beamT!.width / 2 - barrelT.width / 2, y: a.top - barrelT.height }));
  } else if (barrelT) made.push(copy(barrelT, { x: towers[towers.length - 1].x + size + 4 > to - barrelT.width ? towers[0].x - barrelT.width - 4 : towers[towers.length - 1].x + size + 4, y: ground - barrelT.height }));
  // More targets on the ground between the towers, on a little step.
  const extra = Math.max(0, Math.round((f - 1) * 3));
  for (let k = 0; k < extra && k < towers.length - 1; k++) {
    const x = (towers[k].x + size + towers[k + 1].x) / 2;
    if (towers[k + 1].x - (towers[k].x + size) < targetT.width + 20) continue;
    const lift = stepT ? stepT.height : 0;
    if (stepT) made.push(copy(stepT, { x: x - stepT.width / 2, y: ground - stepT.height }));
    made.push(copy(targetT, { x: x - targetT.width / 2, y: ground - lift - targetT.height }));
  }
  return { ...scene, objects: [...scene.objects.filter((o) => !replaced.has(o.id)), ...made] };
}

/** A board of pieces: shuffled into a new board with no three alike in a row to start with. */
function puzzle(scene: Scene, e: Elements, rnd: () => number): Scene {
  const pieces = scene.objects.filter((o) => o.tags.some((t) => e.pieceTags.has(t)));
  const rule = scene.rules.find((r) => r.when.type === 'line')?.when;
  const name = rule?.type === 'line' ? rule.name : 'kind';
  if (pieces.length < 9) return scene;
  const spots = pieces.map((o) => ({ x: o.x, y: o.y }));
  const at = new Map<string, number>();
  let best: GameObject[] = pieces;
  let fewest = Infinity;
  for (let tries = 0; tries < 30 && fewest > 0; tries++) {
    const order = [...pieces].sort(() => rnd() - 0.5);
    const placed = order.map((o, i) => ({ ...o, x: spots[i].x, y: spots[i].y }));
    at.clear();
    for (const o of placed) at.set(`${Math.round(o.x)}:${Math.round(o.y)}`, o.values?.[name] ?? -1);
    const step = Math.min(...placed.map((o) => o.width)) * 1.1;
    let lines = 0;
    for (const o of placed) {
      const k = o.values?.[name];
      const right = [1, 2].every((i) => placed.some((q) => q.values?.[name] === k && Math.abs(q.x - (o.x + i * step)) < step * 0.3 && Math.abs(q.y - o.y) < 4));
      const down = [1, 2].every((i) => placed.some((q) => q.values?.[name] === k && Math.abs(q.y - (o.y + i * step)) < step * 0.3 && Math.abs(q.x - o.x) < 4));
      lines += Number(right) + Number(down);
    }
    if (lines < fewest) { fewest = lines; best = placed; }
  }
  const moved = new Map(best.map((o) => [o.id, o]));
  return { ...scene, objects: scene.objects.map((o) => moved.get(o.id) ?? o) };
}

/** Waves from above: tougher enemies come more often and take more hits; the big one takes many more. */
function shooter(scene: Scene, e: Elements, f: number, rnd: () => number): Scene {
  const tough = (o: GameObject) => (o.health ?? 1);
  const enemyPrefab = (id: string) => scene.prefabs.find((p) => p.id === id && p.tags.some((t) => e.hazardTags.has(t)));
  const objects = scene.objects.map((o): GameObject => {
    let next = o;
    const spawner = o.behaviors.find((b) => b.type === 'spawner');
    if (spawner?.type === 'spawner' && spawner.prefabs.some((id) => enemyPrefab(id))) {
      const foes = [...new Set(spawner.prefabs.filter((id) => enemyPrefab(id)))].sort((a, b) => tough(enemyPrefab(b)!) - tough(enemyPrefab(a)!));
      const more = Math.round((f - 1) * 4);
      const extra = Array.from({ length: more }, (_, i) => foes[Math.min(foes.length - 1, Math.floor(rnd() * (i % 2 ? foes.length : 2)))]);
      next = { ...next, behaviors: next.behaviors.map((b) => (b === spawner ? { ...spawner, prefabs: [...spawner.prefabs, ...extra] } : b)) };
    }
    if (o.tags.some((t) => e.hazardTags.has(t)) && (o.health ?? 0) >= 10) next = { ...next, health: Math.round((o.health ?? 1) * f) };
    return next;
  });
  const prefabs = scene.prefabs.map((p) => (p.tags.some((t) => e.hazardTags.has(t)) && (p.health ?? 0) >= 2 ? { ...p, health: Math.round((p.health ?? 1) * Math.sqrt(f)) } : p));
  return { ...scene, objects, prefabs };
}

/** Catch the falling person: the mat to land on is smaller. */
function rescue(scene: Scene, f: number): Scene {
  const landing = scene.rules.find((r) => r.when.type === 'touch' && r.then.some((a) => a.type === 'goToScene'))?.when;
  const id = landing?.type === 'touch' && landing.b.by === 'id' ? landing.b.id : null;
  return {
    ...scene,
    objects: scene.objects.map((o) => {
      if (o.id !== id) return o;
      const width = Math.max(220, Math.round(o.width / Math.sqrt(f)));
      return { ...o, x: Math.round(o.x + (o.width - width) / 2), width };
    }),
  };
}

/** Lays out a level of the given kind afresh. `f` is how much harder (1 is the same). */
export function remix(scene: Scene, kind: RemixKind, f: number, rnd: () => number, screen: { width: number; height: number }): Scene {
  const e = findElements(scene);
  switch (kind) {
    case 'platformer': return platformer(scene, e, f, rnd);
    case 'tower': return tower(scene, e, f, rnd);
    case 'dungeon': return dungeon(scene, e, f, rnd, screen);
    case 'physics': return physics(scene, e, f, rnd);
    case 'puzzle': return puzzle(scene, e, rnd);
    case 'shooter': return shooter(scene, e, f, rnd);
    case 'rescue': return rescue(scene, f);
  }
}

/** What a new layout of this kind brings, in a few words, for the list of what changed. */
export const REMIX_SAID: Record<RemixKind, string> = {
  platformer: 'زمین و سکوهای تازه', tower: 'سوراخ طبقه‌ها و نردبان‌ها جای تازه', dungeon: 'چیدمان تازه‌ی اتاق‌ها',
  physics: 'برج‌های تازه', puzzle: 'مهره‌ها از نو چیده شد', shooter: 'دشمن‌های قوی‌تر بیشتر', rescue: 'تشک نجات کوچک‌تر',
};

/** Whether this kind places its own enemies (so the general "more enemies" must not add stray copies into walls). */
export const placesEnemies = (kind: RemixKind | null) => kind === 'platformer' || kind === 'tower' || kind === 'dungeon';

/** What changed from the level made by hand to a new one, in a few words. */
export function describeChange(before: Elements, after: Elements): string {
  const words: [keyof Elements['counts'], string][] = [['enemy', 'دشمن'], ['hazard', 'تله'], ['prize', 'جایزه'], ['target', 'هدف']];
  return words.filter(([r]) => before.counts[r] !== after.counts[r]).map(([r, w]) => `${w} از ${fa(before.counts[r])} به ${fa(after.counts[r])}`).join('، ');
}

