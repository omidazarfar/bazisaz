import type { Action, Behavior, GameObject, GameProject, Rule, Scene, Sky, TilesVisual, Visual } from '../format/types';
import { CRATE, DANGER, GROUND, physics, PLAYER, THROWN, withVariable } from './presets';
import { flagshipHud, flagshipScreens } from './flagship';
import { packAnimation, packCharacter, packPicture, packTerrain, packTrimmed, type Sheet } from './packs/kenney';
import { addAll, addClockwork, addRescueRig, badge, byId, byTag, label, picture, RECIPES, rule, title, withItem, withRules } from './recipes';
import { SPRITES, useSprite } from './sprites';
import { makeObject, newId, updateScene } from './state';

/**
 * The genre helper's games. Each builds a whole small game into the scene
 * being edited, out of the same ordinary objects, rules and parts a person
 * could add by hand. A real level, enemies, prizes, a goal, three lives, a
 * start screen, a win screen and a game-over screen, music and a painted sky.
 * Nothing in it is hidden or fixed: every piece shows in the lists and can be
 * moved, changed or removed. The owner asked for these on 2026-11-20, as
 * "really cool games" to start from.
 */

export interface GameResult {
  project: GameProject;
  select: string | null;
  note: string;
}

// Groups the games' rules find things by. The first three are the ones roles and parts use.
const COIN = 'سکه';
const GEM = 'الماس';
const ENEMY = 'دشمن';
const SPIKES = 'تیغ';
const PIT = 'چاله';
const CHECK = 'ایست بازرسی';
const GOAL = 'پایان';
const HURT = 'آسیب';

// ── Shared pieces ─────────────────────────────────────────────────────────

/** A library character with its animations (standing, running, jumping, hurt), as a picture an object can show. */
export async function character(project: GameProject, id: string): Promise<{ project: GameProject; visual: Visual }> {
  const sprite = SPRITES.find((s) => s.id === id)!;
  const placed = await useSprite(project, id);
  const animated = placed.frames.length > 0 || placed.move.length > 0;
  const visual: Visual = {
    kind: 'image',
    asset: placed.asset,
    ...(placed.frames.length > 0 ? { frames: placed.frames } : {}),
    ...(placed.move.length > 0 ? { moveFrames: placed.move } : {}),
    ...(placed.jump ? { airFrames: [placed.jump] } : {}),
    ...(placed.hurt ? { hurtFrames: [placed.hurt] } : {}),
    ...(animated ? { fps: 8 } : {}),
    ...(sprite.category === 'character' ? { flip: true } : {}),
  };
  return { project: placed.project, visual };
}

/** A picture by library id, ready to place: the project with it stored, and its asset id. */
/** A picture of Kenney's pack (the flagship's art), in the shape art() gives. */
async function kenney(project: GameProject, sheet: Sheet, name: string, trim = false) {
  if (trim) {
    // Cut to the picture itself: Kenney's tiles sit in squares with room around them.
    const cut = await packTrimmed(project, sheet, [name]);
    return { project: cut.project, asset: cut.keys[0] };
  }
  const placed = await packPicture(project, sheet, name);
  return { project: placed.project, asset: placed.key };
}

async function art(project: GameProject, id: string) {
  const placed = await useSprite(project, id);
  return { project: placed.project, asset: placed.asset };
}

const withNumber = (project: GameProject, name: string, initial: number, saved = false): GameProject =>
  project.variables.some((v) => v.name === name) ? project : { ...project, variables: [...project.variables, { name, initial, saved }] };

const scene = (name: string, width: number, height: number, sky: Sky, music: string, extra: Partial<Scene> = {}): Scene => ({
  id: newId('scene'), name, width, height, background: null, music, gravity: 2400, sky, objects: [], prefabs: [], rules: [], ...extra,
});

/** Three hearts in the top-left corner showing `lives`: one goes faint for each life lost, and pops back when won again. */
async function hearts(project: GameProject, sceneId: string): Promise<GameProject> {
  const heart = await art(project, 'heart');
  const objects = [0, 1, 2].map((i) => makeObject(`قلب ${i + 1}`, { kind: 'image', asset: heart.asset }, 62, 56, { x: 50 + i * 70, y: 160 }, { fixed: true }));
  const rules = objects.flatMap((h, i) => [
    rule({ type: 'variable', name: 'lives', op: '<', value: i + 1 }, [{ type: 'setOpacity', target: byId(h.id), opacity: 0.25 }, { type: 'effect', target: byId(h.id), kind: 'pop', seconds: 0.3 }]),
    rule({ type: 'variable', name: 'lives', op: '>=', value: i + 1 }, [{ type: 'setOpacity', target: byId(h.id), opacity: 1 }, { type: 'effect', target: byId(h.id), kind: 'pop', seconds: 0.3 }]),
  ]);
  return withRules(addAll(heart.project, sceneId, objects), sceneId, ...rules);
}

/** Runs one of the ready-made parts on the scene, keeping only its project. */
async function part(project: GameProject, sceneId: string, id: string, centre = { x: 0, y: 0 }): Promise<GameProject> {
  return (await RECIPES.find((r) => r.id === id)!.apply(project, sceneId, centre)).project;
}

/**
 * The screens around a level: a start screen (the game opens on it), a win
 * screen and a game-over screen. Play and "play again" start a fresh game;
 * the menu buttons go back to the start.
 */
async function screens(project: GameProject, levelId: string, look: { name: string; hero: string; sky: Sky; music: string }) {
  const { width: W, height: H } = project.meta;
  let p = project;
  // (No glow on the start screen: on a bright sky it washes out the white words.)
  const start = scene('Start', W, H, look.sky, look.music, { vignette: true });
  const win = scene('You win', W, H, 'night', 'music:happy', { bloom: true, vignette: true });
  const over = scene('Game over', W, H, 'night', 'music:calm', { vignette: true });
  const fresh: Action[] = [{ type: 'playSound', sound: 'click' }, { type: 'resetVariables' }, { type: 'goToScene', scene: levelId }];

  // Start: the name in gold, the hero, a pulsing Play button.
  const hero = await character(p, look.hero);
  p = hero.project;
  const startHero = makeObject('قهرمان', hero.visual, 200, 220, { x: W / 2, y: H * 0.47 }, { behaviors: [{ type: 'wave', axis: 'y', distance: 18, seconds: 2 }] });
  const play = await picture(p, 'btn-play', 'دکمه‌ی شروع', 220, 220, { x: W / 2, y: H * 0.72 }, { behaviors: [{ type: 'pulse', amount: 0.08, seconds: 1 }] });
  p = play.project;
  start.objects = [
    title('نام بازی', look.name, 104, W / 2, H * 0.16),
    label('زیرعنوان', 'Tap play to start', 40, W / 2, H * 0.27, { fixed: false }),
    startHero,
    play.object,
  ];
  start.rules = [rule({ type: 'tapObject', target: byId(play.object.id) }, fresh)];

  // Win: a trophy in sparkles and confetti, the score, play again or back to the menu.
  const trophy = await picture(p, 'trophy', 'جام', 260, 260, { x: W / 2, y: H * 0.42 }, {
    glow: '#ffd23f', behaviors: [{ type: 'pulse', amount: 0.06, seconds: 1.2 }, { type: 'particles', preset: 'confetti', color: '#ffd23f', rate: 14, size: 1, speed: 1 }, { type: 'animate', repeat: 'bounce', ease: 'smooth', keys: [{ t: 0, x: 0, y: 0, angle: -8, scale: 1, opacity: 1 }, { t: 1.1, x: 0, y: 0, angle: 8, scale: 1, opacity: 1 }] }],
  });
  const again = await picture(trophy.project, 'btn-wide', 'دکمه‌ی دوباره', 340, 110, { x: W / 2, y: H * 0.74 });
  const home = await picture(again.project, 'btn-home', 'دکمه‌ی منو', 110, 110, { x: W / 2, y: H * 0.87 });
  p = home.project;
  win.objects = [
    title('عنوان برد', 'YOU WIN!', 110, W / 2, H * 0.12),
    trophy.object,
    label('امتیاز نهایی', 'Score: {score}', 60, W / 2, H * 0.58, { fixed: false }),
    label('بهترین امتیازها', 'Best: {best}', 38, W / 2, H * 0.64, { fixed: false }),
    again.object,
    label('نوشته‌ی دوباره', 'Play again', 46, W / 2, H * 0.74 - 32, { fixed: false }),
    home.object,
  ];
  win.rules = [
    rule({ type: 'start' }, [
      { type: 'recordScore', variable: 'score' },
      { type: 'setVariable', name: 'best', op: 'max', amount: { variable: 'score' } },
      { type: 'achieve', name: `${look.name[0]}${look.name.slice(1).toLowerCase()} complete` },
    ]),
    rule({ type: 'tapObject', target: byId(again.object.id) }, fresh),
    rule({ type: 'tapObject', target: byId(home.object.id) }, [{ type: 'playSound', sound: 'click' }, { type: 'goToScene', scene: start.id }]),
  ];

  // Game over: the score, and try again.
  const retry = await picture(p, 'btn-restart', 'دکمه‌ی دوباره', 200, 200, { x: W / 2, y: H * 0.62 }, { behaviors: [{ type: 'pulse', amount: 0.06, seconds: 1 }] });
  p = retry.project;
  over.objects = [
    title('عنوان باخت', 'GAME OVER', 100, W / 2, H * 0.2),
    label('امتیاز', 'Score: {score}', 56, W / 2, H * 0.36, { fixed: false }),
    label('بهترین', 'Best: {best}', 40, W / 2, H * 0.43, { fixed: false }),
    retry.object,
    label('نوشته‌ی دوباره', 'Try again', 44, W / 2, H * 0.75, { fixed: false }),
  ];
  over.rules = [
    rule({ type: 'start' }, [{ type: 'recordScore', variable: 'score' }, { type: 'setVariable', name: 'best', op: 'max', amount: { variable: 'score' } }]),
    rule({ type: 'tapObject', target: byId(retry.object.id) }, fresh),
  ];

  p = withNumber(withNumber(p, 'best', 0, true), 'score', 0);
  for (const name of ['top1', 'top2', 'top3']) p = withNumber(p, name, 0);
  return { project: { ...p, scenes: [...p.scenes, start, win, over], startScene: start.id }, start: start.id, win: win.id, over: over.id };
}

/**
 * Lives and getting hurt, shared by the games: a rule sends "آسیب" with the
 * player as "first"; it costs a life, unless the player was hurt a moment ago
 * (a second and a bit of safety); no lives left is game over.
 */
/** Losing lives. `push`: how hard the player is knocked back from what hurt it; 0 in a shooter, where being thrown about is no help. */
function lifeRules(overId: string, push = 650): Rule[] {
  return [
    {
      ...rule({ type: 'message', name: HURT }, [
        { type: 'setVariable', name: 'hurt', op: 'set', amount: 1 },
        { type: 'setVariable', name: 'lives', op: 'subtract', amount: 1 },
        // Knocked back from what hurt it, and blinking while it cannot be hurt again (its "invincible" time).
        ...(push ? [{ type: 'damage' as const, target: 'first' as const, amount: 0, push }] : []),
        { type: 'flash', target: 'first', color: '#ff3b47', seconds: 0.5 },
        { type: 'playSound', sound: 'hit' },
        { type: 'shake', strength: 12 },
        { type: 'vibrate', ms: 80 },
        { type: 'wait', seconds: 1.3 },
        { type: 'setVariable', name: 'hurt', op: 'set', amount: 0 },
      ]),
      condition: { name: 'hurt', op: '==', value: 0 },
    },
    rule({ type: 'start' }, [{ type: 'setVariable', name: 'hurt', op: 'set', amount: 0 }]),
    rule({ type: 'variable', name: 'lives', op: '<=', value: 0 }, [{ type: 'playSound', sound: 'lose' }, { type: 'wait', seconds: 0.8 }, { type: 'goToScene', scene: overId }]),
  ];
}

const prizeRule = (tag: string, points: number, sound: 'coin' | 'powerup', color: string): Rule =>
  rule({ type: 'touch', a: byTag(PLAYER), b: byTag(tag) }, [
    { type: 'burst', target: 'second', color, count: points > 1 ? 22 : 10 },
    { type: 'floatText', target: 'second', text: `+${points}`, color: points > 1 ? '#9ff3ff' : '#ffe066', size: points > 1 ? 46 : 38 },
    { type: 'destroy', target: 'second' },
    { type: 'setVariable', name: 'score', op: 'add', amount: points },
    { type: 'playSound', sound },
  ]);

// ── Platformer: "Sky Quest" ─────────────────────────────────────────────────

