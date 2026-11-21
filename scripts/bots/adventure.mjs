// A bot that plays Dungeon Escape: finds its way through the rooms to the key, the door and the treasure,
// steering with the arrow keys and swinging the sword at skeletons that come close.
// node scripts/bots/adventure.mjs [seconds]
import { clickGame } from '../lib.mjs';
import { report, startGame, state, tick, watcher } from './bot.mjs';

const GROUND = 'زمین';
const CELL = 20;
const limit = Number(process.argv[2] ?? 120);
const { browser, page, errors, names } = await startGame('adventure');
const w = watcher(page, names, 'adventure');
const held = new Set();
const hold = async (keys) => {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
};

/** The next point on a shortest way through the free cells of the world to `goal`, or null if there is none. */
function nextStep(s, me, goal, world, target) {
  const cols = Math.ceil(world.width / CELL);
  const rows = Math.ceil(world.height / CELL);
  // A cell is blocked if a wall or pillar covers it, with room for the knight's body.
  const pad = 52;
  const walls = s.entities.filter((e) => e.tags.includes(GROUND) && e.visible && e.id !== target?.id);
  const blocked = new Uint8Array(cols * rows);
  // Blocked when the cell's middle is within the knight's half-size of a wall.
  for (const b of walls) {
    for (let r = Math.max(0, Math.floor((b.y - pad) / CELL)); r <= Math.min(rows - 1, Math.floor((b.y + b.height + pad) / CELL)); r++) {
      for (let c = Math.max(0, Math.floor((b.x - pad) / CELL)); c <= Math.min(cols - 1, Math.floor((b.x + b.width + pad) / CELL)); c++) {
        const [mx, my] = [c * CELL + CELL / 2, r * CELL + CELL / 2];
        if (mx > b.x - pad && mx < b.x + b.width + pad && my > b.y - pad && my < b.y + b.height + pad) blocked[r * cols + c] = 1;
      }
    }
  }
  const cellOf = (p) => [Math.min(cols - 1, Math.max(0, Math.floor(p.x / CELL))), Math.min(rows - 1, Math.max(0, Math.floor(p.y / CELL)))];
  const [sc, sr] = cellOf(me);
  const [gc, gr] = cellOf(goal);
  blocked[sr * cols + sc] = 0;
  blocked[gr * cols + gc] = 0;
  const from = new Int32Array(cols * rows).fill(-1);
  const queue = [sr * cols + sc];
  from[sr * cols + sc] = sr * cols + sc;
  while (queue.length) {
    const at = queue.shift();
    if (at === gr * cols + gc) break;
    const c = at % cols;
    const r = Math.floor(at / cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const n = nr * cols + nc;
      if (blocked[n] || from[n] !== -1) continue;
      from[n] = at;
      queue.push(n);
    }
  }
  if (from[gr * cols + gc] === -1) return null;
  // Walk back from the goal; aim a few cells along, so the knight moves smoothly.
  const path = [];
  for (let at = gr * cols + gc; at !== sr * cols + sc; at = from[at]) path.push(at);
  path.reverse();
  const pick = path[Math.min(4, path.length - 1)] ?? gr * cols + gc;
  return { x: (pick % cols) * CELL + CELL / 2, y: Math.floor(pick / cols) * CELL + CELL / 2, left: path.length };
}

let outcome = 'timeout';
let lastSwing = 0;
let lastGoal = '';
try {
  while (true) {
    const s = await state(page);
    const scene = await w.see(s);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    if (s.time > limit) break;
    // The knight speaking: read it and tap on, as a player would (the game waits meanwhile).
    if (s.dialogue) { await page.keyboard.press('Space'); await new Promise((r) => setTimeout(r, 300)); continue; }
    const me = s.entities.find((e) => e.tags.includes('بازیکن'));
    if (!me) { await tick(page, 0.1); continue; }
    const centre = { x: me.x + me.width / 2, y: me.y + me.height / 2 };
    const find = (tag) => s.entities.find((e) => e.tags.includes(tag) && e.visible);
    const key = find('کلید');
    const door = find('در قفل');
    const chest = find('پایان');
    const target = key ?? door ?? chest;
    const goalName = key ? 'key' : door ? 'door' : 'chest';
    if (goalName !== lastGoal) { console.log(`  t ${s.time.toFixed(1)} heading for the ${goalName}`); lastGoal = goalName; }
    // Swing at a skeleton that is close.
    const foe = s.entities.find((e) => e.tags.includes('خطر') && e.visible && Math.abs(e.x + e.width / 2 - centre.x) < 170 && Math.abs(e.y + e.height / 2 - centre.y) < 110);
    if (foe && s.time - lastSwing > 0.35) {
      const sword = s.entities.find((e) => e.tags.includes('دکمه‌ی شمشیر'));
      // Face it first: one short step its way.
      await hold([foe.x > me.x ? 'ArrowRight' : 'ArrowLeft']);
      await tick(page, 0.05);
      if (sword) await clickGame(page, sword.x + sword.width / 2, sword.y + sword.height / 2);
      lastSwing = s.time;
    }
    if (target) {
      const goal = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
      const step = nextStep(s, centre, goal, { width: 1440, height: 2560 }, target);
      if (!step) { const n = `${s.time.toFixed(1)}s no way to the ${goalName} → ${await w.shot('noway')}`; w.notes.push(n); console.log('  ' + n); await hold([]); await tick(page, 0.5); continue; }
      const keys = [];
      if (step.x > centre.x + 10) keys.push('ArrowRight');
      if (step.x < centre.x - 10) keys.push('ArrowLeft');
      if (step.y > centre.y + 10) keys.push('ArrowDown');
      if (step.y < centre.y - 10) keys.push('ArrowUp');
      await hold(keys);
      if (process.env.BOT_DEBUG && Math.floor(s.time) !== Math.floor(s.time - 0.07)) console.log(`  dbg t ${s.time.toFixed(1)} me ${Math.round(centre.x)},${Math.round(centre.y)} step ${step.x},${step.y} left ${step.left} keys ${keys.join('+')}`);
    }
    if (Math.floor(s.time / 5) !== Math.floor((s.time - 0.07) / 5)) console.log(`  t ${s.time.toFixed(1)} at ${Math.round(centre.x)},${Math.round(centre.y)} score ${s.variables.score} lives ${s.variables.lives} Key ${s.variables.Key} wall ${Math.round(process.uptime())}s`);
    await tick(page, 0.06);
  }
} finally {
  const s = await state(page);
  await w.shot('end');
  report('adventure', outcome, w, { score: s.variables.score, lives: s.variables.lives, errors });
  await browser.close();
}
