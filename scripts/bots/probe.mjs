// Holds one arrow key in a saved game and reports how the player moves: a quick check of controls.
import { startGame, state, tick } from './bot.mjs';
const [genre, keyList] = [process.argv[2] ?? 'adventure', process.argv[3] ?? 'ArrowRight'];
const keys = keyList.split('+');
const { browser, page } = await startGame(genre);
const me = async () => (await state(page)).entities.find((e) => e.tags.includes('بازیکن'));
const a = await me();
for (const k of keys) await page.keyboard.down(k);
await tick(page, Number(process.argv[4] ?? 0.6));
const b = await me();
for (const k of keys) await page.keyboard.up(k);
console.log(JSON.stringify({ before: [Math.round(a.x), Math.round(a.y)], after: [Math.round(b.x), Math.round(b.y)], vx: b.vx, vy: b.vy, keys: await page.evaluate(() => [...window.__game.keys]), behaviors: await page.evaluate(() => window.__game.entities.find((e) => e.def.tags.includes('بازیکن')).def.behaviors.map((x) => x.type)) }));
await browser.close();