/** A painted level a few screens long, drawn cell by cell: "a" grass, "c" stone, "b" coins. */
function platformLevel(cols: number, rows: number, coinAsset: string): { tiles: TilesVisual; surface: number; pits: [number, number][] } {
  const grid = Array.from({ length: rows }, () => [...'.'.repeat(cols)]);
  const surface = rows - 4;
  const put = (c0: number, c1: number, r0: number, r1: number, ch: string) => {
    for (let r = Math.max(0, r0); r <= Math.min(rows - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++) grid[r][c] = ch;
  };
  const at = (share: number) => Math.round(share * cols);
  put(0, cols - 1, surface, rows - 1, 'a');
  // Gaps to jump, the widest crossed on a moving platform.
  const pits: [number, number][] = [[at(0.25), at(0.25) + 1], [at(0.47), at(0.47) + 3], [at(0.75), at(0.75) + 1]];
  for (const [c0, c1] of pits) put(c0, c1, surface, rows - 1, '.');
  // Stone steps and ledges, and the stairs up to the goal.
  put(at(0.17), at(0.17) + 1, surface - 1, surface - 1, 'c');
  put(at(0.33), at(0.33) + 2, surface - 3, surface - 3, 'c');
  put(at(0.63), at(0.63), surface - 1, surface - 1, 'c');
  put(at(0.66), at(0.66) + 1, surface - 2, surface - 1, 'c');
  // Stairs up to a podium that runs to the end of the world: the trophy stands on it, so it cannot be jumped over.
  put(at(0.86), at(0.86), surface - 1, surface - 1, 'c');
  put(at(0.88), at(0.88), surface - 2, surface - 1, 'c');
  put(at(0.9), cols - 1, surface - 3, surface - 1, 'c');
  // Coins: a line to start with, arcs over the gaps, a row on the high ledge.
  put(at(0.06), at(0.06) + 3, surface - 2, surface - 2, 'b');
  for (const [c0, c1] of pits) for (let c = c0 - 1; c <= c1 + 1; c++) grid[surface - (c === c0 - 1 || c === c1 + 1 ? 2 : 3)][c] = 'b';
  put(at(0.33), at(0.33) + 2, surface - 4, surface - 4, 'b');
  put(at(0.55), at(0.55) + 3, surface - 2, surface - 2, 'b');
  put(at(0.66), at(0.66) + 1, surface - 3, surface - 3, 'b');
  return {
    surface,
    pits,
    tiles: {
      kind: 'tiles',
      cell: 80,
      rows: grid.map((r) => r.join('')),
      kinds: {
        a: { name: 'زمین چمنی', color: '#6d4c41', tags: [GROUND], style: 'grass' },
        c: { name: 'سنگ', color: '#8a96a3', tags: [GROUND], style: 'stone' },
        b: { name: 'سکه', color: '#ffd54a', tags: [COIN], separate: true, asset: coinAsset },
      },
    },
  };
}

export async function buildPlatformer(project: GameProject, sceneId: string): Promise<GameResult> {
  const { width: W, height: H } = project.meta;
  const CELL = 80;
  const cols = Math.ceil((W * 5) / CELL);
  const rows = Math.max(8, Math.floor(H / CELL));
  let p = withNumber(withNumber(withNumber(withVariable(project, 'score'), 'lives', 3), 'hurt', 0), 'points', 0);
  // The flagship's art is one CC0 pack, Kenney's New Platformer Pack (CREDITS.md): sky colour and hills behind,
  // terrain fitted to its neighbours (autotile), its characters, enemies and sounds.
  p = updateScene(p, sceneId, (s) => ({ ...s, width: Math.max(s.width, cols * CELL), height: Math.max(s.height, rows * CELL), sky: 'none', background: '#c8e6f5', music: 'music:adventure', gravity: 2400 }));
  const coin = await kenney(p, 'tiles', 'coin_gold');
  p = coin.project;
  const level = platformLevel(cols, rows, coin.asset);
  const grass = await packTerrain(p, 'grass', level.tiles.kinds.a);
  const stone = await packTerrain(grass.project, 'stone', level.tiles.kinds.c);
  p = stone.project;
  const { style: _grassStyle, ...grassKind } = grass.kind;
  const { style: _stoneStyle, ...stoneKind } = stone.kind;
  level.tiles.kinds = { ...level.tiles.kinds, a: grassKind, c: stoneKind };
  const top = level.surface * CELL;
  const x = (share: number) => Math.round(share * cols) * CELL;
  const objects: GameObject[] = [];

  // Behind the action: clouds far off, hills nearer, both sliding slower than the level as the camera moves.
  const clouds = await kenney(p, 'backgrounds', 'background_clouds');
  const hills = await kenney(clouds.project, 'backgrounds', 'background_color_hills');
  const bush = await kenney(hills.project, 'tiles', 'bush', true);
  const mushroom = await kenney(bush.project, 'tiles', 'mushroom_red', true);
  const sign = await kenney(mushroom.project, 'tiles', 'sign_right', true);
  p = sign.project;
  const worldW = cols * CELL;
  objects.push(makeObject('تپه‌های دور', { kind: 'image', asset: hills.asset, repeat: 'x' }, worldW, 768, { x: worldW / 2, y: top - 300 }, { parallax: 0.35, locked: true }));
  objects.push(makeObject('ابرهای دور', { kind: 'image', asset: clouds.asset, repeat: 'x' }, worldW, 512, { x: worldW / 2, y: 300 }, { parallax: 0.15, locked: true, opacity: 0.95 }));
  for (const [i, share] of [0.03, 0.29, 0.36, 0.86, 0.93].entries()) {
    objects.push(makeObject(`بوته ${i + 1}`, { kind: 'image', asset: bush.asset }, 90, 90, { x: x(share) + 40, y: top - 45 }, { locked: true }));
  }
  objects.push(makeObject('قارچ', { kind: 'image', asset: mushroom.asset }, 70, 70, { x: x(0.58) + 40, y: top - 35 }, { locked: true }));
  objects.push(makeObject('تابلوی شروع', { kind: 'image', asset: sign.asset }, 80, 80, { x: 4 * CELL, y: top - 40 }, { locked: true }));
  // A lantern swinging under a floating island, on two lengths of rope: three bones, each turning with the one
  // above it and swinging a little more on its own (attach "with its turn", flagship Phase C).
  const island = await kenney(p, 'tiles', 'terrain_grass_cloud', true);
  const rope = await kenney(island.project, 'tiles', 'rope', true);
  const lantern = await packAnimation(rope.project, 'tiles', ['torch_on_a', 'torch_on_b'], 6);
  p = lantern.project;
  const [RIG0, RIG1, RIG2] = ['فانوس: جزیره', 'فانوس: ریسمان ۱', 'فانوس: ریسمان ۲'];
  const swing = (degrees: number, seconds: number) => ({
    type: 'animate' as const, repeat: 'bounce' as const, ease: 'smooth' as const, pivot: { x: 0.5, y: 0 },
    keys: [{ t: 0, x: 0, y: 0, angle: -degrees, scale: 1, opacity: 1 }, { t: seconds, x: 0, y: 0, angle: degrees, scale: 1, opacity: 1 }],
  });
  const islandX = x(0.15) + 40;
  const islandY = top - 6.4 * CELL;
  objects.push(makeObject('جزیره‌ی معلق', { kind: 'image', asset: island.asset }, 200, 90, { x: islandX, y: islandY }, { tags: [RIG0], locked: true }));
  objects.push(makeObject('ریسمان ۱', { kind: 'image', asset: rope.asset }, 24, 70, { x: islandX, y: islandY + 45 + 35 }, {
    tags: [RIG1], locked: true, behaviors: [{ type: 'attach', targetTag: RIG0, offsetX: 88, offsetY: 90 }, swing(22, 1.6)],
  }));
  objects.push(makeObject('ریسمان ۲', { kind: 'image', asset: rope.asset }, 24, 70, { x: islandX, y: islandY + 45 + 105 }, {
    tags: [RIG2], locked: true, behaviors: [{ type: 'attach', targetTag: RIG1, offsetX: 0, offsetY: 70, followAngle: true }, swing(10, 0.8)],
  }));
  objects.push(makeObject('فانوس', lantern.visual, 48, 64, { x: islandX, y: islandY + 45 + 172 }, {
    locked: true, glow: '#ffcf6b', behaviors: [{ type: 'attach', targetTag: RIG2, offsetX: -12, offsetY: 70, followAngle: true }],
  }));
  objects.push(makeObject('مرحله', level.tiles, cols * CELL, rows * CELL, { x: (cols * CELL) / 2, y: (rows * CELL) / 2 }, { locked: true }));

  // Where falling into a gap is caught: hidden strips along the bottom of each gap.
  for (const [i, [c0, c1]] of level.pits.entries()) {
    objects.push(makeObject(`چاله ${i + 1}`, { kind: 'rect', color: '#000000' }, (c1 - c0 + 1) * CELL, 50, { x: ((c0 + c1 + 1) / 2) * CELL, y: rows * CELL - 25 }, { opacity: 0, tags: [PIT] }));
  }
  // A platform that carries the player over the widest gap.
  const raft = await kenney(p, 'tiles', 'block_planks');
  p = raft.project;
  const [w0, w1] = level.pits[1];
  objects.push(makeObject('سکوی متحرک', { kind: 'image', asset: raft.asset, repeat: 'x' }, 200, 50, { x: (w0 + 1) * CELL, y: top - 40 }, {
    tags: [GROUND], behaviors: [{ type: 'patrol', axis: 'x', distance: (w1 - w0 - 1) * CELL, speed: 110 }],
  }));

  // Enemies to jump on, spikes to jump over, gems up high.
  // The slime walks all the time (its walking frames are its resting ones too); the fly beats its wings.
  const slime = await packCharacter(p, 'enemies', 'slime_normal', 6);
  const bat = await packAnimation(slime.project, 'enemies', ['fly_a', 'fly_b'], 10);
  const spikes = await kenney(bat.project, 'tiles', 'spikes', true);
  const gem = await kenney(spikes.project, 'tiles', 'gem_blue', true);
  p = gem.project;
  const crawl = slime.visual.moveFrames ?? [slime.visual.asset];
  for (const [i, [share, reach]] of ([[0.38, 200], [0.73, 140], [0.83, 110]] as const).entries()) {
    objects.push(makeObject(`لجن ${i + 1}`, { kind: 'image', asset: crawl[0], frames: crawl.slice(1), fps: 6, flip: true }, 100, 72, { x: x(share), y: top - 36 }, {
      tags: [ENEMY, DANGER], hitboxInset: 6, behaviors: [{ type: 'patrol', axis: 'x', distance: reach, speed: 90 }],
    }));
  }
  for (const [i, share] of [0.5, 0.71].entries()) {
    objects.push(makeObject(`مگس ${i + 1}`, bat.visual, 100, 80, { x: x(share), y: top - 230 }, {
      tags: [ENEMY, DANGER], hitboxInset: 10, behaviors: [{ type: 'patrol', axis: 'y', distance: 150, speed: 80 }],
    }));
  }
  for (const [i, share] of [0.13, 0.645].entries()) {
    objects.push(makeObject(`تیغ ${i + 1}`, { kind: 'image', asset: spikes.asset, repeat: 'x' }, 160, 40, { x: x(share), y: top - 20 }, { tags: [SPIKES], hitboxInset: 8 }));
  }
  for (const [i, [share, up]] of ([[0.34, 5.6], [0.68, 4.4], [0.9, 5]] as const).entries()) {
    objects.push(makeObject(`الماس ${i + 1}`, { kind: 'image', asset: gem.asset }, 70, 70, { x: x(share) + 40, y: top - up * CELL }, {
      tags: [GEM], glow: '#7fe8ff', behaviors: [{ type: 'pulse', amount: 0.1, seconds: 0.9 }, { type: 'particles', preset: 'sparkle', color: '#bff6ff', rate: 4, size: 1, speed: 1 }],
    }));
  }

  // Checkpoint flags, and the trophy at the end.
  const flag = await packAnimation(p, 'tiles', ['flag_green_a', 'flag_green_b'], 5);
  const trophy = await kenney(flag.project, 'tiles', 'star', true);
  p = trophy.project;
  for (const [i, share] of [0.44, 0.8].entries()) {
    objects.push(makeObject(`ایست بازرسی ${i + 1}`, flag.visual, 90, 100, { x: x(share), y: top - 50 }, { tags: [CHECK] }));
  }
  objects.push(makeObject('جام پایان', { kind: 'image', asset: trophy.asset }, 130, 130, { x: x(0.96), y: top - 3 * CELL - 65 }, {
    tags: [GOAL], glow: '#ffd23f', behaviors: [{ type: 'pulse', amount: 0.08, seconds: 1 }, { type: 'particles', preset: 'sparkle', color: '#fff3a8', rate: 8, size: 1.2, speed: 1 }],
  }));

  // The hero: runs, jumps twice, the camera follows.
  const hero = await packCharacter(p, 'characters', 'character_beige');
  p = hero.project;
  // Its animations fade one into the next (resting, walking, jumping) rather than cutting (flagship Phase C).
  const player = makeObject('قهرمان', { ...hero.visual, blend: 0.08 }, 90, 100, { x: 2 * CELL, y: top - 50 }, {
    tags: [PLAYER], shadow: true, health: 1000, invincible: 1.3,
    behaviors: [
      { type: 'body', gravity: true, solidTag: GROUND, bounce: 0, edges: 'stop', oneWay: false },
      { type: 'jumper', jumpSpeed: 1150, maxJumps: 2, on: 'tap', buttonTag: '' },
      { type: 'camera', lock: 'free', smooth: 0.25 },
    ],
  });
  objects.push(player);
  p = addAll(p, sceneId, objects);

  // The flagship's own screens, made of Kenney's UI kit (src/editor/flagship.ts, flagship Phase D).
  const screen = await flagshipScreens(p, sceneId, 'Sky Quest');
  p = screen.project;
  // Every prize does the same few things with a different number of points: one function, "reward", with
  // the points as its input (Phase 4), called by the coin, the gem, the squashed enemy and the trophy.
  const REWARD = 'جایزه';
  const reward = (points: number): Action => ({ type: 'call', name: REWARD, a1: points });
  const prize = (tag: string, points: number, sound: 'coin' | 'powerup', color: string) => rule({ type: 'touch', a: byTag(PLAYER), b: byTag(tag) }, [
    { type: 'burst', target: 'second', color, count: points > 1 ? 22 : 10 },
    reward(points),
    { type: 'destroy', target: 'second' },
    { type: 'playSound', sound },
  ]);
  p = withRules(p, sceneId,
    rule({ type: 'called', name: REWARD, in1: 'points' }, [
      { type: 'floatText', target: 'second', text: '+{points}', color: '#ffe066', size: 42 },
      { type: 'setVariable', name: 'score', op: 'add', amount: { variable: 'points' } },
    ]),
    prize(COIN, 1, 'coin', '#ffd23f'),
    prize(GEM, 10, 'powerup', '#7fe8ff'),
    // Jumping on an enemy squashes it and bounces the hero up; running into it hurts.
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(ENEMY), from: 'above' }, [
      { type: 'burst', target: 'second', color: '#8be04e', count: 18 },
      { type: 'effect', target: 'second', kind: 'shrink', seconds: 0.2 },
      { type: 'jump', target: 'first' },
      reward(5),
      { type: 'achieve', name: 'Stomper' },
      { type: 'playSound', sound: 'pop' },
      { type: 'shake', strength: 6, axis: 'up' },
    ]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(ENEMY), from: 'side' }, [{ type: 'send', name: HURT }]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(SPIKES) }, [{ type: 'jump', target: 'first' }, { type: 'send', name: HURT }]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(PIT) }, [{ type: 'send', name: HURT }, { type: 'respawn', target: 'first' }]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(CHECK) }, [
      { type: 'checkpoint', target: 'first' },
      { type: 'effect', target: 'second', kind: 'pop', seconds: 0.35 },
      { type: 'burst', target: 'second', color: '#ffd23f', count: 12 },
      { type: 'playSound', sound: 'powerup' },
    ]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(GOAL) }, [
      { type: 'burst', target: 'second', color: '#ffd23f', count: 40 },
      { type: 'playSound', sound: 'win' },
      reward(25),
      { type: 'wait', seconds: 1.2 },
      { type: 'goToScene', scene: screen.win },
    ]),
    ...lifeRules(screen.over),
  );
  p = await banner(p, sceneId, 'Reach the star!');
  // The screen furniture: score, hearts, a pause menu, and the left, right and jump buttons.
  p = await part(p, sceneId, 'score');
  p = await hearts(p, sceneId);
  p = await part(p, sceneId, 'pause-menu');
  p = await part(p, sceneId, 'controls');
  const [DASH, DOWN] = ['دکمه‌ی تیز رفتن', 'دکمه‌ی کوبیدن'];
  const dash = await picture(p, 'btn-dash', DASH, 120, 120, { x: W - 255, y: H - 110 }, { fixed: true, opacity: 0.85, tags: [DASH] });
  const down = await picture(dash.project, 'btn-down', DOWN, 120, 120, { x: W - 100, y: H - 265 }, { fixed: true, opacity: 0.85, tags: [DOWN] });
  p = addAll(down.project, sceneId, [dash.object, down.object]);
  p = updateScene(p, sceneId, (sc) => ({ ...sc, objects: sc.objects.map((o) => (o.id === player.id
    ? { ...o, behaviors: [...o.behaviors, { type: 'moves', wallJump: true, dash: true, dashTag: DASH, climbTag: '', pound: true, poundTag: DOWN }] }
    : o)) }));
  // The HUD and pause menu redrawn in the UI kit, anchored and coming in (flagship Phase D).
  p = await flagshipHud(p, sceneId);
  return {
    project: p,
    select: player.id,
    note: 'بازی سکویی کامل ساخته شد: صفحه‌ی شروع، یک مرحله‌ی چندصفحه‌ای با سکه، الماس، لجن و خفاش (روی سرشان بپر!)، تیغ، چاله، سکوی متحرک، دو پرچم ایست بازرسی و جام پایان، و صفحه‌ی برد و باخت. همه‌چیز را می‌شود جابه‌جا یا عوض کرد؛ مرحله با قلم نقشه نقاشی می‌شود.',
  };
}

