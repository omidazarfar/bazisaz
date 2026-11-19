// Each ready-made part in a fresh game, played for a moment and photographed.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Pictures go to scripts/look/out/. Run `npm run build` first.
const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const EDITOR = new URL('../../dist-editor/editor.html', import.meta.url).href;
const PLAYER = new URL('../../dist/index.html', import.meta.url).href;
import { launch, openPage, sleep, toPage } from '../lib.mjs';
const only = process.argv[2] ? process.argv[2].split(',') : null;
const PARTS = [
  ['sling-tower', []], ['car', []], ['bridge', []], ['conveyor', []], ['pool', []], ['cut-rope', []], ['pendulum', []],
  ['pause-menu', ['score']], ['startscreen', []], ['levels', []], ['controls', ['score', 'best', 'timer']],
];
const browser = await launch();
const { page, errors } = await openPage(browser, EDITOR, { viewport: { width: 1500, height: 950 } });
const click = (text) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t || b.textContent.includes(t)).click(), text);
const addPart = async (id) => {
  await page.click('button[data-library="objects"]');
  await page.waitForSelector('.modal');
  await page.click('.modal [data-library-tab="parts"]');
  await page.click(`.modal button[data-block="${id}"]`);
  await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 20000 });
  await sleep(300);
};
for (const [id, extra] of PARTS) {
  if (only && !only.includes(id)) continue;
  await page.evaluate(() => new Promise((done) => { const r = indexedDB.deleteDatabase('editor'); r.onsuccess = r.onerror = r.onblocked = done; }));
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 20000 });
  await sleep(400);
  for (const e of extra) await addPart(e);
  await addPart(id);
  await page.screenshot({ path: `${out}p-${id}-edit.png` });
  await click('امتحان کن');
  await page.waitForFunction(() => window.__game.getState().mode === 'play' && window.__game.getState().time > 1.2, { timeout: 20000 });
  if (id === 'pause-menu') {
    const b = await page.evaluate(() => window.__game.getState().entities.find((e) => e.width === 90 && e.height === 90));
    if (b) {
      await page.mouse.move(...(await toPage(page, b.x + b.width / 2, b.y + b.height / 2)));
      await page.mouse.down(); await sleep(120); await page.mouse.up();
      await sleep(600);
    }
  }
  if (id === 'sling-tower') {
    const st = await page.evaluate(() => window.__game.getState().entities.find((e) => e.tags.includes('پرتابی')));
    const [cx, cy] = [st.x + st.width / 2, st.y + st.height / 2];
    await page.mouse.move(...(await toPage(page, cx, cy)));
    await page.mouse.down();
    await page.mouse.move(...(await toPage(page, cx - 130, cy + 110)), { steps: 8 });
    await sleep(200);
    await page.screenshot({ path: `${out}p-sling-aim.png` });
    await page.mouse.up();
    await sleep(1200);
  }
  await page.screenshot({ path: `${out}p-${id}.png` });
  await click('توقف');
  await sleep(300);
}
console.log(errors);
await browser.close();
