// Screen framing (roadmap Phase 1): photographs every genre game (Sky Quest is the platform one) as the player
// shows it on four screen shapes, filled to the edges: a 9:16 phone, a 9:19.5 phone, a 9:21 phone and a 3:4
// tablet. For each: the start screen, the level a moment after it starts, and the win screen. Then one contact
// sheet per screen, all games down and the four shapes across, to compare before and after a change.
//   node scripts/bots/export.mjs            (makes the games fresh, into scripts/bots/games/)
//   npm run build
//   node scripts/look/framing.mjs <label> [genre,genre]
// Pictures go to scripts/look/out/framing/<label>/, the sheets to scripts/look/out/framing/<label>-*.png.
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launch, openPage, root } from '../lib.mjs';

const label = process.argv[2] ?? 'now';
const GENRES = (process.argv[3] ?? 'platform,adventure,shooter,puzzle,physics,rescue,tower,bricks,runner,hopper').split(',');
export const SHAPES = [
  { name: '9x16', width: 405, height: 720 },
  { name: '9x19.5', width: 390, height: 845 },
  { name: '9x21', width: 360, height: 840 },
  { name: 'tablet', width: 768, height: 1024 },
];
const out = fileURLToPath(new URL(`./out/framing/${label}/`, import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const browser = await launch();
const problems = [];

for (const genre of GENRES) {
  const project = JSON.parse(readFileSync(resolve(root, `scripts/bots/games/${genre}.json`), 'utf8'));
  const level = project.scenes[0];
  const win = project.scenes.find((s) => s.name === 'You win');
  for (const shape of SHAPES) {
    const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist/index.html')).href, { project, viewport: { width: shape.width, height: shape.height, deviceScaleFactor: 1 }, fill: true });
    await page.waitForFunction(() => window.__game, { timeout: 60000 });
    const steps = (n) => page.evaluate((n) => { const g = window.__game; g.app.ticker.stop(); for (let i = 0; i < n; i++) g.advance(1 / 60); g.app.ticker.start(); }, n);
    const shot = async (name) => {
      await new Promise((r) => setTimeout(r, 120));
      await page.screenshot({ path: `${out}${genre}-${shape.name}-${name}.png` });
    };
    const go = (id) => page.evaluate((id) => { window.__game.nextScene = id; }, id);
    await steps(70);
    await shot('start');
    await go(level.id);
    // Past an opening conversation (its words come by the wall clock: shown at once, then tapped away) and an
    // opening look at the goal, as a player would be a few seconds in.
    await page.evaluate(() => {
      const g = window.__game;
      g.app.ticker.stop();
      for (let i = 0; i < 3000 && (i < 120 || g.dialogue || (g.focus && g.focus.left > 0)); i++) {
        if (g.dialogue && i % 20 === 0) { g.dialogue.since = -1e9; g.keyTap = true; }
        g.advance(1 / 60);
      }
      for (let i = 0; i < 90; i++) g.advance(1 / 60);
      g.app.ticker.start();
    });
    await shot('level');
    if (win) {
      await go(win.id);
      await steps(90);
      await shot('win');
    }
    if (errors.length) problems.push(`${genre} ${shape.name}: ${errors.join(' | ')}`);
    await page.close();
  }
  console.log(`${genre}: photographed on ${SHAPES.length} shapes`);
}

// Contact sheets: one per screen, the games down, the shapes across, each picture 300 px high.
for (const screen of ['start', 'level', 'win']) {
  const page = await browser.newPage();
  const cell = (genre, shape) => {
    try {
      const data = readFileSync(`${out}${genre}-${shape.name}-${screen}.png`).toString('base64');
      return `<td><img src="data:image/png;base64,${data}"></td>`;
    } catch {
      return '<td></td>';
    }
  };
  const rows = GENRES.map((g) => `<tr><th>${g}</th>${SHAPES.map((s) => cell(g, s)).join('')}</tr>`).join('');
  await page.setContent(`<style>body{margin:0;background:#222;color:#eee;font:16px sans-serif}td,th{padding:6px;vertical-align:top}img{height:300px;outline:1px solid #555}</style>
    <table><tr><th>${label} · ${screen}</th>${SHAPES.map((s) => `<th>${s.name}</th>`).join('')}</tr>${rows}</table>`);
  await page.setViewport({ width: 1200, height: 800 });
  await page.screenshot({ path: `${out}../${label}-${screen}.png`, fullPage: true });
  await page.close();
}
console.log(problems.length ? `errors:\n${problems.join('\n')}` : 'no errors');
await browser.close();