/** A banner at the start of a level that says what to do, then fades. */
async function banner(project: GameProject, sceneId: string, text: string, height = 0.3): Promise<GameProject> {
  const { width: W, height: H } = project.meta;
  // Long enough words get smaller letters, so the banner always fits across the screen.
  const size = Math.min(58, Math.floor((W * 1.7) / text.length));
  const words = makeObject('نوشته‌ی هدف', { kind: 'text', text, color: '#ffd23f', size, weight: 'bold', outline: '#5a2a00', shadow: true }, 0, 0, { x: W / 2, y: H * height }, { fixed: true });
  return withRules(addAll(project, sceneId, [words]), sceneId, rule({ type: 'start' }, [
    { type: 'show', target: byId(words.id) },
    { type: 'effect', target: byId(words.id), kind: 'pop', seconds: 0.5 },
    { type: 'wait', seconds: 2.4 },
    { type: 'effect', target: byId(words.id), kind: 'fadeOut', seconds: 0.6 },
  ]));
}

// ── Top-down adventure: "Dungeon Escape" ────────────────────────────────────

/**
 * Four rooms of a dungeon, each one screen, seen from above: stone walls and
 * a wooden floor drawn cell by cell. A → B through an opening, B → C through
 * an opening, C → D through a doorway the locked door (an object) stands in.
 */
function dungeonMap(roomCols: number, roomRows: number): { tiles: TilesVisual; door: { col: number; row: number } } {
  const cols = roomCols * 2;
  const rows = roomRows * 2;
  const grid = Array.from({ length: rows }, () => [...'f'.repeat(cols)]);
  const wall = (c: number, r: number) => (grid[r][c] = 'w');
  for (let c = 0; c < cols; c++) [0, roomRows, rows - 1].forEach((r) => wall(c, r));
  for (let r = 0; r < rows; r++) [0, roomCols, cols - 1].forEach((c) => wall(c, r));
  const mid = Math.floor(roomRows / 2);
  for (const r of [mid - 1, mid]) grid[r][roomCols] = 'f';
  for (const c of [roomCols + Math.floor(roomCols / 2), roomCols + Math.floor(roomCols / 2) + 1]) grid[roomRows][c] = 'f';
  for (const r of [roomRows + mid - 1, roomRows + mid]) grid[r][roomCols] = 'f';
  return {
    door: { col: roomCols, row: roomRows + mid - 1 },
    tiles: {
      kind: 'tiles',
      cell: 80,
      rows: grid.map((r) => r.join('')),
      kinds: {
        w: { name: 'دیوار سنگی', color: '#4b5063', tags: [GROUND], style: 'stone' },
        f: { name: 'کف چوبی', color: '#6b4a32', tags: [], style: 'wood' },
      },
    },
  };
}

export async function buildAdventure(project: GameProject, sceneId: string): Promise<GameResult> {
  const { width: W, height: H } = project.meta;
  const CELL = 80;
  const roomCols = Math.max(6, Math.round(W / CELL));
  const roomRows = Math.max(8, Math.round(H / CELL));
  const RW = roomCols * CELL;
  const RH = roomRows * CELL;
  const ROOM = 'اتاق';
  const KEY = 'کلید';
  const DOOR = 'در قفل';
  let p = withNumber(withNumber(withVariable(project, 'score'), 'lives', 3), 'hurt', 0);
  p = updateScene(p, sceneId, (s) => ({
    ...s, width: Math.max(s.width, RW * 2), height: Math.max(s.height, RH * 2), gravity: 0, sky: 'none', background: '#1b1726',
    music: 'music:dungeon', darkness: 0.5, bloom: true, vignette: true,
  }));
  const map = dungeonMap(roomCols, roomRows);
  const objects: GameObject[] = [];
  // Where each room is, so the camera keeps to the one the knight is in.
  objects.push(...[[0, 0], [RW, 0], [RW, RH], [0, RH]].map(([x, y], i) =>
    makeObject(`اتاق ${'ABCD'[i]}`, { kind: 'rect', color: '#000000' }, RW, RH, { x: x + RW / 2, y: y + RH / 2 }, { visible: false, locked: true, tags: [ROOM] })));
  objects.push(makeObject('سیاه‌چال', map.tiles, RW * 2, RH * 2, { x: RW, y: RH }, { locked: true }));
  // A point in a room, by shares of its inside width and height.
  const at = (room: number, sx: number, sy: number) => ({ x: [0, RW, RW, 0][room] + CELL + sx * (RW - 2 * CELL), y: [0, 0, RH, RH][room] + CELL + sy * (RH - 2 * CELL) });

  // Torches flicker on the walls and light the dark; pillars to walk around; coins and gems.
  const torch = await art(p, 'torch');
  const stone = await art(torch.project, 'dungeon-stone');
  const coin = await art(stone.project, 'coin');
  const gem = await art(coin.project, 'gem');
  p = gem.project;
  for (let room = 0; room < 4; room++) {
    for (const [sx, sy] of [[0.05, 0.12], [0.95, 0.12], [0.05, 0.85], [0.95, 0.85]]) {
      objects.push(makeObject(`مشعل ${room + 1}`, { kind: 'image', asset: torch.asset }, 54, 72, at(room, sx, sy), {
        locked: true, behaviors: [{ type: 'light', radius: 240, color: '#ffb057', flicker: true, shadowTag: GROUND }, { type: 'particles', preset: 'fire', color: '#ffb057', rate: 6, size: 0.6, speed: 0.6 }],
      }));
    }
    for (const [sx, sy] of [[0.3, 0.4], [0.7, 0.6]]) objects.push(makeObject(`ستون ${room + 1}`, { kind: 'image', asset: stone.asset }, 80, 80, at(room, sx, sy), { tags: [GROUND] }));
    // (Clear of the score, hearts and backpack along the top and of the stick and buttons along the bottom.)
    for (const [sx, sy] of [[0.2, 0.25], [0.5, 0.28], [0.8, 0.3], [0.25, 0.7], [0.75, 0.74]]) {
      objects.push(makeObject(`سکه ${room + 1}`, { kind: 'image', asset: coin.asset }, 56, 56, at(room, sx, sy), { tags: [COIN], round: true, behaviors: [{ type: 'pulse', amount: 0.08, seconds: 1.1 }] }));
    }
  }
  for (const [room, sx, sy] of [[1, 0.92, 0.25], [2, 0.1, 0.5], [3, 0.65, 0.33]] as const) {
    objects.push(makeObject('الماس', { kind: 'image', asset: gem.asset }, 64, 64, at(room, sx, sy), {
      tags: [GEM], glow: '#7fe8ff', behaviors: [{ type: 'pulse', amount: 0.1, seconds: 0.9 }, { type: 'light', radius: 120, color: '#7fe8ff', flicker: false }],
    }));
  }

  // Skeletons keep watch, walking to and fro (state 0), and come after the knight once it is near (state 1), finding their way around walls.
  const bones = await art(p, 'skeleton');
  p = bones.project;
  const skeleton = (name: string, centre: { x: number; y: number }, size: number, health: number): GameObject =>
    makeObject(name, { kind: 'image', asset: bones.asset }, size, size, centre, {
      tags: [DANGER], health, healthBar: true, invincible: 0.3, hitboxInset: 10,
      behaviors: [
        // Skeletons bump into each other and into the knight instead of walking through.
        { type: 'body', gravity: false, solidTag: GROUND, bounce: 0, edges: 'stop', oneWay: false, bumpTag: DANGER },
        { type: 'patrol', axis: 'x', distance: 180, speed: 70, onlyIn: [0] },
        // They must see the knight: behind a pillar or round a corner it can lose them.
        { type: 'chase', targetTag: PLAYER, speed: size > 100 ? 95 : 125, avoidTag: GROUND, sight: true, onlyIn: [1] },
      ],
    });
  objects.push(
    skeleton('اسکلت ۱', at(1, 0.5, 0.5), 90, 2),
    skeleton('اسکلت ۲', at(1, 0.3, 0.8), 90, 2),
    skeleton('اسکلت ۳', at(2, 0.6, 0.3), 90, 2),
    skeleton('اسکلت ۴', at(2, 0.4, 0.75), 90, 2),
    skeleton('نگهبان بزرگ', at(2, 0.25, 0.55), 140, 6),
  );

  // The key, the locked door between C and D, and the treasure at the end.
  const keyArt = await art(p, 'key');
  const doorArt = await art(keyArt.project, 'door');
  const chest = await art(doorArt.project, 'chest');
  const item = withItem(chest.project, keyArt.asset, 'Key');
  p = item.project;
  // In the open, where no button covers it (the bottom of a room is under the buttons on a phone).
  objects.push(makeObject('کلید', { kind: 'image', asset: keyArt.asset }, 100, 46, at(1, 0.86, 0.47), {
    tags: [KEY], glow: '#ffd23f', behaviors: [{ type: 'pulse', amount: 0.1, seconds: 1 }, { type: 'light', radius: 140, color: '#ffd23f', flicker: false }],
  }));
  const door = makeObject('در قفل', { kind: 'image', asset: doorArt.asset }, CELL, CELL * 2, { x: map.door.col * CELL + CELL / 2, y: map.door.row * CELL + CELL }, { tags: [GROUND, DOOR] });
  objects.push(door);
  objects.push(makeObject('صندوق گنج', { kind: 'image', asset: chest.asset }, 130, 110, at(3, 0.5, 0.5), {
    tags: [GOAL], glow: '#ffd23f',
    behaviors: [{ type: 'pulse', amount: 0.06, seconds: 1.2 }, { type: 'light', radius: 260, color: '#ffe680', flicker: false, shadowTag: GROUND }, { type: 'particles', preset: 'magic', color: '#fff3a8', rate: 10, size: 16, speed: 1 }],
  }));

  // The knight: steered by a finger dragged anywhere, a lantern's light around it, the camera keeping to its room.
  const knight = await character(p, 'knight');
  p = knight.project;
  const player = makeObject('شوالیه', knight.visual, 90, 100, at(0, 0.5, 0.55), {
    tags: [PLAYER], shadow: true, health: 1000, invincible: 1.3,
    behaviors: [
      { type: 'body', gravity: false, solidTag: GROUND, bounce: 0, edges: 'stop', oneWay: false, bumpTag: DANGER },
      { type: 'steer', speed: 330, control: 'stick', upTag: '', downTag: '', leftTag: '', rightTag: '', face: false, roll: true, rollTag: 'دکمه‌ی غلت' },
      { type: 'light', radius: 300, color: '#fff3d6', flicker: false, shadowTag: GROUND },
      { type: 'camera', lock: 'free', smooth: 0.2, roomTag: ROOM },
    ],
  });
  objects.push(player);
  p = addAll(p, sceneId, objects);

  const screen = await screens(p, sceneId, { name: 'DUNGEON ESCAPE', hero: 'knight', sky: 'cave', music: 'music:dungeon' });
  p = screen.project;
  const open: Action[] = [
    { type: 'take', item: item.item, amount: 1 },
    { type: 'playSound', sound: 'powerup' },
    { type: 'burst', target: byId(door.id), color: '#ffd23f', count: 24 },
    { type: 'effect', target: byId(door.id), kind: 'shrink', seconds: 0.4 },
  ];
  p = withRules(p, sceneId,
    prizeRule(COIN, 1, 'coin', '#ffd23f'),
    prizeRule(GEM, 10, 'powerup', '#7fe8ff'),
    // Skeletons notice the knight and give chase; once it is far away again they go back to keeping watch.
    rule({ type: 'near', a: byTag(PLAYER), b: byTag(DANGER), distance: 340 }, [{ type: 'setValue', target: 'second', name: 'state', op: 'set', amount: 1 }, { type: 'flash', target: 'second', color: '#ff3b47', seconds: 0.2 }]),
    rule({ type: 'near', a: byTag(PLAYER), b: byTag(DANGER), distance: 560, leave: true }, [{ type: 'setValue', target: 'second', name: 'state', op: 'set', amount: 0 }]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(DANGER) }, [{ type: 'send', name: HURT }]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(KEY) }, [
      { type: 'give', item: item.item, amount: 1, from: 'second' }, { type: 'destroy', target: 'second' }, { type: 'playSound', sound: 'coin' },
    ]),
    // The door opens for a knight with the key: walking up to it, or dragging the key onto it.
    { ...rule({ type: 'near', a: byTag(PLAYER), b: byTag(DOOR), distance: 130 }, open), condition: { name: item.item, op: '>=', value: 1 }, otherwise: [{ type: 'flash', target: 'second', color: '#ff3b47', seconds: 0.3 }, { type: 'playSound', sound: 'hit' }] },
    rule({ type: 'useItemOn', item: item.item, target: byTag(DOOR) }, open),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(GOAL) }, [
      { type: 'burst', target: 'second', color: '#ffd23f', count: 40 }, { type: 'playSound', sound: 'win' },
      { type: 'setVariable', name: 'score', op: 'add', amount: 50 }, { type: 'wait', seconds: 1.2 }, { type: 'goToScene', scene: screen.win },
    ]),
    ...lifeRules(screen.over),
  );
  p = await banner(p, sceneId, 'Find the key. Escape!');
  // The knight wakes in the dark and says what to do, in a few words the player taps through.
  p = withRules(p, sceneId, rule({ type: 'after', seconds: 0.8 }, [
    { type: 'say', speaker: 'Knight', text: 'Where am I? This dungeon is so dark...', color: '#ffd23f' },
    { type: 'say', speaker: 'Knight', text: 'Skeletons! I must find the golden key and open the door. Tap the green button to roll away from danger.', color: '#ffd23f' },
  ]));
  p = await part(p, sceneId, 'score');
  p = await hearts(p, sceneId);
  p = await part(p, sceneId, 'pause-menu');
  p = await part(p, sceneId, 'sword');
  const rollButton = await picture(p, 'btn-roll', 'دکمه‌ی غلت', 110, 110, { x: W - 250, y: H - 160 }, { fixed: true, opacity: 0.9, tags: ['دکمه‌ی غلت'] });
  p = addAll(rollButton.project, sceneId, [rollButton.object]);
  // A small backpack beside the hearts for the key: a full row of places under them covered the top of every room.
  p = addAll(p, sceneId, [makeObject('کوله‌پشتی', { kind: 'bag', slots: 2 }, 150, 70, { x: 335, y: 160 }, { fixed: true })]);
  return {
    project: p,
    select: player.id,
    note: 'بازی ماجرایی کامل ساخته شد: چهار اتاق سیاه‌چال در تاریکی با مشعل، اسکلت‌هایی که نگهبانی می‌دهند و وقتی شوالیه را ببینند دنبالش می‌کنند (با دکمه‌ی شمشیر بزنشان)، کلید، در قفل و صندوق گنج. شوالیه با کشیدن انگشت هر جای صفحه حرکت می‌کند.',
  };
}

