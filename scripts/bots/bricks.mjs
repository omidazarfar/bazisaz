// A bot that plays Brick Blitz: a finger held on the screen keeps the paddle under the ball, a little to one
// side or the other so the round paddle sends the ball off at new angles. node scripts/bots/bricks.mjs [seconds]
import { toPage } from '../lib.mjs';
import { report, startGame, state, tick, watcher } from './bot.mjs';

const limit = Number(process.argv[2] ?? 240);
const { browser, page, errors, names } = await startGame('bricks');
const w = watcher(page, names, 'bricks');
let outcome = 'timeout';
let offset = 0;
await page.mouse.move(...(await toPage(page, 360, 1150)));
await page.mouse.down();
try {
  while (true) {
    const s = await state(page);
    const scene = await w.see(s);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    if (s.time > limit) break;
    const ball = s.entities.find((e) => e.tags.includes('توپ'));
    if (!ball) { await tick(page, 0.1); continue; }
    // A new side to hit it with each time it goes back up.
    if (ball.vy < 0 && Math.abs(offset) < 1) offset = (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 45);
    if (ball.vy > 0) offset *= 1;
    const aim = ball.x + ball.width / 2 + (ball.vy > 0 ? offset : 0);
    await page.mouse.move(...(await toPage(page, Math.max(100, Math.min(620, aim)), 1150)));
    if (ball.vy > 0 && ball.y > 900) offset = offset || 30;
    if (ball.vy < 0) offset = 0;
    if (Math.floor(s.time / 15) !== Math.floor((s.time - 0.05) / 15)) console.log(`  t ${s.time.toFixed(0)} score ${s.variables.score} lives ${s.variables.lives}`);
    await tick(page, 0.03);
  }
} finally {
  await page.mouse.up();
  const s = await state(page);
  await w.shot('end');
  report('bricks', outcome, w, { score: s.variables.score, lives: s.variables.lives, errors });
  await browser.close();
}
