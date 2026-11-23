// A bot that plays Tower Climb: on each floor it walks to the ladder, climbs it (W) and steps off onto the
// next floor, jumping over or onto the slimes on the way, and at the top runs to the bell.
// node scripts/bots/tower.mjs [seconds]
import { report, startGame, state, tick, watcher } from './bot.mjs';

const limit = Number(process.argv[2] ?? 90);
const { browser, page, project, errors, names } = await startGame('tower');
const w = watcher(page, names, 'tower');
// Each level (the one made by hand and the ones made from it) has its own ladders and bell.
const towerOf = new Map(project.scenes.filter((s) => s.objects.some((o) => o.name === 'زنگ بالای برج')).map((s) => [s.id, {
  ladders: s.objects.filter((o) => o.name.startsWith('نردبان ')).sort((a, b) => b.y - a.y),
  bell: s.objects.find((o) => o.name === 'زنگ بالای برج'),
}]));
const held = new Set();
const hold = async (keys) => {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
};
let outcome = 'timeout';
let lastJump = 0;
try {
  while (true) {
    const s = await state(page);
    const scene = await w.see(s);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    if (s.time > limit) break;
    if (s.dialogue) { await hold([]); await page.keyboard.press('Space'); await new Promise((r) => setTimeout(r, 300)); continue; }
    const me = s.entities.find((e) => e.tags.includes('بازیکن'));
    if (!me || !towerOf.has(s.scene)) { await tick(page, 0.1); continue; }
    const { ladders, bell } = towerOf.get(s.scene);
    const mx = me.x + me.width / 2;
    const foot = me.y + me.height;
    // Which floor the hero is at or above: each ladder's top sticks up 40 past the floor it leads to.
    const tops = ladders.map((l) => l.y + 40);
    let floorAt = 0;
    tops.forEach((top, i) => { if (foot <= top + 4) floorAt = i + 1; });
    const came = floorAt > 0 ? ladders[floorAt - 1] : null;
    const next = ladders[floorAt];
    let keys = [];
    let onLadder = false;
    if (came && Math.abs(mx - (came.x + came.width / 2)) < 75) {
      // Just up the ladder, still over the hole it came through: step off onto the floor, away from the hole.
      keys = ['KeyW', came.x + came.width / 2 > 360 ? 'ArrowLeft' : 'ArrowRight'];
      onLadder = true;
    } else if (!next) {
      // On the top floor: to the bell.
      keys = [bell.x + bell.width / 2 > mx ? 'ArrowRight' : 'ArrowLeft'];
    } else {
      const lx = next.x + next.width / 2;
      onLadder = Math.abs(mx - lx) < next.width / 2 - 10;
      keys = onLadder ? ['KeyW'] : [lx > mx ? 'ArrowRight' : 'ArrowLeft'];
    }
    {
      if (!onLadder) {
        // A slime ahead on the same floor and close: jump (onto it, or over it).
        const way = keys.includes('ArrowRight') ? 1 : keys.includes('ArrowLeft') ? -1 : 0;
        const slime = s.entities.find((e) => e.visible && e.tags.includes('دشمن') && Math.abs(e.y + e.height - foot) < 30 && (e.x + e.width / 2 - mx) * way > 0 && Math.abs(e.x + e.width / 2 - mx) < 190);
        if (slime && me.grounded && s.time - lastJump > 0.5) {
          lastJump = s.time;
          await page.keyboard.press('Space');
        }
      }
    }
    await hold(keys);
    if (Math.floor(s.time / 10) !== Math.floor((s.time - 0.1) / 10)) console.log(`  t ${s.time.toFixed(1)} score ${s.variables.score} lives ${s.variables.lives} y ${Math.round(me.y)}`);
    await tick(page, 0.06);
  }
} finally {
  await hold([]);
  const s = await state(page);
  await w.shot('end');
  report('tower', outcome, w, { score: s.variables.score, lives: s.variables.lives, errors });
  await browser.close();
}