// ── Space shooter: "Star Raiders" ──────────────────────────────────────────

export async function buildShooter(project: GameProject, sceneId: string): Promise<GameResult> {
  const { width: W, height: H } = project.meta;
  const SHOT = 'تیر دشمن';
  const BOSS = 'غول';
  const HEAL = 'قلب جایزه';
  const BONUS = 'ستاره جایزه';
  let p = withNumber(withNumber(withVariable(project, 'score'), 'lives', 3), 'hurt', 0);
  p = updateScene(p, sceneId, (s) => ({ ...s, width: Math.max(s.width, W), height: Math.max(s.height, H), gravity: 0, sky: 'space', music: 'music:orbit', bloom: true, vignette: true, retro: 'crt' }));
  const pics: Record<string, string> = {};
  for (const id of ['space-ship', 'asteroid', 'alien', 'ufo', 'heart', 'star']) {
    const made = await art(p, id);
    p = made.project;
    pics[id] = made.asset;
  }
  const image = (id: string): Visual => ({ kind: 'image', asset: pics[id] });
  const enemy = (name: string, id: string, w: number, h: number, health: number, extra: Behavior[]): GameObject =>
    makeObject(name, image(id), w, h, { x: 0, y: 0 }, {
      x: 0, y: 0, tags: [ENEMY, DANGER], health, healthBar: health > 1, invincible: 0.05, hitboxInset: 8, behaviors: extra,
    });

  // What the enemies are, made during play: rocks that tumble down, aliens that weave and shoot, saucers that drift.
  const rock = enemy('سیارک', 'asteroid', 84, 84, 1, [{ type: 'mover', vx: 0, vy: 260, speedVariable: '', atEdge: 'remove' }, { type: 'rotate', speed: 70 }]);
  const alien = enemy('موجود فضایی', 'alien', 84, 84, 2, [{ type: 'mover', vx: 0, vy: 130, speedVariable: '', atEdge: 'remove' }, { type: 'wave', axis: 'x', distance: 120, seconds: 2 }]);
  const saucer = enemy('بشقاب‌پرنده', 'ufo', 130, 84, 3, [{ type: 'mover', vx: 0, vy: 90, speedVariable: '', atEdge: 'remove' }, { type: 'wave', axis: 'x', distance: 220, seconds: 3 }]);
  const bolt = makeObject('تیر بازیکن', { kind: 'ellipse', color: '#6cf2ff', shade: true }, 14, 46, { x: 0, y: 0 }, {
    x: 0, y: 0, glow: '#6cf2ff', behaviors: [{ type: 'launch', vx: 0, vy: -950 }, { type: 'homing', targetTag: ENEMY, turn: 90 }, { type: 'lifetime', seconds: 1.4 }],
  });
  const orb = makeObject('گوی غول', { kind: 'ellipse', color: '#c77dff', shade: true }, 26, 26, { x: 0, y: 0 }, {
    x: 0, y: 0, tags: [SHOT], round: true, glow: '#c77dff', behaviors: [{ type: 'lifetime', seconds: 5 }],
  });
  const enemyShot = makeObject('گلوله‌ی دشمن', { kind: 'ellipse', color: '#ff4d6d', shade: true }, 24, 24, { x: 0, y: 0 }, {
    x: 0, y: 0, tags: [SHOT], round: true, glow: '#ff4d6d', behaviors: [{ type: 'launch', vx: 0, vy: 0, toward: 'group', targetTag: PLAYER, speed: 260 }, { type: 'lifetime', seconds: 4 }],
  });
  const heal = makeObject('قلب', image('heart'), 64, 58, { x: 0, y: 0 }, { x: 0, y: 0, tags: [HEAL], glow: '#ff6b8a', behaviors: [{ type: 'mover', vx: 0, vy: 170, speedVariable: '', atEdge: 'remove' }, { type: 'pulse', amount: 0.12, seconds: 0.6 }] });
  const bonus = makeObject('ستاره', image('star'), 66, 66, { x: 0, y: 0 }, { x: 0, y: 0, tags: [BONUS], glow: '#ffd23f', behaviors: [{ type: 'mover', vx: 0, vy: 190, speedVariable: '', atEdge: 'remove' }, { type: 'rotate', speed: 120 }] });
  const prefabs = [rock, alien, saucer, bolt, enemyShot, orb, heal, bonus];

  // Waves come from above the screen until the boss arrives (the maker's state 1 stops it).
  const waves = makeObject('سازنده‌ی دشمن', { kind: 'rect', color: '#000000' }, 40, 40, { x: 0, y: 0 }, {
    x: 60, y: -20, visible: false, locked: true,
    behaviors: [{ type: 'spawner', prefabs: [rock.id, rock.id, alien.id, saucer.id], minInterval: 0.45, maxInterval: 1.0, spreadX: W - 200, spreadY: 0, everyDistance: 0, onlyIn: [0] }],
  });
  const gifts = makeObject('سازنده‌ی جایزه', { kind: 'rect', color: '#000000' }, 40, 40, { x: 0, y: 0 }, {
    x: 60, y: -20, visible: false, locked: true,
    behaviors: [{ type: 'spawner', prefabs: [heal.id, bonus.id, bonus.id], minInterval: 7, maxInterval: 12, spreadX: W - 200, spreadY: 0, everyDistance: 0 }],
  });
  // The boss waits out of sight until the score is high enough.
  const boss = makeObject('غول آخر', image('ufo'), 280, 180, { x: W / 2, y: 260 }, {
    tags: [ENEMY, BOSS], visible: false, health: 40, healthBar: true, invincible: 0.05, hitboxInset: 16, glow: '#b07cff',
    behaviors: [{ type: 'patrol', axis: 'x', distance: Math.max(100, W - 340), speed: 170, onlyIn: [1] }, { type: 'wave', axis: 'y', distance: 40, seconds: 2, onlyIn: [1] }],
  });
  const ship = makeObject('سفینه', image('space-ship'), 104, 110, { x: W / 2, y: H * 0.78 }, {
    // A forgiving hitbox: only the body of the ship counts, not its wing tips and flame (as in every good shooter).
    tags: [PLAYER], glow: '#6cf2ff', health: 1000, invincible: 1.3, hitboxInset: 26,
    behaviors: [{ type: 'followFinger', speed: 1300, axis: 'both' }, { type: 'camera', lock: 'free', smooth: 0 }, { type: 'particles', preset: 'fire', color: '#6cf2ff', rate: 18, size: 0.7, speed: 1.2 }],
  });
  p = updateScene(p, sceneId, (s) => ({ ...s, prefabs: [...s.prefabs, ...prefabs] }));
  p = addAll(p, sceneId, [waves, gifts, boss, ship]);

  const screen = await screens(p, sceneId, { name: 'STAR RAIDERS', hero: 'space-ship', sky: 'space', music: 'music:orbit' });
  p = screen.project;
  const awake = { by: 'tag' as const, tag: BOSS, where: { name: 'state', op: '==' as const, value: 1 } };
  p = withRules(p, sceneId,
    // The ship fires on its own; each enemy takes hits until its health is gone, then explodes.
    rule({ type: 'eachEvery', target: byTag(PLAYER), seconds: 0.22 }, [{ type: 'spawn', prefab: bolt.id, at: 'first' }, { type: 'playSound', sound: 'laser', volume: 18 }]),
    rule({ type: 'touch', a: byId(bolt.id), b: byTag(ENEMY) }, [{ type: 'damage', target: 'second', amount: 1 }, { type: 'flash', target: 'second', color: '#ffffff', seconds: 0.1 }, { type: 'destroy', target: 'first' }]),
    rule({ type: 'dead', target: byTag(ENEMY) }, [
      { type: 'burst', target: 'first', color: '#ff9f1c', count: 26 }, { type: 'playSound', sound: 'boom', volume: 55 }, { type: 'shake', strength: 5 },
      { type: 'floatText', target: 'first', text: '+5', color: '#ffd166', size: 40 },
      { type: 'setVariable', name: 'score', op: 'add', amount: 5 }, { type: 'destroy', target: 'first' },
    ]),
    // Aliens shoot at the ship from time to time; the boss, once awake, much more often.
    rule({ type: 'eachEvery', target: byId(alien.id), seconds: 2.4 }, [{ type: 'spawn', prefab: enemyShot.id, at: 'first' }]),
    // The boss's attack: a ring of orbs all round, and a fan of three aimed at the ship.
    rule({ type: 'eachEvery', target: awake, seconds: 2.4 }, [{ type: 'shoot', from: 'first', prefab: orb.id, pattern: 'ring', count: 10, direction: 90, spread: 0, speed: 210, aimTag: '' }, { type: 'playSound', sound: 'laser', volume: 30 }]),
    rule({ type: 'eachEvery', target: awake, seconds: 1.3 }, [{ type: 'shoot', from: 'first', prefab: orb.id, pattern: 'aimed', count: 3, direction: 90, spread: 30, speed: 280, aimTag: PLAYER }]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(ENEMY) }, [{ type: 'send', name: HURT }, { type: 'damage', target: 'second', amount: 2 }]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(SHOT) }, [{ type: 'destroy', target: 'second' }, { type: 'send', name: HURT }]),
    // Gifts: a heart gives back a life (or points if all are there), a star is worth twenty.
    { ...rule({ type: 'touch', a: byTag(PLAYER), b: byTag(HEAL) }, [{ type: 'setVariable', name: 'lives', op: 'add', amount: 1 }, { type: 'playSound', sound: 'powerup' }, { type: 'burst', target: 'second', color: '#ff6b8a', count: 16 }, { type: 'destroy', target: 'second' }]), condition: { name: 'lives', op: '<', value: 3 }, otherwise: [{ type: 'setVariable', name: 'score', op: 'add', amount: 10 }, { type: 'playSound', sound: 'coin' }, { type: 'destroy', target: 'second' }] },
    prizeRule(BONUS, 20, 'powerup', '#ffd23f'),
    // At 150 points the waves stop and the boss arrives, to darker music.
    rule({ type: 'variable', name: 'score', op: '>=', value: 150 }, [
      { type: 'setValue', target: byId(waves.id), name: 'state', op: 'set', amount: 1 },
      { type: 'show', target: byId(boss.id) },
      { type: 'setValue', target: byId(boss.id), name: 'state', op: 'set', amount: 1 },
      { type: 'effect', target: byId(boss.id), kind: 'grow', seconds: 0.8 },
      { type: 'playMusic', music: 'music:tense' },
      { type: 'shake', strength: 10 },
    ]),
    rule({ type: 'dead', target: byTag(BOSS) }, [{ type: 'achieve', name: 'Boss slayer' }, { type: 'shockwave', at: 'first', size: 700 }, { type: 'zoomPunch', amount: 1.15, seconds: 0.6 }, { type: 'shake', strength: 16 }, { type: 'playSound', sound: 'win' }, { type: 'setVariable', name: 'score', op: 'add', amount: 100 }, { type: 'wait', seconds: 1.4 }, { type: 'goToScene', scene: screen.win }]),
    ...lifeRules(screen.over, 0),
  );
  p = await banner(p, sceneId, 'Blast them all!');
  p = await part(p, sceneId, 'score');
  p = await hearts(p, sceneId);
  p = await part(p, sceneId, 'pause-menu');
  return {
    project: p,
    select: ship.id,
    note: 'بازی تیراندازی فضایی کامل ساخته شد: سفینه دنبال انگشت می‌آید و خودش شلیک می‌کند؛ موج‌های سیارک، موجود فضایی تیرانداز و بشقاب‌پرنده از بالا می‌آیند، قلب و ستاره جایزه می‌افتند، و با ۱۵۰ امتیاز غول آخر ظاهر می‌شود. شکستش بده تا ببری.',
  };
}

