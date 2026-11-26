// Writes the flagship's five levels (Sky Quest) as Tiled maps (.tmj) into src/editor/levels/, which the genre
// helper imports with the Tiled importer (src/editor/tiled.ts). Each level teaches one new idea and is harder than
// the one before (HANDOFF.md, the quality bar). Change a level here and run: node scripts/flagship-levels.mjs
// (or open its .tmj in Tiled: one tile layer "ground", one object layer "things"; the classes are below).
//
// Tiles (class): grass, stone, coin. Things (class): player, slime (property distance, px), fly (distance), spikes,
// gem, checkpoint, goal, platform (distance), key, door, bush, sign.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './lib.mjs';

const CELL = 80;
const ROWS = 16;
const SURFACE = 12;
const TILES = { grass: 1, stone: 2, coin: 3 };

function level(title, idea, cols, build) {
  const grid = Array.from({ length: ROWS }, () => Array(cols).fill(0));
  const things = [];
  const put = (c0, c1, r0, r1, tile) => {
    for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++) grid[r][c] = tile ? TILES[tile] : 0;
  };
  const thing = (cls, c, r, w = 1, h = 1, properties = {}) => things.push({ cls, c, r, w, h, properties });
  // Ground all along, then the level's own shape.
  put(0, cols - 1, SURFACE, ROWS - 1, 'grass');
  const api = {
    cols, put, thing,
    gap: (c0, c1) => put(c0, c1, SURFACE, ROWS - 1, null),
    coins: (c0, c1, r) => put(c0, c1, r, r, 'coin'),
    arc: (c0, c1) => { for (let c = c0 - 1; c <= c1 + 1; c++) grid[SURFACE - (c === c0 - 1 || c === c1 + 1 ? 2 : 3)][c] = TILES.coin; },
    podium: (c0) => {
      put(c0, c0, SURFACE - 1, SURFACE - 1, 'stone');
      put(c0 + 1, c0 + 1, SURFACE - 2, SURFACE - 1, 'stone');
      put(c0 + 2, cols - 1, SURFACE - 3, SURFACE - 1, 'stone');
      thing('goal', cols - 3, SURFACE - 5, 1.6, 1.6);
    },
  };
  build(api);
  const objects = things.map((t, i) => ({
    id: i + 1, name: `${t.cls} ${i + 1}`, class: t.cls, type: t.cls,
    x: t.c * CELL, y: t.r * CELL + (1 - t.h) * CELL, width: t.w * CELL, height: t.h * CELL, rotation: 0, visible: true,
    properties: Object.entries(t.properties).map(([name, value]) => ({ name, type: typeof value === 'number' ? 'int' : 'string', value })),
  }));
  return {
    type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down',
    width: cols, height: ROWS, tilewidth: CELL, tileheight: CELL, infinite: false, nextlayerid: 3, nextobjectid: objects.length + 1,
    properties: [{ name: 'title', type: 'string', value: title }, { name: 'idea', type: 'string', value: idea }],
    tilesets: [{
      firstgid: 1, name: 'sky-quest', tilewidth: CELL, tileheight: CELL, tilecount: 3, columns: 0, margin: 0, spacing: 0,
      tiles: [
        { id: 0, class: 'grass', properties: [{ name: 'tags', type: 'string', value: 'زمین' }] },
        { id: 1, class: 'stone', properties: [{ name: 'tags', type: 'string', value: 'زمین' }] },
        { id: 2, class: 'coin', properties: [{ name: 'tags', type: 'string', value: 'سکه' }, { name: 'separate', type: 'bool', value: true }] },
      ],
    }],
    layers: [
      { id: 1, type: 'tilelayer', name: 'ground', width: cols, height: ROWS, x: 0, y: 0, opacity: 1, visible: true, data: grid.flat() },
      { id: 2, type: 'objectgroup', name: 'things', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects },
    ],
  };
}

