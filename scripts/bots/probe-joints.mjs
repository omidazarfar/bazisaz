// Debug helper: lists the physics joints of a scene of an exported game. node scripts/bots/probe-joints.mjs <genre> "<scene>"
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, openPage } from '../lib.mjs';
const [genre, sceneName] = process.argv.slice(2);
const project = JSON.parse(readFileSync(fileURLToPath(new URL(`./games/${genre}.json`, import.meta.url)), 'utf8'));
project.startScene = project.scenes.find((s) => s.name === sceneName).id;
const browser = await launch();
try {
  const { page } = await openPage(browser, new URL('../../dist/index.html', import.meta.url).href, { project });
  await page.waitForFunction(() => window.__game && window.__game.getState().time > 1, { timeout: 60000 });
  console.log(await page.evaluate(() => {
    const ph = window.__game.physics;
    return JSON.stringify({ joints: ph.joints.map((j) => [j.behavior.kind, j.a.def.name, j.b.def.name, j.joint.getType()]), pending: ph.pendingJoints.map((t) => t.def.name) });
  }));
} finally { await browser.close(); }
