// Debug helper: opens one scene of an exported genre game directly, optionally holds the right arrow,
// and prints chosen objects over time with a photograph at the end.
// node scripts/bots/peek-scene.mjs <genre> "<scene name>" [seconds] [hold] [name,name]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, openPage, sleep } from '../lib.mjs';

const [genre, sceneName, seconds = '6', hold = 'hold', names = ''] = process.argv.slice(2);
const project = JSON.parse(readFileSync(fileURLToPath(new URL(`./games/${genre}.json`, import.meta.url)), 'utf8'));
const scene = project.scenes.find((s) => s.name === sceneName);
if (!scene) throw new Error('no scene ' + sceneName + ': ' + project.scenes.map((s) => s.name).join(', '));
project.startScene = scene.id;
const watch = names ? names.split(',') : scene.objects.filter((o) => o.behaviors.some((b) => b.type === 'physics')).map((o) => o.name);
const browser = await launch();
try {
  const { page, errors } = await openPage(browser, new URL('../../dist/index.html', import.meta.url).href, { project, viewport: { width: 450, height: 800, deviceScaleFactor: 1 } });
  await page.waitForFunction(() => window.__game && window.__game.getState().time > 0.3, { timeout: 60000 });
  if (hold === 'hold') await page.keyboard.down('ArrowRight');
  for (let t = 0.5; t <= Number(seconds); t += 0.5) {
    await page.waitForFunction((t, id) => window.__game.getState().time >= t || window.__game.getState().scene !== id, { timeout: 60000 }, t, scene.id);
    const s = await page.evaluate(() => window.__game.getState());
    const row = watch.map((n) => {
      const def = scene.objects.find((o) => o.name === n);
      const e = def && s.entities.find((x) => x.id === def.id);
      return e ? `${n}:${Math.round(e.x + e.width / 2)},${Math.round(e.y + e.height / 2)}@${(e.angle * 57.3).toFixed(0)}` : `${n}:-`;
    });
    console.log(s.time.toFixed(1), s.scene === scene.id ? '' : 'SCENE ' + project.scenes.find((x) => x.id === s.scene)?.name, JSON.stringify(s.variables), row.join(' '));
    if (s.scene !== scene.id) break;
  }
  await page.screenshot({ path: fileURLToPath(new URL(`./out/peek-${genre}.png`, import.meta.url)) });
  console.log('errors', errors);
} finally {
  await browser.close();
}
