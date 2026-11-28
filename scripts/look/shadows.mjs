// Lights that cast soft shadows of a set length (roadmap item 5): the same dark room three ways (sharp shadows as far
// as the light, as before; short shadows; short and soft), and a light's settings in the editor. Run `npm run build`.
//   node scripts/look/shadows.mjs  → scripts/look/out/shadows-game.png, shadows-editor.png
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launch, openPage, root } from '../lib.mjs';

const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const box = (id, name, x, y, w, h, color, extra = {}) => ({ id, name, x, y, width: w, height: h, visual: { kind: 'rect', color, shade: true }, tags: [], visible: true, behaviors: [], ...extra });
const room = (light) => ({
  formatVersion: 3,
  meta: { name: 'Shadows', orientation: 'portrait', width: 720, height: 1280, background: '#c8b89a', fontFamily: 'Fredoka', transition: 'none' },
  app: { appId: 'com.example.shadowslook', versionCode: 1, versionName: '1.0', icon: null },
  ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
  sound: false, assets: {}, variables: [], textVariables: [], lists: [], startScene: 's',
  scenes: [{
    id: 's', name: 'Shadows', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [], darkness: 0.92, rules: [],
    objects: [
      box('torch', 'مشعل', 330, 600, 50, 50, '#ffb74d', { visual: { kind: 'ellipse', color: '#ffb74d' }, behaviors: [{ type: 'light', radius: 620, color: '#ffcc80', flicker: false, shadowTag: 'ستون', ...light }] }),
      box('p1', 'ستون ۱', 160, 420, 60, 60, '#6d4c41', { tags: ['ستون'] }),
      box('p2', 'ستون ۲', 500, 420, 60, 60, '#6d4c41', { tags: ['ستون'] }),
      box('p3', 'ستون ۳', 160, 800, 60, 60, '#6d4c41', { tags: ['ستون'] }),
      box('p4', 'ستون ۴', 500, 800, 60, 60, '#6d4c41', { tags: ['ستون'] }),
      box('crate', 'جعبه', 320, 300, 70, 70, '#8d6e63', { tags: ['ستون'] }),
    ],
  }],
});
const browser = await launch();
const shots = [];
const ways = [['as before: sharp, as far as the light', {}], ['shadow 140 px long', { shadowLength: 140 }], ['140 px long and soft (16)', { shadowLength: 140, shadowSoftness: 16 }]];
for (const [i, [, light]] of ways.entries()) {
  const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist/index.html')).href, { project: room(light), viewport: { width: 405, height: 720, deviceScaleFactor: 1 } });
  await page.waitForFunction(() => window.__game, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `${out}shadows-game-${i}.png` });
  shots.push(readFileSync(`${out}shadows-game-${i}.png`).toString('base64'));
  if (errors.length) console.log(`errors: ${errors.join(' | ')}`);
  await page.close();
}
const sheet = await browser.newPage();
await sheet.setViewport({ width: 1300, height: 800 });
await sheet.setContent(`<body style="margin:0;background:#111;color:#eee;font:18px sans-serif;display:flex;gap:16px;padding:16px">${shots.map((s, i) => `<div><div>${ways[i][0]}</div><img src="data:image/png;base64,${s}"></div>`).join('')}</body>`);
await sheet.screenshot({ path: `${out}shadows-game.png`, fullPage: true });
{
  const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist-editor/editor.html')).href, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
  await page.evaluate((p) => window.__editor.open(p), room({ shadowLength: 140, shadowSoftness: 16 }));
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => [...document.querySelectorAll('.object-list .row')].find((r) => r.querySelector('.row-name').textContent === 'مشعل')?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll('.panel-inspector label')].find((l) => l.textContent === 'سایه تا کجا برود')?.scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: `${out}shadows-editor.png` });
  console.log(errors.length ? `editor: ${errors.join(' | ')}` : 'editor: no errors');
}
await browser.close();
