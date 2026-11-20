// Builds one of the genre helper's games and plays it for a while, with photographs.
// node scripts/look/gameplay.mjs shooter|puzzle|physics|platform|adventure
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, openPage, sleep, toPage } from '../lib.mjs';

const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const genre = process.argv[2] ?? 'shooter';
const browser = await launch();
const { page, errors } = await openPage(browser, new URL('../../dist-editor/editor.html', import.meta.url).href, { viewport: { width: 1440, height: 900 } });
const click = (t) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t || b.textContent.includes(t))?.click(), t);
const state = () => page.evaluate(() => window.__game.getState());
const after = async (seconds) => {
  const t = (await state()).time;
  await page.waitForFunction((t) => window.__game.getState().time > t, { timeout: 120000 }, t + seconds);
};
await page.waitForFunction(() => window.__game && window.__editor);
await click('بازی جدید'); await sleep(150); await click('بله، بازی خالی'); await sleep(400);
await page.click('[data-library="objects"]'); await page.click('[data-library-tab="genre"]'); await page.click(`[data-genre="${genre}"]`);
await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 30000 });
console.log('problems:', await page.$$eval('.problem, .chip-warn', (els) => els.map((e) => e.textContent)));
await click('امتحان کن');
await page.waitForFunction(() => window.__game.getState().time > 0.8, { timeout: 60000 });
const play = (await state()).entities.find((e) => e.width === 220 && e.height === 220);
await page.mouse.click(...(await toPage(page, play.x + 110, play.y + 110)));
await page.waitForFunction((s) => window.__game.getState().scene !== s && window.__game.getState().time > 0.3, { timeout: 60000 }, (await state()).scene);

if (genre === 'shooter') {
  // Hold a finger in the lower middle so the ship sits there, and let the waves come.
  await page.mouse.move(...(await toPage(page, 360, 1000)));
  await page.mouse.down();
  await after(6);
  await page.screenshot({ path: `${out}p-shooter-waves.png` });
  await page.evaluate(() => window.__game.setDebug({ paused: false }));
  await page.evaluate(() => { window.__game.variables.set('score', 150); });
  await after(3);
  await page.screenshot({ path: `${out}p-shooter-boss.png` });
  await page.mouse.up();
} else if (genre === 'physics') {
  await after(1);
  await page.screenshot({ path: `${out}p-physics-start.png` });
  const rock = (await state()).entities.find((e) => e.tags.includes('پرتابی'));
  const [cx, cy] = [rock.x + rock.width / 2, rock.y + rock.height / 2];
  await page.mouse.move(...(await toPage(page, cx, cy)));
  await page.mouse.down();
  await page.mouse.move(...(await toPage(page, cx - 120, cy + 70)), { steps: 8 });
  await sleep(150);
  await page.screenshot({ path: `${out}p-physics-aim.png` });
  await page.mouse.up();
  await after(2.5);
  await page.screenshot({ path: `${out}p-physics-hit.png` });
} else {
  await after(3);
  await page.screenshot({ path: `${out}p-${genre}-play.png` });
}
const s = await state();
console.log('scene', s.scene, JSON.stringify(s.variables), 'entities', s.entities.length);
console.log(errors);
await browser.close();
