import type { Action, GameObject, GameProject, ImageVisual, Rule, Scene, TextVisual } from '../format/types';
import { packCharacter, packPicture, packSound, packTrimmed } from './packs/kenney';
import { byId, rule } from './recipes';
import { makeObject, newId, updateScene } from './state';
import playRound from './packs/kenney-ui/green_button_round_depth_gloss.png?url';
import yellowRound from './packs/kenney-ui/yellow_button_round_depth_gloss.png?url';
import greyRound from './packs/kenney-ui/grey_button_round_depth_gloss.png?url';
import yellowWide from './packs/kenney-ui/yellow_button_rectangle_depth_gloss.png?url';
import greenWide from './packs/kenney-ui/green_button_rectangle_depth_gloss.png?url';
import greyPanel from './packs/kenney-ui/grey_button_square_flat.png?url';
import star from './packs/kenney-ui/yellow_star.png?url';
import starEmpty from './packs/kenney-ui/yellow_star_outline_depth.png?url';
import track from './packs/kenney-ui/yellow_slide_horizontal_color.png?url';
import knob from './packs/kenney-ui/yellow_slide_hangle.png?url';
import iconPlay from './packs/kenney-ui/extra_icon_play_light.png?url';
import iconRepeat from './packs/kenney-ui/extra_icon_repeat_light.png?url';
import arrowLeft from './packs/kenney-ui/yellow_arrow_basic_w.png?url';
import arrowRight from './packs/kenney-ui/yellow_arrow_basic_e.png?url';
import arrowUp from './packs/kenney-ui/yellow_arrow_basic_n.png?url';
import arrowDown from './packs/kenney-ui/yellow_arrow_basic_s.png?url';

/**
 * The flagship game's own screens and HUD (flagship Phase D): Kenney's UI Pack (CC0) and the Kenney Future font,
 * nine-slice panels and buttons, anchors that fit every phone shape, menus that pop and slide in, and sliders for
 * the sounds and the music. Only the flagship (Sky Quest) uses this; the other genre games keep the library's look.
 */

const UI = { playRound, yellowRound, greyRound, yellowWide, greenWide, greyPanel, star, starEmpty, track, knob, iconPlay, iconRepeat, arrowLeft, arrowRight, arrowUp, arrowDown };
type UiName = keyof typeof UI;

/** The UI Pack's pictures, put into the project once each, under keys of their own. */
function uiPictures(project: GameProject): GameProject {
  const assets = { ...project.assets };
  for (const [name, src] of Object.entries(UI)) assets[`kenney-ui-${name}`] ??= { type: 'image', src };
  return { ...project, assets };
}
const ui = (name: UiName, extra: Partial<ImageVisual> = {}): ImageVisual => ({ kind: 'image', asset: `kenney-ui-${name}`, ...extra });
/** Nine-slice: the UI Pack's double-size pictures have corners about 24 px round. */
const NINE = { left: 26, top: 26, right: 26, bottom: 30 };

const INK = '#4a3300';
const words = (name: string, text: string, size: number, x: number, y: number, extra: Partial<GameObject> = {}, look: Partial<TextVisual> = {}): GameObject =>
  makeObject(name, { kind: 'text', text, color: INK, size, weight: 'bold', font: 'Kenney Future', ...look }, 0, 0, { x, y }, { fixed: true, ...extra });
const heading = (name: string, text: string, size: number, x: number, y: number, extra: Partial<GameObject> = {}) =>
  words(name, text, size, x, y, { anchor: 'top', enter: { kind: 'from-top', seconds: 0.55 }, ...extra }, { color: '#ffd23f', outline: '#5a2a00', shadow: true });

/** A scene with the flagship's sky: Kenney's sky colour, clouds and hills. */
async function skyScene(project: GameProject, name: string, music: string): Promise<{ project: GameProject; scene: Scene }> {
  const { width: W, height: H } = project.meta;
  const clouds = await packPicture(project, 'backgrounds', 'background_clouds');
  const hills = await packPicture(clouds.project, 'backgrounds', 'background_color_hills');
  const scene: Scene = {
    id: newId('scene'), name, width: W, height: H, background: '#c8e6f5', music, gravity: 2400, sky: 'none', prefabs: [], rules: [],
    objects: [
      // The hills' sky-coloured top covers the white foot of the clouds.
      makeObject('ابرها', { ...clouds.visual, repeat: 'x' }, W, H * 0.36, { x: W / 2, y: H * 0.18 }, { locked: true, opacity: 0.95 }),
      makeObject('تپه‌ها', { ...hills.visual, repeat: 'x' }, W, H * 0.9, { x: W / 2, y: H * 0.68 }, { locked: true }),
    ],
  };
  return { project: hills.project, scene };
}