const levels = [
  // 1. Run and jump: gaps, steps and coins; one slime at the end, a taste of the next level.
  level('Run and Jump', 'Run right and jump over gaps and steps.', 50, (l) => {
    l.thing('player', 2, SURFACE - 1, 1.1, 1.25);
    l.thing('sign', 4, SURFACE - 1);
    l.thing('bush', 7, SURFACE - 1);
    l.coins(5, 8, SURFACE - 2);
    for (const [a, b] of [[11, 12], [21, 23], [34, 35]]) { l.gap(a, b); l.arc(a, b); }
    l.put(16, 16, SURFACE - 1, SURFACE - 1, 'stone');
    // One short row of spikes to hop over, on open ground.
    l.thing('spikes', 18, SURFACE - 1, 1, 0.5);
    l.put(27, 28, SURFACE - 2, SURFACE - 1, 'stone');
    l.coins(27, 28, SURFACE - 4);
    l.put(40, 41, SURFACE - 1, SURFACE - 1, 'stone');
    l.thing('gem', 22, SURFACE - 6);
    l.thing('gem', 28, SURFACE - 6);
    l.thing('gem', 38, SURFACE - 4);
    l.thing('checkpoint', 25, SURFACE - 1, 1.1, 1.25);
    l.thing('bush', 31, SURFACE - 1);
    l.thing('checkpoint', 37, SURFACE - 1, 1.1, 1.25);
    l.thing('slime', 42, SURFACE - 1, 1.25, 0.9, { distance: 80 });
    l.podium(44);
  }),
  // 2. Enemies: jump on slimes to squash them; walk under flies.
  level('Stomp!', 'Land on top of a slime to squash it; touching it from the side hurts.', 56, (l) => {
    l.thing('player', 2, SURFACE - 1, 1.1, 1.25);
    l.thing('sign', 4, SURFACE - 1);
    l.coins(6, 9, SURFACE - 2);
    l.thing('slime', 10, SURFACE - 1, 1.25, 0.9, { distance: 160 });
    l.thing('slime', 16, SURFACE - 1, 1.25, 0.9, { distance: 200 });
    l.gap(20, 21); l.arc(20, 21);
    l.thing('fly', 25, SURFACE - 4, 1.25, 1, { distance: 150 });
    l.thing('slime', 28, SURFACE - 1, 1.25, 0.9, { distance: 220 });
    l.thing('checkpoint', 32, SURFACE - 1, 1.1, 1.25);
    l.put(35, 36, SURFACE - 2, SURFACE - 1, 'stone');
    l.thing('slime', 38, SURFACE - 1, 1.25, 0.9, { distance: 140 });
    l.gap(42, 43); l.arc(42, 43);
    l.thing('fly', 46, SURFACE - 4, 1.25, 1, { distance: 150 });
    l.thing('slime', 47, SURFACE - 1, 1.25, 0.9, { distance: 120 });
    l.thing('gem', 18, SURFACE - 5);
    l.thing('gem', 35, SURFACE - 6);
    l.thing('gem', 47, SURFACE - 6);
    l.podium(50);
  }),
  // 3. Moving platforms: ride them over gaps too wide to jump.
  level('Ride the Planks', 'Gaps too wide to jump: wait for the moving plank and ride it.', 60, (l) => {
    l.thing('player', 2, SURFACE - 1, 1.1, 1.25);
    l.thing('sign', 4, SURFACE - 1);
    l.coins(6, 9, SURFACE - 2);
    l.gap(12, 17);
    l.thing('platform', 12, SURFACE, 2.5, 0.6, { distance: 4 * CELL - 40 });
    l.coins(13, 16, SURFACE - 3);
    l.thing('slime', 21, SURFACE - 1, 1.25, 0.9, { distance: 200 });
    l.thing('checkpoint', 26, SURFACE - 1, 1.1, 1.25);
    l.gap(29, 35);
    l.thing('platform', 29, SURFACE, 2.5, 0.6, { distance: 5 * CELL - 40 });
    l.thing('fly', 32, SURFACE - 5, 1.25, 1, { distance: 120 });
    l.put(39, 40, SURFACE - 2, SURFACE - 1, 'stone');
    l.thing('slime', 42, SURFACE - 1, 1.25, 0.9, { distance: 160 });
    l.gap(45, 50);
    l.thing('platform', 45, SURFACE, 2.5, 0.6, { distance: 4 * CELL });
    l.thing('gem', 15, SURFACE - 6);
    l.thing('gem', 32, SURFACE - 3);
    l.thing('gem', 48, SURFACE - 5);
    l.podium(54);
  }),
  // 4. Spikes, checkpoints, a key and a door.
  level('Key to the Gate', 'Spikes hurt from every side. Find the key: the gate only opens with it.', 64, (l) => {
    l.thing('player', 2, SURFACE - 1, 1.1, 1.25);
    l.thing('sign', 4, SURFACE - 1);
    l.thing('spikes', 9, SURFACE - 1, 2, 0.5);
    l.coins(8, 11, SURFACE - 3);
    l.gap(15, 16); l.arc(15, 16);
    l.thing('spikes', 20, SURFACE - 1, 2, 0.5);
    l.thing('slime', 24, SURFACE - 1, 1.25, 0.9, { distance: 160 });
    l.thing('checkpoint', 28, SURFACE - 1, 1.1, 1.25);
    // The key waits up on a ledge.
    l.put(31, 33, SURFACE - 4, SURFACE - 4, 'stone');
    l.put(30, 30, SURFACE - 2, SURFACE - 1, 'stone');
    l.thing('key', 32, SURFACE - 5);
    l.thing('spikes', 36, SURFACE - 1, 3, 0.5);
    l.gap(41, 43); l.arc(41, 43);
    l.thing('checkpoint', 46, SURFACE - 1, 1.1, 1.25);
    l.thing('fly', 49, SURFACE - 4, 1.25, 1, { distance: 150 });
    l.thing('spikes', 51, SURFACE - 1, 2, 0.5);
    l.thing('door', 55, SURFACE - 1, 1, 2);
    l.thing('gem', 10, SURFACE - 6);
    l.thing('gem', 33, SURFACE - 7);
    l.thing('gem', 42, SURFACE - 6);
    l.podium(58);
  }),
  // 5. Everything, and longer.
  level('Sky Summit', 'All you have learned, one after another, all the way to the summit star.', 74, (l) => {
    l.thing('player', 2, SURFACE - 1, 1.1, 1.25);
    l.thing('slime', 8, SURFACE - 1, 1.25, 0.9, { distance: 180 });
    l.gap(12, 13); l.arc(12, 13);
    l.thing('spikes', 16, SURFACE - 1, 2, 0.5);
    l.thing('fly', 20, SURFACE - 4, 1.25, 1, { distance: 160 });
    l.gap(23, 28);
    l.thing('platform', 23, SURFACE, 2.5, 0.6, { distance: 4 * CELL });
    l.thing('checkpoint', 31, SURFACE - 1, 1.1, 1.25);
    l.thing('slime', 33, SURFACE - 1, 1.25, 0.9, { distance: 200 });
    l.put(36, 37, SURFACE - 2, SURFACE - 1, 'stone');
    l.thing('spikes', 38, SURFACE - 1, 2, 0.5);
    l.put(41, 43, SURFACE - 5, SURFACE - 5, 'stone');
    l.put(40, 40, SURFACE - 3, SURFACE - 1, 'stone');
    l.thing('key', 42, SURFACE - 6);
    l.gap(46, 51);
    l.thing('platform', 46, SURFACE, 2.5, 0.6, { distance: 4 * CELL });
    l.thing('fly', 49, SURFACE - 5, 1.25, 1, { distance: 120 });
    l.thing('checkpoint', 54, SURFACE - 1, 1.1, 1.25);
    l.thing('slime', 57, SURFACE - 1, 1.25, 0.9, { distance: 160 });
    l.thing('spikes', 61, SURFACE - 1, 2, 0.5);
    l.thing('door', 65, SURFACE - 1, 1, 2);
    l.thing('gem', 25, SURFACE - 6);
    l.thing('gem', 42, SURFACE - 8);
    l.thing('gem', 58, SURFACE - 5);
    l.podium(68);
  }),
];

const dir = resolve(root, 'src/editor/levels');
mkdirSync(dir, { recursive: true });
levels.forEach((map, i) => writeFileSync(resolve(dir, `sky-quest-${i + 1}.tmj`), JSON.stringify(map, null, 1) + '\n'));
console.log(`Wrote ${levels.length} levels to src/editor/levels/.`);
