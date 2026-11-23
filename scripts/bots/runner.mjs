// A bot that plays Rooftop Run (the runner runs by itself): it jumps when a gap or a crate is just ahead,
// and jumps again in the air over the wide gaps. node scripts/bots/runner.mjs [seconds]
import { report, startGame, state, tick, watcher } from './bot.mjs';

const limit = Number(process.argv[2] ?? 90);
const { browser, page, project, errors, names } = await startGame('runner');
const w = watcher(page, names, 'runner');
// Each level has its own rooftops: read those of the scene being played.
const roofsOf = new Map(project.scenes.map((s) => [s.id, s.objects.filter((o) => o.name.startsWith('بام')).sort((a, b) => a.x - b.x)]));
let outcome = 'timeout';
let jumpedAt = -1;
let doubled = false;
let lastScene = null;
const tap = () => page.keyboard.press('Space');
try {
  while (true) {
    const s = await state(page);
    const scene = await w.see(s);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    if (s.time > limit) break;
    const me = s.entities.find((e) => e.tags.includes('بازیکن'));
    if (!me) { await tick(page, 0.1); continue; }
    // A new level starts its clock again: forget when the last jump was.
    if (s.scene !== lastScene) { lastScene = s.scene; jumpedAt = -1; doubled = false; }
    const roofs = roofsOf.get(s.scene) ?? [];
    const front = me.x + me.width;
    const roof = roofs.find((r) => r.x <= me.x + me.width / 2 && r.x + r.width >= me.x + me.width / 2);
    const edgeAhead = roof ? roof.x + roof.width - front : 0;
    const crate = s.entities.find((e) => e.tags.includes('زمین') && e.width === 80 && e.x - front > -4 && e.x - front < 120 && e.y < me.y + me.height);
    if (me.grounded) {
      doubled = false;
      if ((roof && edgeAhead < 70) || crate) { await tap(); jumpedAt = s.time; }
    } else if (!doubled && s.time - jumpedAt > 0.3 && me.vy > 0) {
      // Falling and there is no roof under the feet: the second jump.
      const under = roofs.some((r) => r.x < front && r.x + r.width > me.x + 10);
      if (!under) { await tap(); doubled = true; }
    }
    await tick(page, 0.03);
  }
} finally {
  const s = await state(page);
  await w.shot('end');
  report('runner', outcome, w, { score: s.variables.score, lives: s.variables.lives, errors });
  await browser.close();
}