/** A button: a nine-slice picture with words on it, both fixed to the screen, coming in together. */
function button(name: string, picture: UiName, text: string, width: number, height: number, x: number, y: number, extra: Partial<GameObject> = {}) {
  const back = makeObject(name, ui(picture, { slice: NINE }), width, height, { x, y }, { fixed: true, ...extra });
  const label = words(`نوشته‌ی ${name}`, text, Math.round(height * 0.36), x, y - height * 0.2, { enter: extra.enter, anchor: extra.anchor });
  return [back, label];
}

/**
 * The start, win and game-over screens of the flagship, made of the UI kit. Same shape and rules as the genre
 * helper's own screens (screens() in games.ts): Play and "play again" start a fresh game, the menu goes back.
 */
export async function flagshipScreens(project: GameProject, levelIds: string[], name: string) {
  const { width: W, height: H } = project.meta;
  let p = uiPictures(project);
  const click = await packSound(p, 'select');
  p = click.project;
  const N = levelIds.length;
  const go = (k: number): Action[] => [{ type: 'playSound', sound: click.key }, { type: 'resetVariables' }, { type: 'goToScene', scene: levelIds[k - 1] }];
  const when = (k: number) => ({ name: 'level', op: '==' as const, value: k });
  const PANEL = { left: 24, top: 24, right: 24, bottom: 24 };

  // Start: the name, the hero bobbing, a big green Play button (the first level), the levels, and the sound and
  // music sliders.
  const s = await skyScene(p, 'Start', 'music:happy');
  p = s.project;
  const start = s.scene;
  const hero = await packCharacter(p, 'characters', 'character_beige');
  p = hero.project;
  const play = makeObject('دکمه‌ی شروع', ui('playRound'), 220, 220, { x: W / 2, y: H * 0.6 }, { fixed: true, enter: { kind: 'pop', delay: 0.1 }, behaviors: [{ type: 'pulse', amount: 0.05, seconds: 1.1 }] });
  const levelsButton = button('دکمه‌ی مرحله‌ها', 'yellowWide', 'Levels', 300, 90, W / 2, H * 0.725, { enter: { kind: 'pop', delay: 0.2 } });
  const [TRACK_FX, TRACK_MUSIC] = ['ریل صدا', 'ریل موسیقی'];
  const panelY = H * 0.865;
  start.objects.push(
    heading('نام بازی', name.toUpperCase(), 96, W / 2, H * 0.11),
    words('زیرعنوان', 'Tap play to start', 34, W / 2, H * 0.2, { anchor: 'top', enter: { kind: 'fade', delay: 0.3 } }, { color: '#ffffff', outline: '#1b3a4b' }),
    makeObject('قهرمان', { ...hero.visual, frames: undefined }, 160, 190, { x: W / 2, y: H * 0.38 }, { fixed: true, enter: { kind: 'pop', delay: 0.05 }, behaviors: [{ type: 'wave', axis: 'y', distance: 16, seconds: 2 }] }),
    play,
    makeObject('نشان شروع', ui('iconPlay'), 96, 96, { x: W / 2 + 8, y: H * 0.6 - 8 }, { fixed: true, enter: { kind: 'pop', delay: 0.1 } }),
    ...levelsButton,
    // Settings: a panel low on the screen with two sliders.
    makeObject('پنل تنظیمات', ui('greyPanel', { slice: PANEL }), 560, 200, { x: W / 2, y: panelY }, { fixed: true, anchor: 'bottom', enter: { kind: 'from-bottom', delay: 0.2 } }),
    words('نوشته‌ی صدا', 'Sound', 30, W / 2 - 160, panelY - 64, { anchor: 'bottom', enter: { kind: 'from-bottom', delay: 0.2 } }),
    makeObject(TRACK_FX, ui('track', { slice: { left: 12, top: 0, right: 12, bottom: 0 } }), 300, 26, { x: W / 2 + 70, y: panelY - 46 }, { fixed: true, tags: [TRACK_FX], anchor: 'bottom', enter: { kind: 'from-bottom', delay: 0.2 } }),
    makeObject('دستگیره‌ی صدا', ui('knob'), 40, 54, { x: W / 2 + 200, y: panelY - 46 }, { fixed: true, anchor: 'bottom', behaviors: [{ type: 'slider', trackTag: TRACK_FX, sets: 'effects', variable: '', min: 0, max: 100 }] }),
    words('نوشته‌ی موسیقی', 'Music', 30, W / 2 - 160, panelY + 16, { anchor: 'bottom', enter: { kind: 'from-bottom', delay: 0.2 } }),
    makeObject(TRACK_MUSIC, ui('track', { slice: { left: 12, top: 0, right: 12, bottom: 0 } }), 300, 26, { x: W / 2 + 70, y: panelY + 34 }, { fixed: true, tags: [TRACK_MUSIC], anchor: 'bottom', enter: { kind: 'from-bottom', delay: 0.2 } }),
    makeObject('دستگیره‌ی موسیقی', ui('knob'), 40, 54, { x: W / 2 + 200, y: panelY + 34 }, { fixed: true, anchor: 'bottom', behaviors: [{ type: 'slider', trackTag: TRACK_MUSIC, sets: 'music', variable: '', min: 0, max: 100 }] }),
  );

  // Levels: a button for each, in two rows laid out in the middle (layout); a level not yet unlocked is dim and
  // only shakes; under each, its stars (gems found, the best run).
  const l = await skyScene(p, 'Levels', 'music:happy');
  p = l.project;
  const levels = l.scene;
  const ROW = ['ردیف مرحله‌های ۱', 'ردیف مرحله‌های ۲'];
  const perRow = Math.ceil(N / 2);
  levels.objects.push(heading('عنوان مرحله‌ها', 'LEVELS', 88, W / 2, H * 0.12));
  levels.objects.push(
    makeObject(ROW[0], { kind: 'rect', color: '#ffffff' }, W, 200, { x: W / 2, y: H * 0.38 }, { fixed: true, opacity: 0, anchor: 'center', behaviors: [{ type: 'layout', tag: ROW[0], direction: 'row', gap: 44 }] }),
    makeObject(ROW[1], { kind: 'rect', color: '#ffffff' }, W, 200, { x: W / 2, y: H * 0.58 }, { fixed: true, opacity: 0, anchor: 'center', behaviors: [{ type: 'layout', tag: ROW[1], direction: 'row', gap: 44 }] }),
  );
  const lsRules: Rule[] = [];
  for (let k = 1; k <= N; k++) {
    const row = k <= perRow ? 0 : 1;
    // Apart to start with (the layout then centres the row): what sits on one button must not sit on the next.
    const x = W / 2 + (k - 1 - (row ? perRow : 0)) * 200;
    const y = row ? H * 0.58 : H * 0.38;
    const knob = makeObject(`دکمه‌ی مرحله ${k}`, ui('yellowRound'), 150, 150, { x, y }, { fixed: true, tags: [ROW[row]], anchor: 'center', enter: { kind: 'pop', delay: 0.1 + k * 0.08 } });
    const digit = words(`شماره‌ی مرحله ${k}`, String(k), 64, x, y - 46, { anchor: 'center', enter: { kind: 'pop', delay: 0.1 + k * 0.08 } });
    const stars = [1, 2, 3].map((j) => makeObject(`ستاره‌ی مرحله ${k}-${j}`, ui('star'), 38, 38, { x: x + (j - 2) * 40, y: y + 52 }, { fixed: true, anchor: 'center', enter: { kind: 'pop', delay: 0.3 + k * 0.08 } }));
    levels.objects.push(knob, digit, ...stars);
    lsRules.push({ ...rule({ type: 'tapObject', target: byId(knob.id) }, go(k)), condition: { name: 'unlocked', op: '>=', value: k }, otherwise: [{ type: 'playSound', sound: 'hit' }, { type: 'shake', strength: 6, axis: 'side' }] });
    if (k > 1) lsRules.push({ ...rule({ type: 'start' }, [{ type: 'setOpacity', target: byId(knob.id), opacity: 0.4 }, { type: 'setOpacity', target: byId(digit.id), opacity: 0.4 }]), condition: { name: 'unlocked', op: '<', value: k } });
    for (const [j, star] of stars.entries()) {
      lsRules.push({ ...rule({ type: 'start' }, [{ type: 'setOpacity', target: byId(star.id), opacity: 1 }]), condition: { name: `stars${k}`, op: '>=', value: j + 1 }, otherwise: [{ type: 'setOpacity', target: byId(star.id), opacity: 0.25 }] });
    }
  }
  const back = button('دکمه‌ی برگشت', 'yellowWide', 'Back', 300, 96, W / 2, H * 0.86, { anchor: 'bottom', enter: { kind: 'from-bottom', delay: 0.3 } });
  levels.objects.push(...back);
  levels.rules = [...lsRules, rule({ type: 'tapObject', target: byId(back[0].id) }, [{ type: 'playSound', sound: click.key }, { type: 'goToScene', scene: start.id }])];
  start.rules = [
    rule({ type: 'tapObject', target: byId(play.id) }, go(1)),
    rule({ type: 'tapObject', target: byId(levelsButton[0].id) }, [{ type: 'playSound', sound: click.key }, { type: 'goToScene', scene: levels.id }]),
  ];

  // Win: as many stars as gems found pop in one after another, the score, the next level or the menu; after the
  // last level, the game is done.
  const w = await skyScene(p, 'You win', 'music:happy');
  p = w.project;
  const win = w.scene;
  const next = button('دکمه‌ی مرحله‌ی بعد', 'greenWide', 'Next level', 360, 110, W / 2, H * 0.72, { anchor: 'bottom', enter: { kind: 'from-bottom', delay: 0.6 } });
  const home = button('دکمه‌ی منو', 'yellowWide', 'Menu', 360, 110, W / 2, H * 0.84, { anchor: 'bottom', enter: { kind: 'from-bottom', delay: 0.7 } });
  const done = words('پایان بازی', 'You reached the summit!', 40, W / 2, H * 0.7, { anchor: 'bottom', visible: false }, { color: '#ffffff', outline: '#1b3a4b' });
  const winStars = [-1, 0, 1].map((i) => makeObject(`ستاره ${i + 2}`, ui('star'), i === 0 ? 150 : 120, i === 0 ? 150 : 120, { x: W / 2 + i * 160, y: H * 0.3 - (i === 0 ? 20 : 0) }, { fixed: true, anchor: 'center', enter: { kind: 'pop', delay: 0.3 + (i + 1) * 0.2 } }));
  win.objects.push(
    makeObject('پنل برد', ui('greyPanel', { slice: PANEL }), 600, 560, { x: W / 2, y: H * 0.42 }, { fixed: true, anchor: 'center', enter: { kind: 'pop' } }),
    heading('عنوان برد', 'LEVEL CLEAR!', 80, W / 2, H * 0.1),
    ...winStars,
    words('امتیاز نهایی', 'Score: {score}', 52, W / 2, H * 0.43, { anchor: 'center', enter: { kind: 'fade', delay: 0.4 } }),
    words('بهترین امتیازها', 'Best: {best}', 36, W / 2, H * 0.51, { anchor: 'center', enter: { kind: 'fade', delay: 0.5 } }),
    ...next,
    ...home,
    done,
  );
  win.rules = [
    rule({ type: 'start' }, [
      { type: 'recordScore', variable: 'score' },
      { type: 'setVariable', name: 'best', op: 'max', amount: { variable: 'score' } },
    ]),
    ...winStars.map((star, j) => ({ ...rule({ type: 'start' }, [{ type: 'setOpacity', target: byId(star.id), opacity: 1 }]), condition: { name: 'gemsNow', op: '>=' as const, value: j + 1 }, otherwise: [{ type: 'setOpacity', target: byId(star.id), opacity: 0.25 } as Action] })),
    // After the last level: no next one, the game is done.
    { ...rule({ type: 'start' }, [{ type: 'hide', target: byId(next[0].id) }, { type: 'hide', target: byId(next[1].id) }, { type: 'show', target: byId(done.id) }, { type: 'achieve', name: `${name[0]}${name.slice(1).toLowerCase()} complete` }]), condition: when(N) },
    ...levelIds.slice(1).map((id, i) => ({
      ...rule({ type: 'tapObject', target: byId(next[0].id) }, [{ type: 'playSound', sound: click.key } as Action, { type: 'setVariable', name: 'lives', op: 'set', amount: 3 } as Action, { type: 'setVariable', name: 'hurt', op: 'set', amount: 0 } as Action, { type: 'goToScene', scene: id } as Action]),
      condition: when(i + 1),
    })),
    rule({ type: 'tapObject', target: byId(home[0].id) }, [{ type: 'playSound', sound: click.key }, { type: 'goToScene', scene: start.id }]),
  ];

  // Game over: the score, and a round "try again" that starts the same level afresh.
  const o = await skyScene(p, 'Game over', 'music:calm');
  p = o.project;
  const over = o.scene;
  const retry = makeObject('دکمه‌ی دوباره', ui('yellowRound'), 200, 200, { x: W / 2, y: H * 0.62 }, { fixed: true, anchor: 'center', enter: { kind: 'pop', delay: 0.3 }, behaviors: [{ type: 'pulse', amount: 0.05, seconds: 1 }] });
  over.objects.push(
    makeObject('پنل باخت', ui('greyPanel', { slice: PANEL }), 560, 300, { x: W / 2, y: H * 0.38 }, { fixed: true, anchor: 'center', enter: { kind: 'pop' } }),
    heading('عنوان باخت', 'GAME OVER', 88, W / 2, H * 0.14),
    words('امتیاز', 'Score: {score}', 52, W / 2, H * 0.34, { anchor: 'center', enter: { kind: 'fade', delay: 0.2 } }),
    words('بهترین', 'Best: {best}', 36, W / 2, H * 0.42, { anchor: 'center', enter: { kind: 'fade', delay: 0.25 } }),
    retry,
    makeObject('نشان دوباره', ui('iconRepeat'), 96, 96, { x: W / 2, y: H * 0.62 - 8 }, { fixed: true, anchor: 'center', enter: { kind: 'pop', delay: 0.3 } }),
    words('نوشته‌ی دوباره', 'Try again', 40, W / 2, H * 0.75, { anchor: 'center', enter: { kind: 'fade', delay: 0.4 } }, { color: '#ffffff', outline: '#1b3a4b' }),
  );
  over.rules = [
    rule({ type: 'start' }, [{ type: 'recordScore', variable: 'score' }, { type: 'setVariable', name: 'best', op: 'max', amount: { variable: 'score' } }]),
    ...levelIds.map((_, i) => ({ ...rule({ type: 'tapObject', target: byId(retry.id) }, go(i + 1)), condition: when(i + 1) })),
  ];

  // The values the screens use: the best score, which levels are open and each level's stars are kept on the phone.
  const wanted: [string, number, boolean][] = [
    ['best', 0, true], ['score', 0, false], ['level', 1, false], ['unlocked', 1, true], ['gemsNow', 0, false],
    ...levelIds.map((_, i): [string, number, boolean] => [`stars${i + 1}`, 0, true]),
  ];
  const variables = [...p.variables, ...wanted.filter(([n]) => !p.variables.some((v) => v.name === n)).map(([n, initial, saved]) => ({ name: n, initial, saved }))];
  return { project: { ...p, variables, scenes: [...p.scenes, start, levels, win, over], startScene: start.id }, start: start.id, levels: levels.id, win: win.id, over: over.id };
}

