#!/usr/bin/env node
// Tools for an agent (or a person) making a game for Bazisaz as a project file. See AGENTS-GAMES.md.
//
//   node scripts/game.mjs new <genre|blank> <file.json>        start from a finished genre game, or an empty one
//   node scripts/game.mjs check <file.json>                     what stops it from running; what the editor warns about
//   node scripts/game.mjs shots <file.json> [--out dir] [--seconds 2]
//                                                               a picture of every scene, on a design-shaped and a tall phone
//   node scripts/game.mjs run <file.json> [--scene <name|id>] [--seconds 10] [--hold ArrowRight,Space]
//                             [--tap x,y] [--tap-every 0.5]     plays it without a screen and says what happened
//   node scripts/game.mjs levels <file.json> <scene name|id> <count> [--seed 7] [--out file.json]
//                                                               harder levels after a scene, as the editor's level maker makes them
//   node scripts/game.mjs library [pictures|parts]              the pictures and ready-made parts there are
//   node scripts/game.mjs picture <file.json> <picture id>      stores a library picture in the game; prints the visual to use
//   node scripts/game.mjs part <file.json> <scene name|id> <part id> [--at x,y]
//                                                               adds a ready-made part (score, hearts, pause menu, buttons...)
//
// Needs `npm install` and `npm run build` first (it plays the built player and editor in headless Chrome).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, openPage, root, sleep } from './lib.mjs';

const GENRES = ['platform', 'adventure', 'shooter', 'puzzle', 'physics', 'rescue', 'tower', 'bricks', 'runner', 'hopper'];
const [command, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) flags[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') || rest[i + 1] === undefined ? 'yes' : rest[++i];
  else args.push(rest[i]);
}
const player = resolve(root, 'dist/index.html');
const editorPage = resolve(root, 'dist-editor/editor.html');

