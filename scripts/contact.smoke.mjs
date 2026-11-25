// The contact lab (Phase 2, docs/contact-report.md): five scenes that measure how well objects meet, each check
// stating how much sinking, jitter or pass-through is allowed. The game is stepped by hand on its own clock
// (60 frames a second), so every run measures the same thing. Run `npm run build` first.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { check, finish, launch, openPage, root, shots, until } from './lib.mjs';

const url = pathToFileURL(resolve(root, 'dist/index.html')).href;
const browser = await launch();

/** A one-scene project. */
const project = (name, scene) => ({
  formatVersion: 2,
  meta: { name, orientation: 'portrait', width: 720, height: 1280, background: '#202833', fontFamily: 'Fredoka', transition: 'none' },
  app: { appId: `com.example.contact${name.toLowerCase()}`, versionCode: 1, versionName: '1.0', icon: null },
  ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
  sound: false, assets: {}, variables: [{ name: 'hits', initial: 0 }], startScene: 's',
  scenes: [{ id: 's', name: 's', width: 720, height: 1280, background: null, music: null, gravity: 2000, prefabs: [], rules: [], objects: [], ...scene }],
});
const box = (id, x, y, width, height, ext = {}) => ({
  id, name: id, x, y, width, height, visual: { kind: 'rect', color: ext.color ?? '#888888' }, tags: [], visible: true, behaviors: [], ...ext,
});
const body = (solidTag, ext = {}) => ({ type: 'body', gravity: true, solidTag, bounce: 0, edges: 'stop', oneWay: false, ...ext });
const physics = (kind, ext = {}) => ({ type: 'physics', kind, solidTag: '', bounce: 0, friction: 0.6, weight: 1, rotates: true, gravity: true, edges: true, ...ext });

/** Opens a project with the clock stopped: `run` then steps it by hand inside the page. */
async function lab(name, scene, run, arg) {
  const { page, errors } = await openPage(browser, url, { project: project(name, scene) });
  await until(page, () => window.__game, null, 20000);
  const result = await page.evaluate(run, arg);
  await page.screenshot({ path: resolve(shots, `contact-${name}.png`) });
  await page.close();
  check(`contact lab ${name}: no errors in the page`, errors.length === 0, errors.join(' | '));
  return result;
}
const fmt = (n) => (Math.round(n * 100) / 100).toString();

// ── 1. Twenty crates resting still ─────────────────────────────────────────
// Four stacks of five, real physics on a still floor; then 2 s watched. Also twenty arcade crates (body).
{
  const crates = [];
  for (let s = 0; s < 4; s++) for (let i = 0; i < 5; i++) crates.push(box(`c${s}-${i}`, 80 + s * 150, 1100 - (i + 1) * 61, 60, 60, { tags: ['crate'], behaviors: [physics('moving')] }));
  const r = await lab('Crates', {
    objects: [box('floor', 0, 1100, 720, 180, { tags: ['ground'], behaviors: [physics('still')] }), ...crates],
  }, () => {
    const g = window.__game;
    g.app.ticker.stop();
    for (let i = 0; i < 240; i++) g.advance(1 / 60);
    const crates = g.entities.filter((e) => e.def.tags.includes('crate'));
    const floor = g.entities.find((e) => e.def.id === 'floor');
    const start = new Map(crates.map((c) => [c, { x: c.x, y: c.y, a: c.angle }]));
    let jitter = 0, sink = 0, turn = 0;
    for (let i = 0; i < 120; i++) {
      g.advance(1 / 60);
      for (const c of crates) {
        const s = start.get(c);
        jitter = Math.max(jitter, Math.hypot(c.x - s.x, c.y - s.y));
        turn = Math.max(turn, Math.abs(c.angle - s.a));
        sink = Math.max(sink, c.y + c.height - floor.y);
        // Into the crate below it (same stack).
        for (const d of crates) if (d !== c && Math.abs(d.x - c.x) < 30 && d.y > c.y) sink = Math.max(sink, c.y + c.height - d.y);
      }
    }
    const fallen = crates.filter((c) => Math.abs(c.angle) > 0.2).length;
    g.app.ticker.start();
    return { jitter, sink, turn, fallen };
  });
  check(`real-physics crates rest still: jitter at most 1 px (${fmt(r.jitter)} px)`, r.jitter <= 1, JSON.stringify(r));
  check(`real-physics crates sink at most 1.5 px into what they stand on (${fmt(r.sink)} px)`, r.sink <= 1.5, JSON.stringify(r));
  check('real-physics stacks stay standing (no crate tipped over)', r.fallen === 0, JSON.stringify(r));

  const arcade = [];
  for (let s = 0; s < 4; s++) for (let i = 0; i < 5; i++) arcade.push(box(`b${s}-${i}`, 80 + s * 150, 1100 - (i + 1) * 62, 60, 60, { tags: ['solid', 'crate'], behaviors: [body('solid', { pushable: true })] }));
  const b = await lab('ArcadeCrates', {
    objects: [box('floor', 0, 1100, 720, 180, { tags: ['solid'] }), ...arcade],
  }, () => {
    const g = window.__game;
    g.app.ticker.stop();
    for (let i = 0; i < 240; i++) g.advance(1 / 60);
    const crates = g.entities.filter((e) => e.def.tags.includes('crate'));
    const floor = g.entities.find((e) => e.def.id === 'floor');
    const start = new Map(crates.map((c) => [c, { x: c.x, y: c.y }]));
    let jitter = 0, sink = 0;
    for (let i = 0; i < 120; i++) {
      g.advance(1 / 60);
      for (const c of crates) {
        const s = start.get(c);
        jitter = Math.max(jitter, Math.hypot(c.x - s.x, c.y - s.y));
        sink = Math.max(sink, c.y + c.height - floor.y);
        for (const d of crates) if (d !== c && Math.abs(d.x - c.x) < 30 && d.y > c.y) sink = Math.max(sink, c.y + c.height - d.y);
      }
    }
    g.app.ticker.start();
    return { jitter, sink, grounded: crates.filter((c) => c.grounded).length };
  });
  check(`arcade crates rest still: no jitter (${fmt(b.jitter)} px)`, b.jitter <= 0.01, JSON.stringify(b));
  check(`arcade crates do not sink (${fmt(b.sink)} px)`, b.sink <= 0.01, JSON.stringify(b));
  check('every arcade crate stands on something', b.grounded === 20, JSON.stringify(b));
}

