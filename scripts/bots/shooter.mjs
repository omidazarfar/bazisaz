// A bot that plays Star Raiders: keeps a finger on the screen and steers the ship under the nearest enemy,
// sliding away from enemy shots and rocks that come close. node scripts/bots/shooter.mjs [seconds]
import { steeringX } from './shooter-steering.mjs';
import { toPage } from '../lib.mjs';
import { report, startGame, state, tick, watcher } from './bot.mjs';

const limit = Number(process.argv[2] ?? 120);
const { browser, page, errors, names, project } = await startGame('shooter');
const level = project.scenes.find(sc => sc.prefabs.some(p => p.tags.includes('تیر دشمن')));
const waveMaker = level.objects.find(o => o.behaviors.some(b => b.type === 'spawner' && b.prefabs.some(id => level.prefabs.find(p => p.id === id)?.tags.includes('دشمن'))));
const motion = new Map(level.prefabs.map(p => [p.id, {
  mover: p.behaviors.find(b => b.type === 'mover'), wave: p.behaviors.find(b => b.type === 'wave' && b.axis === 'x'),
  startY: waveMaker.y - p.height,
}]));
const speed = level.objects.find(o => o.tags.includes('بازیکن')).behaviors.find(b => b.type === 'followFinger').speed;
const w = watcher(page, names, 'shooter');
// A person sees the screen all the time; the bot only looks every so often, and a busy computer makes that
// worse. Half speed gives it a person's reaction time; the game itself is unchanged.
await page.evaluate(() => window.__game.setDebug({ speed: 0.5 }));
let outcome = 'timeout';
const gaps = [];
let lastT = 0;
let elapsed = 0;
let bossSeen = false;
let finger = { x: 360, y: 1050 };
await page.mouse.move(...(await toPage(page, finger.x, finger.y)));
await page.mouse.down();
try {
  while (true) {
    const s = await state(page);
    const scene = await w.see(s);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    elapsed = s.time;
    if (elapsed >= limit) break;
    const me = s.entities.find((e) => e.tags.includes('بازیکن'));
    if (!me) { await tick(page, 0.1); continue; }
    const boss = s.entities.find((e) => e.visible && e.width === 280 && e.height === 180);
    if (boss && !bossSeen) { bossSeen = true; console.log(`  t ${s.time.toFixed(1)} the boss is here`); await w.shot('boss'); }
    finger = { x: steeringX(me, s.entities, motion, project.meta.width, speed), y: 1050 };
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
  report('shooter', outcome, w, { elapsed, score: s.variables.score, lives: s.variables.lives, boss: bossSeen, errors });
  await browser.close();
}
