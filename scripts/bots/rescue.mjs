// Plays every leg using only clicks and the same pedal a player uses.
import assert from 'node:assert/strict';
import { clickGame } from '../lib.mjs';
import { startGame, state, watcher, report } from './bot.mjs';

const { browser, page, project, errors, names } = await startGame('rescue');
const watch = watcher(page, names, 'rescue');
try {
  const current = async name => {
    const id = project.scenes.find(s => s.name === name).id;
    await page.waitForFunction(id => {
      const s = window.__game.getState();
      return (s.scene === id && s.time > 0.4) || s.time > 18;
    }, { timeout: 90000 }, id);
    const snapshot = await state(page);
    assert.equal(snapshot.scene, id, 'reached ' + name);
    return snapshot;
  };
  const tap = async (snapshot, name) => {
    const def = project.scenes.find(s => s.id === snapshot.scene).objects.find(o => o.name === name);
    const e = snapshot.entities.find(e => e.id === def.id);
    await clickGame(page, e.x + e.width / 2, e.y + e.height / 2);
  };
  const cliff = await current('Cliff rescue');
  await watch.shot('chain');
  await tap(cliff, 'قلاب نجات');
  const space = await current('Orbital relay');
  assert.equal(space.variables.score, 100, 'rescuer landed on the mattress');
  await watch.shot('planet');
  await tap(space, 'کاوشگر');
  for (const [i, name] of ['Mountain trail', 'Rescue ridge', 'Harbor crossing', 'Clockwork lift'].entries()) {
    const run = await current(name);
    assert.equal(run.variables.score, 200 + 100 * i);
    await watch.shot(['bike', 'crawler', 'boat', 'gears'][i]);
    await page.keyboard.down('ArrowRight');
  }
  const win = await current('You win');
  await page.keyboard.up('ArrowRight');
  assert.equal(win.variables.score, 600);
  assert.deepEqual(errors, []);
  report('rescue', 'You win', watch, { score: win.variables.score, errors });
} catch (error) {
  const s = await state(page);
  const scene = project.scenes.find(o => o.id === s.scene);
  console.error(scene?.name, s.time, s.variables, s.entities.filter(e => e.width > 10 && e.height > 10).map(e => [scene?.objects.find(o => o.id === e.id)?.name, Math.round(e.x), Math.round(e.y), Math.round(e.vx)]));
  await watch.shot('stuck');
  throw error;
} finally {
  await browser.close();
}
