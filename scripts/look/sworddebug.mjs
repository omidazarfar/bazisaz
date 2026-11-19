// Debugs the sword part: what happens, frame by frame, after the sword button is tapped.
import { launch, openPage, sleep, toPage } from '../lib.mjs';
const EDITOR = new URL('../../dist-editor/editor.html', import.meta.url).href;
const browser = await launch();
const { page, errors } = await openPage(browser, EDITOR, { viewport: { width: 1500, height: 950 } });
const click = (text) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t)).click(), text);
await page.evaluate(() => new Promise((done) => { const r = indexedDB.deleteDatabase('editor'); r.onsuccess = r.onerror = r.onblocked = done; }));
await page.reload();
await page.waitForFunction(() => window.__game && window.__editor, { timeout: 20000 });
await sleep(400);
await click('بازی جدید');
await sleep(150);
await click('بله، بازی خالی');
await sleep(400);
const add = async (tab, id) => {
  await page.click('button[data-library="objects"]');
  await page.waitForSelector('.modal');
  await page.click(`.modal [data-library-tab="${tab}"]`);
  await page.click(`.modal button[data-block="${id}"]`);
  await page.waitForFunction(() => !document.querySelector('.modal'));
  await sleep(200);
};
await add('roles', 'jump-player');
await add('roles', 'patrol-enemy');
await add('parts', 'sword');
await click('امتحان کن');
await page.waitForFunction(() => window.__game.getState().mode === 'play' && window.__game.getState().time > 0.6);
await page.evaluate(() => {
  const player = window.__game.entities.find((e) => e.def.tags.includes('بازیکن'));
  const enemy = window.__game.entities.find((e) => e.def.tags.includes('خطر'));
  enemy.def = { ...enemy.def, behaviors: [] };
  enemy.vx = enemy.vy = 0;
  player.def = { ...player.def, behaviors: [] };
  player.vx = player.vy = 0;
  enemy.x = player.x + player.width + 10;
  enemy.y = player.y;
});
const button = (await page.evaluate(() => window.__game.getState())).entities.find((e) => e.tags.includes('دکمه‌ی شمشیر'));
console.log('button', button.x, button.y, button.width, button.height);
await page.mouse.click(...(await toPage(page, button.x + button.width / 2, button.y + button.height / 2)));
for (let i = 0; i < 6; i++) {
  console.log(await page.evaluate(() => {
    const s = window.__game.getState();
    const pick = s.entities.filter((e) => ['ضربه', 'خطر', 'بازیکن'].includes(e.tags[0])).map((e) => `${e.tags[0]}@${Math.round(e.x)},${Math.round(e.y)} w${e.width} h${e.health}`);
    const log = window.__game.getDebug().log.slice(-4).map((l) => `${l.rule}:${l.ran}`);
    return `t${s.time.toFixed(2)} ${pick.join(' | ')} || ${log.join(' ')}`;
  }));
  await sleep(50);
}
console.log(errors);
await browser.close();
