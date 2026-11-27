// Sub-rules and values with named parts (roadmap item 2): a small scene that uses both, photographed in the
// editor (its rules with their sub-rules, one open; the values panel with a value with parts) and in the game at
// three moments. Run `npm run build` first.
//   node scripts/look/subrules.mjs   → scripts/look/out/subrules-editor.png, subrules-open-editor.png, parts-editor.png,
//                                        subrules-game.png
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launch, openPage, root } from '../lib.mjs';

const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const thing = (id, name, x, y, w, h, visual, extra = {}) => ({ id, name, x, y, width: w, height: h, visual, tags: [], visible: true, behaviors: [], ...extra });
const coin = (id, x, kind) => thing(id, kind === 1 ? 'سکه‌ی طلا' : 'سکه‌ی نقره', x, 200, 90, 90, { kind: 'ellipse', color: kind === 1 ? '#ffd54a' : '#cfd8dc' }, { tags: ['سکه'], values: { kind } });
const tw = (target, property, mode, amount, seconds, extra = {}) => ({ type: 'tween', target, property, mode, amount, seconds, ease: 'smooth', times: 1, yoyo: false, label: '', ...extra });
const add = (name, amount = 1) => ({ type: 'setVariable', name, op: 'add', amount });
const project = {
  formatVersion: 3,
  meta: { name: 'Sub-rules', orientation: 'portrait', width: 720, height: 1280, background: '#1e2a38', fontFamily: 'Fredoka', transition: 'none' },
  app: { appId: 'com.example.subruleslook', versionCode: 1, versionName: '1.0', icon: null },
  ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
  sound: false, assets: {},
  variables: [{ name: 'player.stats.hp', initial: 10, saved: true }, { name: 'player.stats.coins', initial: 0, saved: true }, { name: 'best', initial: 0, saved: true }],
  textVariables: [{ name: 'player.name', initial: 'Ava', saved: true }], lists: [],
  startScene: 's',
  scenes: [{
    id: 's', name: 'Sub-rules', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [],
    objects: [
      thing('floor', 'زمین', 0, 860, 720, 60, { kind: 'rect', color: '#37474f' }),
      coin('c1', 110, 1), coin('c2', 315, 2), coin('c3', 520, 1),
      thing('label', 'نوشته', 360, 1000, 10, 10, { kind: 'text', text: '{player.name}  hp {player.stats.hp}  coins {player.stats.coins}', size: 44, color: '#ffffff', align: 'center' }),
    ],
    rules: [
      { id: 'drop', when: { type: 'start' }, condition: null, then: [tw({ by: 'tag', tag: 'سکه' }, 'y', 'by', 560, 1, { ease: 'bounce', label: 'drop' })] },
      { id: 'land', when: { type: 'tweenDone', target: { by: 'tag', tag: 'سکه' }, label: 'drop' }, condition: null, then: [add('player.stats.coins')], sub: [
        { id: 'land.gold', condition: { of: 'first', name: 'kind', op: '==', value: 1 }, then: [add('player.stats.hp', 2), tw('first', 'scale', 'to', 1.4, 0.3, { yoyo: true, times: 0 })], sub: [
          { id: 'land.gold.full', condition: { name: 'player.stats.hp', op: '>=', value: 14 }, then: [{ type: 'floatText', target: 'first', text: 'hp {player.stats.hp}!', color: '#ffe066', size: 44 }] },
        ] },
        { id: 'land.silver', condition: { of: 'first', name: 'kind', op: '==', value: 2 }, then: [tw('first', 'opacity', 'to', 0.35, 0.4)] },
      ] },
    ],
  }],
};

const browser = await launch();
// The editor: the rules with their sub-rules, a sub-rule open; then the values panel.
{
  const { page } = await openPage(browser, pathToFileURL(resolve(root, 'dist-editor/editor.html')).href, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
  await page.evaluate((p) => window.__editor.open(p), project);
  await new Promise((r) => setTimeout(r, 400));
  await page.click('[data-panel-tab="rules"]');
  await new Promise((r) => setTimeout(r, 300));
  // Every rule closed, as sentences: the sub-rules below their rule, set in.
  await page.screenshot({ path: `${out}subrules-editor.png` });
  // A sub-rule open: no trigger of its own, "if", and the buttons that move it.
  await page.evaluate(() => document.querySelector('.rule-closed[data-rule="land.silver"]')?.click());
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('article.rule[data-rule="land.silver"] [data-move-out]')?.scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: `${out}subrules-open-editor.png` });
  await page.click('[data-panel-tab="game"]');
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('[data-value-group="player"]')?.scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: `${out}parts-editor.png` });
  await page.close();
}
// The game at the start, as the coins land and a moment later.
{
  const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist/index.html')).href, { project, viewport: { width: 405, height: 720, deviceScaleFactor: 1 } });
  await page.waitForFunction(() => window.__game, { timeout: 60000 });
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('save:com.example.subruleslook')).forEach((k) => localStorage.removeItem(k)));
  await page.reload();
  await page.waitForFunction(() => window.__game, { timeout: 60000 });
  const shots = [];
  for (const [i, frames] of [[0, 1], [1, 40], [2, 40]]) {
    await page.evaluate((n) => { const g = window.__game; g.app.ticker.stop(); for (let k = 0; k < n; k++) g.advance(1 / 60); g.app.ticker.start(); }, frames);
    await new Promise((r) => setTimeout(r, 150));
    await page.screenshot({ path: `${out}subrules-game-${i}.png` });
    shots.push(readFileSync(`${out}subrules-game-${i}.png`).toString('base64'));
  }
  const sheet = await browser.newPage();
  await sheet.setViewport({ width: 1300, height: 800 });
  await sheet.setContent(`<body style="margin:0;background:#111;color:#eee;font:20px sans-serif;display:flex;gap:16px;padding:16px">${shots.map((s, i) => `<div><div>${['start', '0.7 s', '1.3 s'][i]}</div><img src="data:image/png;base64,${s}"></div>`).join('')}</body>`);
  await sheet.screenshot({ path: `${out}subrules-game.png`, fullPage: true });
  console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no errors');
  console.log(JSON.stringify(await page.evaluate(() => window.__game.getState().variables)));
}
await browser.close();
