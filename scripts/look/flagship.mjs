// Photographs the flagship game (Sky Quest) as a player sees it on a phone: made fresh by the editor's genre
// helper, then played in the real player (filling a tall phone screen), with pictures at moments that show the
// art, the animations, the menus and the effects. Run `npm run build` first.
//   node scripts/look/flagship.mjs [project.json]
// Pictures go to scripts/look/out/flagship-*.png.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launch, openPage, root } from '../lib.mjs';

const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const browser = await launch();

let project;
if (process.argv[2]) project = JSON.parse(readFileSync(process.argv[2], 'utf8'));
else {
  const { page } = await openPage(browser, pathToFileURL(resolve(root, 'dist-editor/editor.html')).href, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
  const click = (t) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t || b.textContent.includes(t))?.click(), t);
  await click('بازی جدید');
  await new Promise((r) => setTimeout(r, 200));
  await click('بله، بازی خالی');
  await new Promise((r) => setTimeout(r, 300));
  await page.click('[data-library="objects"]');
  await page.click('[data-library-tab="genre"]');
  await page.click('[data-genre="platform"]');
  await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 120000 });
  project = await page.evaluate(() => window.__editor.getState().project);
  await page.close();
  writeFileSync(`${out}flagship.json`, JSON.stringify(project));
}

// A tall phone (about 9:19.5), filled to its edges as the player does.
const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist/index.html')).href, { project, viewport: { width: 400, height: 866, deviceScaleFactor: 1 }, fill: true });
await page.waitForFunction(() => window.__game, { timeout: 60000 });
const shot = async (name) => page.screenshot({ path: `${out}flagship-${name}.png` });
const steps = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__game.advance(1 / 60); }, n);
await page.evaluate(() => window.__game.app.ticker.stop());
await steps(60);
await page.evaluate(() => window.__game.app.ticker.start());
await shot('1-start');
// Into the level (as the Play button does).
await page.evaluate((id) => { window.__game.nextScene = id; }, project.scenes[0].id);
await page.evaluate(() => window.__game.app.ticker.stop());
await steps(90);
await page.evaluate(() => window.__game.app.ticker.start());
await shot('2-level');
// Walk right for a while, jump on the way.
await page.evaluate(() => window.__game.app.ticker.stop());
const key = (type, code) => page.evaluate(([type, code]) => document.body.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })), [type, code]);
await key('keydown', 'ArrowRight');
await steps(50);
await page.evaluate(() => window.__game.app.ticker.start());
await shot('3-run');
await page.evaluate(() => window.__game.app.ticker.stop());
await key('keydown', 'Space');
await steps(12);
await key('keyup', 'Space');
await page.evaluate(() => window.__game.app.ticker.start());
await shot('4-jump');
await page.evaluate(() => window.__game.app.ticker.stop());
await steps(200);
await key('keyup', 'ArrowRight');
await page.evaluate(() => window.__game.app.ticker.start());
await shot('5-further');
console.log(JSON.stringify(await page.evaluate(() => { const s = window.__game.getState(); return { scene: s.scene, time: s.time, variables: s.variables }; })));
console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no errors');
await browser.close();
