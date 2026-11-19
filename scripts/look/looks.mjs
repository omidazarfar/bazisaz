// Screenshots of every backdrop, with a styled tile map and shaded shapes over it.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Pictures go to scripts/look/out/. Run `npm run build` first.
const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const EDITOR = new URL('../../dist-editor/editor.html', import.meta.url).href;
const PLAYER = new URL('../../dist/index.html', import.meta.url).href;
import { launch, openPage, sleep } from '../lib.mjs';
const url = PLAYER;
const skies = (process.argv[2] ?? 'day,sunset,night,space,underwater,forest,desert,city,cave,snow').split(',');
const cols = 12;
const rows = Array.from({ length: 22 }, () => '.'.repeat(cols));
const put = (r, text) => (rows[r] = text.padEnd(cols, '.').slice(0, cols));
put(21, 'aaaaaaaaaaaa');
put(20, 'aaaaaaaaaaaa');
put(19, 'a........aaa');
put(16, '..bbb...ddd.');
put(13, '.eee..fff...');
put(10, 'ggg....hhh..');
put(7, '.....iii....');
const kinds = {
  a: { name: 'g', color: '#6d4c41', tags: ['ground'], style: 'grass' },
  b: { name: 's', color: '#888', tags: ['ground'], style: 'stone' },
  d: { name: 'b', color: '#888', tags: ['ground'], style: 'brick' },
  e: { name: 'w', color: '#888', tags: ['ground'], style: 'wood' },
  f: { name: 'i', color: '#888', tags: ['ground'], style: 'ice' },
  g: { name: 'm', color: '#888', tags: ['ground'], style: 'metal' },
  h: { name: 'sa', color: '#888', tags: ['ground'], style: 'sand' },
  i: { name: 'sn', color: '#888', tags: ['ground'], style: 'snow' },
};
const box = (id, x, y, w, h, extra = {}) => ({ id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#ff5a5f' }, tags: [], visible: true, behaviors: [], ...extra });
const browser = await launch();
for (const sky of skies) {
  const project = {
    formatVersion: 2,
    meta: { name: 'Looks', orientation: 'portrait', width: 720, height: 1280, background: '#8fd3f4', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.looks', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {}, variables: [], startScene: 's',
    scenes: [{ id: 's', name: 's', width: 1440, height: 1280, background: null, music: null, gravity: 2400, sky, bloom: process.argv[3] === 'bloom', prefabs: [], rules: [], objects: [
      { ...box('map', 0, 0, cols * 60, 22 * 60), visual: { kind: 'tiles', cell: 60, rows, kinds } },
      box('shaded', 80, 1010, 110, 110, { visual: { kind: 'rect', color: '#ff5a5f', radius: 22, shade: true, outline: '#1b3a4b' }, shadow: true }),
      box('ball', 260, 1020, 100, 100, { visual: { kind: 'ellipse', color: '#43a047', shade: true }, shadow: true }),
      box('gem', 420, 1030, 80, 80, { visual: { kind: 'ellipse', color: '#ffd54a', shade: true }, glow: '#ffd54a' }),
      box('hero', 560, 1010, 90, 110, { visual: { kind: 'rect', color: '#26c6da', radius: 40, shade: true, outline: '#1b3a4b' }, shadow: true, behaviors: [{ type: 'body', gravity: true, solidTag: 'ground', bounce: 0, edges: 'stop', oneWay: false }, { type: 'jumper', jumpSpeed: 1100, maxJumps: 1, on: 'tap', buttonTag: '' }] }),
      box('title', 360, 60, 0, 0, { visual: { kind: 'text', text: 'Bazisaz', color: '#ffffff', size: 90, weight: 'bold', outline: '#1b3a4b', shadow: true }, fixed: true }),
    ] }],
  };
  const { page, errors } = await openPage(browser, url, { project });
  await page.waitForFunction(() => window.__game && window.__game.getState().time > 1.2, { timeout: 20000 });
  const canvas = await page.$('canvas');
  await canvas.screenshot({ path: `${out}sky-${sky}.png` });
  if (errors.length) console.log(sky, errors);
  await page.close();
}
await browser.close();
console.log('done');
