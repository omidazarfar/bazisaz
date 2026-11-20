// A bot that plays Gem Crush: looks at the board, finds a swap that lines up three (the one that clears most),
// taps the two gems, and keeps going until the goal or the moves run out. node scripts/bots/puzzle.mjs
import { clickGame } from '../lib.mjs';
import { report, startGame, state, tick, watcher } from './bot.mjs';

const { browser, page, errors, names } = await startGame('puzzle');
const w = watcher(page, names, 'puzzle');
let outcome = 'timeout';
let moves = 0;
let refused = 0;
try {
  while (true) {
    const s = await state(page);
    const scene = await w.see(s);
    if (scene === 'You win' || scene === 'Game over') { outcome = scene; break; }
    if (s.time > 240) break;
    const gems = s.entities.filter((e) => e.tags.includes('مهره') && e.visible);
    if (gems.length < 20) { await tick(page, 0.3); continue; }
    const cx = (g) => g.x + g.width / 2;
    const cy = (g) => g.y + g.height / 2;
    // The board's spacing: the smallest gap between columns (gems are drawn a little smaller than their cell).
    const xs = [...new Set(gems.map((g) => Math.round(cx(g))))].sort((a, b) => a - b);
    const cell = Math.min(...xs.slice(1).map((x, i) => x - xs[i]).filter((d) => d > 20));
    const left = Math.min(...gems.map(cx));
    const top = Math.min(...gems.map(cy));
    const grid = new Map();
    for (const g of gems) grid.set(`${Math.round((cx(g) - left) / cell)},${Math.round((cy(g) - top) / cell)}`, g);
    const kind = (c, r, swapA, swapB) => {
      let key = `${c},${r}`;
      if (swapA && key === swapA) key = swapB; else if (swapB && key === swapB) key = swapA;
      return grid.get(key)?.values.kind;
    };
    // Wait for a settled board: every cell filled, nothing sliding.
    const cols = Math.max(...[...grid.keys()].map((k) => Number(k.split(',')[0]))) + 1;
    const rows = Math.max(...[...grid.keys()].map((k) => Number(k.split(',')[1]))) + 1;
    if (process.env.BOT_DEBUG) console.log('  wait', gems.length, grid.size, cols, rows, cell, [...new Set(gems.map((g) => Math.round(cx(g))))].sort((a, b) => a - b).join(' '));
    if (grid.size < cols * rows || gems.some((g) => Math.abs(g.vy) > 1)) { await tick(page, 0.2); continue; }
    let best = null;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (const [dc, dr] of [[1, 0], [0, 1]]) {
          if (c + dc >= cols || r + dr >= rows) continue;
          const A = `${c},${r}`;
          const B = `${c + dc},${r + dr}`;
          let cleared = 0;
          for (const [x, y] of [[c, r], [c + dc, r + dr]]) {
            const k = kind(x, y, A, B);
            let h = 1; for (let i = x - 1; kind(i, y, A, B) === k; i--) h++; for (let i = x + 1; kind(i, y, A, B) === k; i++) h++;
            let v = 1; for (let j = y - 1; kind(x, j, A, B) === k; j--) v++; for (let j = y + 1; kind(x, j, A, B) === k; j++) v++;
            cleared += (h >= 3 ? h : 0) + (v >= 3 ? v : 0);
          }
          if (cleared && (!best || cleared > best.cleared)) best = { a: grid.get(A), b: grid.get(B), cleared };
        }
      }
    }
    if (process.env.BOT_DEBUG) console.log('  dbg', grid.size, cols, rows, cell, best && best.cleared);
    if (!best) { w.notes.push(`${s.time.toFixed(1)}s no move on the board → ${await w.shot('stuck')}`); console.log('  no move left on the board'); break; }
    const movesBefore = s.variables.moves;
    await clickGame(page, cx(best.a), cy(best.a));
    await tick(page, 0.15);
    await clickGame(page, cx(best.b), cy(best.b));
    await tick(page, 1.2);
    moves += 1;
    const after = await state(page);
    if (after.variables.moves === movesBefore) refused += 1;
    console.log(`  move ${moves}: clears ${best.cleared}, score ${after.variables.score}, moves left ${after.variables.moves}`);
  }
} finally {
  const s = await state(page);
  await w.shot('end');
  report('puzzle', outcome, w, { score: s.variables.score, moves, refused, errors });
  await browser.close();
}
