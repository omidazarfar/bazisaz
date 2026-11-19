import type { Behavior, GameObject, GameProject, Rule, Scene, Visual } from '../format/types';

/**
 * Example games, and the empty game every new project starts as.
 *
 * The examples are not offered to users: the product is a tool for building
 * any game from nothing, not a set of games to pick from. They exist so the
 * tests can play complete games built only from the blocks a user has, which
 * shows those blocks are enough.
 *
 * Object, scene and group names are Persian because they are editor labels.
 * Text the player sees is English.
 */
// ── Small builders, to keep the starters readable ──────────────────────────

type Extra = Partial<Pick<GameObject, 'tags' | 'visible' | 'hitboxInset' | 'behaviors'>>;

function make(id: string, name: string, box: number[], visual: Visual, extra: Extra = {}): GameObject {
  const [x, y, width = 0, height = 0] = box;
  return { id, name, x, y, width, height, visual, tags: [], visible: true, behaviors: [], ...extra };
}
const rect = (id: string, name: string, box: number[], color: string, radius = 0, extra?: Extra) =>
  make(id, name, box, { kind: 'rect', color, radius }, extra);
const ellipse = (id: string, name: string, box: number[], color: string, extra?: Extra) =>
  make(id, name, box, { kind: 'ellipse', color }, extra);
const text = (id: string, name: string, x: number, y: number, content: string, size: number, color = INK, bold = false) =>
  make(id, name, [x, y], { kind: 'text', text: content, color, size, weight: bold ? 'bold' : 'normal' });

const INK = '#1b3a4b';
const mover = (vx: number, vy: number, atEdge: 'nothing' | 'remove' | 'wrap'): Behavior => ({
  type: 'mover', vx, vy, speedVariable: 'speed', atEdge,
});