// ── Puzzle: "Gem Crush" ────────────────────────────────────────────────────

export async function buildPuzzle(project: GameProject, sceneId: string): Promise<GameResult> {
  const { width: W, height: H } = project.meta;
  const GOAL_POINTS = 90;
  const MOVES = 20;
  const CELL = 120;
  let p = withNumber(withNumber(withVariable(project, 'score'), 'moves', MOVES), 'picked', 0);
  p = updateScene(p, sceneId, (s) => ({ ...s, cell: CELL, gravity: 0, sky: 'underwater', music: 'music:calm', bloom: true, vignette: true }));
  // The board's frame, behind where the match-three part lays out its pieces (the same sums it uses).
  const cols = Math.min(6, Math.floor(W / CELL));
  const rows = 7;
  const left = Math.max(0, Math.floor((W - CELL * cols) / 2 / CELL)) * CELL;
  const top = Math.max(1, Math.round(330 / CELL)) * CELL;
  const frame = await picture(p, 'panel', 'قاب صفحه', cols * CELL + 36, rows * CELL + 36, { x: left + (cols * CELL) / 2, y: top + (rows * CELL) / 2 }, { locked: true, opacity: 0.92 });
  // The score and the moves left in glassy badges, and a bar filling toward the goal.
  const points = await badge(frame.project, 'coin', 'امتیاز', '{score}', { x: W * 0.25, y: 80 }, { w: 220, h: 80 });
  const moves = await badge(points.project, 'clock', 'حرکت‌ها', '{moves}', { x: W * 0.6, y: 80 }, { w: 220, h: 80 });
  p = moves.project;
  const bar = makeObject('نوار هدف', { kind: 'bar', variable: 'score', max: GOAL_POINTS, color: '#ffd23f', back: '#1b2140' }, W - 160, 30, { x: W / 2, y: 175 }, { fixed: true });
  const goal = label('نوشته‌ی هدف', `Goal: ${GOAL_POINTS}`, 36, W / 2, 205);
  p = addAll(p, sceneId, [...points.objects, ...moves.objects, bar, goal]);
  // The badges go in first: the match-three part adds its own score text only if there is none yet.
  p = addAll(p, sceneId, [frame.object]);
  p = await part(p, sceneId, 'match3');
  // A move is spent each time a second piece is tapped to swap. This rule goes first, before the part's own swap rule clears "picked".
  const spend: Rule = {
    ...rule({ type: 'tapObject', target: { by: 'tag', tag: 'مهره', where: { name: 'sel', op: '==', value: 0 } } }, [{ type: 'setVariable', name: 'moves', op: 'subtract', amount: 1 }]),
    condition: { name: 'picked', op: '==', value: 1 },
  };
  p = updateScene(p, sceneId, (s) => ({ ...s, rules: [spend, ...s.rules] }));
  const screen = await screens(p, sceneId, { name: 'GEM CRUSH', hero: 'gem', sky: 'underwater', music: 'music:calm' });
  p = screen.project;
  p = withRules(p, sceneId,
    rule({ type: 'start' }, [{ type: 'setVariable', name: 'moves', op: 'set', amount: MOVES }]),
    rule({ type: 'variable', name: 'score', op: '>=', value: GOAL_POINTS }, [{ type: 'playSound', sound: 'win' }, { type: 'shake', strength: 6 }, { type: 'wait', seconds: 1.2 }, { type: 'goToScene', scene: screen.win }]),
    // Out of moves: the last pieces settle first, then it is over unless the goal was reached.
    {
      ...rule({ type: 'variable', name: 'moves', op: '<=', value: 0 }, [{ type: 'wait', seconds: 2 }, { type: 'playSound', sound: 'lose' }, { type: 'goToScene', scene: screen.over }]),
      condition: { name: 'score', op: '<', value: GOAL_POINTS },
    },
  );
  // In the gap between the goal and the board (lower down it covered the board's top row).
  p = await banner(p, sceneId, `${GOAL_POINTS} points in ${MOVES} moves!`, 282 / H);
  p = await part(p, sceneId, 'pause-menu');
  return {
    project: p,
    select: null,
    note: `بازی معمایی کامل ساخته شد: صفحه‌ی مهره‌ها در قاب طلایی، ${MOVES} حرکت برای رسیدن به ${GOAL_POINTS} امتیاز، نوار پیشرفت، و صفحه‌ی برد و باخت. روی یک مهره و بعد روی مهره‌ی کناری‌اش بزن تا جا عوض کنند. عدد هدف و حرکت‌ها در قانون‌ها هستند.`,
  };
}

// ── Physics: "Rock Smash" ──────────────────────────────────────────────────

export async function buildPhysics(project: GameProject, sceneId: string): Promise<GameResult> {
  const { width: W, height: H } = project.meta;
  const TARGET = 'هدف';
  const SHOTS = 5;
  let p = withNumber(withVariable(project, 'score'), 'shots', SHOTS);
  p = updateScene(p, sceneId, (s) => ({ ...s, width: Math.max(s.width, W), height: Math.max(s.height, H), gravity: 2400, sky: 'sunset', music: 'music:happy', bloom: true }));
  const pics: Record<string, string> = {};
  for (const id of ['ground', 'slingshot', 'rock', 'crate', 'alien', 'glass-block', 'stone-block', 'steel-beam', 'tnt']) {
    const made = await art(p, id);
    p = made.project;
    pics[id] = made.asset;
  }
  const TNT = 'انفجاری';
  const top = H - 150;
  const objects: GameObject[] = [
    makeObject('زمین', { kind: 'image', asset: pics.ground, repeat: 'x' }, W, 150, { x: W / 2, y: H - 75 }, { tags: [GROUND], locked: true }),
  ];
  // The slingshot, and the stone waiting in its fork; it comes back after each throw.
  const from = { x: Math.round(W * 0.16), y: top - 192 };
  objects.push(makeObject('تیرکمان', { kind: 'image', asset: pics.slingshot }, 150, 240, { x: from.x, y: top - 120 }, { locked: true }));
  const rock = makeObject('سنگ', { kind: 'image', asset: pics.rock }, 70, 70, from, {
    tags: [THROWN], round: true, behaviors: [physics({ drag: 'sling', power: 8, reload: true, material: 'stone', weight: 2 })],
  });
  // A fortress of real materials: stone at the foot of two towers, wooden crates above, a glass column in the
  // middle that shatters, a steel beam across the top, and an explosive barrel tucked inside.
  const C = 80;
  const x = (share: number) => Math.round(W * share);
  const block = (name: string, pic: string, cx: number, row: number, material: 'wood' | 'stone' | 'glass') =>
    makeObject(name, { kind: 'image', asset: pics[pic] }, C, C, { x: cx, y: top - C * row - C / 2 }, {
      tags: [CRATE], behaviors: [physics({ material, ...(material === 'glass' ? { breaks: 380 } : {}) })],
    });
  for (const [i, cx] of [x(0.5), x(0.92)].entries()) {
    objects.push(block(`سنگ پایه ${i + 1}`, 'stone-block', cx, 0, 'stone'), block(`جعبه ${i * 2 + 1}`, 'crate', cx, 1, 'wood'), block(`جعبه ${i * 2 + 2}`, 'crate', cx, 2, 'wood'));
  }
  objects.push(...[0, 1, 2].map((row) => block(`شیشه ${row + 1}`, 'glass-block', x(0.71), row, 'glass')));
  const span = x(0.92) - x(0.5) + C + 20;
  objects.push(makeObject('تیرآهن', { kind: 'image', asset: pics['steel-beam'] }, span, 34, { x: (x(0.5) + x(0.92)) / 2, y: top - 3 * C - 17 }, {
    tags: [CRATE], behaviors: [physics({ material: 'metal', weight: 1.5 })],
  }));
  // The barrel stands on the beam, in the middle: the shot to aim for, since its blast throws out the hidden aliens.
  const onBeamFloor = top - 3 * C - 34;
  objects.push(makeObject('بشکه‌ی انفجاری', { kind: 'image', asset: pics.tnt }, 62, 76, { x: x(0.71), y: onBeamFloor - 38 }, {
    tags: [TNT, CRATE], behaviors: [physics({ material: 'metal', weight: 1, shape: 'outline' })],
  }));
  const alienAt = (name: string, ax: number, ay: number) =>
    makeObject(name, { kind: 'image', asset: pics.alien }, 62, 62, { x: ax, y: ay }, { tags: [TARGET], round: true, behaviors: [physics({ weight: 0.5, material: 'rubber' })] });
  const onBeam = top - 3 * C - 34 - 31;
  objects.push(
    alienAt('موجود ۱', x(0.5), onBeam), alienAt('موجود ۲', x(0.92), onBeam),
    // Two hide inside, each side of the glass, on low stone steps (on the ground they would be out at once).
    ...[Math.round((x(0.5) + x(0.71)) / 2), Math.round((x(0.71) + x(0.92)) / 2)].flatMap((hx, i) => [
      makeObject(`پله‌ی سنگی ${i + 1}`, { kind: 'image', asset: pics['stone-block'] }, 64, 30, { x: hx, y: top - 15 }, { tags: [CRATE], behaviors: [physics({ material: 'stone' })] }),
      alienAt(`موجود ${i + 3}`, hx, top - 30 - 31),
    ]),
    rock,
  );
  p = addAll(p, sceneId, objects);
  const screen = await screens(p, sceneId, { name: 'ROCK SMASH', hero: 'alien', sky: 'sunset', music: 'music:happy' });
  p = screen.project;
  const pop: Action[] = [
    { type: 'burst', target: 'first', color: '#8be04e', count: 22 },
    { type: 'floatText', target: 'first', text: '+30', color: '#b6f36a', size: 52 },
    { type: 'destroy', target: 'first' },
    { type: 'setVariable', name: 'score', op: 'add', amount: 30 },
    { type: 'playSound', sound: 'pop' },
    { type: 'shake', strength: 5 },
    // A tiny freeze on every pop, so it lands with weight.
    { type: 'slowMotion', amount: 0, seconds: 0.06 },
  ];
  const boom: Action[] = [
    { type: 'blast', at: 'first', strength: 3200, radius: 460 },
    { type: 'burst', target: 'first', color: '#ff9f1c', count: 40 },
    { type: 'playSound', sound: 'boom' },
    { type: 'shake', strength: 18 },
    { type: 'shockwave', at: 'first', size: 560 },
    { type: 'achieve', name: 'Demolition' },
    { type: 'zoomPunch', amount: 1.12, seconds: 0.45 },
    { type: 'destroy', target: 'first' },
    { type: 'slowMotion', amount: 0.35, seconds: 0.6 },
  ];
  p = withRules(p, sceneId,
    rule({ type: 'start' }, [{ type: 'setVariable', name: 'shots', op: 'set', amount: SHOTS }]),
    rule({ type: 'thrown', target: byTag(THROWN) }, [{ type: 'setVariable', name: 'shots', op: 'subtract', amount: 1 }, { type: 'playSound', sound: 'jump' }]),
    // The barrel goes off when the stone or anything falling hits it hard.
    rule({ type: 'hit', a: byTag(TNT), b: byTag(THROWN), speed: 200 }, boom),
    rule({ type: 'hit', a: byTag(TNT), b: byTag(CRATE), speed: 260 }, boom),
    // An alien is out when the stone or a falling block hits it hard, or when it tumbles to the ground.
    rule({ type: 'hit', a: byTag(TARGET), b: byTag(THROWN), speed: 150 }, pop),
    rule({ type: 'hit', a: byTag(TARGET), b: byTag(CRATE), speed: 300 }, pop),
    rule({ type: 'touch', a: byTag(TARGET), b: byTag(GROUND) }, pop),
    // All out: points for every stone left, and the last moment in slow motion. Out of stones with aliens standing: over, once things have settled.
    rule({ type: 'noneLeft', target: byTag(TARGET) }, [
      { type: 'slowMotion', amount: 0.3, seconds: 1.2 },
      { type: 'setVariable', name: 'score', op: 'add', amount: { variable: 'shots' } },
      { type: 'playSound', sound: 'win' }, { type: 'wait', seconds: 1.5 }, { type: 'goToScene', scene: screen.win },
    ]),
    rule({ type: 'variable', name: 'shots', op: '<=', value: 0 }, [{ type: 'wait', seconds: 5 }, { type: 'playSound', sound: 'lose' }, { type: 'goToScene', scene: screen.over }]),
  );
  const rocks = await badge(p, 'rock', 'سنگ‌ها', '{shots}', { x: W * 0.6, y: 80 }, { w: 200, h: 80 });
  const points = await badge(rocks.project, 'coin', 'امتیاز', '{score}', { x: W * 0.25, y: 80 }, { w: 220, h: 80 });
  p = addAll(points.project, sceneId, [...rocks.objects, ...points.objects]);
  p = await banner(p, sceneId, 'Pull back the rock and let go!');
  p = await part(p, sceneId, 'pause-menu');
  return {
    project: p,
    select: rock.id,
    note: `بازی فیزیکی کامل ساخته شد: تیرکمان با ${SHOTS} سنگ و یک قلعه از جنس‌های واقعی: پایه‌ی سنگی، جعبه‌ی چوبی، ستون شیشه‌ای که می‌شکند، تیرآهن روی آن و یک بشکه‌ی انفجاری وسطش. چهار موجود فضایی، دوتا پنهان در داخل که فقط انفجار بشکه بیرونشان می‌اندازد. سنگ را عقب بکش و رها کن.`,
  };
}

