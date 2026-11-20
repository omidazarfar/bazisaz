// Drops the platformer's hero onto a slime and lists the rules that ran, to see what hurt it.
import { launch, openPage, sleep, toPage } from '../lib.mjs';
const browser = await launch();
const { page, errors } = await openPage(browser, new URL('../../dist-editor/editor.html', import.meta.url).href, { viewport: { width: 1440, height: 900 } });
const click = (t) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t || b.textContent.includes(t))?.click(), t);
const state = () => page.evaluate(() => window.__game.getState());
await page.waitForFunction(() => window.__game && window.__editor);
await click('بازی جدید'); await sleep(150); await click('بله، بازی خالی'); await sleep(400);
await page.click('[data-library="objects"]'); await page.click('[data-library-tab="genre"]'); await page.click('[data-genre="platform"]');
await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 30000 });
await click('امتحان کن');
await page.waitForFunction(() => window.__game.getState().time > 0.8, { timeout: 60000 });
const play = (await state()).entities.find((e) => e.width === 220 && e.height === 220);
await page.mouse.click(...(await toPage(page, play.x + 110, play.y + 110)));
await page.waitForFunction((s) => window.__game.getState().scene !== s && window.__game.getState().time > 0.6, { timeout: 60000 }, (await state()).scene);
const which = Number(process.argv[2] ?? 0);
console.log(await page.evaluate((which) => {
  const g = window.__game;
  const slime = g.entities.filter((e) => e.def.name.startsWith('لجن'))[which];
  const hero = g.entities.find((e) => e.def.tags.includes('بازیکن'));
  slime.def = { ...slime.def, behaviors: [] };
  hero.x = slime.x + (slime.width - hero.width) / 2; hero.y = slime.y - 240; hero.vx = 0; hero.vy = 0;
  return `slime ${slime.def.name} at ${Math.round(slime.x)},${Math.round(slime.y)}`;
}, which));
const t = (await state()).time;
await page.waitForFunction((t) => window.__game.getState().time > t + 2, { timeout: 60000 }, t);
const names = await page.evaluate(() => {
  const s = window.__game.scene;
  return window.__game.getDebug().log.map((l) => {
    const r = s.rules.find((x) => x.id === l.rule);
    return `${l.time.toFixed(2)} ${r ? r.when.type + (r.when.from ? ':' + r.when.from : '') + ' ' + (r.when.b?.tag ?? r.when.name ?? '') : l.rule} ran=${l.ran}`;
  }).slice(-12);
});
console.log(names.join('\n'));
console.log(JSON.stringify((await state()).variables), errors);
await browser.close();