function project(name: string, appId: string, background: string, rest: Pick<GameProject, 'variables' | 'scenes' | 'startScene'>): GameProject {
  return {
    formatVersion: 2,
    meta: { name, orientation: 'portrait', width: 720, height: 1280, background, fontFamily: 'Fredoka' },
    app: { appId, versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: true,
    assets: {},
    ...rest,
  };
}

/** A start or end screen: some texts, and one rule that starts a fresh round on a tap. */
function menuScene(id: string, name: string, objects: GameObject[]): Scene {
  const startRound: Rule = {
    id: `${id}-tap`,
    when: { type: 'tap' },
    condition: null,
    then: [{ type: 'playSound', sound: 'click' }, { type: 'resetVariables' }, { type: 'goToScene', scene: 'play' }],
  };
  return { id, name, width: 720, height: 1280, background: null, music: null, gravity: 0, objects, prefabs: [], rules: [startRound] };
}

/** What ends a round: remember the best score, then go to the end screen. */
const endRound: Rule['then'] = [
  { type: 'playSound', sound: 'lose' },
  { type: 'setVariable', name: 'best', op: 'max', amount: { variable: 'score' } },
  { type: 'showAd' },
  { type: 'goToScene', scene: 'over' },
];

const scoreVariables = [
  { name: 'score', initial: 0, saved: false },
  { name: 'best', initial: 0, saved: true },
  { name: 'speed', initial: 1, saved: false },
];
const speedUp = (id: string, step: number, limit: number): Rule => ({
  id,
  when: { type: 'every', seconds: 1 },
  condition: { name: 'speed', op: '<=', value: limit },
  then: [{ type: 'setVariable', name: 'speed', op: 'add', amount: step }],
});

// ── Runner ─────────────────────────────────────────────────────────────────

function runner(): GameProject {
  const scenery = (p: string, moving: boolean): GameObject[] => [
    ellipse(`${p}sun`, 'خورشید', [520, 130, 140, 140], '#ffd54a'),
    rect(`${p}cloud1`, 'ابر ۱', [70, 230, 210, 64], '#ffffff', 32, moving ? { behaviors: [mover(-60, 0, 'wrap')] } : {}),
    rect(`${p}cloud2`, 'ابر ۲', [430, 310, 260, 72], '#ffffff', 36, moving ? { behaviors: [mover(-40, 0, 'wrap')] } : {}),
    ellipse(`${p}hill1`, 'تپه‌ی دور', [-120, 770, 700, 360], '#a5d6a7', moving ? { behaviors: [mover(-120, 0, 'wrap')] } : {}),
    ellipse(`${p}hill2`, 'تپه‌ی نزدیک', [420, 820, 560, 280], '#81c784', moving ? { behaviors: [mover(-190, 0, 'wrap')] } : {}),
  ];
  const ground = (p: string): GameObject[] => [
    rect(`${p}ground`, 'زمین', [0, 940, 720, 340], '#6d4c41', 0, { tags: ['زمین'] }),
    rect(`${p}grass`, 'چمن', [0, 940, 720, 28], '#43a047'),
  ];
  const obstacle = (id: string, name: string, w: number, h: number, color: string) =>
    rect(id, name, [0, 0, w, h], color, 14, { tags: ['مانع'], hitboxInset: 6, behaviors: [mover(-420, 0, 'remove')] });

  const play: Scene = {
    id: 'play',
    name: 'بازی',
    width: 720,
    height: 1280,
    background: null,
    music: null,
    gravity: 3200,
    objects: [
      ...scenery('', true),
      rect('coin-spawner', 'سازنده‌ی سکه', [720, 770, 40, 40], '#ffb300', 8, {
        visible: false,
        behaviors: [{ type: 'spawner', prefabs: ['coin'], minInterval: 2.4, maxInterval: 4.5, spreadX: 0, spreadY: 0, everyDistance: 0 }],
      }),
      rect('obstacle-spawner', 'سازنده‌ی مانع', [720, 940, 40, 40], '#2e7d32', 8, {
        visible: false,
        behaviors: [{ type: 'spawner', prefabs: ['cactus-small', 'cactus-tall', 'cactus-wide'], minInterval: 1.1, maxInterval: 2.2, spreadX: 0, spreadY: 0, everyDistance: 0 }],
      }),
      ...ground(''),
      rect('player', 'بازیکن', [110, 856, 84, 84], '#ff5a5f', 18, {
        tags: ['بازیکن'],
        hitboxInset: 8,
        behaviors: [
          { type: 'body', gravity: true, solidTag: 'زمین', bounce: 0, edges: 'none', oneWay: false },
          { type: 'jumper', jumpSpeed: 1150, maxJumps: 2, on: 'tap', buttonTag: '' },
        ],
      }),
      text('score', 'امتیاز', 360, 56, 'Score: {score}', 52, INK, true),
    ],
    prefabs: [
      obstacle('cactus-small', 'مانع کوتاه', 56, 84, '#2e7d32'),
      obstacle('cactus-tall', 'مانع بلند', 56, 130, '#1b5e20'),
      obstacle('cactus-wide', 'مانع پهن', 120, 70, '#388e3c'),
      ellipse('coin', 'سکه', [0, 0, 52, 52], '#ffb300', { tags: ['سکه'], behaviors: [mover(-420, 0, 'remove')] }),
    ],
    rules: [
      { id: 'hit', when: { type: 'touch', a: { by: 'tag', tag: 'بازیکن' }, b: { by: 'tag', tag: 'مانع' } }, condition: null, then: endRound },
      { id: 'passed', when: { type: 'offscreen', target: { by: 'tag', tag: 'مانع' } }, condition: null, then: [{ type: 'setVariable', name: 'score', op: 'add', amount: 1 }] },
      {
        id: 'coin',
        when: { type: 'touch', a: { by: 'tag', tag: 'بازیکن' }, b: { by: 'tag', tag: 'سکه' } },
        condition: null,
        then: [{ type: 'setVariable', name: 'score', op: 'add', amount: 5 }, { type: 'destroy', target: 'second' }, { type: 'playSound', sound: 'coin' }],
      },
      speedUp('faster', 0.02, 2.1),
    ],
  };

  return project('Runner', 'com.example.runner', '#bfe8ff', {
    variables: scoreVariables,
    startScene: 'start',
    scenes: [
      menuScene('start', 'شروع', [
        ...scenery('s-', false),
        ...ground('s-'),
        rect('s-player', 'بازیکن', [110, 856, 84, 84], '#ff5a5f', 18),
        text('s-title', 'عنوان', 360, 430, 'Runner', 120, INK, true),
        text('s-hint', 'راهنمای شروع', 360, 610, 'Tap to start', 40),
      ]),
      play,
      menuScene('over', 'پایان', [
        ...scenery('o-', false),
        ...ground('o-'),
        text('o-title', 'پیام باخت', 360, 380, 'Game over', 110, '#c62828', true),
        text('o-score', 'امتیاز', 360, 540, 'Score: {score}', 52, INK, true),
        text('o-best', 'بهترین امتیاز', 360, 620, 'Best: {best}', 46, INK, true),
        text('o-hint', 'راهنمای شروع دوباره', 360, 720, 'Tap to play again', 38),
      ]),
    ],
  });
}

// ── Catch ──────────────────────────────────────────────────────────────────

function catcher(): GameProject {
  const falling = (id: string, name: string, color: string, tag: string, speed: number) =>
    ellipse(id, name, [0, 0, 64, 64], color, { tags: [tag], hitboxInset: 6, behaviors: [mover(0, speed, 'remove')] });

  const play: Scene = {
    id: 'play',
    name: 'بازی',
    width: 720,
    height: 1280,
    background: null,
    music: null,
    gravity: 0,
    objects: [
      rect('dropper', 'سازنده‌ی میوه و بمب', [328, 0, 64, 20], '#ffffff', 6, {
        visible: false,
        behaviors: [{ type: 'spawner', prefabs: ['apple', 'apple', 'bomb'], minInterval: 0.5, maxInterval: 1.1, spreadX: 300, spreadY: 0, everyDistance: 0 }],
      }),
      rect('basket', 'سبد', [280, 1120, 160, 44], '#8d5a2b', 12, {
        tags: ['سبد'],
        behaviors: [{ type: 'followFinger', speed: 1600, axis: 'x' }],
      }),
      text('score', 'امتیاز', 200, 50, 'Score: {score}', 46, '#ffffff', true),
      text('lives', 'جان‌ها', 540, 50, 'Lives: {lives}', 46, '#ffffff', true),
    ],
    prefabs: [falling('apple', 'سیب', '#e53935', 'خوب', 380), falling('bomb', 'بمب', '#212121', 'بد', 440)],
    rules: [
      {
        id: 'catch',
        when: { type: 'touch', a: { by: 'tag', tag: 'سبد' }, b: { by: 'tag', tag: 'خوب' } },
        condition: null,
        then: [{ type: 'setVariable', name: 'score', op: 'add', amount: 1 }, { type: 'destroy', target: 'second' }, { type: 'playSound', sound: 'coin' }],
      },
      {
        id: 'bomb',
        when: { type: 'touch', a: { by: 'tag', tag: 'سبد' }, b: { by: 'tag', tag: 'بد' } },
        condition: null,
        then: [{ type: 'setVariable', name: 'lives', op: 'subtract', amount: 1 }, { type: 'destroy', target: 'second' }, { type: 'playSound', sound: 'hit' }],
      },
      { id: 'missed', when: { type: 'offscreen', target: { by: 'tag', tag: 'خوب' } }, condition: null, then: [{ type: 'setVariable', name: 'lives', op: 'subtract', amount: 1 }] },
      { id: 'dead', when: { type: 'variable', name: 'lives', op: '<=', value: 0 }, condition: null, then: endRound },
      speedUp('faster', 0.03, 2.5),
    ],
  };

  return project('Catch', 'com.example.catchgame', '#283593', {
    variables: [...scoreVariables, { name: 'lives', initial: 3, saved: false }],
    startScene: 'start',
    scenes: [
      menuScene('start', 'شروع', [
        ellipse('s-apple', 'سیب', [328, 300, 64, 64], '#e53935'),
        text('s-title', 'عنوان', 360, 430, 'Catch!', 120, '#ffffff', true),
        text('s-hint', 'راهنمای شروع', 360, 610, 'Tap to start', 40, '#ffffff'),
        rect('s-basket', 'سبد', [280, 1120, 160, 44], '#8d5a2b', 12),
      ]),
      play,
      menuScene('over', 'پایان', [
        text('o-title', 'پیام باخت', 360, 380, 'Game over', 110, '#ff8a80', true),
        text('o-score', 'امتیاز', 360, 540, 'Score: {score}', 52, '#ffffff', true),
        text('o-best', 'بهترین امتیاز', 360, 620, 'Best: {best}', 46, '#ffffff', true),
        text('o-hint', 'راهنمای شروع دوباره', 360, 720, 'Tap to play again', 38, '#ffffff'),
      ]),
    ],
  });
}

// ── Blank ──────────────────────────────────────────────────────────────────

export function blank(): GameProject {
  return project('My game', 'com.example.mygame', '#bfe8ff', {
    variables: [{ name: 'score', initial: 0, saved: false }],
    startScene: 'scene1',
    scenes: [
      { id: 'scene1', name: 'صحنه‌ی ۱', width: 720, height: 1280, background: null, music: null, gravity: 2400, sky: 'day', objects: [], prefabs: [], rules: [] },
    ],
  });
}

/** Builds an example by name, for the player's ?template= development switch and the tests. */
export function buildExample(id: string): GameProject {
  return id === 'catch' ? catcher() : id === 'blank' ? blank() : runner();
}
