// A bot that plays Sky Hopper: it flaps whenever the bird has sunk below the middle of the next gap
// and is falling. node scripts/bots/hopper.mjs [seconds]
import { report, startGame, state, tick, watcher } from './bot.mjs';

const limit = Number(process.argv[2] ?? 90);
const { browser, page, project, errors, names } = await startGame('hopper');
const w = watcher(page, names, 'hopper');
const gatesOf = new Map(project.scenes.map((s) => [s.id, s.objects.filter((o) => o.name.startsWith('دروازه')).sort((a, b) => a.x - b.x)]));
let outcome = 'timeout';
let flapped = -1;
let lastScene = null;
try {
  while (true) {
    const s = await state(page);
    const scene = await w.see(s);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    if (s.time > limit) break;
    const me = s.entities.find((e) => e.tags.includes('بازیکن'));
    if (!me) { await tick(page, 0.1); continue; }
    // A new level starts its clock again: forget when the last flap was.
    if (s.scene !== lastScene) { lastScene = s.scene; flapped = -1; }
    const gates = gatesOf.get(s.scene) ?? [];
    if (!gates.length) { await tick(page, 0.1); continue; }
    const gate = gates.find((g) => g.x + g.width > me.x) ?? gates.at(-1);
    const middle = gate.y + gate.height / 2 + 30;
    const centre = me.y + me.height / 2;
    if (centre > middle && me.vy > -100 && s.time - flapped > 0.18) {
      await page.keyboard.press('Space');
      flapped = s.time;
    }
    if (Math.floor(s.time) !== Math.floor(s.time - 0.04)) console.log(`  t ${s.time.toFixed(1)} x ${Math.round(me.x)} y ${Math.round(me.y)} gate ${Math.round(middle)} score ${s.variables.score} lives ${s.variables.lives}`);
    await tick(page, 0.03);
  }
} finally {
  const s = await state(page);
  await w.shot('end');
  report('hopper', outcome, w, { score: s.variables.score, lives: s.variables.lives, errors });
  await browser.close();
}
