// Builds the platformer from the genre helper and plays it: the start screen, the level at a few places, a stomp.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, openPage, sleep, toPage } from '../lib.mjs';

const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const genre = process.argv[2] ?? 'platform';
const browser = await launch();
const { page, errors } = await openPage(browser, new URL('../../dist-editor/editor.html', import.meta.url).href, { viewport: { width: 1440, height: 900 } });
const click = (text) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t || b.textContent.includes(t))?.click(), text);
const state = () => page.evaluate(() => window.__game.getState());
await page.waitForFunction(() => window.__game && window.__editor);
await click('بازی جدید');
await sleep(150);
await click('بله، بازی خالی');
await sleep(400);
await page.click('[data-library="objects"]');
await page.click('[data-library-tab="genre"]');
await page.click(`[data-genre="${genre}"]`);
await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 30000 });
await sleep(600);
await page.screenshot({ path: `${out}g-${genre}-edit.png` });
console.log('problems:', await page.$$eval('.problem, .chip-warn', (els) => els.map((e) => e.textContent)));
await click('امتحان کن');
await page.waitForFunction(() => window.__game.getState().mode === 'play' && window.__game.getState().time > 1, { timeout: 60000 });
await page.screenshot({ path: `${out}g-${genre}-start.png` });
// Play.
const play = (await state()).entities.find((e) => e.width === 220 && e.height === 220);
await page.mouse.click(...(await toPage(page, play.x + 110, play.y + 110)));
await page.waitForFunction((s) => window.__game.getState().scene !== s && window.__game.getState().time > 1.2, { timeout: 60000 }, (await state()).scene);
await page.screenshot({ path: `${out}g-${genre}-level-0.png` });
// Walk the player along the level: put it at a few places and let the camera catch up.
const shots = process.argv[3] ? process.argv[3].split(',').map(Number) : [0.3, 0.55, 0.8, 0.95];
for (const share of shots) {
  await page.evaluate((share) => {
    const g = window.__game;
    const p = g.entities.find((e) => e.def.tags.includes('بازیکن'));
    p.x = g.getState().camera.x + 0; // keep the type happy
    p.x = Math.round(share * (g.scene.width - p.width));
    p.y = 200;
    p.vy = 0;
  }, share);
  const t = (await state()).time;
  await page.waitForFunction((t) => window.__game.getState().time > t + 1.2, { timeout: 60000 }, t);
  await page.screenshot({ path: `${out}g-${genre}-level-${share}.png` });
}
const s = await state();
console.log('scene', s.scene, 'score', s.variables.score, 'lives', s.variables.lives, 'entities', s.entities.length);
console.log(errors);
await browser.close();
