// The performance budget (Phase 5): a stress scene of 500 objects, 100 rules, 50 real-physics bodies, particles
// and two lights in the dark. The game is stepped by hand on its own clock and every part of a step is timed
// (Game.startProfile). A step must take under 8 ms on average on CI. Run `npm run build` first.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { check, finish, launch, openPage, root, shots, until } from './lib.mjs';

const BUDGET_MS = Number(process.env.STEP_BUDGET_MS ?? 8);
const url = pathToFileURL(resolve(root, 'dist/index.html')).href;

/** A seeded random, so the scene is the same every run. */
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const box = (id, x, y, width, height, ext = {}) => ({
  id, name: id, x: Math.round(x), y: Math.round(y), width, height, visual: { kind: 'rect', color: ext.color ?? '#888888' }, tags: [], visible: true, behaviors: [], ...ext,
});
const objects = [];
objects.push(box('ground', 0, 1500, 2400, 100, { tags: ['ground'], color: '#4e342e', behaviors: [{ type: 'physics', kind: 'still', solidTag: '', bounce: 0, friction: 0.6, weight: 1, rotates: false }] }));
for (let i = 0; i < 50; i++) objects.push(box(`crate${i}`, 100 + random() * 2200, 200 + random() * 900, 40, 40, { tags: ['crate'], color: '#a1887f', behaviors: [{ type: 'physics', kind: 'moving', solidTag: '', bounce: 0.1, friction: 0.6, weight: 1, rotates: true, gravity: true, edges: true }] }));
for (let i = 0; i < 50; i++) objects.push(box(`walker${i}`, 50 + random() * 2300, 1420, 30, 40, { tags: ['walker'], color: '#4fc3f7', behaviors: [{ type: 'body', gravity: true, solidTag: 'ground', bounce: 0, edges: 'bounce', oneWay: false }, { type: 'walker', speed: 60 + random() * 120, control: 'auto', leftTag: '', rightTag: '' }] }));
for (let i = 0; i < 300; i++) {
  const behaviors = i % 2 ? [{ type: 'rotate', speed: 90 }] : [{ type: 'pulse', amount: 0.1, seconds: 1 }];
  objects.push(box(`coin${i}`, random() * 2370, 300 + random() * 1150, 24, 24, { tags: ['coin'], color: '#ffd54f', behaviors }));
}
for (let i = 0; i < 96; i++) objects.push(box(`drone${i}`, random() * 2370, 100 + random() * 1200, 30, 20, { tags: ['drone'], color: '#ef5350', behaviors: [{ type: 'mover', vx: 80 + random() * 100, vy: 0, speedVariable: '', atEdge: 'wrap' }] }));
for (let i = 0; i < 2; i++) objects.push(box(`torch${i}`, 700 + i * 900, 1380, 40, 80, { tags: ['torch'], color: '#ff9800', behaviors: [{ type: 'light', radius: 420, color: '#ffcc80', flicker: true }, { type: 'particles', preset: 'fire', color: '#ff7043', rate: 30, size: 1, speed: 1 }] }));
objects.push(box('eye', 1100, 900, 20, 20, { tags: ['eye'], visible: true, behaviors: [{ type: 'camera', lock: 'free', smooth: 0.3 }] }));

const add = (name) => [{ type: 'setVariable', name, op: 'add', amount: 1 }];
const rules = [];
for (let i = 0; i < 40; i++) rules.push({ id: `touch${i}`, when: { type: 'touch', a: { by: 'tag', tag: i % 2 ? 'walker' : 'drone' }, b: { by: 'tag', tag: 'coin' } }, condition: null, then: add('touches') });
for (let i = 0; i < 30; i++) rules.push({ id: `near${i}`, when: { type: 'near', a: { by: 'tag', tag: 'drone' }, b: { by: 'tag', tag: 'walker' }, distance: 120 }, condition: null, then: add('nears') });
for (let i = 0; i < 20; i++) rules.push({ id: `every${i}`, when: { type: 'every', seconds: 0.5 }, condition: null, then: add('ticks') });
for (let i = 0; i < 10; i++) rules.push({ id: `value${i}`, when: { type: 'variable', name: 'ticks', op: '>=', value: 1e9 }, condition: null, then: add('never') });

const project = {
  formatVersion: 3,
  meta: { name: 'Stress', orientation: 'portrait', width: 720, height: 1280, background: '#101820', fontFamily: 'Fredoka', transition: 'none' },
  app: { appId: 'com.example.stress', versionCode: 1, versionName: '1.0', icon: null },
  ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
  sound: false, assets: {}, lists: [],
  variables: ['touches', 'nears', 'ticks', 'never'].map((name) => ({ name, initial: 0, saved: false })),
  startScene: 's',
  scenes: [{ id: 's', name: 's', width: 2400, height: 1600, background: null, music: null, gravity: 2000, darkness: 0.7, prefabs: [], objects, rules }],
};

