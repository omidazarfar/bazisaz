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
  await page.evaluate((t) => [...document.querySelectorAll('.modal [role=tab]')].find((b) => b.textContent.includes(t)).click(), tab);
  await sleep(200);
  await page.click(`.modal button[data-block="${id}"]`);
  await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 15000 });
  await sleep(200);
};
await add('با نقش آماده', 'jump-player');
await add('با نقش آماده', 'patrol-enemy');
await add('قطعه‌های آماده', 'sword');
console.log('rules', JSON.stringify(await page.evaluate(() => { const s = window.__editor.getState(); const sc = s.project.scenes.find((x) => x.id === s.sceneId); return sc.rules.map((r) => [r.id, r.when.type, JSON.stringify(r.when.target ?? '')]); })));
await click('امتحان کن');
try {
  await page.waitForFunction(() => window.__game.getState().mode === 'play' && window.__game.getState().time > 0.6, { timeout: 60000 });
} catch (error) {
  console.log('Try-out stalled', await page.evaluate(() => ({ state: window.__game.getState(), debug: window.__game.getDebug() })), errors);
  await browser.close();
  throw error;
}
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
    const log = window.__game.getDebug().log.slice(-6).map((l) => `${l.rule}:${l.ran}`);
    return `t${s.time.toFixed(2)} ${pick.join(' | ')} || ${log.join(' ')}`;
  }));
  await sleep(50);
}
console.log(errors);
await browser.close();
