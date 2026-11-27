// A bot that plays Sky Quest like a person: runs right, jumps over gaps, steps, spikes and enemies, double-jumps over wide gaps.
// node scripts/bots/platform.mjs
import { report, startGame, state, tick, watcher } from './bot.mjs';

const GROUND = 'زمین';
const ENEMY = 'دشمن';
const SPIKES = 'تیغ';
const { browser, page, errors, names } = await startGame('platform');
const w = watcher(page, names, 'platform');
const jump = async () => {
  await page.keyboard.down('Space');
  await tick(page, 0.03);
  await page.keyboard.up('Space');
};
// CLUMSY=0.5 plays like a new player for a playtest round: it reacts late about half the time (flagship Phase G).
const CLUMSY = Number(process.env.CLUMSY ?? 0);
const late = () => CLUMSY > 0 && Math.random() < CLUMSY;
let outcome = 'timeout';
let best = 0;
let bestAt = 0;
let doubled = false;
let lastScene = null;
await page.keyboard.down('ArrowRight');
try {
  while (true) {
    const s = await state(page);
    const scene = await w.see(s);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    if (s.time > Number(process.argv[2] ?? 60)) break;
    const me = s.entities.find((e) => e.tags.includes('بازیکن'));
    if (!me) { await tick(page, 0.1); continue; }
    // A new level starts from its left end, with its own clock.
    if (s.scene !== lastScene) { lastScene = s.scene; best = 0; bestAt = s.time; doubled = false; }
    const solids = s.entities.filter((e) => e.tags.includes(GROUND) && e.visible);
    const feet = me.y + me.height;
    const solidAt = (x, y) => solids.some((b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height);
    const ahead = me.x + me.width;
    // Something in the way at body height, a gap under the next step, a hazard close ahead.
    const wall = solidAt(ahead + 30, feet - 20) || solidAt(ahead + 30, me.y + me.height / 2);
    const gap = !solidAt(ahead + 40, feet + 10) && !solidAt(ahead + 90, feet + 10);
    // (Not a bat flying above head height: walking under it is safe, jumping would go right into it.)
    const hazard = s.entities.some((e) => e.visible && (e.tags.includes(ENEMY) || e.tags.includes(SPIKES)) && e.x - ahead < 170 && e.x + e.width > me.x && Math.abs(e.y + e.height - feet) < 260 && e.y + e.height > me.y + 10);
    if (me.grounded) doubled = false;
    if (me.grounded && (wall || gap || hazard) && !late()) await jump();
    // Falling with nothing below: the second jump.
    else if (!me.grounded && !doubled && !late() && me.vy > 50 && !solidAt(me.x + me.width / 2, feet + 120) && !solidAt(me.x + me.width / 2, feet + 260)) {
      doubled = true;
      await jump();
    }
    if (me.x > best + 20) { best = me.x; bestAt = s.time; }
    if (Math.floor(s.time / 5) !== Math.floor((s.time - 0.07) / 5)) console.log(`  t ${s.time.toFixed(1)} x ${Math.round(me.x)} score ${s.variables.score} lives ${s.variables.lives} wall-clock ${Math.round(process.uptime())}s`);
    if (s.time - bestAt > 6) {
      w.notes.push(`${s.time.toFixed(1)}s stuck at x ${Math.round(me.x)} → ${await w.shot('stuck')}`);
      bestAt = s.time;
      await jump();
    }
    await tick(page, 0.06);
  }
} finally {
  const s = await state(page);
  await w.shot('end');
  // An automated playtest round (flagship Phase G): where the bot lost a life or got stuck, per level.
  const marks = await page.evaluate(() => (window.__game?.playtest ?? []).map((m) => `${m.kind}@${m.scene}:${m.x}`)).catch(() => []);
  if (marks.length) w.notes.push(`playtest marks: ${marks.join(' ')}`);
  report('platform', outcome, w, { time: Number(s.time.toFixed(1)), score: s.variables.score, lives: s.variables.lives, furthest: Math.round(best), errors });
  await browser.close();
}