// ── 2. A fast bullet against a thin wall ───────────────────────────────────
// 3000 px/s at a 10 px wall: 25 px a step at 120 steps a second. No pass-through is allowed.
{
  const r = await lab('Bullet', {
    width: 1400, gravity: 0,
    objects: [
      box('wall', 900, 0, 10, 1280, { tags: ['wall'] }),
      box('arcade', 40, 300, 12, 12, { behaviors: [body('wall', { gravity: false, edges: 'none' })] }),
      box('real', 40, 700, 12, 12, { behaviors: [physics('moving', { gravity: false, edges: false, solidTag: 'wall', rotates: false })] }),
      box('fast', 40, 1000, 12, 12, { behaviors: [body('wall', { gravity: false, edges: 'none' })] }),
    ],
  }, () => {
    const g = window.__game;
    g.app.ticker.stop();
    const find = (id) => g.entities.find((e) => e.def.id === id);
    const [arcade, real, fast, wall] = ['arcade', 'real', 'fast', 'wall'].map(find);
    arcade.vx = 3000;
    real.vx = 3000;
    fast.vx = 12000;
    for (let i = 0; i < 60; i++) g.advance(1 / 60);
    g.app.ticker.start();
    return { arcade: arcade.x + arcade.width - wall.x, real: real.x + real.width - wall.x, fast: fast.x + fast.width - wall.x };
  });
  check(`an arcade body at 3000 px/s stops at a 10 px wall (${fmt(r.arcade)} px past its face, 0.5 allowed)`, r.arcade <= 0.5, JSON.stringify(r));
  check(`an arcade body at 12000 px/s stops there too (${fmt(r.fast)} px past its face)`, r.fast <= 0.5, JSON.stringify(r));
  check(`a real-physics ball at 3000 px/s stops at the wall (${fmt(r.real)} px past its face, 1 allowed)`, r.real <= 1, JSON.stringify(r));
}

