// Plays the sling-and-tower part the way a person would: a few throws, reporting what each did.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Pictures go to scripts/look/out/. Run `npm run build` first.
const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const EDITOR = new URL('../../dist-editor/editor.html', import.meta.url).href;
const PLAYER = new URL('../../dist/index.html', import.meta.url).href;
import { launch, openPage, sleep, toPage } from '../lib.mjs';
const browser = await launch();
const { page, errors } = await openPage(browser, EDITOR, { viewport: { width: 1500, height: 950 } });
await page.evaluate(() => new Promise((done) => { const r = indexedDB.deleteDatabase('editor'); r.onsuccess = r.onerror = r.onblocked = done; }));
await page.reload();
await page.waitForFunction(() => window.__game && window.__editor, { timeout: 20000 });
await sleep(500);
await page.click('button[data-library="objects"]');
await page.waitForSelector('.modal');
await page.click('.modal [data-library-tab="parts"]');
await page.click('.modal button[data-block="sling-tower"]');
await page.waitForFunction(() => !document.querySelector('.modal'));
const click = (text) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t)).click(), text);
for (const [dx, dy] of [[-150, 150], [-200, 60], [-120, 200]]) {
  await click('امتحان کن');
  await page.waitForFunction(() => window.__game.getState().mode === 'play' && window.__game.getState().time > 1);
  const st = await page.evaluate(() => window.__game.getState());
  const stone = st.entities.find((e) => e.tags.includes('پرتابی'));
  const cx = stone.x + stone.width / 2;
  const cy = stone.y + stone.height / 2;
  await page.mouse.move(...(await toPage(page, cx, cy)));
  await page.mouse.down();
  await page.mouse.move(...(await toPage(page, cx + dx, cy + dy)), { steps: 10 });
  await sleep(200);
  await page.screenshot({ path: `${out}t-aim-${dx}-${dy}.png` });
  await page.mouse.up();
  for (let k = 0; k < 4; k++) {
    console.log(await page.evaluate(() => {
      const physics = window.__game.physics;
      const rec = [...physics.recs.values()].find((r) => r.thing.def.tags.includes('پرتابی'));
      const p = rec.body.getPosition();
      const touching = [];
      for (let e = rec.body.getContactList(); e; e = e.next) {
        const u = e.other.getUserData();
        touching.push(`${typeof u === 'string' ? u : u?.thing?.def?.name}:${e.contact.isTouching()}:${e.contact.isEnabled()}`);
      }
      return `   t ${window.__game.getState().time.toFixed(2)} centre ${(p.x * 40).toFixed(0)},${(p.y * 40).toFixed(0)} type ${rec.body.getType()} ready ${rec.ready} ignore ${rec.ignore ? rec.ignore.size : '-'} contacts ${touching.join(' ')}`;
    }));
    await sleep(30);
  }
  let maxX = 0;
  for (let i = 0; i < 30; i++) {
    await sleep(100);
    const now = await page.evaluate(() => window.__game.getState());
    const s = now.entities.find((e) => e.tags.includes('پرتابی'));
    if (s) maxX = Math.max(maxX, s.x);
    if (i < 6 && s) console.log(`  ${now.time.toFixed(2)} ${s.x.toFixed(0)},${s.y.toFixed(0)} v ${s.vx.toFixed(0)},${s.vy.toFixed(0)}`);
  }
  const end = await page.evaluate(() => window.__game.getState());
  console.log(`pull ${dx},${dy}: stone reached x ${maxX.toFixed(0)}, stars left ${end.entities.filter((e) => e.tags.includes('هدف')).length}, score ${end.variables.score}`);
  await page.screenshot({ path: `${out}t-after-${dx}-${dy}.png` });
  await click('توقف');
  await sleep(300);
}
console.log(errors);
await browser.close();
