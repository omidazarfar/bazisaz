// Tween any number (roadmap item 1): a small scene that uses it, photographed in the editor (its rules as
// sentences, one open) and in the game at three moments. Run `npm run build` first.
//   node scripts/look/tween.mjs     → scripts/look/out/tween-editor.png, tween-game.png
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launch, openPage, root } from '../lib.mjs';

const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const thing = (id, name, x, y, w, h, visual) => ({ id, name, x, y, width: w, height: h, visual, tags: [], visible: true, behaviors: [] });
const tw = (target, property, mode, amount, seconds, extra = {}) => ({ type: 'tween', target: { by: 'id', id: target }, property, mode, amount, seconds, ease: 'smooth', times: 1, yoyo: false, label: '', ...extra });
const project = {
  formatVersion: 3,
  meta: { name: 'Tween', orientation: 'portrait', width: 720, height: 1280, background: '#1e2a38', fontFamily: 'Fredoka', transition: 'none' },
  app: { appId: 'com.example.tweenlook', versionCode: 1, versionName: '1.0', icon: null },
  ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
  sound: false, assets: {},
  variables: [{ name: 'energy', initial: 0, saved: false }, { name: 'opened', initial: 0, saved: false }],
  textVariables: [], lists: [],
  startScene: 's',
  scenes: [{
    id: 's', name: 'Tween', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [],
    objects: [
      thing('wall', 'دیوار', 0, 700, 720, 60, { kind: 'rect', color: '#37474f' }),
      thing('door', 'در', 300, 560, 120, 200, { kind: 'rect', color: '#8d6e63', radius: 10 }),
      thing('coin', 'سکه', 120, 300, 90, 90, { kind: 'ellipse', color: '#ffd54a' }),
      thing('wheel', 'چرخ', 520, 280, 120, 120, { kind: 'rect', color: '#4fc3f7', radius: 18 }),
      thing('bar', 'نوار انرژی', 160, 1000, 400, 40, { kind: 'bar', variable: 'energy', max: 100, color: '#66bb6a', back: '#263238' }),
      thing('label', 'نوشته', 360, 1100, 10, 10, { kind: 'text', text: 'energy {energy}', size: 44, color: '#ffffff', align: 'center' }),
    ],
    rules: [
      { id: 'go', when: { type: 'start' }, condition: null, then: [
        tw('door', 'y', 'by', -260, 1.2, { ease: 'bounce', label: 'open' }),
        tw('coin', 'y', 'by', -60, 0.6, { times: 0, yoyo: true }),
        tw('wheel', 'angle', 'by', 360, 1.5, { times: 0, ease: 'linear' }),
        tw('door', 'variable', 'to', 100, 2, { variable: 'energy' }),
      ] },
      { id: 'done', when: { type: 'tweenDone', target: { by: 'id', id: 'door' }, label: 'open' }, condition: null, then: [{ type: 'setVariable', name: 'opened', op: 'set', amount: 1 }] },
    ],
  }],
};

const browser = await launch();
// The editor, its rules as sentences and the first one open.
{
  const { page } = await openPage(browser, pathToFileURL(resolve(root, 'dist-editor/editor.html')).href, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
  await page.evaluate((p) => window.__editor.open(p), project);
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => [...document.querySelectorAll('[role=tab], .tabs button')].find((b) => b.textContent.includes('قانون‌ها'))?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('.rule-closed[data-rule="go"]')?.click());
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${out}tween-editor.png` });
  await page.close();
}
// The game at the start, a moment in and once the door is open.
{
  const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist/index.html')).href, { project, viewport: { width: 405, height: 720, deviceScaleFactor: 1 } });
  await page.waitForFunction(() => window.__game, { timeout: 60000 });
  const shots = [];
  for (const [i, frames] of [[0, 1], [1, 35], [2, 90]]) {
    await page.evaluate((n) => { const g = window.__game; g.app.ticker.stop(); for (let k = 0; k < n; k++) g.advance(1 / 60); g.app.ticker.start(); }, frames);
    await new Promise((r) => setTimeout(r, 150));
    await page.screenshot({ path: `${out}tween-game-${i}.png` });
    shots.push(readFileSync(`${out}tween-game-${i}.png`).toString('base64'));
  }
  const sheet = await browser.newPage();
  await sheet.setViewport({ width: 1300, height: 800 });
  await sheet.setContent(`<body style="margin:0;background:#111;color:#eee;font:20px sans-serif;display:flex;gap:16px;padding:16px">${shots.map((s, i) => `<div><div>${['start', '0.6 s', '2 s'][i]}</div><img src="data:image/png;base64,${s}"></div>`).join('')}</body>`);
  await sheet.screenshot({ path: `${out}tween-game.png`, fullPage: true });
  console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no errors');
}
await browser.close();