// ── 3. Walking up and down a ramp ──────────────────────────────────────────
// Up a ramp 400 wide and 200 high, across the top, down the other side: the feet stay on the surface.
{
  const r = await lab('Ramp', {
    width: 2400,
    objects: [
      box('floor', 0, 1000, 2400, 280, { tags: ['ground'] }),
      box('up', 500, 800, 400, 200, { tags: ['ground'], slope: 'rise' }),
      box('top', 900, 800, 400, 200, { tags: ['ground'] }),
      box('down', 1300, 800, 400, 200, { tags: ['ground'], slope: 'fall' }),
      box('hero', 100, 920, 60, 80, { color: '#4fc3f7', behaviors: [body('ground'), { type: 'walker', speed: 300, control: 'auto', leftTag: '', rightTag: '' }] }),
    ],
  }, () => {
    const g = window.__game;
    g.app.ticker.stop();
    const hero = g.entities.find((e) => e.def.id === 'hero');
    // The highest ground under the feet, worked out from the scene itself.
    const support = (x, w) => {
      let y = 1000;
      if (x + w > 500 && x < 900) y = Math.min(y, 1000 - 200 * ((Math.min(x + w, 900) - 500) / 400));
      if (x + w > 900 && x < 1300) y = Math.min(y, 800);
      if (x + w > 1300 && x < 1700) y = Math.min(y, 800 + 200 * ((Math.max(x, 1300) - 1300) / 400));
      return y;
    };
    for (let i = 0; i < 20; i++) g.advance(1 / 60);
    let steps = 0, grounded = 0, floating = 0, sinking = 0;
    while (hero.x < 1900 && steps < 600) {
      g.advance(1 / 60);
      steps += 1;
      if (hero.grounded) grounded += 1;
      const gap = support(hero.x, hero.width) - (hero.y + hero.height);
      floating = Math.max(floating, gap);
      sinking = Math.max(sinking, -gap);
    }
    g.app.ticker.start();
    return { steps, grounded: grounded / steps, floating, sinking, x: hero.x };
  });
  check('the walker crosses the ramps', r.x >= 1900, JSON.stringify(r));
  check(`it stays on the ground going up and down (${fmt(r.grounded * 100)}% of frames, 97% needed)`, r.grounded >= 0.97, JSON.stringify(r));
  check(`its feet float at most 2 px above the slope (${fmt(r.floating)} px)`, r.floating <= 2, JSON.stringify(r));
  check(`its feet sink at most 1 px into the slope (${fmt(r.sinking)} px)`, r.sinking <= 1, JSON.stringify(r));
}

// ── 4. Standing on a moving platform ───────────────────────────────────────
// One platform goes left and right, a lift goes up and down; a body stands on each for 4 s.
{
  const r = await lab('Platform', {
    objects: [
      box('side', 100, 700, 200, 30, { tags: ['ground'], behaviors: [{ type: 'patrol', axis: 'x', distance: 300, speed: 150 }] }),
      box('lift', 450, 900, 200, 30, { tags: ['ground'], behaviors: [{ type: 'patrol', axis: 'y', distance: 250, speed: 120 }] }),
      box('rider', 170, 620, 60, 80, { color: '#4fc3f7', behaviors: [body('ground')] }),
      box('lifted', 520, 820, 60, 80, { color: '#ffd54f', behaviors: [body('ground')] }),
    ],
  }, () => {
    const g = window.__game;
    g.app.ticker.stop();
    const find = (id) => g.entities.find((e) => e.def.id === id);
    const [side, lift, rider, lifted] = ['side', 'lift', 'rider', 'lifted'].map(find);
    for (let i = 0; i < 30; i++) g.advance(1 / 60);
    const offset = rider.x - side.x, offsetLift = lifted.x - lift.x;
    let drift = 0, gap = 0, gapLift = 0, off = 0;
    for (let i = 0; i < 240; i++) {
      g.advance(1 / 60);
      drift = Math.max(drift, Math.abs(rider.x - side.x - offset), Math.abs(lifted.x - lift.x - offsetLift));
      gap = Math.max(gap, Math.abs(rider.y + rider.height - side.y));
      gapLift = Math.max(gapLift, Math.abs(lifted.y + lifted.height - lift.y));
      if (!rider.grounded || !lifted.grounded) off += 1;
    }
    g.app.ticker.start();
    return { drift, gap, gapLift, off };
  });
  check(`a rider moves with its platform (slides at most 1 px: ${fmt(r.drift)} px)`, r.drift <= 1, JSON.stringify(r));
  check(`it stays on a platform going sideways (gap at most 1 px: ${fmt(r.gap)} px)`, r.gap <= 1, JSON.stringify(r));
  check(`it stays on a lift going up and down (gap at most 1 px: ${fmt(r.gapLift)} px)`, r.gapLift <= 1, JSON.stringify(r));
  check(`it never leaves the platform or the lift (${r.off} frames off)`, r.off === 0, JSON.stringify(r));
}

