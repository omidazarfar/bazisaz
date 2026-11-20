// Starts a saved game and prints a summary of what is on screen: tags, sizes, counts.
import { startGame, state, tick } from './bot.mjs';
const { browser, page } = await startGame(process.argv[2] ?? 'puzzle');
await tick(page, 1);
const s = await state(page);
const groups = {};
for (const e of s.entities) { const k = `${e.tags.join('+') || '-'} ${Math.round(e.width)}x${Math.round(e.height)} vis=${e.visible}`; groups[k] = (groups[k] ?? 0) + 1; }
console.log(JSON.stringify(groups, null, 1));
console.log(JSON.stringify(s.variables));
const g = s.entities.find((e) => e.tags.length && e.values && Object.keys(e.values).length);
console.log(JSON.stringify(g && { tags: g.tags, values: g.values, vx: g.vx, vy: g.vy }));
await browser.close();