/**
 * The level's HUD and pause menu, as the parts made them, redrawn in the UI kit: the coin and hearts of Kenney's
 * platformer pack, nine-slice panel and buttons, round grey buttons with yellow arrows, the Kenney Future font,
 * anchored to their corners and coming in as the level starts. Same objects, groups and rules: only their looks,
 * anchors and entrances change.
 */
export async function flagshipHud(project: GameProject, sceneId: string): Promise<GameProject> {
  let p = uiPictures(project);
  // Cut to the pictures themselves (they sit in 128-pixel squares), so they fill their places.
  const coinCut = await packTrimmed(p, 'tiles', ['hud_coin']);
  const heartCut = await packTrimmed(coinCut.project, 'tiles', ['hud_heart']);
  p = heartCut.project;
  const coin = { visual: { kind: 'image' as const, asset: coinCut.keys[0] } };
  const heart = { visual: { kind: 'image' as const, asset: heartCut.keys[0] } };
  const font = { font: 'Kenney Future' as const };
  const added: GameObject[] = [];
  const restyle = (o: GameObject): GameObject => {
    const n = o.name;
    if (n === 'قاب امتیاز') return { ...o, visual: ui('greyPanel', { slice: { left: 24, top: 24, right: 24, bottom: 24 } }), opacity: 0.92, anchor: 'top', enter: { kind: 'from-top' } };
    if (n === 'نشان امتیاز') return { ...o, visual: coin.visual, anchor: 'top', enter: { kind: 'from-top' } };
    if (n === 'امتیاز' && o.visual.kind === 'text') return { ...o, visual: { ...o.visual, ...font, color: INK, outline: null, shadow: false }, anchor: 'top', enter: { kind: 'from-top' } };
    if (n.startsWith('قلب ')) return { ...o, visual: heart.visual, anchor: 'top-left', enter: { kind: 'pop', delay: 0.1 * Number(n.slice(4)) } };
    if (n === 'دکمه‌ی مکث') {
      added.push(words('نشان مکث', 'II', 40, o.x + o.width / 2, o.y + o.height / 2 - 26, { anchor: 'top-right', enter: { kind: 'from-top' } }));
      return { ...o, visual: ui('yellowRound'), anchor: 'top-right', enter: { kind: 'from-top' } };
    }
    if (n === 'صفحه‌ی منو') return { ...o, visual: ui('greyPanel', { slice: { left: 24, top: 24, right: 24, bottom: 24 } }), anchor: 'center' };
    if (n === 'پرده‌ی تیره') return { ...o, anchor: 'center' };
    if (['دکمه‌ی ادامه', 'دکمه‌ی از نو', 'دکمه‌ی منو', 'دکمه‌ی صدا'].includes(n)) return { ...o, visual: ui(n === 'دکمه‌ی ادامه' ? 'greenWide' : 'yellowWide', { slice: NINE }), anchor: 'center' };
    if (o.tags.includes('منوی مکث') && o.visual.kind === 'text') return { ...o, visual: { ...o.visual, ...font, color: n === 'نوشته‌ی مکث' ? '#ffd23f' : INK, outline: n === 'نوشته‌ی مکث' ? '#5a2a00' : null, shadow: false }, anchor: 'center' };
    const arrows: Record<string, [UiName, number]> = { 'دکمه‌ی چپ': ['arrowLeft', 0], 'دکمه‌ی راست': ['arrowRight', 0], 'دکمه‌ی پرش': ['arrowUp', 0], 'دکمه‌ی تیز رفتن': ['arrowRight', 1], 'دکمه‌ی کوبیدن': ['arrowDown', 0] };
    if (arrows[n]) {
      const [icon, twice] = arrows[n];
      const side = o.x + o.width / 2 < project.meta.width / 2 ? 'bottom-left' : 'bottom-right';
      const size = o.width * 0.42;
      for (let k = 0; k <= twice; k++) {
        added.push(makeObject(`نشان ${n}${k ? ' ۲' : ''}`, ui(icon), size, size, { x: o.x + o.width / 2 + (twice ? (k ? 12 : -12) : 0), y: o.y + o.height / 2 - 4 }, { fixed: true, anchor: side, opacity: 0.95, enter: { kind: 'from-bottom', delay: 0.15 } }));
      }
      return { ...o, visual: ui('greyRound'), opacity: 0.9, anchor: side, enter: { kind: 'from-bottom', delay: 0.15 } };
    }
    if (n === 'نوشته‌ی هدف' && o.visual.kind === 'text') return { ...o, visual: { ...o.visual, ...font }, anchor: 'center' };
    return o;
  };
  p = updateScene(p, sceneId, (s) => ({ ...s, objects: s.objects.map((o) => (o.fixed ? restyle(o) : o)) }));
  // The icons go on top of their buttons: right after the last fixed object.
  return updateScene(p, sceneId, (s) => ({ ...s, objects: [...s.objects, ...added] }));
}