/** A rescue from a cliff to a space relay, then across a ridge and a harbour. */
async function buildRescue(project: GameProject, first: string): Promise<GameResult> {
  const { width: W, height: H } = project.meta;
  const orbit = scene('Orbital relay', W, H, 'space', 'music:calm', { gravity: 0 });
  const trail = scene('Mountain trail', W, H, 'forest', 'music:happy', { weather: 'leaves' });
  const ridge = scene('Rescue ridge', W, H, 'desert', 'music:happy', { dayLength: 16 });
  const harbor = scene('Harbor crossing', W, H, 'night', 'music:tense', { weather: 'storm' });
  const clockwork = scene('Clockwork lift', W, H, 'night', 'music:mystery', { gravity: 1600 });
  let p = updateScene(project, first, sc => ({ ...sc, name: 'Cliff rescue', width: Math.max(W, sc.width), height: Math.max(H, sc.height), gravity: 1600, sky: 'sunset', music: 'music:happy' }));
  p = { ...p, scenes: [...p.scenes, orbit, trail, ridge, harbor, clockwork] };
  const menu = await screens(p, first, { name: 'RESCUE RELAY', hero: 'hero', sky: 'forest', music: 'music:happy' });
  p = menu.project;
  function checkpoint(id: string, player: string, goal: GameObject, next: string) {
    // A foot can bounce back into contact while the screen fades. Each destination awards its points once.
    goal.values = { ...goal.values, claimed: 0 };
    const arrived = rule({ type: 'touch', a: byId(player), b: byId(goal.id) }, [
      { type: 'setValue', target: 'second', name: 'claimed', op: 'set', amount: 1 },
      { type: 'setVariable', name: 'score', op: 'add', amount: 100 }, { type: 'playSound', sound: 'win' }, { type: 'goToScene', scene: next },
    ]);
    arrived.condition = { of: 'second', name: 'claimed', op: '==', value: 0 };
    p = withRules(addAll(p, id, [goal]), id, arrived);
  }
  const add = async (id: string, recipe: string, x: number, y: number) => {
    const result = await RECIPES.find(r => r.id === recipe)!.apply(p, id, { x, y });
    p = result.project;
    return result.select!;
  };
  const rig = addRescueRig(p, first, W / 2, H * 0.26);
  p = rig.project;
  const pad = makeObject('تشک نجات', { kind: 'rect', color: '#39b9a3', radius: 18, shade: true }, W * 0.62, 42, { x: W / 2, y: H * 0.81 }, { behaviors: [physics({ kind: 'still' })] });
  checkpoint(first, rig.boot, pad, orbit.id);
  p = await banner(p, first, 'Tap the gold hook to lower the rescuer', 0.13);
  const radius = Math.min(W, H) * 0.45, distance = radius * 0.64, cx = W / 2, cy = H * 0.55;
  const strength = 900;
  const field = makeObject('میدان سیاره', { kind: 'ellipse', color: '#637cc0' }, 2 * radius, 2 * radius, { x: cx, y: cy },
    { opacity: 0.15, visible: false, behaviors: [{ type: 'field', kind: 'planet', strength, direction: 0 }] });
  const globe = makeObject('سیاره', { kind: 'ellipse', color: '#6994cb', shade: true, outline: '#24538c' }, radius * 0.56, radius * 0.56, { x: cx, y: cy }, { glow: '#508dd6' });
  const probe = await picture(p, 'space-ship', 'کاوشگر', 54, 62, { x: cx - distance, y: cy }, { behaviors: [physics({ gravity: false, edges: false })] });
  const relay = await picture(probe.project, 'star', 'ایستگاه مداری', 70, 70, { x: cx, y: cy - distance }, { glow: '#ffe188' });
  p = addAll(relay.project, orbit.id, [field, globe, probe.object]);
  const speed = Math.sqrt(strength * (radius / 2) ** 2 / distance);
  p = withRules(p, orbit.id, rule({ type: 'tapObject', target: byId(probe.object.id) }, [
    { type: 'show', target: byId(field.id) }, { type: 'push', target: byId(probe.object.id), vx: 0, vy: -speed },
  ]));
  checkpoint(orbit.id, probe.object.id, relay.object, trail.id);
  p = await banner(p, orbit.id, 'Tap the ship to orbit into the relay');
  for (const [stage, vehicle, next] of [[trail, 'bike', ridge.id], [ridge, 'tank', harbor.id], [harbor, 'boat', clockwork.id]] as const) {
    const water = vehicle === 'boat';
    const top = H * 0.7;
    if (!water) p = addAll(p, stage.id, [makeObject('مسیر ترسیمی', { kind: 'terrain', color: vehicle === 'bike' ? '#4b8061' : '#ae7145',
      heights: vehicle === 'bike' ? [0.25, 0.25, 0.25, 0.13, 0.06, 0.18, 0.32, 0.26, 0.24] : [0.32, 0.32, 0.32, 0.19, 0.28, 0.15, 0.25, 0.32, 0.32] },
      W, H - top, { x: W / 2, y: (H + top) / 2 }, { tags: [GROUND] })]);
    if (vehicle === 'bike') {
      // Scenery along the trail, behind the bike: it touches nothing.
      const surface = top + (H - top) * 0.25 - 4;
      const scenery: [string, number, number, number][] = [['signpost', 0.08, 110, 126], ['flower-bush', 0.3, 150, 84], ['oak-tree', 0.62, 170, 226], ['toadstool', 0.92, 70, 78]];
      for (const [sprite, share, w, h] of scenery) {
        const made = await picture(p, sprite, sprite, w, h, { x: W * share, y: surface - h / 2 + 6 }, { locked: true });
        p = addAll(made.project, stage.id, [made.object]);
      }
    }
    const driver = await add(stage.id, vehicle, Math.max(108, W * 0.18), top);
    if (vehicle === 'tank') {
      // Night falls on the ridge: the crawler lights its own way.
      p = updateScene(p, stage.id, (sc) => ({ ...sc, objects: sc.objects.map((o) => (o.id === driver ? { ...o, behaviors: [...o.behaviors, { type: 'light', radius: 340, color: '#fff2c0', flicker: false }] } : o)) }));
    }
    const goal = await picture(p, 'star', 'نشان مقصد', 63, 72, { x: W - 68, y: water ? top : top + (H - top) * (vehicle === 'bike' ? 0.24 : 0.32) - 53 }, { glow: '#ffca43' });
    p = goal.project;
    checkpoint(stage.id, driver, goal.object, next);
    p = await banner(p, stage.id, water ? 'Hold right to reach the harbor' : vehicle === 'bike' ? 'Ride right to the ridge' : 'Drive the rescue crawler to the star');
  }
  // The last leg: wind a geared lift until the pod reaches the zone where gravity points up, and it falls to the star.
  const lift = await addClockwork(p, clockwork.id, W * 0.2, H * 0.74);
  p = lift.project;
  const zoneBottom = lift.rackTop - 66 - 290;
  const zone = makeObject('منطقه‌ی جاذبه‌ی وارونه', { kind: 'rect', color: '#8f6cff', radius: 0 }, W * 0.5, zoneBottom, { x: lift.rackX, y: zoneBottom / 2 },
    { opacity: 0.22, behaviors: [{ type: 'field', kind: 'gravity', direction: -90, strength: 2400 }, { type: 'particles', preset: 'sparkle', color: '#d6c8ff', rate: 14, size: 12, speed: 0.6 }] });
  const sign = makeObject('نوشته‌ی جاذبه', { kind: 'text', text: 'GRAVITY ↑', color: '#e4dcff', size: 34, weight: 'bold', outline: '#2a1a5e', shadow: true }, 0, 0, { x: lift.rackX, y: zoneBottom - 34 });
  p = addAll(p, clockwork.id, [zone, sign]);
  const top = await picture(p, 'star', 'ستاره‌ی بالای برج', 90, 90, { x: lift.rackX, y: 110 }, { glow: '#ffca43' });
  p = top.project;
  checkpoint(clockwork.id, lift.pod, top.object, menu.win);
  p = await banner(p, clockwork.id, 'Hold right to wind the lift', 0.5);
  for (const id of [first, orbit.id, trail.id, ridge.id, harbor.id, clockwork.id]) {
    const retry = await picture(p, 'btn-restart', 'شروع دوباره‌ی این مرحله', 64, 64, { x: W - 47, y: 47 }, { fixed: true });
    p = withRules(addAll(retry.project, id, [retry.object]), id, rule({ type: 'tapObject', target: byId(retry.object.id) }, [{ type: 'restartScene' }]));
  }
  // Parts made for scenes with ground (the rescuer's limbs) also come to scenes without any: there the group
  // to stand on is left empty instead of naming one that is not there (which the game check would point out).
  p = { ...p, scenes: p.scenes.map((s) => {
    const tags = new Set(s.objects.flatMap((o) => o.tags));
    const fix = (o: GameObject): GameObject => ({ ...o, behaviors: o.behaviors.map((b) => (b.type === 'physics' && b.solidTag && !tags.has(b.solidTag) ? { ...b, solidTag: '' } : b)) });
    return { ...s, objects: s.objects.map(fix), prefabs: s.prefabs.map(fix) };
  }) };
  return { project: p, select: rig.select, note: 'مسیر امداد آماده است. قلاب را آزاد کن، کاوشگر را به مدار بفرست، با سه وسیله تا بندر بران و در آخر با چرخ‌دنده‌ها کپسول را به منطقه‌ی جاذبه‌ی وارونه برسان.' };
}