function fail(message) {
  console.error(message);
  process.exit(1);
}
function usage() {
  fail(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
function built() {
  if (!existsSync(player) || !existsSync(editorPage)) fail('The player or editor is not built yet: run `npm run build` first.');
}
function load(file) {
  if (!file) usage();
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) fail(`No file at ${path}`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${file} is not JSON: ${error.message}`);
  }
}
function save(file, project) {
  writeFileSync(resolve(process.cwd(), file), JSON.stringify(project, null, 1));
}
const sceneOf = (project, which) => project.scenes.find((s) => s.id === which || s.name === which);

/** The editor, headless, with nothing open: for its checks and its level maker. */
async function withEditor(job) {
  built();
  const browser = await launch();
  try {
    const { page, errors } = await openPage(browser, pathToFileURL(editorPage).href, { viewport: { width: 1440, height: 900 } });
    await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
    return await job(page, errors);
  } finally {
    await browser.close();
  }
}

/** The smallest game that runs: one empty scene with gravity, a score, and its sizes. Objects and rules are the agent's. */
function blank(name) {
  return {
    formatVersion: 2,
    meta: { name, orientation: 'portrait', width: 720, height: 1280, background: '#8fd3f4', fontFamily: 'Fredoka', transition: 'fade' },
    app: { appId: `com.example.${name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'game'}`, versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: true,
    assets: {},
    variables: [{ name: 'score', initial: 0, saved: false }],
    scenes: [{ id: 'level-1', name: 'Level 1', width: 720, height: 1280, background: null, music: 'music:happy', gravity: 2400, sky: 'day', objects: [], prefabs: [], rules: [] }],
    startScene: 'level-1',
  };
}

async function cmdNew() {
  const [kind, file] = args;
  if (!kind || !file) usage();
  if (kind === 'blank') {
    save(file, blank(basename(file).replace(/\.json$/i, '') || 'Game'));
    return console.log(`Wrote an empty game to ${file}.`);
  }
  if (!GENRES.includes(kind)) fail(`No such genre "${kind}". The genres are: ${GENRES.join(', ')} (or "blank").`);
  const project = await withEditor(async (page) => {
    const click = (t) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t || b.textContent.includes(t))?.click(), t);
    await click('بازی جدید');
    await sleep(150);
    await click('بله، بازی خالی');
    await sleep(300);
    await page.click('[data-library="objects"]');
    await page.click('[data-library-tab="genre"]');
    await page.click(`[data-genre="${kind}"]`);
    await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 60000 });
    return page.evaluate(() => window.__editor.getState().project);
  });
  save(file, project);
  console.log(`Wrote the ${kind} game to ${file}: ${project.scenes.length} scenes (${project.scenes.map((s) => s.name).join(', ')}).`);
}

async function cmdCheck() {
  const project = load(args[0]);
  const result = await withEditor((page) => page.evaluate((p) => window.__editor.agent.check(p), project));
  if (result.problems.length) {
    console.log('It cannot run:');
    for (const p of result.problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  if (result.warnings.length) {
    console.log('It runs. The editor warns (in Persian, as the owner sees it):');
    for (const w of result.warnings) console.log(`  - [${w.scene}] ${w.text}`);
  } else console.log('It runs, and the editor has no warnings.');
}

/** Taps through the words a character says, until there are none and the clock has passed `seconds`. */
async function settle(page, seconds) {
  for (let i = 0; i < 200; i++) {
    const [talking, time] = await page.evaluate(() => {
      const g = window.__game;
      if (g.dialogue) g.tap();
      return [Boolean(g.dialogue), g.getState().time];
    });
    if (!talking && time >= seconds) return;
    await sleep(150);
  }
}

async function cmdShots() {
  const file = args[0];
  const project = load(file);
  built();
  const out = resolve(process.cwd(), flags.out ?? `${file.replace(/\.json$/i, '')}-shots`);
  mkdirSync(out, { recursive: true });
  const seconds = Number(flags.seconds ?? 2);
  const portrait = project.meta.height >= project.meta.width;
  const shapes = [
    ['design', portrait ? { width: 360, height: Math.round((360 * project.meta.height) / project.meta.width) } : { width: Math.round((360 * project.meta.width) / project.meta.height), height: 360 }, false],
    ['tall', portrait ? { width: 390, height: 844 } : { width: 844, height: 390 }, true],
  ];
  const browser = await launch();
  let failed = false;
  try {
    for (const [i, scene] of project.scenes.entries()) {
      for (const [shape, viewport, fill] of shapes) {
        const { page, errors } = await openPage(browser, pathToFileURL(player).href, { project: { ...project, startScene: scene.id }, fill, viewport: { ...viewport, deviceScaleFactor: 1 } });
        const started = await page.waitForFunction(() => window.__game || document.querySelector('.load-error'), { timeout: 60000 }).then(() => true, () => false);
        const refused = await page.evaluate(() => document.querySelector('.load-error')?.textContent ?? null);
        if (!started || refused) {
          console.log(`${scene.name}: does not start${refused ? `: ${refused}` : ''}`);
          failed = true;
          await page.close();
          break;
        }
        await settle(page, seconds);
        const path = resolve(out, `${String(i + 1).padStart(2, '0')}-${scene.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-${shape}.png`);
        await page.screenshot({ path });
        console.log(`${path}${errors.length ? `   errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
        if (errors.length) failed = true;
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (failed) process.exit(1);
}

async function cmdRun() {
  const project = load(args[0]);
  built();
  const scene = flags.scene ? sceneOf(project, flags.scene) : null;
  if (flags.scene && !scene) fail(`No scene called "${flags.scene}". The scenes are: ${project.scenes.map((s) => s.name).join(', ')}`);
  const plan = {
    seconds: Number(flags.seconds ?? 10),
    hold: flags.hold ? flags.hold.split(',') : [],
    tap: flags.tap ? flags.tap.split(',').map(Number) : null,
    tapEvery: flags['tap-every'] ? Number(flags['tap-every']) : 0,
  };
  const browser = await launch();
  try {
    const { page, errors } = await openPage(browser, pathToFileURL(player).href, { project: scene ? { ...project, startScene: scene.id } : project, viewport: { width: 360, height: 640, deviceScaleFactor: 1 } });
    const started = await page.waitForFunction(() => window.__game || document.querySelector('.load-error'), { timeout: 60000 }).then(() => true, () => false);
    const refused = await page.evaluate(() => document.querySelector('.load-error')?.textContent ?? null);
    if (!started || refused) fail(`It does not start${refused ? `: ${refused}` : ''}`);
    // Played sixty steps a second on the game's own clock, so the result is the same however slow the computer is.
    const report = await page.evaluate((plan) => {
      const g = window.__game;
      g.app.ticker.stop();
      const sceneName = (id) => g.project.scenes.find((s) => s.id === id)?.name ?? id;
      const key = (code, down) => document.body.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
      const log = [];
      let last = g.getState();
      log.push(`0.0 s  starts in "${sceneName(last.scene)}"  ${JSON.stringify(last.variables)}`);
      for (const k of plan.hold) key(k, true);
      let nextTap = plan.tapEvery || Infinity;
      for (let step = 0; step < plan.seconds * 60; step++) {
        const time = step / 60;
        if (g.dialogue && step % 20 === 0) g.tap();
        if (plan.tapEvery && time >= nextTap) {
          nextTap += plan.tapEvery;
          if (plan.tap) g.tap(plan.tap[0], plan.tap[1]);
          else g.tap();
        }
        g.advance(1 / 60);
        const now = g.getState();
        if (now.scene !== last.scene) log.push(`${time.toFixed(1)} s  goes to "${sceneName(now.scene)}"`);
        for (const [name, value] of Object.entries(now.variables)) {
          if (last.variables[name] !== value) log.push(`${time.toFixed(1)} s  ${name}: ${last.variables[name]} -> ${value}`);
        }
        last = now;
      }
      for (const k of plan.hold) key(k, false);
      // How many of each group are left, and where the players are (by the group the genre games give them).
      const alive = g.entities.filter((e) => e.alive);
      const groups = {};
      for (const e of alive) for (const t of e.def.tags) groups[t] = (groups[t] ?? 0) + 1;
      const players = alive.filter((e) => e.def.tags.includes('بازیکن')).map((e) => ({ name: e.def.name, x: Math.round(e.x), y: Math.round(e.y) }));
      return { log, end: { scene: sceneName(last.scene), sceneTime: +last.time.toFixed(2), variables: last.variables, groups, players } };
    }, plan);
    // Long runs say a lot: the first and last changes are kept.
    const lines = report.log.length > 80 ? [...report.log.slice(0, 40), `   ... ${report.log.length - 80} more ...`, ...report.log.slice(-40)] : report.log;
    for (const line of lines) console.log(line);
    console.log(`End: ${JSON.stringify(report.end)}`);
    if (errors.length) {
      console.log(`Errors in the page:\n  ${errors.slice(0, 5).join('\n  ')}`);
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

async function cmdLevels() {
  const [file, which, count] = args;
  if (!file || !which || !count) usage();
  const project = load(file);
  const scene = sceneOf(project, which);
  if (!scene) fail(`No scene called "${which}". The scenes are: ${project.scenes.map((s) => s.name).join(', ')}`);
  const made = await withEditor((page) => page.evaluate(({ p, id, n, seed }) => window.__editor.agent.levels(p, id, n, seed), { p: project, id: scene.id, n: Number(count), seed: Number(flags.seed ?? 7) }));
  const out = flags.out ?? file;
  save(out, made.project);
  console.log(`Wrote ${out}: ${made.project.scenes.length} scenes.`);
  for (const c of made.changes) console.log(`  ${c}`);
}

async function cmdLibrary() {
  const which = args[0] ?? 'all';
  const lib = await withEditor((page) => page.evaluate(() => window.__editor.agent.library()));
  if (which !== 'parts') {
    console.log('PICTURES (id, natural size, category, animated?, Persian name):');
    for (const p of lib.pictures) {
      console.log(`  ${p.id.padEnd(18)} ${`${p.width}x${p.height}`.padEnd(9)} ${p.category.padEnd(10)} ${p.animated ? 'animated' : '        '}  ${p.name}`);
    }
  }
  if (which !== 'pictures') {
    console.log('PARTS (id: Persian title — what it adds, in Persian):');
    for (const p of lib.parts) console.log(`  ${p.id}: ${p.title} — ${p.about}`);
  }
}

/** Runs one of the editor's agent calls, which may throw (an unknown id): its message comes back instead. */
const agentCall = (name, ...input) => withEditor((page) => page.evaluate(async ({ name, input }) => {
  try {
    return await window.__editor.agent[name](...input);
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
}, { name, input }));

async function cmdPicture() {
  const [file, id] = args;
  if (!file || !id) usage();
  const made = await agentCall('picture', load(file), id);
  if (made.error) fail(`${made.error}. See: node scripts/game.mjs library pictures`);
  save(file, made.project);
  console.log(`Stored "${id}" in ${file}. Its natural size is ${made.width}x${made.height}. Give an object this visual:`);
  console.log(JSON.stringify(made.visual));
}

async function cmdPart() {
  const [file, which, id] = args;
  if (!file || !which || !id) usage();
  const project = load(file);
  const scene = sceneOf(project, which);
  if (!scene) fail(`No scene called "${which}". The scenes are: ${project.scenes.map((s) => s.name).join(', ')}`);
  const at = flags.at ? (([x, y]) => ({ x, y }))(flags.at.split(',').map(Number)) : undefined;
  const made = await agentCall('part', project, scene.id, id, at);
  if (made.error) fail(`${made.error}. See: node scripts/game.mjs library parts`);
  const after = sceneOf(made.project, scene.id);
  save(file, made.project);
  console.log(`Added "${id}" to "${scene.name}": ${after.objects.length - scene.objects.length} objects, ${after.prefabs.length - scene.prefabs.length} templates, ${after.rules.length - scene.rules.length} rules, ${made.project.variables.length - project.variables.length} variables.`);
  if (made.note) console.log(`Note (Persian, for the owner): ${made.note}`);
}

const commands = { new: cmdNew, check: cmdCheck, shots: cmdShots, run: cmdRun, levels: cmdLevels, library: cmdLibrary, picture: cmdPicture, part: cmdPart };
if (!commands[command]) usage();
await commands[command]();
