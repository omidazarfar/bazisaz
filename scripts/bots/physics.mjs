// A bot that plays Rock Smash: pulls the rock back and lets go, aiming at the targets that are left,
// learning from each throw (a short throw pulls harder next time, a long one softer). node scripts/bots/physics.mjs
import { toPage } from '../lib.mjs';
import { report, startGame, state, tick, watcher } from './bot.mjs';

const { browser, page, errors, names } = await startGame('physics');
const w = watcher(page, names, 'physics');
let outcome = 'timeout';
// Pull back and down from the rock: [dx, dy] in game pixels.
const TRIES = [{ x: -170, y: 110 }, { x: -190, y: 80 }, { x: -160, y: 150 }, { x: -200, y: 120 }, { x: -180, y: 60 }];
let pull = TRIES[0];
const log = [];
try {
  await tick(page, 1.5);
  for (let throwNo = 1; throwNo <= Number(process.env.BOT_THROWS ?? 7); throwNo++) {
    let s = await state(page);
    let scene = await w.see(s);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    const rock = s.entities.find((e) => e.tags.includes('پرتابی'));
    const targets = s.entities.filter((e) => e.tags.includes('هدف') && e.visible);
    if (!rock || !targets.length) { await tick(page, 1); continue; }
    // Aim at the highest target left (falling ones knock others down); work out a lob that passes through it.
    // The barrel first, if it is still there; then the highest alien left.
    const barrel = s.entities.find((e) => e.tags.includes('انفجاری') && e.visible);
    let aim = barrel ?? targets.reduce((a, b) => (b.y < a.y ? b : a));
    // An alien hiding low behind a tower: knock the tower's top block over onto it, with a hard, flat shot.
    const flat = !barrel && aim.y > 950;
    if (flat) {
      const blocks = s.entities.filter((e) => e.tags.includes('جعبه') && e.visible && e.x < aim.x && e.width <= 100);
      if (blocks.length) aim = blocks.reduce((a, b) => (b.y < a.y ? b : a));
    }
    const [cx, cy] = [rock.x + rock.width / 2, rock.y + rock.height / 2];
    const [tx, ty] = [aim.x + aim.width / 2, aim.y + aim.height / 2];
    const gravity = 2400;
    let best = null;
    for (let px = -200; px <= -60; px += 5) {
      for (let py = 0; py <= 200; py += 5) {
        if (Math.hypot(px, py) > 195) continue;
        // The stone flies from where it was pulled back to.
        const [vx, vy] = [-px * 8, -py * 8];
        const [sx, sy] = [cx + px, cy + py];
        const t = (tx - sx) / vx;
        const miss = Math.abs(sy + vy * t + (gravity / 2) * t * t - ty);
        // Among throws that pass through it, the steepest: it comes down from above, over the towers.
        if (miss < 14 && (!best || (flat ? Math.hypot(px, py) > Math.hypot(best.x, best.y) : py > best.y))) best = { x: px, y: py };
      }
    }
    pull = best ?? pull;
    await page.mouse.move(...(await toPage(page, cx, cy)));
    await page.mouse.down();
    await page.mouse.move(...(await toPage(page, cx + pull.x, cy + pull.y)), { steps: 10 });
    await tick(page, 0.2);
    if (process.env.BOT_DEBUG) { const h = (await state(page)).entities.find((e) => e.tags.includes('پرتابی')); console.log('  dbg held at', Math.round(h.x + h.width / 2), Math.round(h.y + h.height / 2), 'wanted', cx + pull.x, cy + pull.y); }
    await page.mouse.up();
    // Follow the rock; note the furthest it got and where it came down.
    let furthest = cx;
    for (let i = 0; i < 40; i++) {
      await tick(page, 0.1);
      const now = await state(page);
      const r = now.entities.find((e) => e.tags.includes('پرتابی'));
      if (r) furthest = Math.max(furthest, r.x + r.width / 2);
      if (process.env.BOT_DEBUG && r && i < 12) console.log('  dbg', now.time.toFixed(2), Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2), Math.round(r.vx), Math.round(r.vy));
      if (i === 8) await w.shot(`throw${throwNo}`);
    }
    await tick(page, 1.5);
    s = await state(page);
    scene = await w.see(s);
    const left = s.entities.filter((e) => e.tags.includes('هدف') && e.visible).length;
    const line = `throw ${throwNo}: pull ${pull.x},${pull.y} aim x ${Math.round(aim.x)} rock reached x ${Math.round(furthest)}; targets left ${left}; shots ${s.variables.shots}; scene ${scene}`;
    console.log('  ' + line);
    log.push(line);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    pull = TRIES[throwNo % TRIES.length];
  }
  if (outcome === 'timeout') {
    await tick(page, 6);
    outcome = names[(await state(page)).scene] ?? outcome;
  }
} finally {
  const s = await state(page);
  await w.shot('end');
  report('physics', outcome, w, { score: s.variables.score, errors });
  await browser.close();
}
