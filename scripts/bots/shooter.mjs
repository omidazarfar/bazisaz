// A bot that plays Star Raiders: keeps a finger on the screen and steers the ship under the nearest enemy,
// sliding away from enemy shots and rocks that come close. node scripts/bots/shooter.mjs [seconds]
import { toPage } from '../lib.mjs';
import { report, startGame, state, tick, watcher } from './bot.mjs';

const limit = Number(process.argv[2] ?? 120);
const { browser, page, errors, names } = await startGame('shooter');
const w = watcher(page, names, 'shooter');
// A person sees the screen all the time; the bot only looks every so often, and a busy computer makes that
// worse. Half speed gives it a person's reaction time; the game itself is unchanged.
await page.evaluate(() => window.__game.setDebug({ speed: 0.5 }));
let outcome = 'timeout';
const gaps = [];
let lastT = 0;
let bossSeen = false;
let finger = { x: 360, y: 1050 };
await page.mouse.move(...(await toPage(page, finger.x, finger.y)));
await page.mouse.down();
try {
  while (true) {
    const s = await state(page);
    const scene = await w.see(s);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    if (s.time > limit) break;
    const me = s.entities.find((e) => e.tags.includes('بازیکن'));
    if (!me) { await tick(page, 0.1); continue; }
    const mx = me.x + me.width / 2;
    const my = me.y + me.height / 2;
    const boss = s.entities.find((e) => e.visible && e.width === 280 && e.height === 180);
    if (boss && !bossSeen) { bossSeen = true; console.log(`  t ${s.time.toFixed(1)} the boss is here`); await w.shot('boss'); }
    const enemies = s.entities.filter((e) => e.visible && e.tags.includes('دشمن') && e.y + e.height < my - 60);
    // Danger: anything harmful within reach and heading this way.
    // Where each harmful thing will be when it reaches the ship's height, within the next second.
    const threats = s.entities.filter((e) => {
      if (!e.visible || e.tags.includes('بازیکن') || !(e.tags.includes('خطر') || e.round)) return false;
      const ex = e.x + e.width / 2;
      const ey = e.y + e.height / 2;
      if (Math.abs(ey - my) < e.height / 2 + 50) return Math.abs(ex - mx) < e.width / 2 + 60;
      const vy = e.vy || 1;
      const t = (my - ey) / vy;
      if (t < 0 || t > 1.0) return false;
      return Math.abs(ex + (e.vx || 0) * t - mx) < e.width / 2 + 60;
    });
    let tx = mx;
    if (threats.length) {
      // Slide toward the side with more room, away from the closest threat.
      const t = threats.reduce((a, b) => (b.y > a.y ? b : a));
      const tc = t.x + t.width / 2;
      const left = mx - 70;
      const right = 650 - mx;
      const away = tc > mx ? -1 : 1;
      const room = away < 0 ? left : right;
      tx = mx + (room > 160 ? away : -away) * 220;
    } else if (enemies.length) {
      const target = enemies.reduce((a, b) => (Math.abs(b.x - mx) < Math.abs(a.x - mx) ? b : a));
      tx = target.x + target.width / 2;
    }
    finger = { x: Math.max(70, Math.min(650, tx)), y: 1050 };
    await page.mouse.move(...(await toPage(page, finger.x, finger.y)));
    if (Math.floor(s.time / 10) !== Math.floor((s.time - 0.08) / 10)) console.log(`  t ${s.time.toFixed(1)} score ${s.variables.score} lives ${s.variables.lives} wall ${Math.round(process.uptime())}s`);
    if (process.env.BOT_DEBUG) { gaps.push(s.time - lastT); lastT = s.time; }
    await tick(page, 0.05);
  }
} finally {
  await page.mouse.up();
  const s = await state(page);
  await w.shot('end');
  if (process.env.BOT_DEBUG) { gaps.sort((a, b) => a - b); console.log('  game seconds between looks: median', gaps[gaps.length >> 1]?.toFixed(3), 'worst', gaps.at(-1)?.toFixed(3)); }
  report('shooter', outcome, w, { score: s.variables.score, lives: s.variables.lives, boss: bossSeen, errors });
  await browser.close();
}
