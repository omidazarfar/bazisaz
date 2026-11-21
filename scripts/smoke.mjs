// Plays the built games in a real browser: both starters from start to
// restart, then a lab scene that exercises every behavior, trigger and action.
// Run `npm run build` first.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { check, clickGame, entity, finish, gameState, launch, openPage, root, shots, silentWav, sleep, solidPng, toPage, until, untilTime } from './lib.mjs';

const url = pathToFileURL(resolve(root, 'dist/index.html')).href;

const browser = await launch();
const loaded = (page) => until(page, () => window.__game, null, 20000);

// ── 1. Runner ──────────────────────────────────────────────────────────────
{
  const { page, errors } = await openPage(browser, url);
  await loaded(page);
  let s = await gameState(page);
  check('runner opens on its start scene', s.scene === 'start');
  const canvas = await page.$eval('canvas', (c) => c.getBoundingClientRect().width / c.getBoundingClientRect().height);
  check('canvas keeps the 9:16 design shape', Math.abs(canvas - 720 / 1280) < 0.01);
  await page.screenshot({ path: resolve(shots, '1-runner-start.png') });

  await untilTime(page, 0.5);
  await clickGame(page, 360, 640);
  check('a tap starts the round', await until(page, () => window.__game.getState().scene === 'play'));

  // A bot that jumps 0.2 s of travel ahead of each obstacle, a distance that
  // clears all three obstacle shapes. It runs inside the page so its timing
  // isn't distorted by round-trips to this script.
  await page.evaluate(() => {
    window.__bot = setInterval(() => {
      const st = window.__game.getState();
      if (st.scene !== 'play') return;
      const player = st.entities.find((e) => e.id === 'player');
      const onGround = Math.abs(player.y + player.height - 940) < 1;
      const next = st.entities
        .filter((e) => e.tags.includes('مانع') && e.x + e.width > player.x)
        .sort((a, b) => a.x - b.x)[0];
      if (onGround && next && next.x - (player.x + player.width) < 420 * st.variables.speed * 0.2) window.__game.tap();
    }, 8);
  });
  await until(page, () => window.__game.getState().variables.score >= 5 || window.__game.getState().scene === 'over', null, 120000);
  s = await gameState(page);
  check('the bot survives and scores', s.scene === 'play' && s.variables.score >= 5, `scene ${s.scene}, score ${s.variables.score}`);
  check('the game speeds up over time', s.variables.speed > 1, `speed ${s.variables.speed.toFixed(2)}`);
  check('obstacles that left the screen are removed', s.entities.filter((e) => e.tags.includes('مانع')).length <= 3);
  await page.screenshot({ path: resolve(shots, '2-runner-play.png') });

  await page.evaluate(() => clearInterval(window.__bot));
  await until(page, () => window.__game.getState().scene === 'over');
  s = await gameState(page);
  check('hitting an obstacle goes to the end scene', s.scene === 'over');
  check('the best score is recorded', s.variables.best === s.variables.score && s.variables.best > 0, `score ${s.variables.score}, best ${s.variables.best}`);
  const best = s.variables.best;
  await untilTime(page, 0.5);
  await page.screenshot({ path: resolve(shots, '3-runner-over.png') });

  await page.keyboard.press('Space');
  await until(page, () => window.__game.getState().scene === 'play');
  s = await gameState(page);
  check('playing again resets the score and keeps the best', s.scene === 'play' && s.variables.score === 0 && s.variables.best === best);
  await page.reload();
  await loaded(page);
  check('the best score survives closing the game', (await gameState(page)).variables.best === best);
  check('runner: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 2. Catch ───────────────────────────────────────────────────────────────
{
  const { page, errors } = await openPage(browser, `${url}?template=catch`);
  await loaded(page);
  await untilTime(page, 0.5);
  await clickGame(page, 360, 640);
  await until(page, () => window.__game.getState().scene === 'play');

  // Hold a finger down and keep it under the lowest apple.
  await page.mouse.move(...(await toPage(page, 360, 1140)));
  await page.mouse.down();
  // The bot runs inside the page, moving the finger that is held down under the lowest apple
  // that can still be caught. From this script, round trips made it fall behind on a busy machine.
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    window.__row = true;
    window.__bot = setInterval(() => {
      const st = window.__game.getState();
      if (st.scene !== 'play' || st.variables.score >= 3) return;
      const basket = st.entities.find((e) => e.id === 'basket');
      if (basket && basket.y !== 1120) window.__row = false;
      const apple = st.entities.filter((e) => e.tags.includes('خوب') && e.y + e.height < 1110).sort((a, b) => b.y - a.y)[0];
      if (!apple) return;
      const r = canvas.getBoundingClientRect();
      const clientX = r.left + ((apple.x + apple.width / 2) / 720) * r.width;
      const clientY = r.top + (1140 / 1280) * r.height;
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX, clientY, bubbles: true }));
    }, 8);
  });
  await until(page, () => window.__game.getState().variables.score >= 3 || window.__game.getState().scene !== 'play', null, 60000);
  await page.evaluate(() => clearInterval(window.__bot));
  let s = await gameState(page);
  // Apples fall at random: now and then two land too far apart for any finger, so two catches are proof enough.
  check('the basket follows the finger and catches apples', s.variables.score >= 2, `score ${s.variables.score}, lives ${s.variables.lives}`);
  check('the basket never leaves its row', await page.evaluate(() => window.__row));
  await page.screenshot({ path: resolve(shots, '4-catch-play.png') });

  // Park the basket in a corner and let apples fall past.
  await page.mouse.move(...(await toPage(page, 10, 1140)));
  await until(page, () => window.__game.getState().scene === 'over', null, 120000);
  s = await gameState(page);
  check('running out of lives ends the round', s.scene === 'over' && s.variables.lives <= 0, `lives ${s.variables.lives}`);
  await page.mouse.up();
  check('catch: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 3. Lab: every behavior, trigger and action ─────────────────────────────
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const id = (v) => ({ by: 'id', id: v });
  // A 4x4 solid orange PNG.
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEklEQVR4nGP438fwHxkzkC4AADxAH+HggXe0AAAAAElFTkSuQmCC';
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka' },
    app: { appId: 'com.example.lab', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: true, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false,
    assets: { pic: { type: 'image', src: png } },
    variables: [{ name: 'hits', initial: 0, saved: false }, { name: 'ready', initial: 0, saved: false }, { name: 'ticks', initial: 0, saved: false }, { name: 'bump', initial: 0, saved: false }],
    startScene: 'lab',
    scenes: [{
      id: 'lab', name: 'lab', width: 720, height: 1280, background: null, music: null, gravity: 2000,
      objects: [
        box('floor', 0, 1000, 720, 40, { tags: ['wall'] }),
        box('pillar', 400, 800, 40, 200, { tags: ['wall'] }),
        box('hero', 100, 900, 80, 80, { tags: ['hero'], behaviors: [
          { type: 'body', gravity: true, solidTag: 'wall', bounce: 0, edges: 'none', oneWay: false },
          { type: 'walker', speed: 300, control: 'buttons', leftTag: 'L', rightTag: 'R' },
          { type: 'jumper', jumpSpeed: 900, maxJumps: 1, on: 'button', buttonTag: 'J' },
        ] }),
        box('btnL', 20, 1100, 100, 100, { tags: ['L'] }),
        box('btnR', 140, 1100, 100, 100, { tags: ['R'] }),
        box('btnJ', 600, 1100, 100, 100, { tags: ['J'] }),
        box('guard', 500, 300, 50, 50, { behaviors: [{ type: 'patrol', axis: 'x', distance: 100, speed: 100 }] }),
        box('bait', 100, 100, 40, 40, { tags: ['bait'] }),
        box('ghost', 600, 100, 40, 40, { behaviors: [{ type: 'chase', targetTag: 'bait', speed: 100 }] }),
        box('crate', 300, 500, 80, 80, { behaviors: [{ type: 'draggable' }] }),
        box('timed', 50, 400, 20, 20, { behaviors: [{ type: 'lifetime', seconds: 0.4 }] }),
        box('spinner', 620, 500, 60, 60, { behaviors: [{ type: 'rotate', speed: 90 }] }),
        box('bell', 600, 620, 80, 80),
        box('secret', 50, 620, 60, 60, { visible: false }),
        box('ball', 250, 300, 40, 40, { behaviors: [{ type: 'body', gravity: false, solidTag: '', bounce: 0, edges: 'none', oneWay: false }] }),
        { ...box('photo', 20, 200, 60, 60), visual: { kind: 'image', asset: 'pic' } },
        { ...box('label', 360, 40, 0, 0), visual: { kind: 'text', text: 'hits {hits}', color: '#ffffff', size: 40 } },
      ],
      prefabs: [box('spark', 0, 0, 20, 20, { tags: ['spark'] })],
      rules: [
        { id: 'r-bump', when: { type: 'touch', a: id('hero'), b: id('pillar') }, condition: null, then: [{ type: 'setVariable', name: 'bump', op: 'add', amount: 1 }] },
        { id: 'r-after', when: { type: 'after', seconds: 0.3 }, condition: null, then: [{ type: 'setVariable', name: 'ready', op: 'set', amount: 1 }] },
        { id: 'r-every', when: { type: 'every', seconds: 0.25 }, condition: { name: 'ticks', op: '<=', value: 2 }, then: [{ type: 'setVariable', name: 'ticks', op: 'add', amount: 1 }] },
        { id: 'r-bell', when: { type: 'tapObject', target: id('bell') }, condition: null, then: [
          { type: 'setVariable', name: 'hits', op: 'add', amount: 1 }, { type: 'show', target: id('secret') },
          { type: 'spawn', prefab: 'spark', at: 'first' }, { type: 'push', target: id('ball'), vx: 0, vy: -200 }, { type: 'showAd' },
        ] },
        { id: 'r-two', when: { type: 'variable', name: 'hits', op: '>=', value: 2 }, condition: null, then: [
          { type: 'hide', target: id('secret') }, { type: 'moveTo', target: id('bait'), x: 100, y: 600 }, { type: 'destroy', target: { by: 'tag', tag: 'spark' } }, { type: 'jump', target: id('hero') },
        ] },
        { id: 'r-three', when: { type: 'variable', name: 'hits', op: '>=', value: 3 }, condition: null, then: [{ type: 'restartScene' }] },
      ],
    }],
  };

  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await page.evaluate(() => { window.__ads = 0; });
  await untilTime(page, 1.2);
  let s = await gameState(page);
  const at = (name) => s.entities.find((e) => e.id === name);
  check('lifetime: a timed object disappears', !at('timed'));
  check('after: fires once the time has passed', s.variables.ready === 1);
  check('every + condition: counts up and stops at its limit', s.variables.ticks === 3, `ticks ${s.variables.ticks}`);
  check('body: gravity rests the hero on the floor', Math.abs(at('hero').y - 920) < 0.5, `y ${at('hero').y}`);
  check('patrol: the guard moves inside its range', at('guard').x >= 500 && at('guard').x <= 600 && at('guard').x !== 500);
  check('chase: the ghost closes in on the bait', at('ghost').x < 520, `x ${at('ghost').x.toFixed(0)}`);

  await page.mouse.move(...(await toPage(page, 190, 1150)));
  await page.mouse.down();
  await until(page, () => window.__game.getState().entities.find((e) => e.id === 'hero').x >= 319);
  await untilTime(page, (await gameState(page)).time + 0.3);
  s = await gameState(page);
  check('walker + solid: holding the right button walks into the pillar and stops', Math.abs(at('hero').x - 320) < 0.5, `x ${at('hero').x}`);
  check('touch: running into a solid counts as touching it, once', s.variables.bump === 1, `bump ${s.variables.bump}`);
  await page.mouse.up();

  await clickGame(page, 650, 1150);
  check('jumper: the jump button lifts the hero', await until(page, () => window.__game.getState().entities.find((e) => e.id === 'hero').y < 880, null, 5000));
  await until(page, () => Math.abs(window.__game.getState().entities.find((e) => e.id === 'hero').y - 920) < 0.5);

  await clickGame(page, 640, 660);
  await untilTime(page, (await gameState(page)).time + 0.2);
  s = await gameState(page);
  check('tapObject: tapping the bell counts a hit', s.variables.hits === 1);
  check('show: the hidden object appears', at('secret').visible === true);
  check('spawn: a spark is created on the bell', s.entities.some((e) => e.id === 'spark' && Math.abs(e.x - 630) < 1));
  check('push: the ball starts moving up', at('ball').y < 300);

  const [cx, cy] = await toPage(page, 340, 540);
  const [tx, ty] = await toPage(page, 240, 740);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 5 });
  await untilTime(page, (await gameState(page)).time + 0.15);
  await page.mouse.up();
  s = await gameState(page);
  check('draggable: the crate follows the finger', Math.abs(at('crate').x - 200) < 3 && Math.abs(at('crate').y - 700) < 3, `${at('crate').x},${at('crate').y}`);

  await clickGame(page, 640, 660);
  await untilTime(page, (await gameState(page)).time + 0.2);
  s = await gameState(page);
  check('variable trigger: the second hit hides the secret', s.variables.hits === 2 && at('secret').visible === false);
  check('moveTo + destroy: the bait moves and sparks are removed', at('bait').y === 600 && !s.entities.some((e) => e.id === 'spark'));
  await page.screenshot({ path: resolve(shots, '5-lab.png') });

  await clickGame(page, 640, 660);
  check('restartScene: the third hit starts the scene again', await until(page, () => window.__game.getState().time < 0.5, null, 5000));
  check('lab: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 4. Lab 2: a scrolling world, screen-fixed objects, and the newer blocks ─
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const id = (v) => ({ by: 'id', id: v });
  const add = (name, amount = 1) => ({ type: 'setVariable', name, op: 'add', amount });
  const names = ['taps', 'later', 'swipes', 'held', 'won', 'roll'];
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab2', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka' },
    app: { appId: 'com.example.labtwo', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {},
    variables: names.map((name) => ({ name, initial: 0, saved: false })),
    startScene: 'w',
    scenes: [{
      id: 'w', name: 'w', width: 2000, height: 1280, background: '#102030', music: null, gravity: 2000,
      objects: [
        box('floor', 0, 1000, 2000, 40, { tags: ['wall'] }),
        box('hero', 100, 920, 80, 80, { tags: ['hero'], behaviors: [
          { type: 'body', gravity: true, solidTag: 'wall', bounce: 0, edges: 'stop', oneWay: false },
          { type: 'walker', speed: 400, control: 'auto', leftTag: '', rightTag: '' },
          { type: 'camera', lock: 'free' },
        ] }),
        box('hat', 0, 0, 40, 20, { behaviors: [{ type: 'attach', targetTag: 'hero', offsetX: 10, offsetY: -30 }] }),
        box('bird', 200, 500, 40, 40, { behaviors: [{ type: 'wave', axis: 'y', distance: 50, seconds: 1 }] }),
        box('ball', 300, 300, 40, 40, { fixed: true, behaviors: [
          { type: 'body', gravity: false, solidTag: '', bounce: 1, edges: 'bounce', oneWay: false }, { type: 'launch', vx: 600, vy: 0 },
        ] }),
        box('star', 20, 20, 30, 30, { fixed: true, behaviors: [{ type: 'blink', seconds: 1 }] }),
        box('ghost', 80, 20, 30, 30, { fixed: true, opacity: 0.5, rotation: 45 }),
        box('hudbtn', 600, 1150, 100, 100, { fixed: true }),
        box('gem', 100, 1150, 80, 80, { fixed: true, tags: ['gem'] }),
        box('crate', 50, 700, 60, 60, { fixed: true }),
        box('dot', 5, 5, 10, 10, { fixed: true }),
      ],
      prefabs: [],
      rules: [
        { id: 'r-start', when: { type: 'start' }, condition: null, then: [{ type: 'setVariable', name: 'roll', op: 'set', amount: { random: [3, 5] } }] },
        { id: 'r-btn', when: { type: 'tapObject', target: id('hudbtn') }, condition: null, then: [add('taps'), { type: 'moveRandom', target: id('dot') }, { type: 'wait', seconds: 0.5 }, add('later')] },
        { id: 'r-swipe', when: { type: 'swipe', direction: 'right' }, condition: null, then: [add('swipes'), { type: 'moveBy', target: id('crate'), dx: 50, dy: 0 }] },
        { id: 'r-hold', when: { type: 'holding' }, condition: null, then: [add('held')] },
        { id: 'r-gem', when: { type: 'tapObject', target: { by: 'tag', tag: 'gem' } }, condition: null, then: [{ type: 'destroy', target: 'first' }] },
        { id: 'r-none', when: { type: 'noneLeft', target: { by: 'tag', tag: 'gem' } }, condition: null, then: [{ type: 'setVariable', name: 'won', op: 'set', amount: 1 }] },
      ],
    }],
  };

  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await untilTime(page, 0.6);
  let s = await gameState(page);
  const at = (name) => s.entities.find((e) => e.id === name);
  check('random amount: a whole number inside its limits', [3, 4, 5].includes(s.variables.roll), `roll ${s.variables.roll}`);
  check('opacity: a half-transparent object reports it', at('ghost').opacity === 0.5);
  check('attach: the hat sits on the hero at its offset', Math.abs(at('hat').x - (at('hero').x + 10)) < 0.01 && Math.abs(at('hat').y - (at('hero').y - 30)) < 0.01);
  check('camera: the view follows the hero into the world', s.camera.x > 0, `camera ${s.camera.x.toFixed(0)}`);

  const samples = [];
  for (let i = 0; i < 12; i++) {
    s = await gameState(page);
    samples.push({ bird: at('bird').y, star: at('star').opacity, ball: at('ball').x });
    await sleep(120);
  }
  check('wave: the bird sways within its distance', samples.every((p) => p.bird >= 449.9 && p.bird <= 550.1) && new Set(samples.map((p) => Math.round(p.bird))).size > 3);
  check('blink: the star fades in and out', Math.min(...samples.map((p) => p.star)) < 0.5 && Math.max(...samples.map((p) => p.star)) > 0.5);

  // Fixed objects are hit where they are drawn, even though the camera has moved.
  await clickGame(page, 650, 1200);
  await untilTime(page, (await gameState(page)).time + 0.15);
  s = await gameState(page);
  const tapTime = s.time;
  check('fixed: a button fixed to the screen is tapped where it is drawn', s.variables.taps === 1, `taps ${s.variables.taps}`);
  check('moveRandom: the dot jumps somewhere on the screen', (at('dot').x !== 5 || at('dot').y !== 5) && at('dot').x >= 0 && at('dot').x <= 710);
  check('wait: later actions have not run yet', s.variables.later === 0);
  await untilTime(page, tapTime + 0.8);
  check('wait: later actions run after the pause', (await gameState(page)).variables.later === 1);

  const [fx, fy] = await toPage(page, 200, 500);
  const [tx, ty] = await toPage(page, 500, 520);
  await page.mouse.move(fx, fy);
  await page.mouse.down();
  await until(page, () => window.__game.getState().variables.held >= 2);
  s = await gameState(page);
  check('holding: counts up while the screen is held', s.variables.held >= 2, `held ${s.variables.held}`);
  await page.mouse.up();

  // A separate quick gesture, delivered together so renderer or protocol
  // delays while checking the hold cannot turn the swipe into a long drag.
  await page.evaluate((fx, fy, tx, ty) => {
    const canvas = document.querySelector('canvas');
    const send = (type, x, y, buttons) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y, buttons, bubbles: true,
    }));
    send('pointerdown', fx, fy, 1);
    send('pointermove', tx, ty, 1);
    send('pointerup', tx, ty, 0);
  }, fx, fy, tx, ty);
  await until(page, () => window.__game.getState().variables.swipes > 0);
  s = await gameState(page);
  check('swipe: a quick slide to the right is recognised', s.variables.swipes === 1, `swipes ${s.variables.swipes}`);
  check('moveBy: the crate moves by the given distance', at('crate').x === 100);

  check('noneLeft: has not fired while a gem remains', s.variables.won === 0);
  await clickGame(page, 140, 1190);
  check('noneLeft: fires when the last gem is gone', await until(page, () => window.__game.getState().variables.won === 1, null, 5000));

  await untilTime(page, 6.5);
  s = await gameState(page);
  check('edges: the hero stops at the edge of the world', Math.abs(at('hero').x - 1920) < 0.5, `x ${at('hero').x}`);
  check('camera: the view stops at the edge of the world', s.camera.x === 1280, `camera ${s.camera.x}`);
  check('edges: the ball has bounced and stayed on the screen', at('ball').x >= 0 && at('ball').x <= 680);
  await page.screenshot({ path: resolve(shots, '6-lab2.png') });
  check('lab 2: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 5. Lab 3: animation, sounds and music, effects, platforms ──────────────
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab3', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Bangers' },
    app: { appId: 'com.example.labthree', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: true,
    assets: {
      a1: { type: 'image', src: solidPng(255, 140, 0) },
      a2: { type: 'image', src: solidPng(0, 120, 255) },
      beep: { type: 'sound', name: 'beep.wav', src: silentWav() },
    },
    variables: [],
    startScene: 'fx',
    scenes: [{
      id: 'fx', name: 'fx', width: 720, height: 1280, background: null, music: 'beep', gravity: 2000,
      objects: [
        { ...box('ground', 0, 1200, 720, 80), visual: { kind: 'image', asset: 'a1' }, behaviors: [{ type: 'scrollImage', vx: -100, vy: 0 }] },
        { ...box('anim', 500, 300, 60, 60), visual: { kind: 'image', asset: 'a1', frames: ['a2'], fps: 10, flip: true },
          behaviors: [{ type: 'mover', vx: -60, vy: 0, speedVariable: '', atEdge: 'nothing' }] },
        box('plat', 100, 700, 300, 30, { tags: ['plat'] }),
        box('hopper', 200, 900, 60, 60, { behaviors: [
          { type: 'body', gravity: true, solidTag: 'plat', bounce: 0, edges: 'none', oneWay: true }, { type: 'launch', vx: 0, vy: -1100 },
        ] }),
        box('wrapper', 600, 100, 50, 50, { fixed: true, behaviors: [
          { type: 'body', gravity: false, solidTag: '', bounce: 0, edges: 'wrap', oneWay: false }, { type: 'launch', vx: 500, vy: 0 },
        ] }),
        box('bell', 600, 1050, 100, 100, { fixed: true }),
        { ...box('title', 360, 40, 0, 0), visual: { kind: 'text', text: 'Outlined', color: '#ffffff', size: 60, outline: '#000000' } },
      ],
      prefabs: [],
      rules: [
        { id: 'r-sounds', when: { type: 'start' }, condition: null, then: [{ type: 'playSound', sound: 'beep' }, { type: 'playSound', sound: 'coin' }] },
        { id: 'r-bell', when: { type: 'tapObject', target: { by: 'id', id: 'bell' } }, condition: null, then: [
          { type: 'burst', target: 'first', color: '#ffcc00', count: 20 }, { type: 'shake', strength: 12 },
        ] },
      ],
    }],
  };

  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  const samples = [];
  for (let i = 0; i < 40; i++) {
    const s = await gameState(page);
    const at = (name) => s.entities.find((e) => e.id === name);
    samples.push({ t: s.time, frame: at('anim').frame, flipped: at('anim').flipped, hop: at('hopper').y, wrap: at('wrapper').x });
    if (s.time > 2.6) break;
    await sleep(100);
  }
  const last = samples.at(-1);
  check('animation: the picture steps through its frames', samples.some((p) => p.frame === 0) && samples.some((p) => p.frame === 1));
  check('flip: a picture moving left faces left', last.flipped === true);
  check('one-way platform: the hopper passes up through it', Math.min(...samples.map((p) => p.hop)) < 640);
  check('one-way platform: and lands on top of it coming down', Math.abs(last.hop - 640) < 0.5, `y ${last.hop}`);
  check('wrap: leaving the right edge brings it back on the left', Math.min(...samples.map((p) => p.wrap)) < 600 && samples.every((p) => p.wrap <= 720.5));

  await clickGame(page, 650, 1100);
  // The tap is handled on the next frame, which a busy computer may draw a moment later.
  await until(page, () => window.__game.getState().particles > 0 && window.__game.getState().shaking, null, 5000);
  let s = await gameState(page);
  check('burst and shake: tapping throws out pieces and shakes the screen', s.particles > 0 && s.shaking, `particles ${s.particles}, shaking ${s.shaking}`);
  await page.screenshot({ path: resolve(shots, '7-lab3.png') });
  check('burst and shake: both die away on their own', await until(page, () => window.__game.getState().particles === 0 && !window.__game.getState().shaking, null, 15000));
  check('lab 3 (sounds, music, outline, scrolling image): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 6. Lab 4: animation sets, smooth effects, health, pause, endless spawning, circles ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const fixed = (id, x, y, w, h, extra = {}) => box(id, x, y, w, h, { fixed: true, ...extra });
  const id = (v) => ({ by: 'id', id: v });
  const after = (name, seconds, then) => ({ id: name, when: { type: 'after', seconds }, condition: null, then });
  const tapOn = (name, target, then) => ({ id: name, when: { type: 'tapObject', target: id(target) }, condition: null, then });
  const add = (name) => ({ type: 'setVariable', name, op: 'add', amount: 1 });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab4', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka' },
    app: { appId: 'com.example.labfour', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false,
    assets: { a1: { type: 'image', src: solidPng(255, 140, 0) }, a2: { type: 'image', src: solidPng(0, 120, 255) }, a3: { type: 'image', src: solidPng(0, 200, 90) } },
    variables: ['kills', 'cornerHit', 'sideHit'].map((name) => ({ name, initial: 0, saved: false })),
    startScene: 'tall',
    scenes: [{
      id: 'tall', name: 'tall', width: 720, height: 6000, background: null, music: null, gravity: 2000,
      objects: [
        box('far', 100, 100, 50, 50),
        box('floor', 0, 5950, 720, 50, { tags: ['floor'] }),
        { ...box('runner', 50, 5890, 60, 60), visual: { kind: 'image', asset: 'a1', moveFrames: ['a2'], airFrames: ['a3'] }, behaviors: [
          { type: 'body', gravity: true, solidTag: 'floor', bounce: 0, edges: 'none', oneWay: false },
          { type: 'walker', speed: 100, control: 'auto', leftTag: '', rightTag: '' },
          { type: 'jumper', jumpSpeed: 700, maxJumps: 1, on: 'none', buttonTag: '' },
        ] },
        { ...box('stander', 400, 5890, 60, 60), visual: { kind: 'image', asset: 'a1', frames: ['a2'], fps: 10 } },
        box('climber', 330, 5800, 60, 60, { behaviors: [{ type: 'mover', vx: 0, vy: -600, speedVariable: '', atEdge: 'nothing' }, { type: 'camera', lock: 'up' }] }),
        fixed('maker', 300, 0, 20, 20, { visible: false, behaviors: [{ type: 'spawner', prefabs: ['step'], minInterval: 1, maxInterval: 1, spreadX: 200, spreadY: 0, everyDistance: 200 }] }),
        fixed('popper', 20, 100, 60, 60),
        fixed('fader', 120, 100, 60, 60),
        fixed('shrinker', 220, 100, 60, 60),
        fixed('glider', 0, 300, 40, 40),
        fixed('heart', 320, 100, 60, 60, { behaviors: [{ type: 'pulse', amount: 0.2, seconds: 1 }] }),
        fixed('brick', 100, 1000, 100, 60, { health: 2, tags: ['brick'] }),
        fixed('hit', 500, 1000, 100, 100),
        fixed('pauseBtn', 300, 1150, 100, 100),
        fixed('resumeBtn', 450, 1150, 100, 100),
        { ...fixed('meter', 20, 20, 300, 30), visual: { kind: 'bar', variable: 'kills', max: 2, color: '#43a047', back: '#1b3a4b' } },
        fixed('ballA', 600, 100, 40, 40, { round: true }),
        fixed('cornerB', 636, 136, 40, 40),
        fixed('ballC', 600, 200, 40, 40, { round: true }),
        fixed('sideD', 630, 200, 40, 40),
      ],
      prefabs: [box('step', 0, 0, 120, 20, { tags: ['step'] })],
      rules: [
        after('r-fx', 0.5, [
          { type: 'effect', target: id('popper'), kind: 'pop', seconds: 0.8 }, { type: 'effect', target: id('fader'), kind: 'fadeOut', seconds: 0.5 },
          { type: 'effect', target: id('shrinker'), kind: 'shrink', seconds: 0.5 }, { type: 'glide', target: id('glider'), x: 400, y: 300, seconds: 1 },
        ]),
        after('r-jump', 0.8, [{ type: 'jump', target: id('runner') }]),
        after('r-drop', 3, [{ type: 'moveBy', target: id('climber'), dx: 0, dy: 900 }]),
        tapOn('r-hit', 'hit', [{ type: 'damage', target: id('brick'), amount: 1 }]),
        { id: 'r-dead', when: { type: 'dead', target: { by: 'tag', tag: 'brick' } }, condition: null, then: [{ type: 'destroy', target: 'first' }, add('kills')] },
        tapOn('r-pause', 'pauseBtn', [{ type: 'pause' }]),
        tapOn('r-resume', 'resumeBtn', [{ type: 'resume' }]),
        { id: 'r-corner', when: { type: 'touch', a: id('ballA'), b: id('cornerB') }, condition: null, then: [add('cornerHit')] },
        { id: 'r-side', when: { type: 'touch', a: id('ballC'), b: id('sideD') }, condition: null, then: [add('sideHit')] },
      ],
    }],
  };

  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  const samples = [];
  for (let i = 0; i < 60; i++) {
    const s = await gameState(page);
    const at = (name) => s.entities.find((e) => e.id === name);
    samples.push({ t: s.time, run: at('runner').anim, stand: at('stander').anim, standFrame: at('stander').frame, pop: at('popper').scale, heart: at('heart').scale, glide: at('glider').x });
    if (s.time > 2.4) break;
    await sleep(80);
  }
  let s = await gameState(page);
  const at = (name) => s.entities.find((e) => e.id === name);
  check('placed objects far from the view are kept', Boolean(at('far')));
  check('animation sets: running shows the move pictures, jumping the air pictures', samples.some((p) => p.run === 'move') && samples.some((p) => p.run === 'air'));
  check('animation sets: an object at rest cycles its own pictures', samples.every((p) => p.stand === 'idle') && samples.some((p) => p.standFrame === 1));
  check('effect pop: swells, then settles back to its size', Math.max(...samples.map((p) => p.pop)) > 1.15 && Math.abs(at('popper').scale - 1) < 0.01);
  check('effect fadeOut: ends hidden', at('fader').visible === false);
  check('effect shrink: ends removed', !at('shrinker'));
  check('glide: travels smoothly and stops on the point', samples.some((p) => p.glide > 50 && p.glide < 350) && Math.abs(at('glider').x - 400) < 0.01);
  check('pulse: grows and shrinks within its amount', Math.max(...samples.map((p) => p.heart)) > 1.1 && samples.every((p) => p.heart >= 0.999 && p.heart <= 1.201));
  check('round: a circle does not touch a box that only overlaps its empty corner', s.variables.cornerHit === 0);
  check('round: a circle does touch a box beside it', s.variables.sideHit === 1);
  check('endless: the spawner creates steps as the camera climbs', s.entities.filter((e) => e.id === 'step').length >= 3, `steps ${s.entities.filter((e) => e.id === 'step').length}`);

  const climbed = s.camera.y;
  await untilTime(page, 3.4);
  s = await gameState(page);
  check('camera lock: the view does not follow the climber back down', s.camera.y <= climbed + 0.5 && at('climber').y > s.camera.y + 640, `camera ${s.camera.y.toFixed(0)}, was ${climbed.toFixed(0)}`);

  await clickGame(page, 550, 1050);
  await untilTime(page, (await gameState(page)).time + 0.15);
  s = await gameState(page);
  check('health: one hit lowers it', at('brick')?.health === 1 && s.variables.kills === 0);
  await clickGame(page, 550, 1050);
  check('health: the last hit fires «dead», which removes it', await until(page, () => { const st = window.__game.getState(); return st.variables.kills === 1 && !st.entities.some((e) => e.id === 'brick'); }, null, 5000));

  await clickGame(page, 350, 1200);
  s = await gameState(page);
  const frozenAt = s.time;
  await sleep(400);
  s = await gameState(page);
  check('pause: the game and its clock stop', s.paused === true && s.time === frozenAt);
  await clickGame(page, 500, 1200);
  check('resume: a tap rule starts it again', await until(page, (t) => { const st = window.__game.getState(); return !st.paused && st.time > t; }, frozenAt, 5000));
  await page.screenshot({ path: resolve(shots, '8-lab4.png') });
  check('lab 4 (with a value bar): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 7. Lab 5: how movement feels, and the blocks added with it ─────────────
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const id = (v) => ({ by: 'id', id: v });
  const add = (name, amount = 1) => ({ type: 'setVariable', name, op: 'add', amount });
  const body = { type: 'body', gravity: true, solidTag: 'ground', bounce: 0, edges: 'none', oneWay: false };
  const names = ['landed', 'right', 'wrong', 'swaps'];
  const scene = (sid, objects, prefabs, rules) => ({ id: sid, name: sid, width: 2400, height: 1280, background: null, music: null, gravity: 2400, objects, prefabs, rules });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab5', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka' },
    app: { appId: 'com.example.labfive', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: true,
    assets: { a: { type: 'image', src: solidPng(255, 140, 0) }, b: { type: 'image', src: solidPng(0, 120, 255) } },
    variables: [...names.map((name) => ({ name, initial: 0, saved: false })), { name: 'low', initial: 2, saved: false }, { name: 'high', initial: 5, saved: false }],
    startScene: 'five',
    scenes: [
      scene('five', [
        box('floor', 0, 1000, 2400, 60, { tags: ['ground'] }),
        box('lift', 300, 800, 200, 30, { tags: ['ground'], behaviors: [{ type: 'patrol', axis: 'x', distance: 300, speed: 200 }] }),
        box('rider', 350, 700, 50, 50, { behaviors: [body] }),
        box('faller', 1000, 100, 50, 50, { behaviors: [body, { type: 'jumper', jumpSpeed: 900, maxJumps: 1, on: 'tap', buttonTag: '', variable: true }] }),
        box('runner', 0, 1150, 40, 40, { behaviors: [{ type: 'walker', speed: 400, control: 'auto', leftTag: '', rightTag: '', ease: 1 }, { type: 'camera', lock: 'free', smooth: 0.8 }] }),
        box('hills', 0, 600, 400, 40, { parallax: 0.5, visual: { kind: 'image', asset: 'a', repeat: 'x' } }),
        box('blast', 60, 60, 40, 40, { fixed: true, visual: { kind: 'image', asset: 'a', frames: ['b'], fps: 10, once: true } }),
        box('gun', 100, 200, 20, 20),
        box('mark', 400, 600, 20, 20, { tags: ['mark'] }),
        box('cannon', 100, 200, 20, 20, { fixed: true }),
        box('on', 600, 100, 60, 60, { fixed: true }),
        box('off', 600, 100, 60, 60, { fixed: true, visible: false }),
      ], [
        box('dart', 0, 0, 20, 10, { behaviors: [{ type: 'launch', vx: 0, vy: 0, toward: 'group', targetTag: 'mark', speed: 500, face: true }, { type: 'trail', color: '#ffffff', size: 12, rate: 40 }] }),
        box('shot', 0, 0, 20, 20, { fixed: true, behaviors: [{ type: 'launch', vx: 0, vy: 0, toward: 'tap', speed: 500 }] }),
      ], [
        { id: 'r-land', when: { type: 'land', target: id('rider') }, condition: null, then: [add('landed')] },
        { id: 'r-dart', when: { type: 'after', seconds: 0.2 }, condition: null, then: [{ type: 'spawn', prefab: 'dart', at: id('gun') }] },
        { id: 'r-mute', when: { type: 'after', seconds: 0.3 }, condition: null, then: [{ type: 'setSound', on: false }, { type: 'vibrate', ms: 20 }] },
        { id: 'r-shot', when: { type: 'tap' }, condition: null, then: [{ type: 'spawn', prefab: 'shot', at: id('cannon') }] },
        { id: 'r-right', when: { type: 'every', seconds: 0.1 }, condition: { name: 'high', op: '>=', value: { variable: 'low' } }, then: [add('right')] },
        { id: 'r-wrong', when: { type: 'every', seconds: 0.1 }, condition: { name: 'low', op: '>=', value: { variable: 'high' } }, then: [add('wrong')] },
        { id: 'r-on', when: { type: 'tapObject', target: id('on') }, condition: null, then: [{ type: 'hide', target: id('on') }, { type: 'show', target: id('off') }, add('swaps')] },
        { id: 'r-off', when: { type: 'tapObject', target: id('off') }, condition: null, then: [{ type: 'hide', target: id('off') }, { type: 'show', target: id('on') }, add('swaps')] },
        { id: 'r-next', when: { type: 'after', seconds: 3 }, condition: null, then: [{ type: 'goToScene', scene: 'two' }] },
      ]),
      scene('two', [box('only', 100, 100, 50, 50)], [], []),
    ],
  };

  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  // Taps at exact moments of the game's own clock, and a record of what was seen, kept inside the page
  // so that nothing depends on how long a round trip to this script takes.
  await page.evaluate(() => {
    const game = window.__game;
    const log = (window.__log = { taps: [], mid: null, minY: Infinity, fadeSeen: false, frames: [], ticks: 0 });
    const done = new Set();
    window.__watch = setInterval(() => {
      const s = game.getState();
      if (s.scene !== 'five') return;
      log.ticks += 1;
      if (s.fading) log.fadeSeen = true;
      const faller = s.entities.find((e) => e.id === 'faller');
      for (const at of [0.45, 0.74]) {
        if (s.time < at || done.has(at)) continue;
        done.add(at);
        game.tap();
        log.taps.push({ time: s.time, grounded: faller.grounded });
      }
      if (s.time >= 0.62 && !log.mid) {
        const runner = s.entities.find((e) => e.id === 'runner');
        log.mid = { time: s.time, fallerVy: faller.vy, runnerVx: runner.vx, riding: s.entities.find((e) => e.id === 'rider').x - s.entities.find((e) => e.id === 'lift').x };
      }
      // It lands at 0.84; from just after that, the highest point it reaches is the height of its hop.
      if (s.time > 0.87 && s.time < 1.6) log.minY = Math.min(log.minY, faller.y);
      const dart = s.entities.find((e) => e.id === 'dart');
      if (dart && s.time > 0.35 && !window.__dart) window.__dart = { vx: dart.vx, vy: dart.vy, angle: dart.angle, particles: s.particles };
      if (s.time > 0.8) log.frames.push(s.entities.find((e) => e.id === 'blast').frame);
    }, 4);
  });

  await untilTime(page, 1.7);
  let s = await gameState(page);
  const at = (name) => s.entities.find((e) => e.id === name);
  const log = await page.evaluate(() => window.__log);
  // The platform has gone out and turned back since the first look; the rider is still on the same spot of it.
  check('moving platform: what stands on it is carried along, both ways', at('lift').x > 400 && Math.abs(at('rider').x - at('lift').x - log.mid.riding) < 1 && at('rider').grounded, `on it at ${log.mid.riding.toFixed(1)} then ${(at('rider').x - at('lift').x).toFixed(1)}`);
  check('land: fires once when a body comes down, not again while it rides', s.variables.landed === 1, `landed ${s.variables.landed}`);
  check('jump: a press in mid-air, long after leaving the ground, does nothing', log.taps[0] && !log.taps[0].grounded && log.mid.fallerVy > 0, JSON.stringify(log.mid));
  check('jump: a press just before landing still jumps on landing', log.taps[1] && !log.taps[1].grounded && log.minY < 945, `min y ${log.minY}, tap at ${log.taps[1]?.time}`);
  check('jump: letting go early makes it a short hop', log.minY > 890, `min y ${log.minY} (a full jump reaches 781)`);
  check('walker: speed builds up instead of snapping', Math.abs(log.mid.runnerVx - 400 * log.mid.time) < 40, JSON.stringify(log.mid));
  const centred = at('runner').x + 20 - 360;
  check('camera: a soft camera trails behind what it follows', s.camera.x > 20 && s.camera.x < centred - 5, `camera ${s.camera.x.toFixed(0)}, centred ${centred.toFixed(0)}`);
  check('animation: one set to play once holds its last picture', log.frames.length > 3 && log.frames.every((f) => f === 1), log.frames.slice(0, 6).join());
  check('condition: one value can be compared with another', s.variables.right > 3 && s.variables.wrong === 0, `right ${s.variables.right}, wrong ${s.variables.wrong}`);
  check('setSound: sound can be switched off by a rule', s.soundOn === false);

  // The dart was aimed from the gun (centre 110,210) at the mark (centre 410,610): three across, four down.
  const dartSeen = await page.evaluate(() => window.__dart);
  check('launch toward a group: flies straight at the nearest one, turned to face it', dartSeen && Math.abs(dartSeen.vx - 300) < 1 && Math.abs(dartSeen.vy - 400) < 1 && Math.abs(dartSeen.angle - Math.atan2(4, 3)) < 0.01, JSON.stringify(dartSeen));
  check('trail: leaves dots behind it', dartSeen && dartSeen.particles > 0);

  await page.evaluate(() => window.__game.tap(400, 600));
  await untilTime(page, s.time + 0.1);
  s = await gameState(page);
  // The newest one is drawn just above the cannon, so it comes first.
  const shot = s.entities.find((e) => e.id === 'shot');
  const reach = Math.hypot(400 - 110, 600 - 210);
  check('launch toward the touch: flies at where the screen was touched', shot && Math.abs(shot.vx - (290 / reach) * 500) < 1 && Math.abs(shot.vy - (390 / reach) * 500) < 1, JSON.stringify(shot && [shot.vx, shot.vy]));

  await page.evaluate(() => window.__game.tap(630, 130));
  await untilTime(page, s.time + 0.1);
  s = await gameState(page);
  check('a touch presses only what was on show: swapping two buttons takes one step, not two', s.variables.swaps === 1 && at('off').visible && !at('on').visible, `swaps ${s.variables.swaps}`);

  check('scene change: fades through black', await until(page, () => window.__log.fadeSeen, null, 20000));
  check('and arrives at the next scene, clear again', await until(page, () => { const st = window.__game.getState(); return st.scene === 'two' && !st.fading; }, null, 10000));
  await page.screenshot({ path: resolve(shots, '9-lab5.png') });
  check('lab 5: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 8. Lab 6: games seen from above — steering, routes, counting, a touch as a place ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const steer = (control, extra = {}) => ({ type: 'steer', speed: 300, control, upTag: '', downTag: '', leftTag: '', rightTag: '', face: false, ...extra });
  const after = (rid, seconds, then) => ({ id: rid, when: { type: 'after', seconds }, condition: null, then });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab6', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labsix', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {},
    variables: [{ name: 'marks', initial: 0, saved: false }],
    startScene: 'six',
    scenes: [{
      id: 'six', name: 'six', width: 720, height: 1280, background: null, music: null, gravity: 2400,
      objects: [
        box('wall', 0, 900, 720, 40, { tags: ['wall'] }),
        box('pilot', 300, 600, 40, 40, { behaviors: [{ type: 'body', gravity: false, solidTag: 'wall', bounce: 0, edges: 'stop', oneWay: false }, steer('stick', { face: true })] }),
        box('snake', 100, 1200, 30, 30, { behaviors: [steer('swipe', { speed: 200 })] }),
        box('p3', 300, 300, 20, 20, { tags: ['path'] }),
        box('p1', 100, 100, 20, 20, { tags: ['path'] }),
        box('p2', 300, 100, 20, 20, { tags: ['path'] }),
        box('cart', 100, 100, 20, 20, { behaviors: [{ type: 'route', tag: 'path', speed: 400, end: 'stop' }] }),
        box('ball', 200, 500, 20, 20, { tags: ['ball'] }),
        box('bat', 600, 100, 20, 20, { behaviors: [{ type: 'chase', targetTag: 'ball', speed: 200, axis: 'y' }] }),
        box('floaty', 650, 300, 20, 20, { behaviors: [{ type: 'body', gravity: true, solidTag: '', bounce: 0, edges: 'none', oneWay: false }] }),
      ],
      prefabs: [box('dot', 0, 0, 30, 30)],
      rules: [
        after('r-count', 0.2, [{ type: 'setVariable', name: 'marks', op: 'set', amount: { count: 'path' } }]),
        after('r-up', 0.3, [{ type: 'setGravity', amount: -2400 }]),
        { id: 'r-dot', when: { type: 'tap' }, condition: null, then: [{ type: 'spawn', prefab: 'dot', at: 'tap' }] },
      ],
    }],
  };

  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await page.evaluate(() => {
    window.__watch = setInterval(() => {
      const s = window.__game.getState();
      const cart = s.entities.find((e) => e.id === 'cart');
      if (s.time >= 0.25 && !window.__early) window.__early = { x: cart.x, y: cart.y };
    }, 4);
  });
  await untilTime(page, 2.3);
  let s = await gameState(page);
  const at = (name) => s.entities.find((e) => e.id === name);
  const early = await page.evaluate(() => window.__early);
  check('route: goes to the markers in the order of their names', early.y === 100 && early.x > 100 && early.x < 300 && at('cart').x === 300 && at('cart').y === 300, `early ${JSON.stringify(early)}, end ${at('cart').x},${at('cart').y}`);
  check('chase on one axis: follows up and down only', at('bat').x === 600 && Math.abs(at('bat').y - 500) <= 1.5, `${at('bat').x},${at('bat').y}`);
  check('amount: the number of objects in a group', s.variables.marks === 3, `marks ${s.variables.marks}`);
  check('setGravity: things fall upward after gravity is turned over', at('floaty').vy < 0, `vy ${at('floaty').vy}`);

  // A finger put down below the wall and dragged straight down: the stick steers the pilot down into the wall.
  await page.mouse.move(...(await toPage(page, 360, 1100)));
  await page.mouse.down();
  await page.mouse.move(...(await toPage(page, 360, 1200)), { steps: 3 });
  check('steer with the stick: a drag sends it that way at full speed, turned to face it', await until(page, () => {
    const p = window.__game.getState().entities.find((e) => e.id === 'pilot');
    return Math.abs(p.vy - 300) < 1 && Math.abs(p.vx) < 1 && Math.abs(p.angle - Math.PI / 2) < 0.01;
  }, null, 5000));
  check('steer with a body: a wall stops it', await until(page, () => window.__game.getState().entities.find((e) => e.id === 'pilot').y === 860, null, 10000));
  await page.mouse.up();
  s = await gameState(page);
  const dot = at('dot');
  check('spawn at the touch: the new object appears where the screen was touched', dot && Math.abs(dot.x + 15 - 360) < 2 && Math.abs(dot.y + 15 - 1100) < 2, JSON.stringify(dot && [dot.x, dot.y]));

  await page.keyboard.down('ArrowRight');
  await until(page, () => window.__game.getState().entities.find((e) => e.id === 'snake').vx === 200, null, 5000);
  await page.keyboard.up('ArrowRight');
  await untilTime(page, (await gameState(page)).time + 0.2);
  s = await gameState(page);
  check('steer by swipe: keeps going the way it was last sent', at('snake').vx === 200 && at('snake').x > 100, `vx ${at('snake').vx}`);
  check('lab 6: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 9. Lab 7: board games — an object's own values, lines, shuffling, steps on a grid ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const after = (rid, seconds, then) => ({ id: rid, when: { type: 'after', seconds }, condition: null, then });
  const add = (name, amount = 1) => ({ type: 'setVariable', name, op: 'add', amount });
  const empty = { by: 'tag', tag: 'cell', where: { name: 'mark', op: '==', value: 0 } };
  const cells = Array.from({ length: 9 }, (_, i) =>
    box(`c${i}`, 100 + (i % 3) * 100, 100 + Math.floor(i / 3) * 100, 100, 100, { tags: ['cell'], values: { mark: 0 }, visual: { kind: 'image', asset: 'a', frames: ['b', 'c'], frameBy: 'mark' } }));
  const deckPlaces = [[0, 900], [100, 900], [200, 900], [300, 900], [400, 900], [500, 900]];
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab7', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labseven', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false,
    assets: { a: { type: 'image', src: solidPng(200, 200, 200) }, b: { type: 'image', src: solidPng(255, 0, 0) }, c: { type: 'image', src: solidPng(0, 0, 255) } },
    variables: [{ name: 'turn', initial: 1, saved: false }, ...['inLine', 'noughts', 'picked'].map((name) => ({ name, initial: 0, saved: false }))],
    startScene: 'seven',
    scenes: [{
      id: 'seven', name: 'seven', width: 720, height: 1280, background: null, music: null, gravity: 0, cell: 100,
      objects: [
        ...cells,
        box('pusher', 100, 600, 100, 100),
        box('crate', 200, 600, 100, 100, { tags: ['crate'] }),
        box('rock', 400, 600, 100, 100, { tags: ['rock'] }),
        ...[3, 4, 5].map((power, i) => box(`lamp${i}`, 100 + i * 100, 750, 60, 60, { tags: ['lamp'], values: { on: 0, power } })),
        ...deckPlaces.map(([x, y], i) => box(`d${i}`, x, y, 80, 80, { tags: ['deck'] })),
        { ...box('counter', 360, 1100, 0, 0, { values: { n: 7 } }), visual: { kind: 'text', text: 'N={n} T={turn}', color: '#ffffff', size: 40 } },
      ],
      prefabs: [],
      rules: [
        { id: 'r-x', when: { type: 'tapObject', target: empty }, condition: { name: 'turn', op: '==', value: 1 }, then: [{ type: 'setValue', target: 'first', name: 'mark', op: 'set', amount: 1 }, { type: 'setVariable', name: 'turn', op: 'set', amount: 2 }] },
        { id: 'r-o', when: { type: 'tapObject', target: empty }, condition: { name: 'turn', op: '==', value: 2 }, then: [{ type: 'setValue', target: 'first', name: 'mark', op: 'set', amount: 2 }, { type: 'setVariable', name: 'turn', op: 'set', amount: 1 }] },
        { id: 'r-line', when: { type: 'line', target: { by: 'tag', tag: 'cell' }, name: 'mark', length: 3, diagonal: true }, condition: null, then: [add('inLine')] },
        { id: 'r-nought', when: { type: 'value', target: { by: 'tag', tag: 'cell' }, name: 'mark', op: '==', value: 2 }, condition: null, then: [add('noughts')] },
        after('r-step1', 0.2, [{ type: 'step', target: { by: 'id', id: 'pusher' }, direction: 'right', blockTag: 'rock', pushTag: 'crate' }]),
        after('r-step2', 0.4, [{ type: 'step', target: { by: 'id', id: 'pusher' }, direction: 'right', blockTag: 'rock', pushTag: 'crate' }]),
        after('r-lamp', 0.3, [{ type: 'setValue', target: { by: 'tag', tag: 'lamp', pick: 'random' }, name: 'on', op: 'set', amount: 1 }]),
        {
          id: 'r-lit', when: { type: 'value', target: { by: 'tag', tag: 'lamp' }, name: 'on', op: '==', value: 1 },
          condition: { of: 'first', name: 'power', op: '>', value: 2 }, also: [{ name: 'turn', op: '>=', value: 1 }],
          then: [{ type: 'setVariable', name: 'picked', op: 'set', amount: { value: 'power', of: 'first' } }],
        },
        after('r-shuffle', 0.5, [{ type: 'shuffle', target: { by: 'tag', tag: 'deck' } }]),
      ],
    }],
  };

  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await untilTime(page, 0.7);
  let s = await gameState(page);
  const at = (name) => s.entities.find((e) => e.id === name);
  check('step: goes one cell and pushes what is in the way', s.time < 5 && at('pusher').x === 200 && at('crate').x === 300, `${at('pusher').x},${at('crate').x}`);
  check('step: what is pushed against a blocker stays, and so does the pusher', at('crate').x === 300 && at('rock').x === 400);
  const lit = s.entities.filter((e) => e.tags.includes('lamp') && e.values.on === 1);
  check('a group narrowed to one at random: exactly one is changed', lit.length === 1, `lit ${lit.length}`);
  check('condition on an object\'s own value, and its value as an amount', lit.length === 1 && s.variables.picked === lit[0].values.power, `picked ${s.variables.picked}`);
  const places = s.entities.filter((e) => e.tags.includes('deck')).map((e) => `${e.x},${e.y}`).sort();
  check('shuffle: the same places, each taken once', places.join(' ') === deckPlaces.map(([x, y]) => `${x},${y}`).sort().join(' '), places.join(' '));
  check('text: shows the object\'s own value next to a game variable', at('counter').text === 'N=7 T=1', at('counter').text);

  // Noughts and crosses: X takes the top row while O plays below it.
  for (const cell of [0, 3, 1, 4, 2]) {
    await page.evaluate((x, y) => window.__game.tap(x, y), 150 + (cell % 3) * 100, 150 + Math.floor(cell / 3) * 100);
    await untilTime(page, (await gameState(page)).time + 0.08);
  }
  s = await gameState(page);
  check('values: a touch marks only an empty cell, in turn', [0, 1, 2].every((i) => at(`c${i}`).values.mark === 1) && [3, 4].every((i) => at(`c${i}`).values.mark === 2) && at('c8').values.mark === 0, JSON.stringify(s.entities.filter((e) => e.tags.includes('cell')).map((e) => e.values.mark)));
  check('picture by value: each cell shows the picture its value names', at('c0').frame === 1 && at('c3').frame === 2 && at('c8').frame === 0, `${at('c0').frame},${at('c3').frame},${at('c8').frame}`);
  check('line: three alike in a row are found, once for each of them', s.variables.inLine === 3, `inLine ${s.variables.inLine}`);
  check('value trigger: fires for each object as its value comes to pass the test', s.variables.noughts === 2, `noughts ${s.variables.noughts}`);
  check('lab 7: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 10. Lab 8: a board of pieces — swapping, clearing lines, settling, and where things are ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const after = (rid, seconds, then) => ({ id: rid, when: { type: 'after', seconds }, condition: null, then });
  const add = (name) => ({ type: 'setVariable', name, op: 'add', amount: 1 });
  const byId = (id) => ({ by: 'id', id });
  const kinds = [[1, 2, 1], [2, 1, 3], [3, 3, 1]];
  const gems = kinds.flatMap((row, r) => row.map((kind, c) => box(`g${r}${c}`, 110 + c * 100, 110 + r * 100, 80, 80, { tags: ['gem'], values: { kind } })));
  const mark = (tag, spot, name) => ({ type: 'setValue', target: { by: 'tag', tag, spot }, name, op: 'set', amount: 1 });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab8', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labeight', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {},
    variables: ['slant', 'straight'].map((name) => ({ name, initial: 0, saved: false })),
    startScene: 'eight',
    scenes: [{
      id: 'eight', name: 'eight', width: 720, height: 1280, background: null, music: null, gravity: 0, cell: 100,
      objects: [
        ...gems,
        box('stays', 500, 600, 80, 80, { tags: ['pair'] }),
        box('goes', 600, 600, 80, 80, { tags: ['pair'] }),
        box('padA', 100, 800, 100, 100, { tags: ['pad'] }),
        box('crateA', 110, 810, 80, 80, { tags: ['crate'] }),
        box('crateB', 310, 810, 80, 80, { tags: ['crate'] }),
        ...[0, 1, 2, 3].map((i) => box(`slot${i}`, 100 + i * 100, 1000, 100, 100, { tags: ['slot'] })),
        box('t1', 110, 1010, 80, 80, { tags: ['tile'], values: { level: 0 } }),
        box('t2', 210, 1010, 80, 80, { tags: ['tile'], values: { level: 0 } }),
        box('t3', 410, 1010, 80, 80, { tags: ['tile'], values: { level: 1 } }),
      ],
      prefabs: [box('fresh', 0, 0, 80, 80, { tags: ['gem'], values: { kind: 0 } }), box('newtile', 0, 0, 80, 80, { tags: ['tile'], values: { level: 0 } })],
      rules: [
        { id: 'r-slant', when: { type: 'line', target: { by: 'tag', tag: 'gem' }, name: 'kind', length: 3, diagonal: true }, condition: null, then: [add('slant')] },
        { id: 'r-straight', when: { type: 'line', target: { by: 'tag', tag: 'gem' }, name: 'kind', length: 3, diagonal: false }, condition: null, then: [{ type: 'destroy', target: 'first' }, add('straight')] },
        after('r-far', 0.2, [{ type: 'swap', target: byId('g00'), other: byId('g22'), near: true }, { type: 'step', target: byId('goes'), direction: 'down', blockTag: '', pushTag: '' }]),
        after('r-idle', 0.3, [{ type: 'swap', target: byId('g00'), other: byId('g01'), near: true, match: 3, matchBy: 'kind' }]),
        after('r-near', 0.4, [{ type: 'swap', target: byId('g12'), other: byId('g22'), near: true, match: 3, matchBy: 'kind' }]),
        after('r-spots', 0.6, [mark('pair', { is: 'home' }, 'home'), mark('pair', { is: 'away' }, 'away'), mark('crate', { is: 'on', tag: 'pad' }, 'on'), mark('crate', { is: 'off', tag: 'pad' }, 'off')]),
        after('r-slide', 1.0, [{ type: 'slideAll', target: { by: 'tag', tag: 'tile' }, direction: 'right', boardTag: 'slot', mergeBy: 'level', prefab: 'newtile' }]),
        after('r-settle', 0.8, [{ type: 'settle', target: { by: 'tag', tag: 'gem' }, prefabs: ['fresh'] }]),
      ],
    }],
  };

  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await page.evaluate(() => {
    window.__watch = setInterval(() => {
      const s = window.__game.getState();
      const at = (id) => s.entities.find((e) => e.id === id);
      if (s.time >= 0.34 && !window.__idle) window.__idle = [at('g00').x, at('g01').x];
      if (s.time >= 0.3 && !window.__far) window.__far = { g00: [at('g00').x, at('g00').y], goes: at('goes').y, slant: s.variables.slant };
      if (s.time >= 0.7 && !window.__mid) window.__mid = { gems: s.entities.filter((e) => e.tags.includes('gem')).length, straight: s.variables.straight };
    }, 4);
  });
  await untilTime(page, 1.4);
  const s = await gameState(page);
  const at = (name) => s.entities.find((e) => e.id === name);
  const far = await page.evaluate(() => window.__far);
  const mid = await page.evaluate(() => window.__mid);
  check('line: three alike on a slant are found when slants count', far.slant === 3, `slant ${far.slant}`);
  check('swap, side by side only: two that are far apart stay where they are', far.g00[0] === 110 && far.g00[1] === 110);
  check('step: the move counts at once, while the picture slides', far.goes === 700, `y ${far.goes}`);
  const idle = await page.evaluate(() => window.__idle);
  check('swap that must make a line: neighbours that would not line up stay put', idle && idle[0] === 110 && idle[1] === 210, JSON.stringify(idle));
  check('swap: two neighbours change places, and the line that makes is cleared', mid.straight === 3 && mid.gems === 6, JSON.stringify(mid));
  check('where things are: at home or away from it', at('stays').values.home === 1 && at('stays').values.away === undefined && at('goes').values.away === 1 && at('goes').values.home === undefined, JSON.stringify([at('stays').values, at('goes').values]));
  check('where things are: on a group or off it', at('crateA').values.on === 1 && at('crateA').values.off === undefined && at('crateB').values.off === 1 && at('crateB').values.on === undefined);
  const board = s.entities.filter((e) => e.tags.includes('gem'));
  const cellsTaken = new Set(board.map((e) => `${Math.round((e.x - 110) / 100)},${Math.round((e.y - 110) / 100)}`));
  check('settle: the pieces drop, new ones fill the top, and every cell is taken once', board.length === 9 && cellsTaken.size === 9 && at('g00').y === 210 && at('g10').y === 310 && board.filter((e) => e.id === 'fresh').every((e) => e.y === 110) && board.filter((e) => e.id === 'fresh').length === 3, `${board.length} pieces, ${cellsTaken.size} cells, g00 at ${at('g00').y}`);
  const tiles = s.entities.filter((e) => e.tags.includes('tile'));
  check('slide all: pieces run to the far side, two alike become one a step higher, and a new one appears',
    tiles.length === 3 && !at('t1') && at('t3').x === 410 && at('t3').values.level === 1 && at('t2').x === 310 && at('t2').values.level === 1 && [110, 210].includes(at('newtile')?.x),
    JSON.stringify(tiles.map((e) => [e.id, e.x, e.values.level])));
  check('lab 8: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 11. Lab 9: rules that change looks, music and the camera, and sums ─────
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const byId = (id) => ({ by: 'id', id });
  const after = (rid, seconds, then) => ({ id: rid, when: { type: 'after', seconds }, condition: null, then });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab9', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labnine', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: true,
    assets: { red: { type: 'image', src: solidPng(255, 0, 0) }, blue: { type: 'image', src: solidPng(0, 0, 255) }, tune: { type: 'sound', src: silentWav(), name: 'tune.wav' } },
    variables: [{ name: 'n', initial: 5, saved: false }, { name: 'm', initial: 10, saved: false }, { name: 'k', initial: 3, saved: false }],
    startScene: 'nine',
    scenes: [{
      id: 'nine', name: 'nine', width: 720, height: 1280, background: null, music: null, gravity: 0,
      objects: [
        box('paint', 50, 50, 100, 100),
        { ...box('pic', 200, 50, 100, 100), visual: { kind: 'image', asset: 'red' } },
        { ...box('label', 360, 300, 0, 0), visual: { kind: 'text', text: 'start', color: '#ffffff', size: 40 } },
        box('grow', 100, 600, 100, 100),
        box('spin', 400, 600, 100, 50),
        box('ghost', 550, 600, 100, 100),
        box('hit', 100, 900, 100, 100),
        box('under', 400, 900, 100, 100),
      ],
      prefabs: [],
      rules: [
        after('r-looks', 0.2, [
          { type: 'setColor', target: byId('paint'), color: '#00ff00' },
          { type: 'setImage', target: byId('pic'), asset: 'blue' },
          { type: 'setVariable', name: 'n', op: 'multiply', amount: 13 },
          { type: 'setVariable', name: 'm', op: 'divide', amount: 4 },
          { type: 'setVariable', name: 'k', op: 'divide', amount: 0 },
          { type: 'setText', target: byId('label'), text: 'T {n:time} {m:int}' },
          { type: 'resize', target: byId('grow'), width: 200, height: 50 },
          { type: 'turn', target: byId('spin'), op: 'add', degrees: 90 },
          { type: 'setOpacity', target: byId('ghost'), opacity: 0.3 },
          { type: 'flash', target: byId('hit'), color: '#ffffff', seconds: 0.3 },
          { type: 'layer', target: byId('paint'), to: 'front' },
          { type: 'layer', target: byId('under'), to: 'back' },
          { type: 'playMusic', music: 'tune' },
          { type: 'zoom', amount: 2, seconds: 0 },
        ]),
        after('r-quiet', 1.0, [{ type: 'playMusic', music: '' }, { type: 'zoom', amount: 1, seconds: 0.2 }]),
      ],
    }],
  };
  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await page.evaluate(() => {
    window.__seen = null;
    window.__watch = setInterval(() => {
      const st = window.__game.getState();
      if (st.time >= 0.3 && !window.__seen) window.__seen = st;
    }, 4);
  });
  await untilTime(page, 1.5);
  const seen = await page.evaluate(() => window.__seen);
  const at = (name) => seen.entities.find((e) => e.id === name);
  check('colour and picture: a rule repaints a shape and swaps a picture', at('paint').color === '#00ff00' && at('pic').image === 'blue');
  check('sums: multiply, divide, and dividing by zero changes nothing', seen.variables.n === 65 && seen.variables.m === 2.5 && seen.variables.k === 3, JSON.stringify(seen.variables));
  check('text: a rule rewrites it, and shows time as a clock and a whole number', at('label').text === 'T 1:05 2', at('label').text);
  check('resize: the new size, around the same middle', at('grow').width === 200 && at('grow').height === 50 && at('grow').x === 50 && at('grow').y === 625, JSON.stringify(at('grow')));
  check('turn and opacity', Math.abs(at('spin').angle - Math.PI / 2) < 1e-6 && Math.abs(at('ghost').opacity - 0.3) < 1e-6);
  check('flash: the object glows for a moment', at('hit').flashing === true);
  check('layer: to the front, and to the back', seen.entities.at(-1).id === 'paint' && seen.entities[0].id === 'under', seen.entities.map((e) => e.id).join(','));
  check('music: a rule starts a piece in place of the scene\'s', seen.music === 'tune');
  check('zoom: the camera comes closer', seen.playZoom === 2);
  const later = await gameState(page);
  check('flash: and fades back', later.entities.find((e) => e.id === 'hit').flashing === false);
  check('music can be stopped, and the zoom eased back', later.music === null && Math.abs(later.playZoom - 1) < 1e-6, `${later.music} ${later.playZoom}`);
  check('lab 9: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 12. Lab 10: enemies that notice, keep their own time, flee and find their way ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const set = (name, amount = 1) => ({ type: 'setVariable', name, op: 'set', amount });
  const free = { type: 'body', gravity: false, solidTag: 'wall', bounce: 0, edges: 'stop', oneWay: false };
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab10', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labten', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {},
    variables: ['seen', 'gone'].map((name) => ({ name, initial: 0, saved: false })),
    startScene: 'ten',
    scenes: [{
      id: 'ten', name: 'ten', width: 720, height: 1280, background: null, music: null, gravity: 0, cell: 40,
      objects: [
        // A wall across the top part of the world with a gap at its right end.
        box('wall', 0, 240, 600, 40, { tags: ['wall'] }),
        box('smart', 40, 120, 30, 30, { behaviors: [free, { type: 'chase', targetTag: 'goal', speed: 400, axis: 'both', avoidTag: 'wall' }] }),
        box('dumb', 120, 120, 30, 30, { behaviors: [free, { type: 'chase', targetTag: 'goal', speed: 400, axis: 'both' }] }),
        // Two that must see the target: one with the wall between them, one with a clear view.
        box('guard', 400, 120, 30, 30, { behaviors: [free, { type: 'chase', targetTag: 'goal', speed: 400, axis: 'both', avoidTag: 'wall', sight: true }] }),
        box('seer', 650, 405, 30, 30, { behaviors: [free, { type: 'chase', targetTag: 'goal', speed: 150, axis: 'both', avoidTag: 'wall', sight: true }] }),
        box('target', 45, 405, 30, 30, { tags: ['goal'] }),
        box('scout', 100, 600, 40, 40, { tags: ['scout'] }),
        box('runner', 600, 600, 40, 40, { tags: ['runner'], behaviors: [{ type: 'mover', vx: -400, vy: 0, speedVariable: '', atEdge: 'nothing' }] }),
        box('lazy', 600, 900, 40, 40, { behaviors: [{ type: 'chase', targetTag: 'goal', speed: 300, axis: 'both', range: 100 }] }),
        box('cat', 300, 1100, 40, 40, { tags: ['cat'] }),
        box('mouse', 400, 1100, 40, 40, { behaviors: [{ type: 'chase', targetTag: 'cat', speed: 100, axis: 'both', away: true }] }),
        box('t1', 600, 20, 20, 20, { tags: ['tick'] }),
        box('t2', 650, 20, 20, 20, { tags: ['tick'] }),
      ],
      prefabs: [box('late', 0, 0, 20, 20, { tags: ['tick'] })],
      rules: [
        { id: 'r-near', when: { type: 'near', a: { by: 'tag', tag: 'runner' }, b: { by: 'tag', tag: 'scout' }, distance: 200 }, condition: null, then: [set('seen')] },
        { id: 'r-far', when: { type: 'near', a: { by: 'tag', tag: 'runner' }, b: { by: 'tag', tag: 'scout' }, distance: 200, leave: true }, condition: null, then: [set('gone')] },
        { id: 'r-each', when: { type: 'eachEvery', target: { by: 'tag', tag: 'tick' }, seconds: 0.5 }, condition: null, then: [{ type: 'setValue', target: 'first', name: 'n', op: 'add', amount: 1 }] },
        { id: 'r-late', when: { type: 'after', seconds: 0.25 }, condition: null, then: [{ type: 'spawn', prefab: 'late', at: { by: 'id', id: 't1' } }] },
      ],
    }],
  };
  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await page.evaluate(() => {
    window.__ticks = null;
    window.__watch = setInterval(() => {
      const st = window.__game.getState();
      // Between the second tick of the first objects (t = 1.0) and the third of the late one (t = 1.75).
      if (st.time >= 1.3 && !window.__ticks) window.__ticks = st.entities.filter((e) => e.tags.includes('tick')).map((e) => [e.id, e.values.n ?? 0]);
    }, 4);
  });
  await untilTime(page, 0.6);
  let s = await gameState(page);
  const mouseStart = 400;
  check('flee: it runs away from what it would chase', s.entities.find((e) => e.id === 'mouse').x > mouseStart + 20);
  check('range: a chaser does not notice a target farther off', s.entities.find((e) => e.id === 'lazy').x === 600);
  await untilTime(page, 2.5);
  s = await gameState(page);
  check('near: fires as one comes within the distance, and again (leaving) once it is past', s.variables.seen === 1 && s.variables.gone === 1, JSON.stringify(s.variables));
  const ticks = await page.evaluate(() => window.__ticks);
  check('each on its own clock: two ticks each, the late one counted from when it appeared', ticks.length === 3 && ticks.every(([, n]) => n === 2), JSON.stringify(ticks));
  const reached = await until(page, () => {
    const st = window.__game.getState();
    const [a, b] = ['smart', 'target'].map((id) => st.entities.find((e) => e.id === id));
    return Math.hypot(a.x - b.x, a.y - b.y) < 20;
  }, null, 30000);
  s = await gameState(page);
  check('finding the way: a chaser goes around the wall, through the gap, to its target', reached, JSON.stringify(s.entities.find((e) => e.id === 'smart')));
  check('without it, a chaser stays stuck behind the wall', s.entities.find((e) => e.id === 'dumb').y + 30 <= 240);
  {
    const [guard, seer] = ['guard', 'seer'].map((id) => s.entities.find((e) => e.id === id));
    check('sight: a chaser that must see does not notice a target behind a wall', Math.hypot(guard.x - 400, guard.y - 120) < 2, `${guard.x.toFixed(0)},${guard.y.toFixed(0)}`);
    check('sight: with a clear view it comes after the target', seer.x < 500, `${seer.x.toFixed(0)},${seer.y.toFixed(0)}`);
  }
  check('lab 10: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 13. Lab 11: a painted level with a ramp and coins; pushing, friction and rolling ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const cols = 18;
  const row = (fill) => fill.padEnd(cols, '.');
  const rows = Array.from({ length: 32 }, () => row(''));
  rows[30] = 'a'.repeat(cols);
  rows[29] = '........r' + 'a'.repeat(cols - 9);
  rows[27] = '............cc';
  const body = (extra = {}) => ({ type: 'body', gravity: true, solidTag: 'ground', bounce: 0, edges: 'none', oneWay: false, ...extra });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab11', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labeleven', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {},
    variables: [{ name: 'coins', initial: 0, saved: false }, { name: 'bumped', initial: 0, saved: false }],
    startScene: 'level',
    scenes: [{
      id: 'level', name: 'level', width: 720, height: 1280, background: null, music: null, gravity: 2000,
      objects: [
        { ...box('map', 0, 0, cols * 40, 32 * 40), visual: { kind: 'tiles', cell: 40, rows, kinds: {
          a: { name: 'ground', color: '#6d4c41', tags: ['ground'] },
          r: { name: 'ramp', color: '#8d6e63', tags: ['ground'], slope: 'rise' },
          c: { name: 'coin', color: '#ffd54a', tags: ['coin'], separate: true },
        } } },
        box('hero', 80, 1000, 40, 60, { tags: ['hero'], behaviors: [body(), { type: 'walker', speed: 200, control: 'auto', leftTag: '', rightTag: '' }] }),
      ],
      prefabs: [],
      rules: [{ id: 'r-coin', when: { type: 'touch', a: { by: 'tag', tag: 'hero' }, b: { by: 'tag', tag: 'coin' } }, condition: null, then: [{ type: 'destroy', target: 'second' }, { type: 'setVariable', name: 'coins', op: 'add', amount: 1 }] }],
    }, {
      id: 'push', name: 'push', width: 720, height: 1280, background: null, music: null, gravity: 2000,
      objects: [
        box('floor', 0, 1000, 720, 40, { tags: ['wall'] }),
        box('stop', 600, 700, 40, 300, { tags: ['wall'] }),
        box('pusher', 100, 940, 60, 60, { behaviors: [body({ solidTag: 'wall' }), { type: 'walker', speed: 300, control: 'auto', leftTag: '', rightTag: '' }] }),
        box('crate', 300, 920, 80, 80, { tags: ['wall'], behaviors: [body({ solidTag: 'wall', pushable: true })] }),
        box('puck', 50, 300, 40, 40, { behaviors: [{ type: 'body', gravity: false, solidTag: '', bounce: 0, edges: 'stop', oneWay: false, friction: 0.5 }, { type: 'launch', vx: 600, vy: 0 }] }),
        box('ball', 50, 500, 40, 40, { round: true, behaviors: [{ type: 'body', gravity: false, solidTag: '', bounce: 0, edges: 'stop', oneWay: false, roll: true }, { type: 'launch', vx: 200, vy: 0 }] }),
        // Two that bump into each other, and two that pass through each other.
        ...[['m1', 100, 300], ['m2', 400, -300]].map(([id, x, vx]) => box(id, x, 100, 50, 50, { tags: ['mob'], hitboxInset: 5, behaviors: [{ type: 'body', gravity: false, solidTag: 'wall', bounce: 0, edges: 'stop', oneWay: false, bumpTag: 'mob' }, { type: 'mover', vx, vy: 0, speedVariable: '', atEdge: 'nothing' }] })),
        ...[['g1', 100, 300], ['g2', 400, -300]].map(([id, x, vx]) => box(id, x, 180, 50, 50, { tags: ['ghost'], behaviors: [{ type: 'body', gravity: false, solidTag: '', bounce: 0, edges: 'stop', oneWay: false }, { type: 'launch', vx, vy: 0 }] })),
      ],
      prefabs: [],
      rules: [{ id: 'r-bump', when: { type: 'touch', a: { by: 'tag', tag: 'mob' }, b: { by: 'tag', tag: 'mob' } }, condition: null, then: [{ type: 'setVariable', name: 'bumped', op: 'set', amount: 1 }] }],
    }],
  };
  let { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await untilTime(page, 0.3);
  let s = await gameState(page);
  const blocks = s.entities.filter((e) => e.id === 'map');
  check('tile map: cells side by side become one block, ramps and coins stay separate', blocks.length === 5 && blocks.some((e) => e.width === 720 && e.y === 1200) && blocks.filter((e) => e.tags.includes('coin')).length === 2, JSON.stringify(blocks.map((e) => [e.x, e.y, e.width, e.tags.join('+')])));
  const climbed = await until(page, () => {
    const hero = window.__game.getState().entities.find((e) => e.id === 'hero');
    return hero.x > 500 && Math.abs(hero.y + hero.height - 1160) < 1 && hero.grounded;
  }, null, 20000);
  s = await gameState(page);
  const hero = s.entities.find((e) => e.id === 'hero');
  check('ramp: a walker goes up the slope onto the higher ground instead of being stopped', climbed, `${hero.x},${hero.y + hero.height} grounded ${hero.grounded}`);
  check('tile cells as objects: each coin cell is taken on its own', s.variables.coins === 2 && !s.entities.some((e) => e.tags.includes('coin')) && s.entities.filter((e) => e.id === 'map').length === 3, `coins ${s.variables.coins}`);
  check('lab 11: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();

  ({ page, errors } = await openPage(browser, `${url}`, { project: { ...project, startScene: 'push' } }));
  await loaded(page);
  await untilTime(page, 1.0);
  s = await gameState(page);
  const puck = s.entities.find((e) => e.id === 'puck');
  check('friction: something slid across the floor slows to a stop', Math.abs(puck.vx) < 1 && puck.x < 300, `x ${puck.x.toFixed(0)}, vx ${puck.vx.toFixed(1)}`);
  check('roll: a ball turns as it goes', Math.abs(s.entities.find((e) => e.id === 'ball').angle) > 1);
  const pushed = await until(page, () => {
    const st = window.__game.getState();
    const crate = st.entities.find((e) => e.id === 'crate');
    return Math.abs(crate.x + crate.width - 600) < 1;
  }, null, 20000);
  s = await gameState(page);
  const crate = s.entities.find((e) => e.id === 'crate');
  const pusher = s.entities.find((e) => e.id === 'pusher');
  check('push: a crate goes ahead of whatever walks into it, until a wall stops it', pushed && Math.abs(pusher.x + pusher.width - crate.x) < 1, `crate ${crate.x}, pusher ${pusher.x}`);
  {
    const [m1, m2] = ['m1', 'm2'].map((id) => s.entities.find((e) => e.id === id));
    const [g1, g2] = ['g1', 'g2'].map((id) => s.entities.find((e) => e.id === id));
    // Pressed together by their movers, the collision boxes (inset by 5) meet face to face: 40 apart, never inside each other.
    check('bump: two that bump into each other meet face to face instead of passing through', Math.abs(m2.x - m1.x - 40) < 1.5 && m1.y === 100 && m2.y === 100, `m1 ${m1.x.toFixed(1)}, m2 ${m2.x.toFixed(1)}`);
    check('bump: meeting still counts as touching for rules', s.variables.bumped === 1, `bumped ${s.variables.bumped}`);
    check('bump: without it they pass through each other', g1.x > g2.x, `g1 ${g1.x.toFixed(0)}, g2 ${g2.x.toFixed(0)}`);
  }
  check('lab 11 (push): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 13b. Lab 12: real physics: stacking, turned slopes, ropes, crashes, blasts, motors, slings ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const physics = (extra = {}) => ({ type: 'physics', kind: 'moving', solidTag: 'ground', bounce: 0, friction: 0.6, weight: 1, rotates: true, gravity: true, slowdown: 0, edges: true, drag: 'none', power: 6, ...extra });
  const scene = (id, objects, rules = [], width = 720) => ({ id, name: id, width, height: 1280, background: null, music: null, gravity: 2000, objects, prefabs: [], rules });
  const floor = (width = 720) => box('floor', 0, 1100, width, 60, { tags: ['ground'] });
  const add = (name) => [{ type: 'setVariable', name, op: 'add', amount: 1 }];
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab12', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labtwelve', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {},
    variables: ['hits', 'softHits', 'lands', 'blasted'].map((name) => ({ name, initial: 0, saved: false })),
    startScene: 'stack',
    scenes: [
      scene('stack', [
        floor(),
        ...[0, 1, 2, 3, 4].map((i) => box(`c${i}`, 300, 1100 - 80 * (i + 1), 80, 80, { tags: ['crate'], behaviors: [physics()] })),
        // A slab turned 20° clockwise: its right end is lower, so a ball dropped on it rolls right.
        box('slab', 20, 420, 300, 30, { rotation: 20, behaviors: [physics({ kind: 'still' })] }),
        box('ball', 60, 250, 40, 40, { round: true, behaviors: [physics({ solidTag: '', friction: 0.8 })] }),
        box('pin', 540, 140, 20, 20, { tags: ['pin'], behaviors: [physics({ kind: 'still' })] }),
        box('bob', 640, 240, 40, 40, { round: true, behaviors: [physics({ solidTag: '' }), { type: 'joint', kind: 'rope', targetTag: 'pin', at: 'self', motor: 0 }] }),
        box('drop', 470, 500, 50, 50, { tags: ['drop'], behaviors: [physics({ rotates: false })] }),
        box('jumpy', 620, 1040, 60, 60, { tags: ['jumpy'], behaviors: [physics({ rotates: false }), { type: 'jumper', jumpSpeed: 900, maxJumps: 1, on: 'none', buttonTag: '' }] }),
      ], [
        { id: 'r-hit', when: { type: 'hit', a: { by: 'tag', tag: 'drop' }, b: { by: 'tag', tag: 'ground' }, speed: 800 }, condition: null, then: add('hits') },
        { id: 'r-soft', when: { type: 'hit', a: { by: 'tag', tag: 'crate' }, b: { by: 'tag', tag: 'ground' }, speed: 800 }, condition: null, then: add('softHits') },
        { id: 'r-land', when: { type: 'land', target: { by: 'tag', tag: 'drop' } }, condition: null, then: add('lands') },
        { id: 'r-jump', when: { type: 'after', seconds: 2.5 }, condition: null, then: [{ type: 'jump', target: { by: 'id', id: 'jumpy' } }] },
      ]),
      scene('blast', [
        floor(),
        ...[0, 1, 2, 3].map((i) => box(`b${i}`, 200 + i * 90, 1020, 80, 80, { tags: ['crate'], behaviors: [physics()] })),
        box('bomb', 340, 1060, 20, 20, { visible: false }),
      ], [{ id: 'r-boom', when: { type: 'after', seconds: 1 }, condition: null, then: [{ type: 'blast', at: { by: 'id', id: 'bomb' }, strength: 2500, radius: 400 }, ...add('blasted')] }]),
      scene('car', [
        floor(3000),
        box('car', 300, 950, 220, 70, { tags: ['car'], behaviors: [physics({ friction: 0.4 })] }),
        ...[-70, 70].map((dx, i) => box(`w${i}`, 410 + dx - 35, 985 - 35 + 35, 70, 70, { visual: { kind: 'ellipse', color: '#263238' }, round: true, behaviors: [physics({ friction: 1 }), { type: 'joint', kind: 'hinge', targetTag: 'car', at: 'self', motor: 360 }] })),
      ], [], 3000),
      scene('matter', [
        floor(),
        // Two blocks slid along the floor: ice keeps going, stone stops soon.
        box('ice', 20, 1040, 60, 60, { behaviors: [physics({ material: 'ice', rotates: false }), { type: 'launch', vx: 700, vy: 0 }] }),
        // The stone one slides on a shelf of its own, out of the ice block's way.
        box('shelf', 0, 700, 380, 20, { tags: ['ground'] }),
        box('stone', 20, 640, 60, 60, { behaviors: [physics({ material: 'stone', rotates: false }), { type: 'launch', vx: 700, vy: 0 }] }),
        // Two balls dropped from the same height: rubber bounces high, stone hardly at all.
        box('rubber', 420, 300, 50, 50, { round: true, behaviors: [physics({ material: 'rubber' })] }),
        box('rock', 520, 300, 50, 50, { round: true, behaviors: [physics({ material: 'stone' })] }),
        // A glass pane on two posts, and a heavy weight dropped onto it.
        box('postA', 600, 1000, 20, 100, { tags: ['ground'] }),
        box('postB', 690, 1000, 20, 100, { tags: ['ground'] }),
        box('pane', 600, 980, 110, 20, { tags: ['glass'], behaviors: [physics({ material: 'glass', breaks: 300 })] }),
        box('weight', 625, 600, 60, 60, { behaviors: [physics({ material: 'metal' })] }),
        // A ghost that passes through crates and lands on the floor under one.
        box('crate', 300, 620, 80, 80, { tags: ['crate'], behaviors: [physics()] }),
        box('ghost', 310, 300, 60, 60, { behaviors: [physics({ passTag: 'crate', rotates: false })] }),
      ], [{ id: 'r-slow', when: { type: 'after', seconds: 0.3 }, condition: null, then: [{ type: 'slowMotion', amount: 0, seconds: 1.5 }] }]),
      scene('sling', [
        floor(),
        box('post', 140, 900, 40, 200, { tags: ['ground'] }),
        // Without reloading: it rests on its post and is pulled from wherever it stops.
        box('stone', 130, 840, 60, 60, { round: true, tags: ['stone'], behaviors: [physics({ drag: 'sling', power: 6, weight: 2, reload: false })] }),
      ]),
    ],
  };
  const open = async (startScene) => {
    const opened = await openPage(browser, url, { project: { ...project, startScene } });
    await loaded(opened.page);
    return opened;
  };

  let { page, errors } = await open('stack');
  await untilTime(page, 2.2);
  let s = await gameState(page);
  const crates = [0, 1, 2, 3, 4].map((i) => s.entities.find((e) => e.id === `c${i}`));
  check('physics: five crates stacked on the ground stay standing', crates.every((c, i) => Math.abs(c.x - 300) < 4 && Math.abs(c.y - (1100 - 80 * (i + 1))) < 4 && Math.abs(c.angle) < 0.03), crates.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)},${c.angle.toFixed(3)}`).join(' '));
  const ball = s.entities.find((e) => e.id === 'ball');
  check('physics: a ball dropped on a turned slab rolls down its slope', ball.x > 160 && ball.angle > 1, `x ${ball.x.toFixed(0)}, turned ${ball.angle.toFixed(2)}`);
  const bob = s.entities.find((e) => e.id === 'bob');
  const ropeLength = Math.hypot(660 - 550, 260 - 150);
  const reach = Math.hypot(bob.x + 20 - 550, bob.y + 20 - 150);
  check('physics: a weight on a rope swings below its pin and never goes further than the rope', reach <= ropeLength + 3 && bob.y > 200, `reach ${reach.toFixed(1)} of ${ropeLength.toFixed(1)}`);
  const drop = s.entities.find((e) => e.id === 'drop');
  check('physics: something dropped comes to rest on the ground, upright', Math.abs(drop.y + 50 - 1100) < 3 && drop.angle === 0 && drop.grounded, `bottom ${(drop.y + 50).toFixed(1)}`);
  check('hit: a hard landing fires once; things that only rest there do not', s.variables.hits === 1 && s.variables.softHits === 0, `hits ${s.variables.hits}, resting ${s.variables.softHits}`);
  check('land: a body with real physics coming down counts as landing', s.variables.lands >= 1, `lands ${s.variables.lands}`);
  const jumped = await until(page, () => window.__game.getState().entities.find((e) => e.id === 'jumpy').y < 1040 - 80, null, 10000);
  const back = await until(page, () => {
    const j = window.__game.getState().entities.find((e) => e.id === 'jumpy');
    return j.grounded && Math.abs(j.y + 60 - 1100) < 3;
  }, null, 10000);
  check('a jumper with real physics jumps and comes back down onto the ground', jumped && back);
  check('lab 12 (stack): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: resolve(shots, '12-physics-stack.png') });
  await page.close();

  ({ page, errors } = await open('blast'));
  await untilTime(page, 0.8);
  const before = (await gameState(page)).entities.filter((e) => e.tags.includes('crate'));
  await until(page, () => window.__game.getState().variables.blasted === 1, null, 10000);
  await untilTime(page, 1.25);
  s = await gameState(page);
  const after = s.entities.filter((e) => e.tags.includes('crate'));
  const thrown = after.filter((c, i) => Math.hypot(c.x - before[i].x, c.y - before[i].y) > 60 || Math.hypot(c.vx, c.vy) > 300);
  check('blast: crates near the blast are thrown away from it', thrown.length >= 3 && after[0].x < before[0].x && after[3].x > before[3].x, after.map((c) => `${c.x.toFixed(0)},${c.y.toFixed(0)}`).join(' '));
  check('lab 12 (blast): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();

  ({ page, errors } = await open('car'));
  await untilTime(page, 0.5);
  const start = (await entity(page, 'car')).x;
  await untilTime(page, 2.5);
  s = await gameState(page);
  const car = s.entities.find((e) => e.id === 'car');
  const wheels = s.entities.filter((e) => e.id.startsWith('w'));
  check('joint: wheels on hinges with motors drive a car along the ground', car.x - start > 200 && wheels.every((w) => Math.abs(w.x + 35 - (car.x + 110)) < 90), `travelled ${(car.x - start).toFixed(0)}`);
  check('lab 12 (car): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();

  ({ page, errors } = await open('matter'));
  await untilTime(page, 0.3);
  {
    // Frozen by "slow motion" at 0: the game's clock does not move for a while.
    const frozenAt = (await gameState(page)).time;
    await sleep(400);
    const later = (await gameState(page)).time;
    check('slow motion at 0 holds the game still for a moment (a hit stop)', later - frozenAt < 0.02, `${frozenAt.toFixed(3)} → ${later.toFixed(3)}`);
  }
  // The highest each ball gets after it has first come down to the floor.
  const peak = { rubber: 9999, rock: 9999 };
  const down = { rubber: false, rock: false };
  // The most pieces of the pane seen at once (they fade out after a few seconds).
  let pieces = 0;
  for (let i = 0; i < 400; i++) {
    const st = await gameState(page);
    pieces = Math.max(pieces, st.entities.filter((e) => e.id.startsWith('pane~')).length);
    for (const id of ['rubber', 'rock']) {
      const b = st.entities.find((e) => e.id === id);
      if (b.y + 50 > 1070) down[id] = true;
      else if (down[id]) peak[id] = Math.min(peak[id], b.y);
    }
    if (st.time > 3.2) break;
    await sleep(25);
  }
  const bounced = down.rubber;
  s = await gameState(page);
  const [ice, stone] = ['ice', 'stone'].map((id) => s.entities.find((e) => e.id === id));
  check('material: ice slides much further than stone given the same push', ice.x > stone.x + 150, `ice ${ice.x.toFixed(0)}, stone ${stone.x.toFixed(0)}`);
  check('material: a rubber ball bounces high, a stone one hardly', bounced && peak.rubber < 900 && (peak.rock === 9999 || peak.rubber < peak.rock - 150), `rubber up to ${peak.rubber.toFixed(0)}, stone up to ${peak.rock.toFixed(0)}`);
  // A long pane breaks into three by two.
  check('breaks: a glass pane hit hard shatters into pieces that fly apart', !s.entities.some((e) => e.id === 'pane') && pieces === 6 && !s.entities.some((e) => e.tags.includes('glass')), `${pieces} pieces`);
  const ghost = s.entities.find((e) => e.id === 'ghost');
  check('pass: something set to pass through crates falls through one onto the shelf under it', Math.abs(ghost.y + 60 - 700) < 3, `bottom ${(ghost.y + 60).toFixed(1)}`);
  check('lab 12 (matter): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: resolve(shots, '12-physics-matter.png') });
  await page.close();

  ({ page, errors } = await open('sling'));
  await untilTime(page, 0.6);
  await page.mouse.move(...(await toPage(page, 160, 870)));
  await page.mouse.down();
  await page.mouse.move(...(await toPage(page, 40, 930)), { steps: 8 });
  await until(page, () => window.__game.getState().entities.find((e) => e.id === 'stone').x < 60, null, 5000);
  const pulled = await entity(page, 'stone');
  check('sling: the stone follows the finger back while it is pulled', pulled.x < 60 && pulled.vy < 1, `x ${pulled.x.toFixed(0)}`);
  await page.mouse.up();
  await sleep(60);
  const flying = await entity(page, 'stone');
  check('sling: letting go throws it forward, the harder the further it was pulled', flying.vx > 500 && flying.vy < -100, `speed ${flying.vx.toFixed(0)}, ${flying.vy.toFixed(0)}`);
  const t = (await gameState(page)).time;
  await untilTime(page, t + 2);
  const landed = await entity(page, 'stone');
  check('physics edges: a thrown stone stays inside the world', landed.x >= -1 && landed.x + landed.width <= 721 && landed.x > 300, `x ${landed.x.toFixed(0)}`);
  check('lab 12 (sling): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: resolve(shots, '12-physics-sling.png') });
  await page.close();
}

// ── 13b2. Lab 15: more physics: conveyor, jump-through, water, wind, magnet, joint limits, sliders, cutting and snapping, spin, freezing, a reloading sling ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const physics = (extra = {}) => ({ type: 'physics', kind: 'moving', solidTag: 'ground', bounce: 0, friction: 0.6, weight: 1, rotates: true, gravity: true, slowdown: 0, edges: true, drag: 'none', power: 8, ...extra });
  const still = (extra = {}) => physics({ kind: 'still', ...extra });
  const joint = (kind, targetTag, extra = {}) => ({ type: 'joint', kind, targetTag, at: 'self', motor: 0, ...extra });
  const field = (kind, direction, strength) => ({ type: 'field', kind, direction, strength });
  const add = (name) => [{ type: 'setVariable', name, op: 'add', amount: 1 }];
  const id = (x) => ({ by: 'id', id: x });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab15', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labfifteen', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {},
    variables: ['snaps', 'throws', 'rests'].map((name) => ({ name, initial: 0, saved: false })),
    startScene: 'mech',
    scenes: [{
      id: 'mech', name: 'mech', width: 720, height: 1280, background: null, music: null, gravity: 2000,
      objects: [
        box('floor', 0, 1200, 720, 80, { tags: ['ground'] }),
        box('belt', 40, 300, 300, 20, { behaviors: [still({ surfaceSpeed: 200 })] }),
        box('cargo', 60, 250, 50, 50, { behaviors: [physics()] }),
        box('fan', 0, 450, 300, 200, { behaviors: [field('wind', 0, 3000)] }),
        box('blown', 20, 520, 40, 40, { round: true, behaviors: [physics({ gravity: false })] }),
        box('magnet', 40, 700, 220, 220, { round: true, behaviors: [field('magnet', 0, 3000)] }),
        box('iron', 90, 750, 30, 30, { round: true, behaviors: [physics({ gravity: false })] }),
        box('frozen', 300, 1000, 50, 50, { behaviors: [still()] }),
        box('shelf', 420, 380, 200, 20, { behaviors: [still({ oneWay: true })] }),
        box('up', 500, 600, 40, 40, { round: true, behaviors: [physics({ rotates: false })] }),
        box('pool', 400, 900, 320, 300, { behaviors: [field('water', 0, 1)] }),
        box('light', 450, 700, 60, 60, { behaviors: [physics({ weight: 0.4 })] }),
        box('heavy', 600, 700, 60, 60, { behaviors: [physics({ weight: 4 })] }),
        box('frame', 360, 100, 20, 20, { tags: ['frame'], behaviors: [still()] }),
        box('door', 370, 104, 120, 12, { behaviors: [physics({ solidTag: '' }), joint('hinge', 'frame', { at: 'other', limit: 30 })] }),
        box('rail', 660, 150, 20, 20, { tags: ['rail'], behaviors: [still()] }),
        box('lift', 630, 200, 80, 20, { behaviors: [physics({ rotates: false, solidTag: '' }), joint('slider', 'rail', { axis: 90, range: 120, motor: 250 })] }),
        box('hook', 200, 30, 20, 20, { tags: ['hook'], behaviors: [still()] }),
        box('hung', 190, 100, 40, 40, { round: true, tags: ['hung'], behaviors: [physics(), joint('rope', 'hook')] }),
        box('hook2', 100, 30, 20, 20, { tags: ['hook2'], behaviors: [still()] }),
        box('anvil', 90, 100, 40, 40, { round: true, tags: ['hung'], behaviors: [physics({ weight: 5 }), joint('rope', 'hook2', { strength: 0.5 })] }),
        box('spinner', 650, 600, 40, 40, { round: true, behaviors: [physics({ gravity: false })] }),
      ],
      prefabs: [],
      rules: [
        { id: 'r-start', when: { type: 'start' }, condition: null, then: [{ type: 'kick', target: id('up'), vx: 0, vy: -1400 }, { type: 'spin', target: id('spinner'), speed: 720 }] },
        { id: 'r-cut', when: { type: 'after', seconds: 0.5 }, condition: null, then: [{ type: 'cut', target: id('hung') }] },
        { id: 'r-free', when: { type: 'after', seconds: 1 }, condition: null, then: [{ type: 'setPhysics', target: id('frozen'), kind: 'moving' }] },
        { id: 'r-snap', when: { type: 'snap', target: { by: 'tag', tag: 'hung' } }, condition: null, then: add('snaps') },
      ],
    }, {
      id: 'sling', name: 'sling', width: 720, height: 1280, background: null, music: null, gravity: 2400,
      objects: [
        box('floor', 0, 1200, 720, 80, { tags: ['ground'] }),
        box('stone', 100, 770, 60, 60, { round: true, tags: ['stone'], behaviors: [physics({ drag: 'sling', reload: true, weight: 2 })] }),
      ],
      prefabs: [],
      rules: [
        { id: 'r-thrown', when: { type: 'thrown', target: { by: 'tag', tag: 'stone' } }, condition: null, then: add('throws') },
        { id: 'r-rest', when: { type: 'rest', target: { by: 'tag', tag: 'stone' } }, condition: null, then: add('rests') },
      ],
    }],
  };
  let { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  const at = async (name) => (await gameState(page)).entities.find((e) => e.id === name);
  const distance = (e) => Math.hypot(e.x + e.width / 2 - 150, e.y + e.height / 2 - 810);
  const ironFrom = distance({ x: 90, y: 750, width: 30, height: 30 });
  await untilTime(page, 0.7);
  check('wind: blows what is inside it along', (await at('blown')).x > 120, `x ${(await at('blown')).x.toFixed(0)}`);
  check('spin: sets an object turning', Math.abs((await at('spinner')).angle) > 1.5, `angle ${(await at('spinner')).angle.toFixed(2)}`);
  const lift = [];
  for (let t = 0.8; t <= 3.2; t += 0.2) {
    await untilTime(page, t);
    lift.push((await at('lift')).y);
  }
  let s = await gameState(page);
  const e = (name) => s.entities.find((x) => x.id === name);
  check('magnet: pulls what is inside it to its middle and holds it there', distance(e('iron')) < 15, `${ironFrom.toFixed(0)} → ${distance(e('iron')).toFixed(0)}`);
  check('conveyor: carries what rests on it along', e('cargo').x > 150, `x ${e('cargo').x.toFixed(0)}`);
  check('jump-through: something coming up from below passes through and lands on top', Math.abs(e('up').y + 40 - 380) < 4 && e('up').grounded, `bottom ${(e('up').y + 40).toFixed(1)}`);
  // It may still be bobbing a little: near the surface (at 900) is what counts.
  check('water: a light crate floats at the surface', e('light').y + 30 < 960 && e('light').y + 60 > 840, `middle ${(e('light').y + 30).toFixed(0)}`);
  check('water: a heavy crate sinks to the bottom', Math.abs(e('heavy').y + 60 - 1200) < 6, `bottom ${(e('heavy').y + 60).toFixed(0)}`);
  check('hinge limit: a door turns no further than its limit', Math.abs(e('door').angle) <= (34 * Math.PI) / 180 && Math.abs(e('door').angle) > (20 * Math.PI) / 180, `${((e('door').angle * 180) / Math.PI).toFixed(1)}°`);
  check('slider: a lift with a motor goes back and forth along its rail, and only along it', Math.max(...lift) - Math.min(...lift) > 150 && Math.abs(e('lift').x - 630) < 2, `${Math.min(...lift).toFixed(0)}..${Math.max(...lift).toFixed(0)}, x ${e('lift').x.toFixed(1)}`);
  // Both fall from their hooks onto the conveyor below them.
  check('cut and snap: a cut rope and one pulled past its strength both let go, and say so', s.variables.snaps === 2 && e('hung').y > 200 && e('anvil').y > 200, `snaps ${s.variables.snaps}, ${e('hung').y.toFixed(0)} ${e('anvil').y.toFixed(0)}`);
  check('freeing: a still object can be let go to fall', Math.abs(e('frozen').y + 50 - 1200) < 4, `bottom ${(e('frozen').y + 50).toFixed(0)}`);
  check('lab 15: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: resolve(shots, '15-mechanics.png') });
  await page.close();

  ({ page, errors } = await openPage(browser, url, { project: { ...project, startScene: 'sling' } }));
  await loaded(page);
  await untilTime(page, 1);
  let stone = await at('stone');
  check('sling: the stone waits in the air where it was placed', Math.abs(stone.x - 100) < 0.5 && Math.abs(stone.y - 770) < 0.5);
  const throwOnce = async (dx, dy) => {
    await page.mouse.move(...(await toPage(page, 130, 800)));
    await page.mouse.down();
    await page.mouse.move(...(await toPage(page, 130 + dx, 800 + dy)), { steps: 8 });
    await sleep(150);
    await page.mouse.up();
  };
  await throwOnce(-150, 150);
  check('thrown: letting go is noticed', await until(page, () => window.__game.getState().variables.throws === 1, null, 5000));
  const flew = await until(page, () => window.__game.getState().entities.find((e) => e.id === 'stone').x > 700 - 60 - 5 || window.__game.getState().entities.find((e) => e.id === 'stone').x > 500, null, 5000);
  check('a full pull throws the stone right across the screen', flew, `x ${(await at('stone')).x.toFixed(0)}`);
  check('rest: the stone coming to a stop is noticed', await until(page, () => window.__game.getState().variables.rests >= 1, null, 8000));
  check('reload: then it goes back into the sling', await until(page, () => { const st = window.__game.getState().entities.find((e) => e.id === 'stone'); return Math.abs(st.x - 100) < 0.5 && Math.abs(st.y - 770) < 0.5; }, null, 8000));
  await sleep(300);
  await throwOnce(-100, 60);
  check('and can be thrown again', await until(page, () => window.__game.getState().variables.throws === 2, null, 5000));
  check('lab 15 (sling): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 13c. Lab 13: messages, "otherwise", the next scene, and the try-out tools ──
{
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab13', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labthirteen', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {},
    variables: ['got', 'missed', 'reached'].map((name) => ({ name, initial: 0, saved: false })),
    startScene: 'a',
    scenes: [
      { id: 'a', name: 'a', width: 720, height: 1280, background: null, music: null, gravity: 0, objects: [], prefabs: [], rules: [
        { id: 'r-ping', when: { type: 'every', seconds: 0.2 }, condition: null, then: [{ type: 'send', name: 'ping' }] },
        { id: 'r-got', when: { type: 'message', name: 'ping' }, condition: { name: 'got', op: '<', value: 3 }, then: [{ type: 'setVariable', name: 'got', op: 'add', amount: 1 }], otherwise: [{ type: 'setVariable', name: 'missed', op: 'add', amount: 1 }] },
        { id: 'r-next', when: { type: 'variable', name: 'missed', op: '>=', value: 2 }, condition: null, then: [{ type: 'nextScene' }] },
      ] },
      { id: 'b', name: 'b', width: 720, height: 1280, background: null, music: null, gravity: 0, objects: [], prefabs: [], rules: [
        { id: 'r-b', when: { type: 'start' }, condition: null, then: [{ type: 'setVariable', name: 'reached', op: 'set', amount: 1 }] },
        // Through a door into room c, arriving at its door rather than where the player was placed.
        { id: 'r-door', when: { type: 'after', seconds: 1.5 }, condition: null, then: [{ type: 'goToScene', scene: 'c', arriveAt: 'door', bring: 'hero' }] },
      ] },
      { id: 'c', name: 'c', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [], rules: [], objects: [
        { id: 'p', name: 'p', x: 10, y: 10, width: 50, height: 50, visual: { kind: 'rect', color: '#ff5a5f' }, tags: ['hero'], visible: true, behaviors: [] },
        { id: 'd', name: 'd', x: 300, y: 500, width: 100, height: 200, visual: { kind: 'rect', color: '#8d6e63' }, tags: ['door'], visible: true, behaviors: [] },
      ] },
    ],
  };
  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  check('messages: a rule that sends a message makes the rules waiting for it run', await until(page, () => window.__game.getState().variables.got === 3, null, 10000));
  // The new scene's first step (where its start rule runs) comes a moment after the scene changes.
  const moved = await until(page, () => window.__game.getState().scene === 'b' && window.__game.getState().time > 0.05, null, 10000);
  let s = await gameState(page);
  check('otherwise: once the condition fails, the "otherwise" actions run instead', s.variables.missed >= 2 && s.variables.got === 3, `got ${s.variables.got}, missed ${s.variables.missed}`);
  check('next scene: goes to the scene after this one in the list', moved && s.variables.reached === 1, JSON.stringify({ scene: s.scene, time: s.time, v: s.variables }));
  await until(page, () => window.__game.getState().scene === 'c', null, 15000);
  const arrived = (await gameState(page)).entities.find((e) => e.id === 'p');
  check('a door into another scene: the player arrives at the door, standing on its bottom edge', arrived?.x === 325 && arrived?.y === 650, `${arrived?.x},${arrived?.y}`);
  const log = await page.evaluate(() => window.__game.getDebug().log);
  check('try-out tools: the rules that ran are listed, with those stopped by their condition told apart', log.some((e) => e.rule === 'r-got' && e.ran) && log.some((e) => e.rule === 'r-got' && !e.ran) && log.some((e) => e.rule === 'r-b'), JSON.stringify(log.slice(-4)));
  await page.evaluate(() => window.__game.setDebug({ paused: true }));
  const frozenAt = (await gameState(page)).time;
  await sleep(400);
  const still = (await gameState(page)).time;
  await page.evaluate(() => window.__game.stepFrame());
  await sleep(200);
  const stepped = (await gameState(page)).time;
  check('try-out tools: frozen, the game stands still; one step moves it one frame', still === frozenAt && Math.abs(stepped - still - 1 / 60) < 0.002, `${frozenAt} ${still} ${stepped}`);
  // Compare equal frame inputs. Wall time includes headless rendering delays,
  // and the runtime deliberately caps the amount it simulates on a long frame.
  const ratio = await page.evaluate(() => {
    const game = window.__game;
    const elapsedAt = speed => {
      game.setDebug({ paused: false, speed, shapes: true });
      const start = game.getState().time;
      for (let frame = 0; frame < 12; frame++) game.advance(1 / 60);
      return game.getState().time - start;
    };
    const normal = elapsedAt(1);
    return elapsedAt(0.25) / normal;
  });
  check('try-out tools: quarter speed advances a quarter as far for the same frames', Math.abs(ratio - 0.25) < 1e-6, ratio.toFixed(2));
  check('lab 13: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 13d. Lab 14: particles, light in the dark, looks, easing, a tapped button giving, ready-made music ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab14', orientation: 'portrait', width: 720, height: 1280, background: '#3a7bd5', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labfourteen', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: true, assets: {}, variables: [{ name: 'taps', initial: 0, saved: false }],
    startScene: 's',
    scenes: [{
      id: 's', name: 's', width: 720, height: 1280, background: null, music: 'music:happy', gravity: 0, darkness: 0.9, look: 'warm', vignette: true,
      objects: [
        box('torch', 300, 500, 60, 60, { visual: { kind: 'rect', color: '#ffd54a' }, behaviors: [{ type: 'light', radius: 260, color: '#ff9100', flicker: true }, { type: 'particles', preset: 'fire', color: '#ff9100', rate: 60, size: 18, speed: 1 }] }),
        box('sky', 0, 0, 720, 20, { opacity: 0, behaviors: [{ type: 'particles', preset: 'rain', color: '#90caf9', rate: 40, size: 16, speed: 1 }] }),
        box('mover', 0, 900, 60, 60),
        box('button', 500, 1100, 160, 100),
      ],
      prefabs: [],
      rules: [
        { id: 'r-glide', when: { type: 'start' }, condition: null, then: [{ type: 'glide', target: { by: 'id', id: 'mover' }, x: 600, y: 900, seconds: 0.6, ease: 'bounce' }] },
        { id: 'r-look', when: { type: 'after', seconds: 0.8 }, condition: null, then: [{ type: 'setLook', look: 'gray' }, { type: 'setDarkness', amount: 0, seconds: 0.4 }] },
        { id: 'r-tap', when: { type: 'tapObject', target: { by: 'id', id: 'button' } }, condition: null, then: [{ type: 'setVariable', name: 'taps', op: 'add', amount: 1 }] },
      ],
    }],
  };
  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await untilTime(page, 0.5);
  let s = await gameState(page);
  check('particles: fire and rain stream out', s.particles > 15, `${s.particles} particles`);
  check('a dark scene with a look, and ready-made music made on the spot', Math.abs(s.darkness - 0.9) < 0.01 && s.look === 'warm' && s.music === 'music:happy');
  await page.screenshot({ path: resolve(shots, '14-dark-light.png') });
  await untilTime(page, 1.4);
  s = await gameState(page);
  const mover = s.entities.find((e) => e.id === 'mover');
  check('easing: a glide that bounces still ends exactly where it was sent', Math.abs(mover.x - 600) < 0.5, `x ${mover.x}`);
  check('a rule can change the look and bring the light back', s.look === 'gray' && s.darkness < 0.01, `${s.look} ${s.darkness}`);
  const smallest = page.evaluate(() => new Promise((done) => {
    let least = 1;
    const started = performance.now();
    const look = () => {
      least = Math.min(least, window.__game.getState().entities.find((e) => e.id === 'button').scale);
      if (performance.now() - started < 600) requestAnimationFrame(look);
      else done(least);
    };
    look();
  }));
  await clickGame(page, 580, 1150);
  const least = await smallest;
  check('a tapped button gives a little under the finger, and the tap counts', least < 0.97 && (await gameState(page)).variables.taps === 1, `smallest ${least}`);
  check('lab 14: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 13e. Lab 16: the look of a game: backdrops, materials, shading, shadow and glow, bloom, a character's squash and stretch ──
{
  const box = (id, x, y, w, h, extra = {}) => ({ id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#ff5a5f' }, tags: [], visible: true, behaviors: [], ...extra });
  const rows = Array.from({ length: 22 }, () => '............');
  rows[20] = 'aaaaaaaaaaaa';
  rows[21] = 'aaaaaaaaaaaa';
  rows[16] = '..bbb...ccc.';
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab16', orientation: 'portrait', width: 720, height: 1280, background: '#ff00ff', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labsixteen', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {}, variables: [], startScene: 's',
    scenes: [{
      id: 's', name: 's', width: 1440, height: 1280, background: null, music: null, gravity: 2400, sky: 'night', bloom: true,
      objects: [
        { ...box('map', 0, 0, 720, 1320), visual: { kind: 'tiles', cell: 60, rows, kinds: {
          a: { name: 'g', color: '#6d4c41', tags: ['ground'], style: 'grass' },
          b: { name: 's', color: '#888888', tags: ['ground'], style: 'stone' },
          c: { name: 'b', color: '#888888', tags: ['ground'], style: 'brick' },
        } } },
        box('shaded', 80, 1000, 110, 110, { visual: { kind: 'rect', color: '#ff5a5f', radius: 22, shade: true, outline: '#1b3a4b' }, shadow: true }),
        box('gem', 420, 1030, 80, 80, { visual: { kind: 'ellipse', color: '#ffd54a', shade: true }, glow: '#ffd54a', shadow: true }),
        box('hero', 560, 1000, 90, 110, { visual: { kind: 'rect', color: '#26c6da', radius: 40, shade: true }, behaviors: [{ type: 'body', gravity: true, solidTag: 'ground', bounce: 0, edges: 'stop', oneWay: false }, { type: 'jumper', jumpSpeed: 1100, maxJumps: 1, on: 'tap', buttonTag: '' }] }),
        box('title', 360, 60, 0, 0, { visual: { kind: 'text', text: 'Look', color: '#ffffff', size: 90, weight: 'bold', shadow: true }, fixed: true }),
      ],
      prefabs: [], rules: [],
    }],
  };
  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await untilTime(page, 1.2);
  let s = await gameState(page);
  check('backdrop: a scene shows its painted sky', s.sky === 'night');
  check('shadow and glow: objects carry the effects they ask for', s.entities.find((e) => e.id === 'shaded').effects === 1 && s.entities.find((e) => e.id === 'gem').effects === 2 && s.entities.find((e) => e.id === 'hero').effects === 0);
  // What is actually on the screen: the sky, not the plain background colour; grass on top of the ground.
  const pixels = await page.evaluate(() => {
    const app = window.__game.app;
    const { pixels: data, width } = app.renderer.extract.pixels({ target: app.stage, frame: app.screen.clone() });
    const at = (x, y) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
    return { sky: at(600, 400), grass: at(300, 1204), dirt: at(300, 1260) };
  });
  const [sr, sg, sb] = pixels.sky;
  check('the night sky is drawn behind the game, instead of the plain background colour', sb > sr && sb > 30 && !(sr > 200 && sb > 200 && sg < 60), JSON.stringify(pixels.sky));
  const [gr, gg, gb] = pixels.grass;
  const [dr, dg, db] = pixels.dirt;
  check('a grass cell has grass along its open top and earth below', gg > gr && gg > gb && dr > dg && dr > db, `grass ${pixels.grass} dirt ${pixels.dirt}`);
  await page.screenshot({ path: resolve(shots, '16-looks.png') });
  // Watched on the game's own clock: on a slow machine the game runs slower than real time.
  const stretched = page.evaluate(() => new Promise((done) => {
    let most = 1;
    let least = 1;
    const started = window.__game.getState().time;
    const look = () => {
      const st = window.__game.getState();
      const hero = st.entities.find((e) => e.id === 'hero');
      most = Math.max(most, hero.stretch);
      least = Math.min(least, hero.stretch);
      if (st.time - started < 2) requestAnimationFrame(look);
      else done({ most, least });
    };
    look();
  }));
  await page.evaluate(() => window.__game.tap());
  const squash = await stretched;
  check('a jumping character stretches as it springs up and squashes as it lands', squash.most > 1.08 && squash.least < 0.95, JSON.stringify(squash));
  const fxBefore = (await gameState(page)).entities.reduce((n, e) => n + e.effects, 0);
  await page.evaluate(() => window.__game.lighten());
  const lit = await gameState(page);
  const fxAfter = lit.entities.reduce((n, e) => n + e.effects, 0);
  check('a slow phone: the costly effects (shadows, glows, bloom) can be dropped, and the game goes on', fxBefore > 0 && fxAfter === 0 && lit.light, `${fxBefore} → ${fxAfter}`);
  check('lab 16: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 13f. Lab 17: a bag of things the player carries: giving, flying in, taking, using ──
{
  const box = (id, x, y, w, h, extra = {}) => ({ id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#ff5a5f' }, tags: [], visible: true, behaviors: [], ...extra });
  const picture = (r, g, b) => ({ type: 'image', src: solidPng(r, g, b) });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab17', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labseventeen', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false,
    assets: { k: picture(255, 210, 63), g: picture(40, 200, 240), p: picture(200, 60, 200) },
    variables: [
      { name: 'Key', initial: 0, saved: false, item: { asset: 'k' } },
      { name: 'Gem', initial: 2, saved: false, item: { asset: 'g' } },
      { name: 'Potion', initial: 0, saved: false, item: { asset: 'p' } },
      { name: 'used', initial: 0, saved: false },
      { name: 'opened', initial: 0, saved: false },
    ],
    startScene: 's',
    scenes: [{
      id: 's', name: 's', width: 720, height: 1280, background: null, music: null, gravity: 0,
      objects: [
        // Four places across the bottom of the screen, 100 wide each: their middles at x 160, 260, 360, 460.
        box('bag', 110, 1100, 400, 100, { visual: { kind: 'bag', slots: 4 }, fixed: true }),
        box('chest', 300, 400, 100, 100),
        box('runner', 100, 600, 50, 50),
        box('stray', 40, 40, 50, 50),
        box('knight', 560, 300, 80, 80, { visual: { kind: 'image', asset: 'k', hurtFrames: ['p'] }, health: 3, invincible: 1, healthBar: true }),
        // States: moves right in state 0, down in state 1.
        box('guard', 600, 700, 40, 40, { behaviors: [{ type: 'mover', vx: 100, vy: 0, speedVariable: '', atEdge: 'nothing', onlyIn: [0] }, { type: 'rotate', speed: 90, onlyIn: [1] }] }),
      ],
      prefabs: [],
      rules: [
        { id: 'r-give', when: { type: 'after', seconds: 0.5 }, condition: null, then: [
          { type: 'give', item: 'Key', amount: 1, from: { by: 'id', id: 'chest' } },
          { type: 'give', item: 'Potion', amount: 3 },
        ] },
        // Checkpoints: the runner reaches one at (400, 600), wanders off, and comes back to it; the stray never reached one.
        { id: 'r-cp1', when: { type: 'after', seconds: 0.3 }, condition: null, then: [{ type: 'moveTo', target: { by: 'id', id: 'runner' }, x: 400, y: 600 }, { type: 'checkpoint', target: { by: 'id', id: 'runner' } }] },
        { id: 'r-cp2', when: { type: 'after', seconds: 0.6 }, condition: null, then: [{ type: 'moveTo', target: { by: 'id', id: 'runner' }, x: 600, y: 900 }, { type: 'moveTo', target: { by: 'id', id: 'stray' }, x: 500, y: 200 }] },
        { id: 'r-cp3', when: { type: 'after', seconds: 0.9 }, condition: null, then: [{ type: 'respawn', target: { by: 'id', id: 'runner' } }, { type: 'respawn', target: { by: 'id', id: 'stray' } }] },
        // Two hits a moment apart: the second lands while the knight still cannot be hurt.
        { id: 'r-state', when: { type: 'after', seconds: 0.5 }, condition: null, then: [{ type: 'setValue', target: { by: 'id', id: 'guard' }, name: 'state', op: 'set', amount: 1 }] },
        { id: 'r-hit1', when: { type: 'after', seconds: 0.4 }, condition: null, then: [{ type: 'damage', target: { by: 'id', id: 'knight' }, amount: 1 }] },
        { id: 'r-hit2', when: { type: 'after', seconds: 0.7 }, condition: null, then: [{ type: 'damage', target: { by: 'id', id: 'knight' }, amount: 1 }] },
        { id: 'r-take', when: { type: 'after', seconds: 1.5 }, condition: null, then: [{ type: 'take', item: 'Gem', amount: 5 }] },
        { id: 'r-use', when: { type: 'useItem', item: 'Potion' }, condition: null, then: [{ type: 'setVariable', name: 'used', op: 'add', amount: 1 }, { type: 'take', item: 'Potion', amount: 1 }] },
        { id: 'r-on', when: { type: 'useItemOn', item: 'Key', target: { by: 'id', id: 'chest' } }, condition: null, then: [{ type: 'setVariable', name: 'opened', op: 'set', amount: 1 }, { type: 'take', item: 'Key', amount: 1 }] },
      ],
    }],
  };
  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await untilTime(page, 0.1);
  let s = await gameState(page);
  check('bag: what the player has from the start is in it', JSON.stringify(s.bag) === '["Gem"]', JSON.stringify(s.bag));
  await until(page, () => window.__game.getState().variables.Key === 1);
  s = await gameState(page);
  check('bag: giving puts things in, after what was there, in the order given', JSON.stringify(s.bag) === '["Gem","Key","Potion"]' && s.variables.Potion === 3, JSON.stringify({ bag: s.bag, v: s.variables }));
  check('bag: a thing given from an object flies from it into the bag', s.flights === 1, `${s.flights} flying`);
  check('hurt art: damage shows the hurt pose', await until(page, () => window.__game.getState().entities.find(e => e.id === 'knight').anim === 'hurt'));
  await untilTime(page, 1.3);
  check('hurt art: idle returns after the hit', (await entity(page, 'knight')).anim === 'idle');
  check('bag: and lands there', (await gameState(page)).flights === 0);
  const drawn = await page.evaluate(() => window.__game.entities.find((e) => e.def.id === 'bag').view.children.length);
  check('bag: its places and the things in them are drawn', drawn >= 4, `${drawn} pieces`);
  await untilTime(page, 1.6);
  s = await gameState(page);
  const guard = s.entities.find((e) => e.id === 'guard');
  check('states: behaviors work only in their state (moved while 0, turns instead while 1)', guard.x > 630 && guard.x < 670 && Math.abs(guard.angle) > 0.5, `x ${guard.x.toFixed(0)}, angle ${guard.angle.toFixed(2)}`);
  const knight = s.entities.find((e) => e.id === 'knight');
  check('hurt: a second hit while it cannot be hurt again takes nothing', knight.health === 2, `health ${knight.health}`);
  const barWidth = await page.evaluate(() => window.__game.healthBars.bounds.width);
  check('hurt: a health bar is drawn over it', barWidth >= 80, `${barWidth}px`);
  const runner = s.entities.find((e) => e.id === 'runner');
  const stray = s.entities.find((e) => e.id === 'stray');
  check('checkpoint: respawning goes back to the last checkpoint, or to the start without one', runner.x === 400 && runner.y === 600 && stray.x === 40 && stray.y === 40, `${runner.x},${runner.y} / ${stray.x},${stray.y}`);
  check('bag: taking more than there is leaves none, and the others move up', s.variables.Gem === 0 && JSON.stringify(s.bag) === '["Key","Potion"]', JSON.stringify({ bag: s.bag, gem: s.variables.Gem }));
  await clickGame(page, 260, 1150);
  check('bag: tapping a thing in it uses it', await until(page, () => window.__game.getState().variables.used === 1, null, 5000) && (await gameState(page)).variables.Potion === 2, JSON.stringify((await gameState(page)).variables));
  await clickGame(page, 160, 1150);
  await sleep(300);
  check('bag: tapping another thing does not use this one', (await gameState(page)).variables.used === 1);
  // The key is in the first place (x 160). The thing is held a little above the finger, so let go a little below the target.
  const dragKey = async (x, y) => {
    await page.mouse.move(...(await toPage(page, 160, 1150)));
    await page.mouse.down();
    await page.mouse.move(...(await toPage(page, x, y)), { steps: 8 });
    await page.mouse.up();
  };
  await dragKey(600, 700);
  s = await gameState(page);
  check('bag: a thing dragged out and let go over nothing flies back, still carried', s.flights === 1 && s.variables.Key === 1 && s.variables.opened === 0, JSON.stringify({ f: s.flights, v: s.variables }));
  await untilTime(page, s.time + 0.8);
  await dragKey(350, 480);
  check('bag: dragged onto the object a rule waits for, it is used on it', await until(page, () => window.__game.getState().variables.opened === 1, null, 5000) && (await gameState(page)).variables.Key === 0 && !(await gameState(page)).bag.includes('Key'));
  check('lab 17: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 13g. Lab 18: saving progress and continuing ───────────────────────────
{
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab18', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labeighteen', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {}, textVariables: [{ name: 'quest', initial: 'Find the key', saved: true }], variables: [{ name: 'marker', initial: 0, saved: false }], startScene: 'x',
    scenes: [
      { id: 'x', name: 'x', width: 720, height: 1280, background: null, music: null, gravity: 0, objects: [], prefabs: [], rules: [
        { id: 'r-save', when: { type: 'after', seconds: 0.2 }, condition: null, then: [{ type: 'setVariable', name: 'marker', op: 'set', amount: 5 }, { type: 'setTextVariable', name: 'quest', text: 'Open the gate' }, { type: 'saveGame' }] },
        { id: 'r-load', when: { type: 'tap' }, condition: null, then: [{ type: 'loadGame', scene: 'x' }] },
      ] },
      { id: 'y', name: 'y', width: 720, height: 1280, background: null, music: null, gravity: 0, objects: [], prefabs: [], rules: [
        { id: 'quest-reward', when: { type: 'textEquals', name: 'quest', text: 'Gate open' }, condition: null, then: [{ type: 'setVariable', name: 'marker', op: 'add', amount: 1 }] },
      ] },
    ],
  };
  const { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await untilTime(page, 0.4);
  const key = 'save:com.example.labeighteen:#game';
  const kept = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  check('save: the scene and every value are kept on the device', kept?.scene === 'x' && kept?.values?.marker === 5, JSON.stringify(kept));
  check('quest: text survives both save mechanisms', kept?.values?.quest === 'Open the gate' &&
    await page.evaluate(() => localStorage.getItem('save:com.example.labeighteen:#text.quest') === 'Open the gate'));
  // Pretend the player had got further: saved in scene y, with another value.
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ scene: 'y', values: { marker: 41, quest: 'Gate open' } })), key);
  await untilTime(page, 0.6);
  await clickGame(page, 360, 640);
  check('continue: goes back to the saved scene with the saved values', await until(page, () => window.__game.getState().scene === 'y' && window.__game.getState().variables.marker === 42, null, 5000), JSON.stringify((await gameState(page)).variables));
  await untilTime(page, 0.25);
  const continued = await gameState(page);
  check('quest: restored text fires a matching rule once', continued.variables.quest === 'Gate open' && continued.variables.marker === 42);
  await page.evaluate((k) => localStorage.removeItem(k), key);
  check('lab 18: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();

  // Rooms: two hidden boxes side by side; the view keeps within the one the hero is in.
  const box = (id, x, y, w, h, extra = {}) => ({ id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#ff5a5f' }, tags: [], visible: true, behaviors: [], ...extra });
  const rooms = {
    ...project, startScene: 'r',
    scenes: [{ id: 'r', name: 'r', width: 2000, height: 1280, background: null, music: null, gravity: 0, prefabs: [], rules: [
      { id: 'r-go', when: { type: 'after', seconds: 0.5 }, condition: null, then: [{ type: 'moveTo', target: { by: 'id', id: 'hero' }, x: 1100, y: 600 }] },
    ], objects: [
      box('room1', 0, 0, 1000, 1280, { tags: ['room'], visible: false }),
      box('room2', 1000, 0, 1000, 1280, { tags: ['room'], visible: false }),
      box('hero', 900, 600, 50, 50, { behaviors: [{ type: 'camera', lock: 'free', smooth: 0, roomTag: 'room' }] }),
    ] }],
  };
  const second = await openPage(browser, url, { project: rooms });
  await loaded(second.page);
  await untilTime(second.page, 0.3);
  const inFirst = (await gameState(second.page)).camera.x;
  await untilTime(second.page, 0.7);
  const inSecond = (await gameState(second.page)).camera.x;
  check('camera rooms: the view stays inside the room the hero is in, and moves to the next room with it', inFirst === 280 && inSecond === 1000, `${inFirst} → ${inSecond}`);
  check('lab 18 (rooms): no errors in the page', second.errors.length === 0, second.errors.join(' | '));
  await second.page.close();
  // Both contact systems sample the same flat middle ledge. The empty space above it is traversable.
  const phys = { type: 'physics', kind: 'moving', gravity: true, weight: 1, bounce: 0, friction: 0.6, rotates: false, solidTag: 'ground', edges: false, drag: 'none', power: 1 };
  const ledge = box('ledge', 0, 700, 720, 300, { tags: ['ground'], visual: {kind:'terrain', color:'#437754', heights:[0.1,0.5,0.5,0.5,0.1]} });
  const lab = { ...rooms, scenes: [{...rooms.scenes[0], width:720, gravity:1100, rules:[], objects: [
    ledge, box('wheel',245,480,40,40,{round:true,behaviors:[phys]}),
    box('walker',425,480,40,40,{behaviors:[{type:'body', solidTag:'ground', gravity:true, edges:'none', bounce:0}]}),
  ]}] };
  const terrain = await openPage(browser, url, {project:lab});
  await loaded(terrain.page);
  await untilTime(terrain.page,1.8);
  const settled = (await gameState(terrain.page)).entities;
  for (const id of ['walker','wheel']) {
    const e = settled.find(o => o.id === id);
    check('drawn terrain supports ' + id + ' at the painted height', Math.abs(e.y + e.height - 850) < 3, String(e.y));
  }
  check('terrain renders without page errors', !terrain.errors.length, terrain.errors.join(' | '));
  await terrain.page.close();
  // Equal radii at different masses must produce equal acceleration, even on opposite sides.
  const gravityField = box('field', 80, 260, 560, 560, { visual:{kind:'ellipse',color:'#6788aa'}, behaviors:[{type:'field',kind:'planet',direction:0,strength:420}] });
  const floater = (id,x,y,extra) => box(id,x-10,y-10,20,20,{behaviors:[{...phys,gravity:false,...extra}]});
  const forces = {...lab, scenes:[{...lab.scenes[0], gravity:1200, objects:[
    gravityField, floater('light',220,540,{weight:0.3}), floater('heavy',500,540,{weight:4}), floater('far',360,795,{}),
    box('water',0,910,720,350,{behaviors:[{type:'field',kind:'water',strength:1,direction:0}]}),
    floater('boat',110,980,{weight:0.6,gravity:true,propeller:1200}), floater('dry',110,90,{propeller:1200})
  ]}]};
  const forcesPage = await openPage(browser,url,{project:forces});
  await loaded(forcesPage.page);
  await untilTime(forcesPage.page,0.32);
  const snapshot = await gameState(forcesPage.page);
  const find = (s,id) => s.entities.find(e => e.id === id);
  const light = find(snapshot,'light'), heavy = find(snapshot,'heavy'), far = find(snapshot,'far');
  check('planet gravity points inward equally at both masses and weakens with distance',
    light.vx > 30 && Math.abs(light.vx + heavy.vx) < 2 && far.vy < 0 && -far.vy < light.vx * 0.65,
    JSON.stringify([light.vx,heavy.vx,far.vy]));
  await forcesPage.page.keyboard.down('ArrowRight');
  await untilTime(forcesPage.page,snapshot.time+1);
  const driven = await gameState(forcesPage.page);
  check('the propeller drives a floating hull and stays idle on dry land', find(driven,'boat').x > 130 && Math.abs(find(driven,'dry').x-100)<1);
  await forcesPage.page.keyboard.up('ArrowRight');
  await forcesPage.page.keyboard.down('ArrowLeft');
  await untilTime(forcesPage.page,driven.time+1.4);
  check('the boat pedal reverses the hull', find(await gameState(forcesPage.page),'boat').vx < -20);
  await forcesPage.page.close();
}

// ── 13h. Lab 19: shapes a body meets others with, gears and racks, gravity zones ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#888888' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const physics = (extra = {}) => ({ type: 'physics', kind: 'moving', solidTag: 'ground', bounce: 0, friction: 0.6, weight: 1, rotates: true, gravity: true, slowdown: 0, edges: false, drag: 'none', power: 8, ...extra });
  const still = (extra = {}) => physics({ kind: 'still', ...extra });
  const joint = (kind, targetTag, extra = {}) => ({ type: 'joint', kind, targetTag, at: 'self', motor: 0, ...extra });
  const id = (x) => ({ by: 'id', id: x });
  // A picture that is a small dot in the middle of an empty square: its box is four times wider than what is drawn.
  const dot = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="24" fill="#e53935"/></svg>').toString('base64');
  const picture = (extra = {}) => ({ visual: { kind: 'image', asset: 'dot' }, ...extra });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab19', orientation: 'portrait', width: 720, height: 1280, background: '#222831', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labnineteen', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: { dot: { type: 'image', src: dot } },
    variables: ['corner', 'boxed'].map((name) => ({ name, initial: 0, saved: false })),
    startScene: 'shapes',
    scenes: [{
      id: 'shapes', name: 'shapes', width: 720, height: 1280, background: null, music: null, gravity: 2000,
      objects: [
        box('floor', 0, 1200, 720, 80, { tags: ['ground'] }),
        // A ball dropped over the corner of each square: the plain box catches it, the traced dot and the triangle do not.
        box('boxy', 40, 500, 100, 100, picture({ behaviors: [still()] })),
        box('onBoxy', 115, 380, 30, 30, { round: true, tags: ['ball'], behaviors: [physics()] }),
        box('traced', 220, 500, 100, 100, picture({ tags: ['traced'], behaviors: [still({ shape: 'outline' })] })),
        box('onTraced', 295, 380, 30, 30, { round: true, tags: ['ball'], behaviors: [physics()] }),
        box('tri', 400, 500, 100, 100, { behaviors: [still({ shape: 'triangle' })] }),
        box('onTri', 403, 380, 30, 30, { round: true, behaviors: [physics()] }),
        // Two posts nudged off upright: a box stands on its flat foot, a capsule rolls over on its round end.
        box('postBox', 520, 1050, 40, 150, { rotation: 4, behaviors: [physics()] }),
        box('postCapsule', 620, 1050, 40, 150, { rotation: 4, behaviors: [physics({ shape: 'capsule' })] }),
        box('hex', 560, 300, 80, 70, { behaviors: [physics({ shape: 'hexagon' })] }),
      ],
      prefabs: [],
      rules: [
        { id: 'r-corner', when: { type: 'touch', a: { by: 'tag', tag: 'ball' }, b: { by: 'tag', tag: 'traced' } }, condition: null, then: [{ type: 'setVariable', name: 'corner', op: 'add', amount: 1 }] },
        { id: 'r-boxed', when: { type: 'touch', a: id('onBoxy'), b: id('boxy') }, condition: null, then: [{ type: 'setVariable', name: 'boxed', op: 'add', amount: 1 }] },
      ],
    }, {
      id: 'gears', name: 'gears', width: 720, height: 1280, background: null, music: null, gravity: 2000,
      objects: [
        box('pinA', 140, 290, 20, 20, { tags: ['pinA'] }),
        box('pinB', 260, 290, 20, 20, { tags: ['pinB'] }),
        box('pinC', 140, 590, 20, 20, { tags: ['pinC'] }),
        box('pinD', 400, 590, 20, 20, { tags: ['pinD'] }),
        box('pinE', 200, 890, 20, 20, { tags: ['pinE'] }),
        // Meshed: a small driver and a gear twice its size, which turns half as fast the other way.
        box('driver', 100, 250, 100, 100, { round: true, tags: ['g'], behaviors: [physics({ gravity: false, passTag: 'g' }), joint('hinge', 'pinA', { motor: 180 }), joint('gear', 'big')] }),
        box('bigGear', 170, 200, 200, 200, { round: true, tags: ['g', 'big'], behaviors: [physics({ gravity: false, passTag: 'g' }), joint('hinge', 'pinB')] }),
        // Belted: the same size, the same way round.
        box('beltA', 100, 550, 100, 100, { round: true, tags: ['g'], behaviors: [physics({ gravity: false, passTag: 'g' }), joint('hinge', 'pinC', { motor: 180 }), joint('gear', 'beltB', { belt: true })] }),
        box('beltB', 360, 550, 100, 100, { round: true, tags: ['g', 'beltB'], behaviors: [physics({ gravity: false, passTag: 'g' }), joint('hinge', 'pinD')] }),
        // A pinion over a rack: turning clockwise, its bottom teeth push the rack to the left.
        box('pinion', 150, 840, 100, 100, { round: true, tags: ['g'], behaviors: [physics({ gravity: false, passTag: 'g' }), joint('hinge', 'pinE', { motor: 180 }), joint('gear', 'rack')] }),
        box('rack', 200, 940, 300, 30, { tags: ['g', 'rack'], behaviors: [physics({ gravity: false, rotates: false, passTag: 'g' }), joint('slider', 'pinE', { axis: 0 })] }),
      ],
      prefabs: [],
      rules: [{ id: 'r-cut', when: { type: 'after', seconds: 1.2 }, condition: null, then: [{ type: 'cut', target: id('driver') }] }],
    }, {
      id: 'zones', name: 'zones', width: 720, height: 1280, background: null, music: null, gravity: 2000,
      objects: [
        box('floor', 0, 1200, 720, 80, { tags: ['ground'] }),
        box('upside', 0, 300, 240, 700, { behaviors: [{ type: 'field', kind: 'gravity', direction: -90, strength: 1500 }] }),
        box('floating', 240, 300, 240, 700, { behaviors: [{ type: 'field', kind: 'gravity', direction: 90, strength: 0 }] }),
        box('riser', 100, 800, 40, 40, { behaviors: [physics()] }),
        box('floater', 340, 800, 40, 40, { behaviors: [physics()] }),
        box('faller', 580, 800, 40, 40, { behaviors: [physics()] }),
      ],
      prefabs: [], rules: [],
    }],
  };
  let { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await untilTime(page, 1.6);
  let s = await gameState(page);
  let e = (name) => s.entities.find((x) => x.id === name);
  check('shapes: a ball over the corner of a plain box lands on the box', Math.abs(e('onBoxy').y + 30 - 500) < 3 && s.variables.boxed >= 1, `bottom ${(e('onBoxy').y + 30).toFixed(0)}`);
  check('outline: a ball over the empty corner of a traced picture falls past it to the floor', Math.abs(e('onTraced').y + 30 - 1200) < 4, `bottom ${(e('onTraced').y + 30).toFixed(0)}`);
  check('outline: brushing past the empty corner is not a touch', s.variables.corner === 0, `touches ${s.variables.corner}`);
  check('triangle: a ball over its corner falls past the slope instead of resting on a box', e('onTri').y + 30 > 600, `bottom ${(e('onTri').y + 30).toFixed(0)}`);
  check('capsule: a post with round ends tips over, a box post stays standing', Math.abs(e('postCapsule').angle) > 1 && Math.abs(e('postBox').angle) < 0.3, `${e('postCapsule').angle.toFixed(2)} / ${e('postBox').angle.toFixed(2)}`);
  check('hexagon: lands on a flat side', Math.abs(e('hex').y + 70 - 1200) < 6, `bottom ${(e('hex').y + 70).toFixed(0)}`);
  check('lab 19 (shapes): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: resolve(shots, '19-shapes.png') });
  await page.close();

  ({ page, errors } = await openPage(browser, url, { project: { ...project, startScene: 'gears' } }));
  await loaded(page);
  await untilTime(page, 1);
  s = await gameState(page);
  const meshed = e('bigGear').angle / e('driver').angle;
  check('gear: a gear twice the size turns half as fast, the other way', e('driver').angle > 1.5 && Math.abs(meshed + 0.5) < 0.08, `ratio ${meshed.toFixed(2)}`);
  const belted = e('beltB').angle / e('beltA').angle;
  check('gear with a belt: the two turn the same way', e('beltA').angle > 1.5 && Math.abs(belted - 1) < 0.08, `ratio ${belted.toFixed(2)}`);
  check('rack: a turning pinion pushes the rack along its rail', e('rack').x < 200 - 50 && Math.abs(e('rack').y - 940) < 2, `x ${e('rack').x.toFixed(0)}`);
  await untilTime(page, 1.8);
  s = await gameState(page);
  check('cutting a geared hinge lets go of the gear too, and the game goes on', s.time >= 1.8 && errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: resolve(shots, '19-gears.png') });
  await page.close();

  ({ page, errors } = await openPage(browser, url, { project: { ...project, startScene: 'zones' } }));
  await loaded(page);
  await untilTime(page, 0.6);
  s = await gameState(page);
  check('gravity zone: something inside an upside-down zone falls upward', e('riser').y < 700, `y ${e('riser').y.toFixed(0)}`);
  check('gravity zone: with no strength, something inside floats where it was', Math.abs(e('floater').y - 800) < 3, `y ${e('floater').y.toFixed(1)}`);
  check('gravity zone: outside any zone the scene\'s gravity still pulls down', e('faller').y > 900, `y ${e('faller').y.toFixed(0)}`);
  check('lab 19 (zones): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 13i. Lab 20: graphics: walls that cast shadows, weather, words that float up, more particle streams ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#8d6e63' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const presets = ['embers', 'leaves', 'dust', 'magic', 'hearts', 'steam', 'electric', 'portal', 'waterfall', 'fireflies', 'stars', 'drip'];
  const scene = (id, extra) => ({ id, name: id, width: 720, height: 1280, background: null, music: null, gravity: 0, objects: [], prefabs: [], rules: [], ...extra });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab20', orientation: 'portrait', width: 720, height: 1280, background: '#2a3a4a', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labtwenty', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {},
    variables: [{ name: 'score', initial: 7, saved: false }],
    startScene: 'shadows',
    scenes: [
      scene('shadows', {
        darkness: 1,
        objects: [
          box('lamp', 80, 580, 40, 40, { visual: { kind: 'ellipse', color: '#ffe082' }, behaviors: [{ type: 'light', radius: 420, color: '#ffcc80', flicker: false, shadowTag: 'wall' }] }),
          box('plain', 560, 1100, 40, 40, { behaviors: [{ type: 'light', radius: 200, color: '#ffffff', flicker: false }] }),
          box('pillar', 250, 500, 40, 200, { tags: ['wall'] }),
          box('far', 400, 120, 40, 40, { tags: ['wall'] }),
        ],
      }),
      scene('storm', { weather: 'storm' }),
      scene('fog', { weather: 'fog' }),
      scene('snow', { weather: 'snow' }),
      scene('floats', {
        objects: [
          box('chest', 300, 700, 120, 80),
          ...presets.map((p, i) => box('s-' + p, 40 + (i % 4) * 170, 100 + Math.floor(i / 4) * 180, 120, 120, { visual: { kind: 'rect', color: '#37474f' }, behaviors: [{ type: 'particles', preset: p, color: '#ffcc80', rate: 30, size: 16, speed: 1 }] })),
        ],
        rules: [{ id: 'r-float', when: { type: 'start' }, condition: null, then: [{ type: 'floatText', target: { by: 'id', id: 'chest' }, text: '+{score}', color: '#ffe066', size: 48 }] }],
      }),
    ],
  };
  const inside = (x, y, p) => {
    let ins = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const [xi, yi, xj, yj] = [p[i], p[i + 1], p[j], p[j + 1]];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  let { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await untilTime(page, 0.4);
  let s = await gameState(page);
  const lamp = s.lit.find((l) => l.id === 'lamp');
  check('shadows: a light with a shadow group is cut to what it can see; a plain light is not', lamp && !s.lit.some((l) => l.id === 'plain'), JSON.stringify(s.lit.map((l) => l.id)));
  check('shadows: the space in front of a pillar is lit, and the face of the pillar too', inside(200, 600, lamp.points) && inside(255, 600, lamp.points));
  check('shadows: behind the pillar is dark, but beside it the light still reaches', !inside(420, 600, lamp.points) && inside(380, 380, lamp.points));
  check('shadows: a wall beyond the light\'s reach changes nothing', !inside(100, 100, lamp.points) && inside(100, 250, lamp.points));
  await page.screenshot({ path: resolve(shots, '20-shadows.png') });
  check('lab 20 (shadows): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();

  ({ page, errors } = await openPage(browser, url, { project: { ...project, startScene: 'storm' } }));
  await loaded(page);
  await untilTime(page, 0.3);
  s = await gameState(page);
  check('weather: a storm fills the screen with rain', s.weather.kind === 'storm' && s.weather.drops >= 200, JSON.stringify(s.weather));
  await untilTime(page, 1.3);
  s = await gameState(page);
  check('weather: and soon lightning flashes', s.weather.strikes >= 1 && s.weather.flash > 0, JSON.stringify(s.weather));
  await page.screenshot({ path: resolve(shots, '20-storm.png') });
  check('lab 20 (storm): no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();

  for (const kind of ['fog', 'snow']) {
    ({ page, errors } = await openPage(browser, url, { project: { ...project, startScene: kind } }));
    await loaded(page);
    await untilTime(page, 0.5);
    s = await gameState(page);
    check(`weather: ${kind} is there`, s.weather.kind === kind && (kind === 'fog' ? s.weather.fog >= 3 : s.weather.drops >= 100) && errors.length === 0, JSON.stringify(s.weather) + errors.join(' | '));
    await page.close();
  }

  ({ page, errors } = await openPage(browser, url, { project: { ...project, startScene: 'floats' } }));
  await loaded(page);
  await untilTime(page, 0.1);
  s = await gameState(page);
  const first = s.floats[0];
  check('floating words: the text shows over the object, with the value filled in', s.floats.length === 1 && first.text === '+7' && Math.abs(first.x - 360) < 2, JSON.stringify(s.floats));
  await untilTime(page, 0.6);
  s = await gameState(page);
  check('floating words: they rise', s.floats.length === 1 && s.floats[0].y < first.y - 40, `${first.y.toFixed(0)} → ${s.floats[0]?.y.toFixed(0)}`);
  await untilTime(page, 1.3);
  s = await gameState(page);
  check('floating words: and are gone after a second', s.floats.length === 0);
  check('particles: the twelve new kinds all stream', s.particles > 60 && errors.length === 0, `${s.particles} ${errors.join(' | ')}`);
  await page.screenshot({ path: resolve(shots, '20-particles.png') });
  await page.close();
}

// ── 13j. Lab 21: old-screen looks, ripples, the view's punch, shaking one way, day and night, the last particle kinds ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#ff8a65' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const scene = (id, extra) => ({ id, name: id, width: 720, height: 1280, background: null, music: null, gravity: 0, objects: [], prefabs: [], rules: [], ...extra });
  const late = ['sparks', 'petals', 'feathers', 'poison', 'frost', 'glitter', 'coins', 'ash', 'rainbow', 'splash', 'sand'];
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab21', orientation: 'portrait', width: 720, height: 1280, background: '#3a4a5a', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labtwentyone', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {}, variables: [],
    startScene: 'hit',
    scenes: [
      scene('hit', {
        retro: 'crt',
        objects: [box('barrel', 310, 600, 100, 100), ...late.map((p, i) => box('l-' + p, 30 + (i % 4) * 175, 80 + Math.floor(i / 4) * 160, 110, 110, { visual: { kind: 'rect', color: '#263238' }, behaviors: [{ type: 'particles', preset: p, color: '#ffcc80', rate: 30, size: 16, speed: 1 }] }))],
        rules: [{ id: 'r-hit', when: { type: 'after', seconds: 0.3 }, condition: null, then: [
          { type: 'shockwave', at: { by: 'id', id: 'barrel' }, size: 500 },
          { type: 'zoomPunch', amount: 1.2, seconds: 0.5 },
          { type: 'shake', strength: 20, axis: 'side' },
        ] }],
      }),
      scene('pixel', { retro: 'pixel', objects: [box('block', 300, 600, 120, 120)] }),
      scene('day', { dayLength: 4, objects: [box('lamp', 330, 600, 60, 60, { behaviors: [{ type: 'light', radius: 200, color: '#ffffff', flicker: false }] })] }),
    ],
  };
  let { page, errors } = await openPage(browser, url, { project });
  await loaded(page);
  await untilTime(page, 0.2);
  let s = await gameState(page);
  check('old screen: the arcade look is on', s.retro === 'crt', s.retro);
  await untilTime(page, 0.4);
  s = await gameState(page);
  check('shockwave: a ripple runs over the picture', s.waves === 1, `waves ${s.waves}`);
  check('the view punches in closer', s.punch > 1.05, `scale ${s.punch.toFixed(3)}`);
  check('a side shake moves the screen only left and right', s.shaking && s.shakeAt.y === 0, JSON.stringify(s.shakeAt));
  await page.screenshot({ path: resolve(shots, '21-shockwave.png') });
  await untilTime(page, 1.4);
  s = await gameState(page);
  check('and the ripple and the punch are over a moment later', s.waves === 0 && Math.abs(s.punch - 1) < 0.001, `waves ${s.waves}, scale ${s.punch}`);
  check('particles: the last eleven kinds stream too', s.particles > 60 && errors.length === 0, `${s.particles} ${errors.join(' | ')}`);
  await page.screenshot({ path: resolve(shots, '21-particles.png') });
  await page.close();

  ({ page, errors } = await openPage(browser, url, { project: { ...project, startScene: 'pixel' } }));
  await loaded(page);
  await untilTime(page, 0.3);
  check('old screen: big pixels', (await gameState(page)).retro === 'pixel' && errors.length === 0);
  await page.screenshot({ path: resolve(shots, '21-pixel.png') });
  await page.close();

  ({ page, errors } = await openPage(browser, url, { project: { ...project, startScene: 'day' } }));
  await loaded(page);
  await untilTime(page, 0.2);
  const noon = (await gameState(page)).darkness;
  await untilTime(page, 2);
  const midnight = (await gameState(page)).darkness;
  await untilTime(page, 3.8);
  const morning = (await gameState(page)).darkness;
  check('day and night: the scene darkens to night halfway through the day, and is light again at the end', noon < 0.05 && midnight > 0.75 && morning < 0.1, `${noon.toFixed(2)} → ${midnight.toFixed(2)} → ${morning.toFixed(2)}`);
  check('lab 21: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── 13k. Lab 22: a hero's special moves, a dodge roll, shooting in patterns, homing ──
{
  const box = (id, x, y, w, h, extra = {}) => ({
    id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#4fc3f7' }, tags: [], visible: true, behaviors: [], ...extra,
  });
  const scene = (id, extra) => ({ id, name: id, width: 720, height: 1280, background: null, music: null, gravity: 2400, objects: [], prefabs: [], rules: [], ...extra });
  const floor = box('floor', 0, 1200, 720, 80, { tags: ['ground'] });
  const hero = (x, y, extra = []) => box('hero', x, y, 60, 80, { health: 100, behaviors: [
    { type: 'body', gravity: true, solidTag: 'ground', bounce: 0, edges: 'stop', oneWay: false },
    { type: 'walker', speed: 300, control: 'buttons', leftTag: '', rightTag: '' },
    { type: 'jumper', jumpSpeed: 1100, maxJumps: 1, on: 'button', buttonTag: '' },
    { type: 'moves', wallJump: true, dash: true, dashTag: '', climbTag: 'ladder', pound: true, poundTag: '' },
    ...extra,
  ] });
  const project = {
    formatVersion: 2,
    meta: { name: 'Lab22', orientation: 'portrait', width: 720, height: 1280, background: '#263238', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.labtwentytwo', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {}, variables: [],
    startScene: 'dash',
    scenes: [
      scene('dash', { objects: [floor, hero(100, 1120)] }),
      scene('wall', { objects: [floor, box('wall', 400, 200, 80, 1000, { tags: ['ground'] }), hero(330, 300)] }),
      scene('pound', { objects: [floor, hero(300, 300)] }),
      scene('ladder', { objects: [floor, box('ladder', 280, 500, 100, 700, { tags: ['ladder'], visual: { kind: 'rect', color: '#8d6e63' } }), hero(300, 1120)] }),
      scene('roll', {
        gravity: 0,
        objects: [box('knight', 300, 600, 60, 60, { health: 100, behaviors: [
          { type: 'body', gravity: false, solidTag: '', bounce: 0, edges: 'stop', oneWay: false },
          { type: 'steer', speed: 300, control: 'stick', upTag: '', downTag: '', leftTag: '', rightTag: '', face: false, roll: true, rollTag: '' },
        ] })],
        // Something hurts the knight all the time, except while it rolls.
        rules: [{ id: 'r-hurt', when: { type: 'every', seconds: 0.05 }, condition: null, then: [{ type: 'damage', target: { by: 'id', id: 'knight' }, amount: 1 }] }],
      }),
      scene('shoot', {
        gravity: 0,
        objects: [box('gun', 330, 600, 60, 60), box('target', 640, 600, 40, 40, { tags: ['tgt'] }), box('launcher', 40, 1150, 40, 40)],
        prefabs: [box('orb', 0, 0, 16, 16, { visual: { kind: 'ellipse', color: '#c77dff' }, tags: ['orb'], behaviors: [{ type: 'lifetime', seconds: 3 }] }),
          box('aimer', 0, 0, 16, 16, { visual: { kind: 'ellipse', color: '#ffd54a' }, tags: ['aimed'], behaviors: [{ type: 'lifetime', seconds: 3 }] }),
          box('missile', 0, 0, 14, 30, { tags: ['missile'], behaviors: [{ type: 'mover', vx: 0, vy: -400, speedVariable: '' }, { type: 'homing', targetTag: 'tgt', turn: 240 }, { type: 'lifetime', seconds: 3 }] })],
        rules: [{ id: 'r-fire', when: { type: 'start' }, condition: null, then: [
          { type: 'shoot', from: { by: 'id', id: 'gun' }, prefab: 'orb', pattern: 'ring', count: 8, direction: 0, spread: 0, speed: 300, aimTag: '' },
          { type: 'shoot', from: { by: 'id', id: 'gun' }, prefab: 'orb', pattern: 'spread', count: 5, direction: -90, spread: 60, speed: 300, aimTag: '' },
          { type: 'shoot', from: { by: 'id', id: 'gun' }, prefab: 'aimer', pattern: 'aimed', count: 1, direction: 90, spread: 0, speed: 300, aimTag: 'tgt' },
          { type: 'spawn', prefab: 'missile', at: { by: 'id', id: 'launcher' } },
        ] }],
      }),
    ],
  };
  const open = async (startScene) => {
    const opened = await openPage(browser, url, { project: { ...project, startScene } });
    await loaded(opened.page);
    return opened;
  };
  const hero_ = async (page, id = 'hero') => (await gameState(page)).entities.find((e) => e.id === id);

  let { page, errors } = await open('dash');
  await untilTime(page, 0.5);
  const before = await hero_(page);
  await page.keyboard.press('KeyX');
  await untilTime(page, (await gameState(page)).time + 0.3);
  const after = await hero_(page);
  check('dash: X sends the hero a long way forward in a moment, with nobody walking', after.x - before.x > 120, `${before.x.toFixed(0)} → ${after.x.toFixed(0)}`);
  await page.close();

  ({ page, errors } = await open('wall'));
  await page.keyboard.down('ArrowRight');
  await untilTime(page, 0.6);
  const sliding = await hero_(page);
  check('wall slide: pressed against a wall in the air, it slides down slowly', sliding.vy <= 161 && sliding.vy > 0 && sliding.y < 1000, `vy ${sliding.vy.toFixed(0)}, y ${sliding.y.toFixed(0)}`);
  await page.keyboard.press('Space');
  await untilTime(page, (await gameState(page)).time + 0.08);
  const kicked = await hero_(page);
  check('wall jump: a jump from the wall goes up and away from it, even holding toward the wall', kicked.vy < 0 && kicked.vx < 0, `vx ${kicked.vx.toFixed(0)}, vy ${kicked.vy.toFixed(0)}`);
  await page.keyboard.up('ArrowRight');
  await page.close();

  ({ page, errors } = await open('pound'));
  await untilTime(page, 0.1);
  await page.keyboard.press('ArrowDown');
  const landed = await until(page, () => { const s = window.__game.getState(); const h = s.entities.find((e) => e.id === 'hero'); return h.grounded && s.shaking && s.shakeAt.x === 0; }, null, 5000);
  check('ground pound: down in the air drives it straight down, and the landing shakes the screen up and down', landed);
  check('and it got there fast', (await gameState(page)).time < 0.75, `${(await gameState(page)).time.toFixed(2)} s`);
  await page.close();

  ({ page, errors } = await open('ladder'));
  await untilTime(page, 0.3);
  const foot = await hero_(page);
  await page.keyboard.down('ArrowUp');
  await untilTime(page, 1.1);
  await page.keyboard.up('ArrowUp');
  const climbed = await hero_(page);
  await untilTime(page, 1.5);
  const hanging = await hero_(page);
  check('ladder: up climbs it', foot.y - climbed.y > 150, `${foot.y.toFixed(0)} → ${climbed.y.toFixed(0)}`);
  check('ladder: let go, it holds on where it is', Math.abs(hanging.y - climbed.y) < 12, `${climbed.y.toFixed(0)} → ${hanging.y.toFixed(0)}`);
  await page.close();

  ({ page, errors } = await open('roll'));
  await page.keyboard.down('ArrowRight');
  await untilTime(page, 0.3);
  await page.keyboard.press('KeyX');
  const rollStart = await gameState(page);
  const startHealth = rollStart.entities.find((e) => e.id === 'knight').health;
  await untilTime(page, rollStart.time + 0.12);
  const rolling = await hero_(page, 'knight');
  await untilTime(page, rollStart.time + 0.3);
  const rolled = await hero_(page, 'knight');
  check('dodge roll: X rolls the knight fast the way it is going', rolling.vx > 600, `vx ${rolling.vx.toFixed(0)}`);
  check('dodge roll: nothing hurts it while it rolls', rolled.health >= startHealth - 1, `${startHealth} → ${rolled.health}`);
  await untilTime(page, rollStart.time + 0.8);
  check('and afterwards it can be hurt again', (await hero_(page, 'knight')).health < rolled.health - 3);
  await page.keyboard.up('ArrowRight');
  await page.close();

  ({ page, errors } = await open('shoot'));
  await untilTime(page, 0.15);
  let s = await gameState(page);
  const orbs = s.entities.filter((e) => e.tags.includes('orb'));
  const angles = new Set(orbs.map((o) => Math.round((Math.atan2(o.vy, o.vx) * 180) / Math.PI)));
  check('shoot: a ring of eight and a fan of five, each at its own angle and at the speed asked', orbs.length === 13 && angles.size >= 12 && orbs.every((o) => Math.abs(Math.hypot(o.vx, o.vy) - 300) < 1), `${orbs.length} orbs, ${angles.size} angles`);
  const aimed = s.entities.find((e) => e.tags.includes('aimed'));
  check('shoot aimed: straight at the target, whatever the direction says', aimed && aimed.vx > 290 && Math.abs(aimed.vy) < 15, aimed ? `${aimed.vx.toFixed(0)}, ${aimed.vy.toFixed(0)}` : 'none');
  await untilTime(page, 1.2);
  s = await gameState(page);
  const missile = s.entities.find((e) => e.tags.includes('missile'));
  check('homing: a missile fired upward turns toward its target', missile && missile.x > 200 && missile.vx > 100, missile ? `x ${missile.x.toFixed(0)}, vx ${missile.vx.toFixed(0)}` : 'gone');
  check('lab 22: no errors in the pages', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: resolve(shots, '22-shoot.png') });
  await page.close();
}

// ── 14. A broken project is refused with a readable message ───────────────
{
  const broken = { formatVersion: 2, meta: { name: 'x', orientation: 'portrait', width: 720, height: 1280, background: '#222222', fontFamily: 'Fredoka' },
    app: { appId: 'com.example.broken', versionCode: 1, versionName: '1.0', icon: null }, ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {}, variables: [], startScene: 's',
    scenes: [{ id: 's', name: 's', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [], rules: [{ id: 'r', when: { type: 'tap' }, condition: null, then: [{ type: 'goToScene', scene: 'nowhere' }] }], objects: [] }] };
  const { page } = await openPage(browser, url, { project: broken });
  await page.waitForSelector('.load-error', { timeout: 15000 });
  const message = await page.$eval('.load-error', (el) => el.textContent);
  check('a project pointing at a missing scene is refused', message.includes('missing scene "nowhere"'), message.replace(/\n/g, ' '));
  await page.close();
}

await browser.close();
finish();