/**
 * Tower Climb: a tall tower in the rain, floor above floor. Each floor is
 * reached by a ladder that comes up through a gap; slimes patrol two of the
 * floors; coins line the way; the bell at the top wins. The hero has every
 * special move: wall jump, dash, ground pound and climbing.
 */
export async function buildTower(project: GameProject, sceneId: string): Promise<GameResult> {
  const { width: W, height: H } = project.meta;
  const LADDER = 'نردبان';
  const FLOORS = 4;
  const STOREY = 560;
  // The ground is thick: the first floor stands above the buttons along the bottom of the screen, not behind them.
  const BASE = 340;
  const height = 120 + FLOORS * STOREY + H * 0.4 + (BASE - 80);
  let p = withNumber(withNumber(withVariable(project, 'score'), 'lives', 3), 'hurt', 0);
  p = updateScene(p, sceneId, (s) => ({ ...s, width: W, height: Math.round(height), gravity: 2400, sky: 'city', weather: 'rain', music: 'music:adventure', vignette: true }));
  const ground = Math.round(height) - BASE;
  const floorTop = (k: number) => ground - k * STOREY;
  // The gap each floor's ladder comes up through: on the right for odd floors, the left for even.
  const gap = (k: number) => (k % 2 ? { x0: W - 200, x1: W - 60 } : { x0: 60, x1: 200 });
  const objects: GameObject[] = [];
  const stone = { kind: 'rect' as const, color: '#6b5b4e', radius: 8, shade: true };
  objects.push(makeObject('زمین برج', stone, W, BASE, { x: W / 2, y: ground + BASE / 2 }, { tags: [GROUND], locked: true }));
  for (let k = 1; k <= FLOORS; k++) {
    const { x0, x1 } = gap(k);
    const y = floorTop(k) + 20;
    if (x0 > 0) objects.push(makeObject(`طبقه ${k} چپ`, stone, x0, 40, { x: x0 / 2, y }, { tags: [GROUND], locked: true }));
    objects.push(makeObject(`طبقه ${k} راست`, stone, W - x1, 40, { x: (x1 + W) / 2, y }, { tags: [GROUND], locked: true }));
  }
  const ladder = await art(p, 'ladder');
  const coin = await art(ladder.project, 'coin');
  const slime = await art(coin.project, 'slime');
  const bell = await art(slime.project, 'trophy');
  p = bell.project;
  for (let k = 1; k <= FLOORS; k++) {
    const { x0, x1 } = gap(k);
    // From the floor below up past this floor's top, so the hero can step off onto it.
    const top = floorTop(k) - 40;
    const bottom = floorTop(k - 1);
    objects.push(makeObject(`نردبان ${k}`, { kind: 'image', asset: ladder.asset }, 100, bottom - top, { x: (x0 + x1) / 2, y: (top + bottom) / 2 }, { tags: [LADDER], locked: true }));
    // A row of coins on the way to the next ladder.
    for (let c = 0; c < 4; c++) {
      const cx = k % 2 ? W - 260 - c * 110 : 260 + c * 110;
      // None where the hero starts: it was picked up unseen during the opening film (the score began at 1).
      if (k === 1 && Math.abs(cx - W / 2) < 70) continue;
      objects.push(makeObject(`سکه ${k}-${c + 1}`, { kind: 'image', asset: coin.asset }, 48, 48, { x: cx, y: floorTop(k - 1) - 60 }, { tags: [COIN], behaviors: [{ type: 'pulse', amount: 0.1, seconds: 0.8 }] }));
    }
  }
  for (const k of [1, 2]) {
    objects.push(makeObject(`لجن طبقه ${k}`, { kind: 'image', asset: slime.asset }, 90, 64, { x: W / 2, y: floorTop(k) - 32 }, {
      tags: [ENEMY, DANGER], hitboxInset: 6, behaviors: [{ type: 'patrol', axis: 'x', distance: 100, speed: 80 }],
    }));
  }
  const goalX = gap(FLOORS).x0 > 100 ? 140 : W - 140;
  objects.push(makeObject('زنگ بالای برج', { kind: 'image', asset: bell.asset }, 110, 110, { x: goalX, y: floorTop(FLOORS) - 55 }, { tags: [GOAL], glow: '#ffd23f', behaviors: [{ type: 'particles', preset: 'stars', color: '#ffe066', rate: 3, size: 18, speed: 0.6 }, { type: 'animate', repeat: 'bounce', ease: 'smooth', keys: [{ t: 0, x: 0, y: 0, angle: -12, scale: 1, opacity: 1 }, { t: 1.1, x: 0, y: 0, angle: 12, scale: 1, opacity: 1 }] }] }));
  const hero = await character(p, 'hero');
  p = hero.project;
  const player = makeObject('قهرمان', hero.visual, 70, 90, { x: W / 2, y: ground - 45 }, {
    tags: [PLAYER], shadow: true, health: 1000, invincible: 1.3,
    behaviors: [
      { type: 'body', gravity: true, solidTag: GROUND, bounce: 0, edges: 'stop', oneWay: false },
      { type: 'jumper', jumpSpeed: 1050, maxJumps: 2, on: 'tap', buttonTag: '' },
      { type: 'moves', wallJump: true, dash: true, dashTag: '', climbTag: LADDER, pound: true, poundTag: '', crouch: true },
      { type: 'camera', lock: 'free', smooth: 0.2 },
    ],
  });
  objects.push(player);
  p = addAll(p, sceneId, objects);
  const screen = await screens(p, sceneId, { name: 'TOWER CLIMB', hero: 'hero', sky: 'city', music: 'music:adventure' });
  p = screen.project;
  p = withRules(p, sceneId,
    prizeRule(COIN, 1, 'coin', '#ffd23f'),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(ENEMY), from: 'above' }, [
      { type: 'burst', target: 'second', color: '#8be04e', count: 18 },
      { type: 'floatText', target: 'second', text: '+5', color: '#c5f27a', size: 40 },
      { type: 'jump', target: 'first' },
      { type: 'setVariable', name: 'score', op: 'add', amount: 5 },
      { type: 'playSound', sound: 'pop' },
      // It crumbles away, and is gone once it has.
      { type: 'effect', target: 'second', kind: 'dissolve', seconds: 0.35 },
      { type: 'wait', seconds: 0.35 },
      { type: 'destroy', target: 'second' },
    ]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(ENEMY), from: 'side' }, [{ type: 'send', name: HURT }]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(GOAL) }, [
      { type: 'achieve', name: 'Bell ringer' },
      { type: 'burst', target: 'second', color: '#ffd23f', count: 40 },
      { type: 'shockwave', at: 'second', size: 500 },
      { type: 'playSound', sound: 'win' },
      { type: 'setVariable', name: 'score', op: 'add', amount: 25 },
      { type: 'wait', seconds: 1.2 },
      { type: 'goToScene', scene: screen.win },
    ]),
    // A little film first: the camera rises to the bell at the top, the hero speaks, and the camera comes back down.
    rule({ type: 'after', seconds: 0.3 }, [{ type: 'focus', target: byTag(GOAL), seconds: 3.2 }]),
    rule({ type: 'after', seconds: 1.6 }, [
      { type: 'say', speaker: 'Hero', text: 'Rain again... and the bell at the top of the tower is silent.', color: '#7fd0ff' },
      { type: 'say', speaker: 'Hero', text: 'Up the ladders, floor by floor. Jump on the slimes!', color: '#7fd0ff' },
    ]),
    ...lifeRules(screen.over),
  );
  p = await banner(p, sceneId, 'Climb to the bell!');
  p = await part(p, sceneId, 'score');
  p = await hearts(p, sceneId);
  p = await part(p, sceneId, 'pause-menu');
  p = await part(p, sceneId, 'controls');
  // The controls part adds left, right and jump; up the ladder is the jump button, down is its own button.
  const [DASH, DOWN] = ['دکمه‌ی تیز رفتن', 'دکمه‌ی پایین'];
  const dash = await picture(p, 'btn-dash', DASH, 120, 120, { x: W - 255, y: H - 110 }, { fixed: true, opacity: 0.85, tags: [DASH] });
  const down = await picture(dash.project, 'btn-down', DOWN, 120, 120, { x: W - 100, y: H - 265 }, { fixed: true, opacity: 0.85, tags: [DOWN] });
  p = addAll(down.project, sceneId, [dash.object, down.object]);
  p = updateScene(p, sceneId, (sc) => ({ ...sc, objects: sc.objects.map((o) => (o.id === player.id
    ? { ...o, behaviors: o.behaviors.map((b) => (b.type === 'moves' ? { ...b, dashTag: DASH, poundTag: DOWN } : b)) }
    : o)) }));
  return {
    project: p,
    select: player.id,
    note: 'بازی برج ساخته شد: چهار طبقه در باران، هر طبقه با یک نردبان، سکه، لجن، و زنگ طلایی بالای برج. قهرمان از نردبان بالا می‌رود (دکمه‌ی پرش)، از دیوار می‌پرد، تیز می‌رود و به زمین می‌کوبد.',
  };
}

/** Brick Blitz: a paddle that follows the finger, a ball, and a wall of bricks; clear them all, three balls to do it. */
export async function buildBricks(project: GameProject, sceneId: string): Promise<GameResult> {
  const { width: W, height: H } = project.meta;
  const WALL = 'دیوار';
  const BRICK = 'آجر';
  const BALL = 'توپ';
  const PADDLE = 'راکت';
  const DROP = 'افتادن';
  let p = withNumber(withVariable(project, 'score'), 'lives', 3);
  p = updateScene(p, sceneId, (s) => ({ ...s, width: W, height: H, gravity: 0, sky: 'space', music: 'music:orbit', bloom: true, vignette: true, retro: 'none' }));
  const objects: GameObject[] = [];
  const wall = (name: string, w: number, h: number, x: number, y: number) =>
    makeObject(name, { kind: 'rect', color: '#3a4a6b', shade: true }, w, h, { x, y }, { tags: [WALL], locked: true, behaviors: [physics({ kind: 'still', solidTag: '', bounce: 1, friction: 0 })] });
  objects.push(wall('دیوار چپ', 24, H, 12, H / 2), wall('دیوار راست', 24, H, W - 12, H / 2), wall('سقف', W, 24, W / 2, 132));
  objects.push(makeObject('زیر راکت', { kind: 'rect', color: '#000000' }, W, 40, { x: W / 2, y: H + 60 }, { tags: [DROP], opacity: 0 }));
  const colors = ['#ff5a5f', '#ff9f1c', '#ffd23f', '#43c463', '#2f9cf6', '#8f5ff0'];
  const cols = 7;
  const bw = (W - 80) / cols;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < cols; c++) {
      objects.push(makeObject(`آجر ${r + 1}-${c + 1}`, { kind: 'rect', color: colors[r], radius: 8, shade: true }, bw - 8, 40, { x: 40 + bw * c + bw / 2, y: 260 + r * 50 }, { tags: [BRICK, WALL], behaviors: [physics({ kind: 'still', solidTag: '', bounce: 1, friction: 0 })] }));
    }
  }
  const paddle = makeObject('راکت', { kind: 'rect', color: '#dfe8ff', radius: 18, shade: true, outline: '#6cf2ff' }, 180, 36, { x: W / 2, y: H - 230 }, {
    // Round ends: where the ball lands on the paddle decides the angle it leaves at.
    tags: [PADDLE, WALL], glow: '#6cf2ff', behaviors: [{ type: 'followFinger', speed: 2400, axis: 'x' }, physics({ kind: 'still', solidTag: '', bounce: 1, friction: 0, shape: 'capsule' })],
  });
  const ballPic = await art(p, 'ball');
  p = ballPic.project;
  const ball = makeObject('توپ', { kind: 'image', asset: ballPic.asset }, 40, 40, { x: W / 2, y: H - 300 }, {
    tags: [BALL], round: true, glow: '#ffffff',
    behaviors: [physics({ gravity: false, solidTag: '', bounce: 1, friction: 0, rotates: false, edges: false, slowdown: 0 }), { type: 'launch', vx: 260, vy: -620 }, { type: 'trail', color: '#9fd8ff', size: 18, rate: 30 }],
  });
  objects.push(paddle, ball);
  p = addAll(p, sceneId, objects);
  const screen = await screens(p, sceneId, { name: 'BRICK BLITZ', hero: 'hero', sky: 'space', music: 'music:orbit' });
  p = screen.project;
  p = withRules(p, sceneId,
    rule({ type: 'touch', a: byTag(BALL), b: byTag(BRICK) }, [
      { type: 'burst', target: 'second', color: '#ffd23f', count: 14 },
      { type: 'floatText', target: 'second', text: '+10', color: '#ffe066', size: 34 },
      { type: 'destroy', target: 'second' },
      { type: 'setVariable', name: 'score', op: 'add', amount: 10 },
      { type: 'playSound', sound: 'pop', volume: 60 },
    ]),
    // Where the ball meets the paddle decides where it goes: the edges send it out at a slant.
    rule({ type: 'touch', a: byTag(BALL), b: byTag(PADDLE) }, [{ type: 'playSound', sound: 'click', volume: 50 }, { type: 'flash', target: 'second', color: '#ffffff', seconds: 0.1 }]),
    rule({ type: 'touch', a: byTag(BALL), b: byTag(DROP) }, [
      { type: 'setVariable', name: 'lives', op: 'subtract', amount: 1 },
      { type: 'shake', strength: 10 },
      { type: 'playSound', sound: 'hit' },
      { type: 'respawn', target: 'first' },
      { type: 'push', target: 'first', vx: 260, vy: -620 },
    ]),
    rule({ type: 'variable', name: 'lives', op: '<=', value: 0 }, [{ type: 'playSound', sound: 'lose' }, { type: 'wait', seconds: 0.6 }, { type: 'goToScene', scene: screen.over }]),
    rule({ type: 'noneLeft', target: byTag(BRICK) }, [
      { type: 'achieve', name: 'Wall breaker' }, { type: 'slowMotion', amount: 0.3, seconds: 1 }, { type: 'playSound', sound: 'win' },
      { type: 'wait', seconds: 1.2 }, { type: 'goToScene', scene: screen.win },
    ]),
  );
  // Between the bricks and the paddle, not over the bricks.
  p = await banner(p, sceneId, 'Break every brick!', 0.62);
  const lives = await badge(p, 'heart', 'جان‌ها', '{lives}', { x: W * 0.72, y: 70 }, { w: 170, h: 80 });
  const points = await badge(lives.project, 'coin', 'امتیاز', '{score}', { x: W * 0.28, y: 70 }, { w: 220, h: 80 });
  p = addAll(points.project, sceneId, [...lives.objects, ...points.objects]);
  return { project: p, select: paddle.id, note: 'بازی آجرشکن ساخته شد: راکت دنبال انگشت می‌آید، توپ به دیوارها و آجرها می‌خورد و برمی‌گردد. همه‌ی آجرها را بشکن؛ سه توپ داری.' };
}

