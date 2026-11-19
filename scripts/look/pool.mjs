// Plays the pool part a few times and reports where the crates are, on the game clock.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Pictures go to scripts/look/out/. Run `npm run build` first.
const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const EDITOR = new URL('../../dist-editor/editor.html', import.meta.url).href;
const PLAYER = new URL('../../dist/index.html', import.meta.url).href;
import { launch, openPage, sleep } from '../lib.mjs';
const part = process.argv[2] ?? 'pool';
const browser = await launch();
const { page, errors } = await openPage(browser, EDITOR, { viewport: { width: 1500, height: 950 } });
const click = (text) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t)).click(), text);
for (let run = 0; run < 3; run++) {
  await page.evaluate(() => new Promise((done) => { const r = indexedDB.deleteDatabase('editor'); r.onsuccess = r.onerror = r.onblocked = done; }));
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 20000 });
  await sleep(400);
  await page.click('button[data-library="objects"]');
  await page.waitForSelector('.modal');
  await page.click('.modal [data-library-tab="parts"]');
  await page.click(`.modal button[data-block="${part}"]`);
  await page.waitForFunction(() => !document.querySelector('.modal'));
  const objs = await page.evaluate(() => { const s = window.__editor.getState(); const sc = s.project.scenes.find((x) => x.id === s.sceneId) ?? s.project.scenes[0]; return sc.objects.map((o) => ({ id: o.id, name: o.name, x: o.x, y: o.y, w: o.width, h: o.height })); });
  if (run === 0) console.log(objs.map((o) => `${o.name} ${o.x},${o.y} ${o.w}x${o.h}`).join('\n'));
  await click('امتحان کن');
  for (const t of [1, 2, 3, 5]) {
    await page.waitForFunction((t) => window.__game.getState().mode === 'play' && window.__game.getState().time > t, { timeout: 30000 }, t);
    const g = await page.evaluate(() => window.__game.getState());
    console.log(`run ${run} t ${g.time.toFixed(1)}: ` + objs.map((o) => { const e = g.entities.find((x) => x.id === o.id); return e ? `${o.name} ${e.x.toFixed(0)},${e.y.toFixed(0)}` : ''; }).filter(Boolean).join(' | '));
  }
  await click('توقف');
  await sleep(300);
}
console.log(errors);
await browser.close();
