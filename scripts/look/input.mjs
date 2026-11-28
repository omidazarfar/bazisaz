// Gamepad, typing and phone tilt (roadmap item 6): a "what is your name" screen, in the editor and in the game with
// Persian typed into it. Run `npm run build` first.
//   node scripts/look/input.mjs  → scripts/look/out/input-editor.png, input-game.png
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launch, openPage, root } from '../lib.mjs';

const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const project = {
  formatVersion: 3,
  meta: { name: 'Name', orientation: 'portrait', width: 720, height: 1280, background: '#1e2a38', fontFamily: 'Fredoka', transition: 'none' },
  app: { appId: 'com.example.inputlook', versionCode: 1, versionName: '1.0', icon: null },
  ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
  sound: false, assets: {}, lists: [], variables: [], textVariables: [{ name: 'player', initial: '', saved: true }],
  startScene: 's',
  scenes: [{
    id: 's', name: 'Name', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [], sky: 'night',
    objects: [
      { id: 'title', name: 'عنوان', x: 360, y: 380, width: 10, height: 10, visual: { kind: 'text', text: 'What is your name?', size: 52, color: '#ffffff', align: 'center', outline: '#1b2a4a' }, tags: [], visible: true, behaviors: [], fixed: true },
      { id: 'name', name: 'جای اسم', x: 110, y: 520, width: 500, height: 96, visual: { kind: 'input', variable: 'player', placeholder: 'اسمت را بنویس…', size: 40, color: '#ffffff', background: '#2b3f6b', maxLength: 16 }, tags: [], visible: true, behaviors: [], fixed: true },
      { id: 'hello', name: 'سلام', x: 360, y: 700, width: 10, height: 10, visual: { kind: 'text', text: 'Hello, {player}!', size: 44, color: '#ffe066', align: 'center' }, tags: [], visible: true, behaviors: [], fixed: true },
    ],
    rules: [],
  }],
};
const browser = await launch();
{
  const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist-editor/editor.html')).href, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
  await page.evaluate((p) => window.__editor.open(p), project);
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => [...document.querySelectorAll('.object-list .row')].find((r) => r.querySelector('.row-name').textContent === 'جای اسم')?.click());
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${out}input-editor.png` });
  console.log(errors.length ? `editor: ${errors.join(' | ')}` : 'editor: no errors');
  await page.close();
}
{
  const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist/index.html')).href, { project, viewport: { width: 405, height: 720, deviceScaleFactor: 2 } });
  await page.waitForFunction(() => window.__game, { timeout: 60000 });
  await page.waitForSelector('input[data-input="name"]');
  await page.click('input[data-input="name"]');
  await page.keyboard.type('مریم');
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${out}input-game.png` });
  console.log(errors.length ? `game: ${errors.join(' | ')}` : 'game: no errors');
}
await browser.close();