/** Rooftop Run: the hero runs by itself across the rooftops; tap to jump over the gaps and crates, to the flag. */
export async function buildRunner(project: GameProject, sceneId: string): Promise<GameResult> {
  const { width: W, height: H } = project.meta;
  const LENGTH = W * 9;
  let p = withNumber(withNumber(withVariable(project, 'score'), 'lives', 3), 'hurt', 0);
  p = updateScene(p, sceneId, (s) => ({ ...s, width: LENGTH, height: H, gravity: 2600, sky: 'city', music: 'music:happy', dayLength: 40 }));
  const top = H - 220;
  const objects: GameObject[] = [];
  const crate = await art(p, 'crate');
  const coin = await art(crate.project, 'coin');
  const lamp = await art(coin.project, 'lamp-post');
  const flag = await art(lamp.project, 'flag');
  p = flag.project;
  const roof = { kind: 'rect' as const, color: '#4a4f63', radius: 6, shade: true };
  // Rooftops with gaps between them; every gap a little wider than the last.
  let x = 0;
  let gapWidth = 140;
  let n = 0;
  while (x < LENGTH - 600) {
    const w = n === 0 ? W * 1.2 : 900 + (n % 3) * 160;
    objects.push(makeObject(`بام ${n + 1}`, roof, w, H - top, { x: x + w / 2, y: (top + H) / 2 }, { tags: [GROUND], locked: true }));
    // A street lamp on each roof, glowing; only to look at.
    objects.push(makeObject(`چراغ ${n + 1}`, { kind: 'image', asset: lamp.asset }, 60, 180, { x: x + w * 0.2, y: top - 90 }, { locked: true, glow: '#fff3b0' }));
    if (n > 0) {
      objects.push(makeObject(`جعبه ${n}`, { kind: 'image', asset: crate.asset }, 80, 80, { x: x + w * 0.55, y: top - 40 }, { tags: [GROUND] }));
      for (let c = 0; c < 3; c++) objects.push(makeObject(`سکه ${n}-${c + 1}`, { kind: 'image', asset: coin.asset }, 46, 46, { x: x + w * 0.55 - 60 + c * 60, y: top - 200 }, { tags: [COIN] }));
    }
    objects.push(makeObject(`چاله ${n + 1}`, { kind: 'rect', color: '#000000' }, gapWidth + 80, 40, { x: x + w + gapWidth / 2, y: H + 80 }, { tags: [PIT], opacity: 0 }));
    x += w + gapWidth;
    gapWidth = Math.min(260, gapWidth + 20);
    n += 1;
  }
  objects.push(makeObject('بام آخر', roof, LENGTH - x, H - top, { x: (x + LENGTH) / 2, y: (top + H) / 2 }, { tags: [GROUND], locked: true }));
  objects.push(makeObject('پرچم پایان', { kind: 'image', asset: flag.asset }, 90, 130, { x: LENGTH - 200, y: top - 65 }, { tags: [GOAL] }));
  const hero = await character(p, 'hero');
  p = hero.project;
  const player = makeObject('دونده', hero.visual, 80, 96, { x: 200, y: top - 48 }, {
    tags: [PLAYER], shadow: true,
    behaviors: [
      { type: 'body', gravity: true, solidTag: GROUND, bounce: 0, edges: 'none', oneWay: false },
      { type: 'walker', speed: 420, control: 'auto', leftTag: '', rightTag: '' },
      { type: 'jumper', jumpSpeed: 1150, maxJumps: 2, on: 'tap', buttonTag: '' },
      { type: 'camera', lock: 'free', smooth: 0.1 },
    ],
  });
  p = addAll(p, sceneId, [...objects, player]);
  const screen = await screens(p, sceneId, { name: 'ROOFTOP RUN', hero: 'hero', sky: 'city', music: 'music:happy' });
  p = screen.project;
  p = withRules(p, sceneId,
    prizeRule(COIN, 1, 'coin', '#ffd23f'),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(PIT) }, [
      { type: 'setVariable', name: 'lives', op: 'subtract', amount: 1 }, { type: 'playSound', sound: 'hit' }, { type: 'shake', strength: 8 }, { type: 'respawn', target: 'first' },
    ]),
    rule({ type: 'variable', name: 'lives', op: '<=', value: 0 }, [{ type: 'playSound', sound: 'lose' }, { type: 'wait', seconds: 0.6 }, { type: 'goToScene', scene: screen.over }]),
    rule({ type: 'every', seconds: 1 }, [{ type: 'setVariable', name: 'score', op: 'add', amount: 1 }]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(GOAL) }, [
      { type: 'achieve', name: 'Roof runner' }, { type: 'burst', target: 'second', color: '#ffd23f', count: 40 }, { type: 'playSound', sound: 'win' },
      { type: 'setVariable', name: 'score', op: 'add', amount: 25 }, { type: 'wait', seconds: 1 }, { type: 'goToScene', scene: screen.win },
    ]),
  );
  p = await banner(p, sceneId, 'Tap to jump! Tap twice to jump higher');
  p = await part(p, sceneId, 'score');
  p = await hearts(p, sceneId);
  return { project: p, select: player.id, note: 'بازی دونده ساخته شد: دونده خودش روی بام‌ها می‌دود؛ با لمس صفحه می‌پرد (دو بار برای پرش بلندتر). از روی شکاف‌ها و جعبه‌ها بپر تا به پرچم برسی. هر شکاف کمی پهن‌تر از قبلی است و شب و روز می‌شود.' };
}

/** Sky Hopper: a bird flies on by itself; each tap flaps it up; fly through the gaps between the pipes to the end. */
export async function buildHopper(project: GameProject, sceneId: string): Promise<GameResult> {
  const { width: W, height: H } = project.meta;
  const PIPES = 12;
  const SPACING = 520;
  const LENGTH = W + PIPES * SPACING + W;
  let p = withNumber(withNumber(withVariable(project, 'score'), 'lives', 3), 'hurt', 0);
  p = updateScene(p, sceneId, (s) => ({ ...s, width: LENGTH, height: H, gravity: 2000, sky: 'day', music: 'music:happy' }));
  const pipe = await art(p, 'pipe');
  const flag = await art(pipe.project, 'flag');
  p = flag.project;
  const objects: GameObject[] = [];
  const GAP = 420;
  for (let i = 0; i < PIPES; i++) {
    const x = W + i * SPACING;
    // Gaps wander up and down in a gentle wave, never too far from the last.
    const middle = H * 0.5 + Math.sin(i * 1.3) * H * 0.18;
    const upper = middle - GAP / 2;
    const lower = middle + GAP / 2;
    objects.push(makeObject(`لوله بالا ${i + 1}`, { kind: 'image', asset: pipe.asset }, 120, upper, { x, y: upper / 2 }, { tags: [DANGER], rotation: 180, locked: true }));
    objects.push(makeObject(`لوله پایین ${i + 1}`, { kind: 'image', asset: pipe.asset }, 120, H - lower, { x, y: (lower + H) / 2 }, { tags: [DANGER], locked: true }));
    // The pipe goes on up out of sight: on a tall phone more sky shows above the world, where a top pipe
    // ended in mid-air (and a bird could fly over it). Only its body, so the cap keeps its size.
    // (It reaches a little way down over the pipe, hiding the line where the pipe's picture ends.)
    objects.push(makeObject(`بدنه‌ی لوله ${i + 1}`, { kind: 'image', asset: pipe.asset, crop: { x: 0, y: 0.18, w: 1, h: 0.78 } }, 120, Math.round(H * 0.7) + 16, { x, y: 8 - Math.round(H * 0.35) }, { tags: [DANGER], rotation: 180, locked: true }));
    objects.push(makeObject(`دروازه ${i + 1}`, { kind: 'rect', color: '#ffffff' }, 20, GAP, { x: x + 80, y: middle }, { tags: [CHECK], opacity: 0 }));
  }
  objects.push(makeObject('پرچم پایان', { kind: 'image', asset: flag.asset }, 90, 130, { x: LENGTH - W / 2, y: H * 0.5 }, { tags: [GOAL] }));
  // The finish is the whole height of the sky at the flag, so a bird flying high or low still reaches it.
  objects.push(makeObject('خط پایان', { kind: 'rect', color: '#ffffff' }, 40, H, { x: LENGTH - W / 2, y: H / 2 }, { tags: [GOAL], opacity: 0 }));
  const bird = await character(p, 'bird');
  p = bird.project;
  const player = makeObject('پرنده', bird.visual, 90, 76, { x: 200, y: H * 0.45 }, {
    tags: [PLAYER], hitboxInset: 10,
    behaviors: [
      { type: 'body', gravity: true, solidTag: '', bounce: 0, edges: 'stop', oneWay: false },
      { type: 'walker', speed: 260, control: 'auto', leftTag: '', rightTag: '' },
      { type: 'jumper', jumpSpeed: 760, maxJumps: 999, on: 'tap', buttonTag: '' },
      { type: 'camera', lock: 'free', smooth: 0.1 },
    ],
  });
  objects.push(player);
  p = addAll(p, sceneId, objects);
  const screen = await screens(p, sceneId, { name: 'SKY HOPPER', hero: 'bird', sky: 'day', music: 'music:happy' });
  p = screen.project;
  p = withRules(p, sceneId,
    // Through a gap: a point. Into a pipe: a life, and back to the last gap passed.
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(CHECK) }, [
      { type: 'checkpoint', target: 'first' }, { type: 'floatText', target: 'first', text: '+1', color: '#ffe066', size: 36 },
      { type: 'setVariable', name: 'score', op: 'add', amount: 1 }, { type: 'playSound', sound: 'coin', volume: 50 }, { type: 'destroy', target: 'second' },
    ]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(DANGER) }, [
      { type: 'setVariable', name: 'lives', op: 'subtract', amount: 1 }, { type: 'playSound', sound: 'hit' }, { type: 'shake', strength: 10 },
      { type: 'respawn', target: 'first' }, { type: 'push', target: 'first', vx: 0, vy: -500 },
    ]),
    rule({ type: 'variable', name: 'lives', op: '<=', value: 0 }, [{ type: 'playSound', sound: 'lose' }, { type: 'wait', seconds: 0.6 }, { type: 'goToScene', scene: screen.over }]),
    rule({ type: 'touch', a: byTag(PLAYER), b: byTag(GOAL) }, [
      { type: 'achieve', name: 'High flyer' }, { type: 'burst', target: 'second', color: '#ffd23f', count: 40 }, { type: 'playSound', sound: 'win' },
      { type: 'setVariable', name: 'score', op: 'add', amount: 10 }, { type: 'wait', seconds: 1 }, { type: 'goToScene', scene: screen.win },
    ]),
  );
  p = await banner(p, sceneId, 'Tap to flap!');
  p = await part(p, sceneId, 'score');
  p = await hearts(p, sceneId);
  return { project: p, select: player.id, note: 'بازی پرنده ساخته شد: پرنده خودش جلو می‌رود؛ با هر لمس بال می‌زند و بالا می‌رود. از شکاف بین لوله‌ها رد شو تا به پرچم برسی؛ هر شکاف یک امتیاز است.' };
}

/** The genre helper's games, by genre id. Genres without one here still use the helper's simpler start. */
export const GAMES: Record<string, (project: GameProject, sceneId: string) => Promise<GameResult>> = {
  platform: buildPlatformer,
  adventure: buildAdventure,
  shooter: buildShooter,
  puzzle: buildPuzzle,
  physics: buildPhysics,
  rescue: buildRescue,
  tower: buildTower,
  bricks: buildBricks,
  runner: buildRunner,
  hopper: buildHopper,
};