// The same scene with visual effects (item 4): on everything, the world and the screen, on 40 objects, and a rule
// changing one twice a second. Effects cost drawing time (not counted in a step), so that is measured and reported
// beside the step: the drawing of a frame, with and without them.
const withEffects = structuredClone(project);
const fxScene = withEffects.scenes[0];
fxScene.effects = { all: [{ kind: 'adjust', settings: { saturation: 1.3 } }, { kind: 'film' }], world: [{ kind: 'hue', settings: { hue: 20 } }], screen: [{ kind: 'tint', settings: { alpha: 0.1 } }] };
fxScene.objects.forEach((o, i) => {
  if (o.tags.includes('coin') && i % 15 === 0) o.effects = [{ kind: 'outline' }, { kind: 'glow' }];
  if (o.tags.includes('walker') && i % 5 === 0) o.effects = [{ kind: 'pixelate', settings: { size: 4 } }];
});
fxScene.rules.push({ id: 'fx', when: { type: 'every', seconds: 0.5 }, condition: null, then: [{ type: 'setEffect', place: 'world', target: { by: 'tag', tag: 'coin' }, kind: 'hue', setting: 'hue', amount: { random: [0, 90] }, seconds: 0.4 }] });

const browser = await launch();
async function measure(project, picture) {
  const { page, errors } = await openPage(browser, url, { project });
  await until(page, () => window.__game, null, 30000);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.app.ticker.stop();
    for (let i = 0; i < 60; i++) g.advance(1 / 60);
    g.startProfile();
    for (let i = 0; i < 180; i++) g.advance(1 / 60);
    const p = g.readProfile();
    // Drawing frames, timed apart from the steps; reading one pixel waits for the drawing to be done.
    const gl = g.app.renderer.gl;
    const pixel = new Uint8Array(4);
    const t0 = performance.now();
    for (let i = 0; i < 30; i++) {
      g.app.render();
      gl?.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    }
    const drawMs = (performance.now() - t0) / 30;
    g.app.ticker.start();
    const s = g.getState();
    const effects = s.entities.length && g.entities.reduce((n, e) => n + e.effects.length, 0);
    return { profile: p, objects: s.entities.length, rules: 100, variables: s.variables, drawMs, effects };
  });
  await page.screenshot({ path: resolve(shots, picture) });
  await page.close();
  return { ...result, errors };
}
const result = await measure(project, 'stress.png');
const fx = await measure(withEffects, 'stress-effects.png');
await browser.close();

const { profile } = result;
const mean = profile.stepMs / profile.steps;
const fxMean = fx.profile.stepMs / fx.profile.steps;
const parts = Object.entries(profile.ms)
  .map(([part, ms]) => [part, part.startsWith('frame:') ? ms / profile.frames : ms / profile.steps])
  .sort((a, b) => b[1] - a[1]);
const report = [
  `Stress scene: ${result.objects} objects, ${result.rules} rules, ${profile.steps} steps (${profile.frames} frames).`,
  `A step: ${mean.toFixed(2)} ms on average, ${profile.worst.toFixed(2)} ms at worst (budget ${BUDGET_MS} ms).`,
  'Per part, on average (a step, or a frame for "frame: …"):',
  ...parts.map(([part, ms]) => `  ${ms.toFixed(3).padStart(8)} ms  ${part}`),
  `With visual effects (${fx.effects} on objects, 4 on the scene and its layers, one changed by a rule): a step ${fxMean.toFixed(2)} ms on average, ${fx.profile.worst.toFixed(2)} ms at worst.`,
  `Drawing a frame (this computer's graphics; software drawing on CI): ${result.drawMs.toFixed(2)} ms without effects, ${fx.drawMs.toFixed(2)} ms with them.`,
].join('\n');
console.log(report);
writeFileSync(resolve(shots, 'stress-profile.txt'), report + '\n');

check('the stress scene has 500 objects and its rules fire', result.objects >= 490 && result.variables.ticks > 0 && result.variables.touches > 0, JSON.stringify(result.variables));
check(`a step of the stress scene takes under ${BUDGET_MS} ms on average (${mean.toFixed(2)} ms)`, mean < BUDGET_MS, parts.slice(0, 3).map(([p, ms]) => `${p} ${ms.toFixed(2)}`).join(', '));
check(`with several visual effects, a step still takes under ${BUDGET_MS} ms on average (${fxMean.toFixed(2)} ms)`, fx.effects >= 20 && fxMean < BUDGET_MS, `${fx.effects} effects on objects`);
check('stress scene: no errors in the page', result.errors.length === 0 && fx.errors.length === 0, [...result.errors, ...fx.errors].join(' | '));
finish();
