// Shared pieces for the bots that play the genre helper's games in the real player, like a person would.
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clickGame, launch, openPage } from '../lib.mjs';

export const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });

/** Opens a saved game in the player, taps Play on its start screen, and returns once the level is running. */
export async function startGame(genre) {
  const file = process.env.BOT_GAME || genre;
  const project = JSON.parse(readFileSync(fileURLToPath(new URL(`./games/${file}.json`, import.meta.url)), 'utf8'));
  const browser = await launch();
  const { page, errors } = await openPage(browser, new URL('../../dist/index.html', import.meta.url).href, { project, adaptiveGraphics: true, viewport: { width: 450, height: 800, deviceScaleFactor: 1 } });
  await page.waitForFunction(() => window.__game && window.__game.getState().time > 0.6, { timeout: 60000 });
  const start = await state(page);
  const play = start.entities.find((e) => e.width === 220 && e.height === 220);
  await clickGame(page, play.x + 110, play.y + 110);
  await page.waitForFunction((s) => window.__game.getState().scene !== s && window.__game.getState().time > 0.4, { timeout: 60000 }, start.scene);
  const names = Object.fromEntries(project.scenes.map((s) => [s.id, s.name]));
  return { browser, page, errors, project, names };
}

/** The game's state; if the page stops answering (the game is stuck in a loop), says where it is stuck and stops. */
export async function state(page) {
  const answer = page.evaluate(() => window.__game.getState());
  let timer;
  const late = new Promise(resolve => { timer = setTimeout(() => resolve('frozen'), 20000); });
  const got = await Promise.race([answer, late]).finally(() => clearTimeout(timer));
  if (got !== 'frozen') return got;
  const cdp = await page.target().createCDPSession();
  await cdp.send('Debugger.enable');
  const paused = new Promise((resolve) => cdp.once('Debugger.paused', resolve));
  await cdp.send('Debugger.pause');
  const at = await Promise.race([paused, new Promise((r) => setTimeout(() => r(null), 10000))]);
  console.log('  THE GAME IS FROZEN (an endless loop). Where it is:');
  for (const f of at?.callFrames.slice(0, 8) ?? []) console.log(`    ${f.functionName || '(anonymous)'}  line ${f.location.lineNumber} col ${f.location.columnNumber}`);
  process.exit(2);
}

/** Return control to the pilot when time advances, the scene changes, or dialogue needs input. */
export async function tick(page, seconds) {
  const { time, scene } = await page.evaluate(() => {
    const { time, scene } = window.__game.getState();
    return { time, scene };
  });
  await page.waitForFunction((end, previous) => {
    const s = window.__game.getState();
    return s.time >= end || s.scene !== previous || Boolean(s.dialogue);
  }, { timeout: 60000 }, time + seconds, scene);
}

/**
 * Keeps an eye on a run: lives lost, the scene it ends on, and being stuck (not getting anywhere for a while),
 * each noted with the game time and a photograph.
 */
export function watcher(page, names, genre) {
  const notes = [];
  let lives = null;
  let prev = null;
  let shots = 0;
  const shot = async (why) => {
    shots += 1;
    const file = `${out}${genre}-${String(shots).padStart(2, '0')}-${why}.png`;
    await page.screenshot({ path: file });
    return file;
  };
  return {
    notes,
    shot,
    async see(s) {
      const scene = names[s.scene] ?? s.scene;
      if (lives !== null && s.variables.lives < lives) {
        // What was close to the player just before it was hurt (what hit it may be gone by now).
        const me = (prev ?? s).entities.find((e) => e.tags.includes('بازیکن'));
        const gap = prev ? (s.time - prev.time).toFixed(2) : '?';
        const near = me ? (prev ?? s).entities.filter((e) => e !== me && e.visible && Math.abs(e.x + e.width / 2 - me.x - me.width / 2) < 140 && Math.abs(e.y + e.height / 2 - me.y - me.height / 2) < 160).map((e) => `${e.tags.join('+') || e.id}@${Math.round(e.x)},${Math.round(e.y)}`).join(', ') : '';
        const line = `${s.time.toFixed(1)}s (looked ${gap}s before) lost a life (${s.variables.lives} left) at ${me ? Math.round(me.x) + ',' + Math.round(me.y) : '?'} near [${near}] → ${await shot('life')}`;
        notes.push(line);
        console.log('  ' + line);
      }
      lives = s.variables.lives ?? lives;
      prev = s;
      return scene;
    },
  };
}

export function report(genre, outcome, w, extra = {}) {
  console.log(JSON.stringify({ genre, outcome, ...extra }, null, 0));
  for (const n of w.notes) console.log('  ' + n);
}
