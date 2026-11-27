// Screen framing (roadmap Phase 1): every genre game (Sky Quest is the platform one), made fresh by the editor,
// played in the real player on four screen shapes, filled to the edges: a 9:16, a 9:19.5 and a 9:21 phone and a
// 3:4 tablet. Checks that
// - a level with on-screen buttons keeps a controls area for them, and the hero and the ground it stands on are
//   above it, never under a button;
// - on a tall phone a scrolling level is drawn larger instead of adding empty sky;
// - on the menus, win, game-over and levels screens nothing is off the screen and nothing covers the title.
// Run `npm run build` first. Pictures of failures go to test-output/framing-*.png.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { check, finish, launch, openPage, root, shots } from './lib.mjs';

const GENRES = ['platform', 'adventure', 'shooter', 'puzzle', 'physics', 'rescue', 'tower', 'bricks', 'runner', 'hopper'];
const SHAPES = [
  { name: '9:16', width: 405, height: 720 },
  { name: '9:19.5', width: 390, height: 845 },
  { name: '9:21', width: 360, height: 840 },
  { name: 'tablet', width: 768, height: 1024 },
];
// The games, as the genre helper makes them (the same as the bots play).
const made = spawnSync(process.execPath, [resolve(root, 'scripts/bots/export.mjs'), GENRES.join(',')], { encoding: 'utf8' });
if (made.status !== 0) {
  console.log(made.stdout, made.stderr);
  process.exit(1);
}

/** Everything on view on the screen, in screen pixels of the game: fixed things as they are, the world through the camera. */
const onView = () => {
  const g = window.__game;
  const z = g.z;
  return {
    view: { ...g.view },
    frame: g.getState().frame,
    things: g.entities
      .filter((e) => e.alive && e.visible && (e.def.opacity ?? 1) > 0.05 && e.view.alpha > 0.05)
      .map((e) => {
        const b = g.boxOf(e);
        const box = e.def.fixed ? b : { x: (b.x - g.camera.x) * z, y: (b.y - g.camera.y) * z, width: b.width * z, height: b.height * z };
        const v = e.def.visual;
        // A line of text counts by its letters, not by its glow or shadow (which reach past the line under it).
        if (v.kind === 'text') {
          const middle = box.y + box.height / 2;
          box.height = Math.min(box.height, v.size * 1.15 * (e.def.fixed ? 1 : z));
          box.y = middle - box.height / 2;
        }
        return { name: e.def.name, fixed: Boolean(e.def.fixed), text: v.kind === 'text' ? v.text : null, size: v.kind === 'text' ? v.size : 0, hero: e.def.behaviors.some((x) => x.type === 'camera'), ...box };
      }),
  };
};
/** Two things overlap by more than a touch: a tenth of the smaller one (a title's glow brushing the line under it is not). */
const meets = (a, b) => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 && w * h > 0.1 * Math.min(a.width * a.height, b.width * b.height);
};
const holds = (a, p) => p.x >= a.x && p.x <= a.x + a.width && p.y >= a.y && p.y <= a.y + a.height;

const browser = await launch();
for (const genre of GENRES) {
  const project = JSON.parse(readFileSync(resolve(root, `scripts/bots/games/${genre}.json`), 'utf8'));
  const { width: W, height: H } = project.meta;
  const level = project.scenes[0];
  const screens = project.scenes.filter((s) => ['Start', 'Levels', 'You win', 'Game over'].includes(s.name));
  for (const shape of SHAPES) {
    const { page, errors } = await openPage(browser, pathToFileURL(resolve(root, 'dist/index.html')).href, { project, viewport: { width: shape.width, height: shape.height, deviceScaleFactor: 1 }, fill: true });
    await page.waitForFunction(() => window.__game, { timeout: 60000 });
    // (A conversation pauses the game and holds the scene: it is tapped through, as a player does. A level's
    // opening look at its goal, a camera "focus", is waited out.)
    const goTo = (id, frames) => page.evaluate(([id, n]) => {
      const g = window.__game;
      g.app.ticker.stop();
      g.nextScene = id;
      for (let i = 0; i < n + 3000 && (i < n || g.dialogue || (g.focus && g.focus.left > 0)); i++) {
        // (A conversation's words come in by the wall clock, not the game's: shown at once, then tapped away.)
        if (g.dialogue && i % 20 === 0) { g.dialogue.since = -1e9; g.keyTap = true; }
        g.advance(1 / 60);
      }
      // (And the camera's glide back from that look.)
      for (let i = 0; i < 90; i++) g.advance(1 / 60);
    }, [id, frames]);
    const where = `${genre} on ${shape.name}`;
    const photo = (name) => page.screenshot({ path: resolve(shots, `framing-${genre}-${shape.name.replace(':', 'x')}-${name}.png`) });

    // The level.
    await goTo(level.id, 120);
    const l = await page.evaluate(onView);
    const hero = l.things.find((t) => t.hero);
    const hasButtons = ['platform', 'tower', 'adventure'].includes(genre);
    if (hasButtons) {
      const top = l.view.height - l.frame.strip;
      const ok = l.frame.strip > 0 && hero && hero.y + hero.height <= top;
      check(`${where}: the level keeps a controls area, the hero above it`, ok, JSON.stringify({ strip: l.frame.strip, heroBottom: hero && Math.round(hero.y + hero.height), top }));
      if (!ok) await photo('level');
    }
    if (['runner', 'hopper'].includes(genre) && shape.name === '9:19.5') {
      check(`${where}: a tall phone shows the level larger, not more sky`, l.frame.zoom > 1.1, JSON.stringify(l.frame));
    }
    if (shape.name === '9:16') check(`${where}: on the design's own shape nothing is enlarged`, l.frame.zoom === 1 || genre === 'adventure', JSON.stringify(l.frame));

    // The menus.
    for (const s of screens) {
      await goTo(s.id, 150);
      const m = await page.evaluate(onView);
      const { width: vw, height: vh } = m.view;
      // Whole-screen things (covers, backdrops, the invisible rows that lay out buttons) are not in the way of anything.
      const things = m.things.filter((t) => !(t.width >= vw * 0.85 && t.height >= vh * 0.5) && t.width < vw * 0.98);
      // (Fixed things, the buttons and words; a world backdrop may reach past the edges.)
      const off = things.filter((t) => t.fixed).filter((t) => t.x < -2 || t.y < -2 || t.x + t.width > vw + 2 || t.y + t.height > vh + 2);
      check(`${where}, ${s.name}: nothing off the screen`, off.length === 0, off.map((t) => `${t.name} ${Math.round(t.x)},${Math.round(t.y)} ${Math.round(t.width)}×${Math.round(t.height)}`).join(' | '));
      const title = things.filter((t) => t.text && t.y < vh * 0.4).sort((a, b) => b.size - a.size)[0];
      const over = title ? things.filter((t) => t !== title && meets(t, title) && !holds(t, { x: title.x + title.width / 2, y: title.y + title.height / 2 })) : [];
      check(`${where}, ${s.name}: nothing over the title`, over.length === 0, `${title?.text}: ${over.map((t) => t.name).join(', ')}`);
      if (off.length || over.length) await photo(s.name.replace(' ', '-'));
    }
    check(`${where}: no errors`, errors.length === 0, errors.join(' | '));
    await page.close();
  }
}
await browser.close();
finish();