// ── 5. A crate pushed into a corner ────────────────────────────────────────
// A walker pushes a crate into the corner of a wall and the floor and keeps pushing for 3 s.
{
  const r = await lab('Corner', {
    objects: [
      box('floor', 0, 1000, 720, 280, { tags: ['solid'] }),
      box('wall', 600, 600, 120, 400, { tags: ['solid'] }),
      box('crate', 300, 920, 80, 80, { color: '#a1887f', tags: ['solid'], behaviors: [body('solid', { pushable: true })] }),
      box('hero', 150, 920, 60, 80, { color: '#4fc3f7', behaviors: [body('solid'), { type: 'walker', speed: 250, control: 'auto', leftTag: '', rightTag: '' }] }),
    ],
  }, () => {
    const g = window.__game;
    g.app.ticker.stop();
    const find = (id) => g.entities.find((e) => e.def.id === id);
    const [hero, crate, wall, floor] = ['hero', 'crate', 'wall', 'floor'].map(find);
    for (let i = 0; i < 150; i++) g.advance(1 / 60);
    const at = { x: crate.x, y: crate.y, hx: hero.x };
    let into = 0, overlap = 0, sink = 0, jitter = 0;
    for (let i = 0; i < 180; i++) {
      g.advance(1 / 60);
      into = Math.max(into, crate.x + crate.width - wall.x);
      overlap = Math.max(overlap, hero.x + hero.width - crate.x);
      sink = Math.max(sink, crate.y + crate.height - floor.y);
      jitter = Math.max(jitter, Math.hypot(crate.x - at.x, crate.y - at.y), Math.abs(hero.x - at.hx));
    }
    g.app.ticker.start();
    return { into, overlap, sink, jitter, reached: wall.x - (crate.x + crate.width) };
  });
  check(`the crate is pushed all the way into the corner (${fmt(r.reached)} px short, 0.5 allowed)`, Math.abs(r.reached) <= 0.5, JSON.stringify(r));
  check(`it does not go into the wall (${fmt(r.into)} px, 0 allowed)`, r.into <= 0.01, JSON.stringify(r));
  check(`the pusher does not go into the crate (${fmt(r.overlap)} px)`, r.overlap <= 0.01, JSON.stringify(r));
  check(`nothing sinks into the floor (${fmt(r.sink)} px)`, r.sink <= 0.01, JSON.stringify(r));
  check(`crate and pusher hold still in the corner (jitter ${fmt(r.jitter)} px, 0.01 allowed)`, r.jitter <= 0.01, JSON.stringify(r));
}

// ── 6. One idea of touching ────────────────────────────────────────────────
// A hero with a hitbox inset standing on the ground touches it (it never did); a hidden object touches nothing.
{
  const r = await lab('Touch', {
    rules: [
      { id: 't', when: { type: 'touch', a: { by: 'id', id: 'hero' }, b: { by: 'tag', tag: 'ground' } }, condition: null, then: [{ type: 'setVariable', name: 'hits', op: 'add', amount: 1 }] },
      { id: 'h', when: { type: 'touch', a: { by: 'id', id: 'hero2' }, b: { by: 'id', id: 'ghost' } }, condition: null, then: [{ type: 'setVariable', name: 'hits', op: 'add', amount: 100 }] },
    ],
    objects: [
      box('floor', 0, 1000, 720, 280, { tags: ['ground'] }),
      box('hero', 100, 900, 60, 80, { hitboxInset: 10, behaviors: [body('ground')] }),
      box('ghost', 400, 900, 100, 100, { visible: false }),
      box('hero2', 420, 920, 60, 60),
    ],
  }, () => {
    const g = window.__game;
    g.app.ticker.stop();
    for (let i = 0; i < 90; i++) g.advance(1 / 60);
    g.app.ticker.start();
    return { hits: g.getState().variables.hits, grounded: g.entities.find((e) => e.def.id === 'hero').grounded };
  });
  check('a hero with a hitbox inset standing on the ground touches it (once)', r.grounded && r.hits === 1, JSON.stringify(r));
}

// ── 7. The broadphase gives the same answers as looking at every pair ──────
// 300 coins scattered, a player walking through them: every touch the grid finds is one a full search finds.
{
  const coins = [];
  for (let i = 0; i < 300; i++) coins.push(box(`coin${i}`, (i * 97) % 2300, 200 + ((i * 53) % 900), 30, 30, { tags: ['coin'], color: '#ffd54f' }));
  const r = await lab('Broadphase', {
    width: 2400, gravity: 0,
    rules: [{ id: 'c', when: { type: 'touch', a: { by: 'id', id: 'p' }, b: { by: 'tag', tag: 'coin' } }, condition: null, then: [{ type: 'setVariable', name: 'hits', op: 'add', amount: 1 }, { type: 'destroy', target: 'second' }] }],
    objects: [box('p', 0, 200, 80, 900, { behaviors: [{ type: 'mover', vx: 400, vy: 0, speedVariable: '', atEdge: 'nothing' }] }), ...coins],
  }, () => {
    const g = window.__game;
    g.app.ticker.stop();
    const p = g.entities.find((e) => e.def.id === 'p');
    // Every coin lies across the player's path; some may already be taken before the clock was stopped.
    const expected = 300;
    for (let i = 0; i < 400; i++) g.advance(1 / 60);
    g.app.ticker.start();
    return { hits: g.getState().variables.hits, expected, x: p.x, left: g.entities.filter((e) => e.def.tags.includes('coin') && e.alive).length, builds: g.contacts.builds };
  });
  check(`the player picks up every coin it passes (${r.hits} of ${r.expected})`, r.hits === r.expected && r.left === 300 - r.expected, JSON.stringify(r));
}

await browser.close();
finish();
