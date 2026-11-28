// Custom behaviors (roadmap item 3): a small game with two behaviors made from rules, photographed in the editor
// (the behavior's rules with its name and settings, one rule open, an object's behavior card with its own
// settings, the pick list with "your behaviors") and in the game at three moments. Run `npm run build` first.
//   node scripts/look/custom.mjs   → scripts/look/out/custom-rules-editor.png, custom-open-editor.png,
//                                    custom-object-editor.png, custom-pick-editor.png, custom-game.png
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launch, openPage, root } from '../lib.mjs';

const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const self = { by: 'self' };
const thing = (id, name, x, y, w, h, visual, extra = {}) => ({ id, name, x, y, width: w, height: h, visual, tags: [], visible: true, behaviors: [], ...extra });
const pace = (distance) => ({ type: 'custom', behavior: 'pace', settings: { distance } });
const project = {
  formatVersion: 3,
  meta: { name: 'Custom behaviors', orientation: 'portrait', width: 720, height: 1280, background: '#1e2a38', fontFamily: 'Fredoka', transition: 'none' },
  app: { appId: 'com.example.customlook', versionCode: 1, versionName: '1.0', icon: null },
  ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
  sound: false, assets: {},
  variables: [{ name: 'score', initial: 0, saved: false }],
  textVariables: [], lists: [],
  customBehaviors: [
    { id: 'pace', name: 'رفت و برگشت', about: 'به اندازه‌ی «فاصله» جلو می‌رود و برمی‌گردد، همیشه.', settings: [{ name: 'distance', label: 'فاصله', initial: 200 }], rules: [
      { id: 'go', when: { type: 'start' }, condition: null, then: [
        { type: 'tween', target: self, property: 'x', mode: 'by', amount: { value: 'distance', of: self }, seconds: 2, ease: 'smooth', times: 0, yoyo: true, label: '' },
      ] },
    ] },
    { id: 'shy', name: 'خجالتی', about: 'وقتی بازیکن نزدیک می‌شود کم‌رنگ می‌شود و دوباره پیدا می‌شود.', settings: [{ name: 'hits', label: 'چند بار دیده شد', initial: 0 }], rules: [
      { id: 'seen', when: { type: 'near', a: self, b: { by: 'tag', tag: 'بازیکن' }, distance: 220 }, condition: null, then: [
        { type: 'tween', target: self, property: 'opacity', mode: 'to', amount: 0.25, seconds: 0.4, ease: 'smooth', times: 1, yoyo: true, label: '' },
        { type: 'setValue', target: self, name: 'hits', op: 'add', amount: 1 },
      ], sub: [
        { id: 'seen.again', condition: { of: self, name: 'hits', op: '>=', value: 2 }, then: [{ type: 'floatText', target: self, text: 'again!', color: '#ffe066', size: 40 }] },
      ] },
    ] },
  ],
  startScene: 's',
  scenes: [{
    id: 's', name: 'Custom behaviors', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [],
    objects: [
      thing('floor', 'زمین', 0, 1100, 720, 60, { kind: 'rect', color: '#37474f' }),
      thing('a', 'سکوی بلند', 60, 300, 160, 40, { kind: 'rect', color: '#4fc3f7' }, { behaviors: [pace(400)] }),
      thing('b', 'سکوی کوتاه', 60, 520, 160, 40, { kind: 'rect', color: '#81c784' }, { behaviors: [pace(120)] }),
      thing('c', 'سکوی وسط', 60, 740, 160, 40, { kind: 'rect', color: '#ffb74d' }, { behaviors: [{ type: 'custom', behavior: 'pace' }] }),
      thing('ghost', 'روح', 540, 900, 100, 100, { kind: 'ellipse', color: '#e1bee7' }, { behaviors: [{ type: 'custom', behavior: 'shy' }] }),
      thing('hero', 'بازیکن', 80, 1010, 80, 80, { kind: 'ellipse', color: '#ffd54a' }, { tags: ['بازیکن'], behaviors: [{ type: 'patrol', axis: 'x', speed: 260, distance: 480 }] }),
    ],
    rules: [],
  }],
};

const browser = await launch();
{
  const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist-editor/editor.html')).href, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
  await page.evaluate((p) => window.__editor.open(p), project);
  await new Promise((r) => setTimeout(r, 400));
  // An object with a behavior of the game's own: its card with its own setting, and the button to its rules.
  await page.evaluate(() => [...document.querySelectorAll('.object-list .row')].find((r) => r.querySelector('.row-name').textContent === 'سکوی بلند')?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('[data-custom-setting="distance"]')?.scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: `${out}custom-object-editor.png` });
  // The pick list: "your behaviors" first.
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'اضافه کردن رفتار')?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${out}custom-pick-editor.png` });
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 200));
  // The behavior's rules: its name, settings, who has it, and its rules as sentences.
  await page.evaluate(() => document.querySelector('[data-edit-custom="shy"]')?.click() ?? document.querySelector('[data-edit-custom="pace"]')?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('[data-rules-of="shy"]')?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${out}custom-rules-editor.png` });
  // A rule open: "this object" among the choices.
  await page.evaluate(() => document.querySelector('.rule-closed[data-rule="seen"]')?.click());
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector('article.rule[data-rule="seen"]')?.scrollIntoView({ block: 'start' }));
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: `${out}custom-open-editor.png` });
  console.log(errors.length ? `editor errors: ${errors.join(' | ')}` : 'editor: no errors');
  await page.close();
}
{
  const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist/index.html')).href, { project, viewport: { width: 405, height: 720, deviceScaleFactor: 1 } });
  await page.waitForFunction(() => window.__game, { timeout: 60000 });
  await page.evaluate(() => { const g = window.__game; g.app.ticker.stop(); g.restart?.(); });
  const shots = [];
  for (const [i, frames] of [[0, 1], [1, 60], [2, 60]]) {
    await page.evaluate((n) => { const g = window.__game; g.app.ticker.stop(); for (let k = 0; k < n; k++) g.advance(1 / 60); g.app.ticker.start(); }, frames);
    await new Promise((r) => setTimeout(r, 150));
    await page.screenshot({ path: `${out}custom-game-${i}.png` });
    shots.push(readFileSync(`${out}custom-game-${i}.png`).toString('base64'));
  }
  const sheet = await browser.newPage();
  await sheet.setViewport({ width: 1300, height: 800 });
  await sheet.setContent(`<body style="margin:0;background:#111;color:#eee;font:20px sans-serif;display:flex;gap:16px;padding:16px">${shots.map((s, i) => `<div><div>${['start', '1 s', '2 s'][i]}</div><img src="data:image/png;base64,${s}"></div>`).join('')}</body>`);
  await sheet.screenshot({ path: `${out}custom-game.png`, fullPage: true });
  console.log(errors.length ? `game errors: ${errors.join(' | ')}` : 'game: no errors');
  console.log(JSON.stringify(await page.evaluate(() => window.__game.entities.filter((e) => e.def.id === 'ghost').map((e) => [...e.values]))));
}
await browser.close();
