// Visual effects on anything (roadmap item 4): every effect on a picture of its own, a scene with effects on its layers,
// and the editor's effect lists. Run `npm run build` first.
//   node scripts/look/effects.mjs  → scripts/look/out/effects-all.png (each effect on the same picture),
//                                     effects-scene.png (layers), effects-object-editor.png, effects-scene-editor.png,
//                                     effects-pick-editor.png
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launch, openPage, root } from '../lib.mjs';

const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const app = { appId: 'com.example.effectslook', versionCode: 1, versionName: '1.0', icon: null };
const ads = { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' };
const kinds = ['none', 'blur', 'motionBlur', 'adjust', 'hue', 'grayscale', 'tint', 'outline', 'glow', 'shadow', 'bevel', 'emboss', 'pixelate', 'ascii', 'dots', 'hatch', 'crt', 'film', 'glitch', 'split', 'bulge', 'noise', 'bloom', 'rays', 'reflection', 'clouds'];
const label = (id, x, y, text) => ({ id, name: id, x, y, width: 10, height: 10, visual: { kind: 'text', text, size: 22, color: '#ffffff', align: 'center' }, tags: [], visible: true, behaviors: [] });

const browser = await launch();
// Each effect on the same little picture (a library sprite), five to a row.
{
  const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist-editor/editor.html')).href, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
  const objects = [];
  kinds.forEach((kind, i) => {
    const x = 20 + (i % 5) * 140;
    const y = 30 + Math.floor(i / 5) * 240;
    objects.push({ id: `o${i}`, name: kind, x, y, width: 120, height: 120, visual: { kind: 'rect', color: ['#ff7043', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc'][i % 5], shade: true, radius: 24 }, tags: [], visible: true, behaviors: [], ...(kind === 'none' ? {} : { effects: [{ kind }] }) });
    objects.push(label(`l${i}`, x + 60, y + 165, kind));
  });
  const project = {
    formatVersion: 3, meta: { name: 'Effects', orientation: 'portrait', width: 720, height: 1280, background: '#263238', fontFamily: 'Fredoka', transition: 'none' }, app, ads,
    sound: false, assets: {}, variables: [], textVariables: [], lists: [], startScene: 's',
    scenes: [{ id: 's', name: 'Effects', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [], objects, rules: [] }],
  };
  const player = await openPage(browser, pathToFileURL(resolve(root, 'dist/index.html')).href, { project, viewport: { width: 720, height: 1280, deviceScaleFactor: 1 } });
  await player.page.waitForFunction(() => window.__game, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 800));
  await player.page.screenshot({ path: `${out}effects-all.png` });
  console.log(player.errors.length ? `all: ${player.errors.join(' | ')}` : 'all: no errors');
  await player.page.close();

  // The editor: an object's effects, the pick list, the scene's effects on its layers.
  const hero = { id: 'hero', name: 'قهرمان', x: 260, y: 700, width: 200, height: 200, visual: { kind: 'ellipse', color: '#ffd54a', shade: true }, tags: [], visible: true, behaviors: [], effects: [{ kind: 'outline', settings: { thickness: 5, color: '#ffffff' } }, { kind: 'glow', settings: { color: '#ff6ec7' } }] };
  const scened = {
    ...project,
    scenes: [{ id: 's', name: 'Effects', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [], sky: 'sunset', effects: { sky: [{ kind: 'pixelate', settings: { size: 10 } }], all: [{ kind: 'film' }] },
      objects: [hero, { id: 'ground', name: 'زمین', x: 0, y: 1100, width: 720, height: 180, visual: { kind: 'rect', color: '#5d4037' }, tags: [], visible: true, behaviors: [] }, label('score', 360, 80, 'Score 12')], rules: [] }],
  };
  await page.evaluate((p) => window.__editor.open(p), scened);
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => [...document.querySelectorAll('.object-list .row')].find((r) => r.querySelector('.row-name').textContent === 'قهرمان')?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('[data-effects="این شیء"]')?.scrollIntoView({ block: 'start' }));
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: `${out}effects-object-editor.png` });
  await page.evaluate(() => document.querySelector('[data-effects="این شیء"] button[aria-label^="اضافه کردن جلوه"]')?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${out}effects-pick-editor.png` });
  await page.keyboard.press('Escape');
  await page.click('[data-panel-tab="game"]');
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('[data-scene-effects]')?.scrollIntoView({ block: 'start' }));
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${out}effects-scene-editor.png` });
  console.log(errors.length ? `editor: ${errors.join(' | ')}` : 'editor: no errors');

  const scene = await openPage(browser, pathToFileURL(resolve(root, 'dist/index.html')).href, { project: scened, viewport: { width: 405, height: 720, deviceScaleFactor: 1 } });
  await scene.page.waitForFunction(() => window.__game, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 800));
  await scene.page.screenshot({ path: `${out}effects-scene.png` });
  console.log(scene.errors.length ? `scene: ${scene.errors.join(' | ')}` : 'scene: no errors');
}
await browser.close();
