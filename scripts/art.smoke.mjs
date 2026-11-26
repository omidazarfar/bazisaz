// Professional art in the engine (flagship Phase B): sprite sheets and atlases (TexturePacker JSON, Aseprite JSON
// with tags, Starling XML) cut into pictures with their animations; autotile sets fitted to neighbours; nine-slice
// pictures; and the flagship (Sky Quest) built from Kenney's CC0 pack. Run `npm run build` first.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { check, finish, launch, openPage, root, shots, until } from './lib.mjs';

/** A 4×4 picture of one colour, as a data URL made here (no canvas in node): a tiny BMP is enough for the player. */
const solid = (r, g, b) => {
  const px = [b, g, r, 255];
  const header = Buffer.alloc(54);
  header.write('BM');
  header.writeUInt32LE(54 + 64, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(4, 18);
  header.writeInt32LE(4, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(32, 28);
  const data = Buffer.alloc(64);
  for (let i = 0; i < 16; i++) Buffer.from(px).copy(data, i * 4);
  return `data:image/bmp;base64,${Buffer.concat([header, data]).toString('base64')}`;
};
/** A picture `w` × `h` coloured by `colour(x, y)` → [r, g, b], as a BMP data URL (rows from the bottom, as BMP keeps them). */
const painted = (w, h, colour) => {
  const header = Buffer.alloc(54);
  header.write('BM');
  header.writeUInt32LE(54 + w * h * 4, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(w, 18);
  header.writeInt32LE(h, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(32, 28);
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = colour(x, h - 1 - y);
    Buffer.from([b, g, r, 255]).copy(data, (y * w + x) * 4);
  }
  return `data:image/bmp;base64,${Buffer.concat([header, data]).toString('base64')}`;
};

const browser = await launch();
const editorUrl = pathToFileURL(resolve(root, 'dist-editor/editor.html')).href;
const playerUrl = pathToFileURL(resolve(root, 'dist/index.html')).href;

// ── Atlases, read and cut in the editor ────────────────────────────────────
const { page, errors } = await openPage(browser, editorUrl, { viewport: { width: 1440, height: 900 } });
await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
const results = await page.evaluate(async () => {
  // A sheet of four 16×16 squares in a row: red, green, blue, yellow.
  const colours = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
  const sheet = document.createElement('canvas');
  sheet.width = 64;
  sheet.height = 16;
  const ctx = sheet.getContext('2d');
  colours.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * 16, 0, 16, 16); });
  const src = sheet.toDataURL('image/png');
  const project = window.__editor.getState().project;
  const pixel = async (dataUrl, x, y) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return { size: [img.naturalWidth, img.naturalHeight], rgba: [...g.getImageData(x, y, 1, 1).data] };
  };
  const frame = (i) => ({ frame: { x: i * 16, y: 0, w: 16, h: 16 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 16, h: 16 }, sourceSize: { w: 16, h: 16 }, duration: 125 });
  // Aseprite: a hash of frames and two tags.
  const aseprite = JSON.stringify({
    frames: { 'hero 0.aseprite': frame(0), 'hero 1.aseprite': frame(1), 'hero 2.aseprite': frame(2), 'hero 3.aseprite': frame(3) },
    meta: { image: 'hero.png', frameTags: [{ name: 'Idle', from: 0, to: 1, direction: 'forward' }, { name: 'Run', from: 2, to: 3, direction: 'forward' }] },
  });
  const a = await window.__editor.agent.importAtlas(project, src, aseprite, 'hero');
  // TexturePacker: an array, with one frame trimmed (an 8×8 piece set at 4,4 in a 16×16 picture).
  const packer = JSON.stringify({ frames: [
    { filename: 'coin.png', ...frame(1) },
    { filename: 'spark.png', frame: { x: 48, y: 0, w: 8, h: 8 }, rotated: false, trimmed: true, spriteSourceSize: { x: 4, y: 4, w: 8, h: 8 }, sourceSize: { w: 16, h: 16 } },
  ], meta: { image: 'items.png' } });
  const b = await window.__editor.agent.importAtlas(project, src, packer, 'items');
  // Starling / Kenney XML, frames named like Kenney's: walk_a, walk_b, jump, hit.
  const xml = `<TextureAtlas imagePath="kid.png">
    <SubTexture name="kid_idle" x="0" y="0" width="16" height="16"/>
    <SubTexture name="kid_walk_a" x="16" y="0" width="16" height="16"/>
    <SubTexture name="kid_walk_b" x="32" y="0" width="16" height="16"/>
    <SubTexture name="kid_jump" x="48" y="0" width="16" height="16"/>
  </TextureAtlas>`;
  const c = await window.__editor.agent.importAtlas(project, src, xml, 'kid');
  return {
    aseprite: { keys: Object.keys(a.keys), animations: a.animations, visual: a.visual, run: await pixel(a.project.assets[a.keys['hero 2']].src, 8, 8) },
    packer: { keys: Object.keys(b.keys), spark: await pixel(b.project.assets[b.keys.spark].src, 8, 8), sparkCorner: await pixel(b.project.assets[b.keys.spark].src, 1, 1) },
    xml: { keys: Object.keys(c.keys), animations: c.animations, jump: await pixel(c.project.assets[c.keys.kid_jump].src, 8, 8) },
  };
});
check('Aseprite JSON: four frames become four pictures', results.aseprite.keys.length === 4, JSON.stringify(results.aseprite.keys));
check('Aseprite tags become animations (Idle → rest, Run → run) at its frame times (8 a second)',
  results.aseprite.animations.rest?.length === 2 && results.aseprite.animations.run?.length === 2 && results.aseprite.animations.fps === 8, JSON.stringify(results.aseprite.animations));
check('the run frame is cut from the right place (blue)', results.aseprite.run.rgba.join() === '0,0,255,255', JSON.stringify(results.aseprite.run));
check('an object made from it rests and runs', results.aseprite.visual.frames?.length === 1 && results.aseprite.visual.moveFrames?.length === 2 && results.aseprite.visual.flip === true, JSON.stringify(results.aseprite.visual));
check('TexturePacker JSON array: each frame a picture', results.packer.keys.join() === 'coin,spark', results.packer.keys.join());
check('a trimmed frame goes back into its full size, in its place (16×16, the piece in the middle)',
  results.packer.spark.size.join() === '16,16' && results.packer.spark.rgba.join() === '255,255,0,255' && results.packer.sparkCorner.rgba[3] === 0, JSON.stringify(results.packer));
check('Starling / Kenney XML: frames named walk_a, walk_b and jump become run and jump',
  results.xml.keys.length === 4 && results.xml.animations.run?.length === 2 && results.xml.animations.jump?.length === 1 && results.xml.animations.rest?.length === 1, JSON.stringify(results.xml.animations));
check('…and the jump frame is the yellow one', results.xml.jump.rgba.join() === '255,255,0,255', JSON.stringify(results.xml.jump));
check('atlas import: no errors in the page', errors.length === 0, errors.join(' | '));

// ── The flagship, made by the genre helper from Kenney's pack ──────────────
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('بازی جدید'))?.click());
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('بله، بازی خالی'))?.click());
await new Promise((r) => setTimeout(r, 300));
await page.click('[data-library="objects"]');
await page.click('[data-library-tab="genre"]');
await page.click('[data-genre="platform"]');
await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 120000 });
const flagship = await page.evaluate(() => window.__editor.getState().project);
const level = flagship.scenes[0];
const hero = level.objects.find((o) => o.tags.includes('بازیکن'));
const map = level.objects.find((o) => o.visual.kind === 'tiles');
const kenney = Object.keys(flagship.assets).filter((k) => k.startsWith('kenney-'));
check('the flagship is drawn with Kenney\'s pack (pictures and sounds)', kenney.length >= 40, `${kenney.length} pictures`);
check('its hero rests, walks, jumps and gets hurt in Kenney\'s frames', hero?.visual.asset.startsWith('kenney-character-beige') && hero.visual.moveFrames?.length === 2 && hero.visual.airFrames?.length === 1 && hero.visual.hurtFrames?.length === 1, JSON.stringify(hero?.visual));
const kindNamed = (name) => Object.values(map?.visual.kinds ?? {}).find((k) => k.name === name);
check('its ground and stone are autotile sets of 16', kindNamed('زمین چمنی')?.autotile?.length === 16 && kindNamed('سنگ')?.autotile?.length === 16, JSON.stringify(Object.values(map?.visual.kinds ?? {}).map((k) => k.name)));
const problems = await page.evaluate((p) => window.__editor.agent.check(p).problems, flagship);
check('the flagship checks clean', problems.length === 0, problems.join(' | '));
await page.close();

// ── Autotile and nine-slice in the player ──────────────────────────────────
{
  const assets = {};
  for (let i = 0; i < 16; i++) assets[`t${i}`] = { type: 'image', src: solid(i * 16, 255 - i * 16, 128) };
  assets.panel = { type: 'image', src: solid(40, 90, 200) };
  const project = {
    formatVersion: 3, lists: [],
    meta: { name: 'Art', orientation: 'portrait', width: 720, height: 1280, background: '#202833', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.art', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets, variables: [], startScene: 's',
    scenes: [{
      id: 's', name: 's', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [], rules: [],
      objects: [
        // A 3×3 block, a row of 3 below it, a lone cell: the centre gets picture 15, a row's middle 10, a lone cell 0.
        { id: 'map', name: 'map', x: 0, y: 0, width: 400, height: 500, tags: [], visible: true, behaviors: [],
          visual: { kind: 'tiles', cell: 80, rows: ['ggg.', 'ggg.', 'ggg.', '....', 'ggg.', '....', '...g'], kinds: { g: { name: 'g', color: '#00ff00', tags: ['ground'], separate: true, autotile: Object.keys(assets).filter((k) => k !== 'panel') } } } },
        { id: 'panel', name: 'panel', x: 100, y: 800, width: 500, height: 300, tags: [], visible: true, behaviors: [],
          visual: { kind: 'image', asset: 'panel', slice: { left: 1, top: 1, right: 1, bottom: 1 } } },
      ],
    }],
  };
  const { page, errors } = await openPage(browser, playerUrl, { project });
  await until(page, () => window.__game, null, 30000);
  const r = await page.evaluate(() => {
    const g = window.__game;
    const pictureOf = (x, y) => {
      const e = g.entities.find((e) => e.def.id === 'map' && Math.abs(e.x - x) < 1 && Math.abs(e.y - y) < 1);
      const texture = e?.view.children?.[0]?.texture;
      return [...g.textures.entries()].find(([, t]) => t.texture === texture)?.[0] ?? null;
    };
    const panel = g.entities.find((e) => e.def.id === 'panel');
    return {
      centre: pictureOf(80, 80), topLeft: pictureOf(0, 0), bottomRight: pictureOf(160, 160), rowMiddle: pictureOf(80, 320), rowLeft: pictureOf(0, 320), lone: pictureOf(240, 480),
      panel: { nine: 'leftWidth' in panel.view && panel.view.leftWidth === 1, width: panel.view.width, height: panel.view.height },
    };
  });
  check('autotile: the middle of a block shows picture 15 (all four neighbours)', r.centre === 't15', JSON.stringify(r));
  check('autotile: the top-left corner shows 6 (right and below), the bottom-right 9 (above and left)', r.topLeft === 't6' && r.bottomRight === 't9', JSON.stringify(r));
  check('autotile: a row\'s middle shows 10, its left end 2, a lone cell 0', r.rowMiddle === 't10' && r.rowLeft === 't2' && r.lone === 't0', JSON.stringify(r));
  check('nine-slice: the panel stretches to its size as nine pieces', r.panel.nine && Math.round(r.panel.width) === 500 && Math.round(r.panel.height) === 300, JSON.stringify(r.panel));
  await page.screenshot({ path: resolve(shots, 'art-autotile-nineslice.png') });
  check('autotile and nine-slice: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── Character animation (flagship Phase C): nested bones, and animations that fade into each other ──
{
  const rect = (id, x, y, w, h, ext = {}) => ({ id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#ffffff' }, tags: [], visible: true, behaviors: [], ...ext });
  const turning = (degrees) => ({ type: 'animate', repeat: 'loop', ease: 'linear', keys: [{ t: 0, x: 0, y: 0, angle: 0, scale: 1, opacity: 1 }, { t: 1, x: 0, y: 0, angle: degrees, scale: 1, opacity: 1 }] });
  const project = {
    formatVersion: 3, lists: [],
    meta: { name: 'Bones', orientation: 'portrait', width: 720, height: 1280, background: '#202833', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.bones', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: { a: { type: 'image', src: solid(255, 0, 0) }, b: { type: 'image', src: solid(0, 0, 255) } },
    variables: [], startScene: 's',
    scenes: [{
      id: 's', name: 's', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [], rules: [],
      // Listed child first: it must still move after its parent, however deep.
      objects: [
        rect('hand', 0, 0, 20, 40, { tags: ['hand'], behaviors: [{ type: 'attach', targetTag: 'arm', offsetX: 0, offsetY: 100, followAngle: true }] }),
        rect('arm', 0, 0, 20, 100, { tags: ['arm'], behaviors: [{ type: 'attach', targetTag: 'body', offsetX: 90, offsetY: 100, followAngle: true }] }),
        rect('body', 260, 400, 200, 200, { tags: ['body'], behaviors: [turning(90)] }),
        // A runner whose resting and walking pictures fade into each other over 0.2 s.
        { ...rect('runner', 300, 900, 80, 80), visual: { kind: 'image', asset: 'a', moveFrames: ['b'], blend: 0.2 }, behaviors: [{ type: 'walker', speed: 200, control: 'buttons', leftTag: '', rightTag: '' }] },
      ],
    }],
  };
  const { page, errors } = await openPage(browser, playerUrl, { project });
  await until(page, () => window.__game, null, 30000);
  const r = await page.evaluate(() => {
    const g = window.__game;
    g.app.ticker.stop();
    const find = (id) => g.entities.find((e) => e.def.id === id);
    const [body, arm, hand, runner] = ['body', 'arm', 'hand', 'runner'].map(find);
    const fadingAt = [];
    // Standing still, then walking: the resting picture fades out under the walking one.
    for (let i = 0; i < 10; i++) g.advance(1 / 60);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
    for (let i = 0; i < 6; i++) {
      g.advance(1 / 60);
      fadingAt.push(runner.fading ? Math.round((runner.fading.sprite.alpha) * 100) / 100 : null);
    }
    // Half a second: the body has turned 45°.
    for (let i = 0; i < 24; i++) g.advance(1 / 60);
    const centre = (e) => ({ x: e.x + e.width / 2, y: e.y + e.height / 2 });
    // Where each should be, from its parent's middle and turn.
    const expect = (parent, child, ox, oy) => {
      const c = centre(parent);
      const lx = ox + child.width / 2 - parent.width / 2;
      const ly = oy + child.height / 2 - parent.height / 2;
      return { x: c.x + lx * Math.cos(parent.angle) - ly * Math.sin(parent.angle), y: c.y + lx * Math.sin(parent.angle) + ly * Math.cos(parent.angle) };
    };
    const off = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const result = {
      bodyAngle: (body.angle * 180) / Math.PI,
      armAngle: (arm.angle * 180) / Math.PI,
      handAngle: (hand.angle * 180) / Math.PI,
      armOff: off(centre(arm), expect(body, arm, 90, 100)),
      handOff: off(centre(hand), expect(arm, hand, 0, 100)),
      fadingAt,
      fadingLater: runner.fading ? 'still there' : null,
    };
    g.app.ticker.start();
    return result;
  });
  check('nested bones: the arm turns with the body, and the hand with the arm', Math.abs(r.armAngle - r.bodyAngle) < 0.01 && Math.abs(r.handAngle - r.bodyAngle) < 0.01 && r.bodyAngle > 40, JSON.stringify(r));
  check('nested bones: each keeps its place on its parent as it turns, with no step of lag (within 0.5 px)', r.armOff < 0.5 && r.handOff < 0.5, JSON.stringify(r));
  check('animations fade into each other: the old picture fades out over the blend time, then goes', r.fadingAt.some((a) => a !== null && a > 0 && a < 1) && r.fadingLater === null, JSON.stringify(r.fadingAt));
  check('bones and blending: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── The UI kit (flagship Phase D): anchors, entrances, a row laid out, a font, a slider ──
{
  const fixedRect = (id, x, y, w, h, ext = {}) => ({ id, name: id, x, y, width: w, height: h, visual: { kind: 'rect', color: '#ffffff' }, tags: [], visible: true, behaviors: [], fixed: true, ...ext });
  const project = {
    formatVersion: 3, lists: [],
    meta: { name: 'UiKit', orientation: 'portrait', width: 720, height: 1280, background: '#202833', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.uikit', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {}, variables: [{ name: 'v', initial: 0, saved: false }], startScene: 's',
    scenes: [{
      id: 's', name: 's', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [], rules: [],
      objects: [
        fixedRect('pause', 620, 20, 90, 90, { anchor: 'top-right' }),
        fixedRect('bar', 0, 1180, 720, 100, { anchor: 'bottom' }),
        fixedRect('high', 300, 1000, 60, 60, { anchor: 'top' }),
        fixedRect('panel', 160, 400, 400, 300, { behaviors: [{ type: 'layout', tag: 'item', direction: 'row', gap: 20 }] }),
        fixedRect('i1', 10, 10, 80, 80, { tags: ['item'] }),
        fixedRect('i2', 600, 700, 80, 80, { tags: ['item'] }),
        fixedRect('i3', 300, 1100, 80, 80, { tags: ['item'] }),
        fixedRect('popper', 320, 800, 80, 80, { enter: { kind: 'pop', delay: 0.3, seconds: 0.3 } }),
        fixedRect('slider', 100, 300, 80, 40, { enter: { kind: 'from-left', seconds: 0.4 } }),
        { ...fixedRect('title', 0, 0, 0, 0), x: 360, y: 200, visual: { kind: 'text', text: 'HELLO', color: '#ffffff', size: 60, font: 'Kenney Future' } },
        fixedRect('track', 200, 900, 300, 20, { tags: ['track'] }),
        fixedRect('knob', 200, 890, 40, 40, { behaviors: [{ type: 'slider', trackTag: 'track', sets: 'value', variable: 'v', min: 0, max: 100 }] }),
      ],
    }],
  };
  // A tall phone, filled to its edges.
  {
    const { page, errors } = await openPage(browser, playerUrl, { project, viewport: { width: 400, height: 866, deviceScaleFactor: 1 }, fill: true });
    await until(page, () => window.__game, null, 30000);
    const r = await page.evaluate(() => {
      const g = window.__game;
      g.app.ticker.stop();
      const find = (id) => g.entities.find((e) => e.def.id === id);
      const early = [];
      for (let i = 0; i < 6; i++) {
        g.advance(1 / 60);
        early.push({ popper: Math.round(find('popper').scale * 100) / 100, slider: Math.round(find('slider').x) });
      }
      for (let i = 0; i < 60; i++) g.advance(1 / 60);
      const items = ['i1', 'i2', 'i3'].map(find);
      const panel = find('panel');
      const left = Math.min(...items.map((e) => e.x));
      const right = Math.max(...items.map((e) => e.x + e.width));
      const title = find('title');
      g.app.ticker.start();
      return {
        view: { w: g.view.width, h: g.view.height },
        pause: [find('pause').x, find('pause').y], bar: find('bar').y, high: find('high').y,
        rowCentre: (left + right) / 2, panelCentre: panel.x + panel.width / 2, rowY: items.map((e) => Math.round(e.y + e.height / 2)), panelY: Math.round(panel.y + panel.height / 2),
        gaps: [items[1].x - (items[0].x + items[0].width), items[2].x - (items[1].x + items[1].width)].map(Math.round),
        early, popper: find('popper').scale, slider: find('slider').x,
        font: String(title.view.style?.fontFamily ?? ''),
      };
    });
    const moreH = r.view.h - 1280;
    check('the tall phone gives the game more height to lay out', moreH > 100, JSON.stringify(r.view));
    check('anchors: "top-right" stays at the top, "bottom" moves to the bottom, "top" stays up although low on the screen',
      r.pause[1] === 20 && Math.abs(r.bar - (1180 + moreH)) < 1 && r.high === 1000, JSON.stringify(r));
    check('layout: the row is centred in the panel, at its middle height, 20 px apart', Math.abs(r.rowCentre - r.panelCentre) < 1 && r.rowY.every((y) => Math.abs(y - r.panelY) <= 1) && r.gaps.every((g) => g === 20), JSON.stringify(r));
    check('entrances: a pop waits its delay at nothing, then grows to full size', r.early.slice(0, 4).every((e) => e.popper === 0) && Math.abs(r.popper - 1) < 0.01, JSON.stringify(r.early));
    check('entrances: a slide from the left starts off the screen and ends in its place', r.early[0].slider < 0 && Math.abs(r.slider - 100) < 0.5, JSON.stringify(r.early));
    check('a text can have its own font (Kenney Future)', r.font.includes('Kenney Future'), r.font);
    await page.screenshot({ path: resolve(shots, 'ui-kit.png') });
    check('UI kit: no errors in the page', errors.length === 0, errors.join(' | '));
    await page.close();
  }
  // The design shape, for dragging the slider with a finger.
  {
    const { page, errors } = await openPage(browser, playerUrl, { project });
    await until(page, () => window.__game && window.__game.getState().time > 0.5, null, 30000);
    const { toPage } = await import('./lib.mjs');
    const drag = async (x) => {
      await page.mouse.move(...(await toPage(page, 220, 910)));
      await page.mouse.down();
      await page.mouse.move(...(await toPage(page, x, 910)), { steps: 6 });
      await until(page, () => true);
      await new Promise((r) => setTimeout(r, 300));
      const v = await page.evaluate(() => window.__game.getState().variables.v);
      await page.mouse.up();
      return v;
    };
    const full = await drag(560);
    const half = await drag(370);
    check('a slider dragged to its right end sets its value to the most (100)', full === 100, `v ${full}`);
    check('…and dragged to the middle, about half (40–60)', half >= 40 && half <= 60, `v ${half}`);
    check('slider: no errors in the page', errors.length === 0, errors.join(' | '));
    await page.close();
  }
}

// ── Level tools (flagship Phase E): a Tiled map imported, materials that keep their edges, five levels ──
{
  // A Tiled map 4×3 cells of 16 px: a row of ground (tile 1, red) under a block of stone (tile 2, blue), one tile
  // flipped (Tiled's top bits), and an object layer with a box of class "coin" and a tile object (stone).
  const FLIP = 0x80000000;
  const tmj = JSON.stringify({
    type: 'map', width: 4, height: 3, tilewidth: 16, tileheight: 16, infinite: false, orientation: 'orthogonal',
    properties: [{ name: 'title', type: 'string', value: 'Test' }],
    tilesets: [{ firstgid: 1, name: 'test', image: 'test-tiles.png', imagewidth: 32, imageheight: 16, columns: 2, tilewidth: 16, tileheight: 16, margin: 0, spacing: 0, tilecount: 2,
      tiles: [{ id: 0, class: 'ground' }, { id: 1, class: 'stone', properties: [{ name: 'tags', type: 'string', value: 'rock,hard' }] }] }],
    layers: [
      { type: 'tilelayer', name: 'land', width: 4, height: 3, visible: true, data: [0, 0, 2, 0, 0, 0, 2, 0, 1, 1, 1 | FLIP, 1] },
      { type: 'objectgroup', name: 'things', visible: true, objects: [
        { id: 1, name: 'c', class: 'coin', x: 8, y: 4, width: 12, height: 12, properties: [{ name: 'value', type: 'int', value: 5 }] },
        { id: 2, name: 'rock', gid: 2, x: 32, y: 48, width: 16, height: 16 },
      ] },
    ],
  });
  const sheet = painted(32, 16, (x) => (x < 16 ? [255, 0, 0] : [0, 0, 255]));
  const { page, errors } = await openPage(browser, editorUrl, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
  const r = await page.evaluate(async ({ tmj, sheet }) => {
    const state = window.__editor.getState();
    const made = await window.__editor.agent.importTiled(state.project, state.sceneId, tmj, { 'test-tiles.png': sheet });
    const scene = made.project.scenes.find((s) => s.id === state.sceneId);
    const map = scene.objects.find((o) => o.visual.kind === 'tiles' && o.name === 'land');
    const coin = scene.objects.find((o) => o.tags.includes('coin'));
    const rock = scene.objects.find((o) => o.name === 'rock');
    const colour = async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = 4;
      c.getContext('2d').drawImage(img, 8, 8, 1, 1, 0, 0, 1, 1);
      return [...c.getContext('2d').getImageData(0, 0, 1, 1).data].slice(0, 3).join(',');
    };
    const kinds = Object.values(map.visual.kinds);
    return {
      maps: made.maps, things: made.things, rows: map.visual.rows, names: kinds.map((k) => k.name), tags: kinds.map((k) => k.tags.join('/')),
      groundColour: await colour(made.project.assets[kinds.find((k) => k.name === 'ground').asset].src),
      stoneColour: await colour(made.project.assets[kinds.find((k) => k.name === 'stone').asset].src),
      coin: coin && [coin.x, coin.y, coin.width, coin.height], rock: rock && [rock.x, rock.y, rock.visual.kind],
      problems: window.__editor.agent.check(made.project).problems,
    };
  }, { tmj, sheet });
  check('Tiled: a tile layer becomes a tile map, rows as in the map, the flipped tile the same kind', r.maps === 1 && r.rows.join('|') === '..a|..a|bbbb', JSON.stringify(r.rows));
  check('Tiled: tiles are told apart by class, their tags from their properties', r.names.join() === 'stone,ground' && r.tags.join() === 'rock/hard,ground', JSON.stringify(r));
  check('Tiled: each tile\'s picture is cut from the tileset\'s (red ground, blue stone)', r.groundColour === '255,0,0' && r.stoneColour === '0,0,255', JSON.stringify(r));
  check('Tiled: objects come in their class\'s group at their place; a tile object stands on its bottom-left corner', r.things === 2 && r.coin.join() === '8,4,12,12' && r.rock.join() === '32,32,image', JSON.stringify(r));
  check('Tiled: the imported level checks clean', r.problems.length === 0, r.problems.join(' | '));
  check('Tiled import: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}
{
  // Materials that keep their edges: a stone cell (joins only stone) inside grass (joins everything).
  const assets = {};
  for (let i = 0; i < 16; i++) assets[`t${i}`] = { type: 'image', src: solid(i * 16, 100, 100) };
  const list = Object.keys(assets);
  const project = {
    formatVersion: 3, lists: [],
    meta: { name: 'Joins', orientation: 'portrait', width: 720, height: 1280, background: '#202833', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.joins', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets, variables: [], startScene: 's',
    scenes: [{
      id: 's', name: 's', width: 720, height: 1280, background: null, music: null, gravity: 0, prefabs: [], rules: [],
      objects: [{ id: 'map', name: 'map', x: 0, y: 0, width: 240, height: 240, tags: [], visible: true, behaviors: [],
        visual: { kind: 'tiles', cell: 80, rows: ['ggg', 'gsg', 'ggg'], kinds: { g: { name: 'g', color: '#0f0', tags: [], separate: true, autotile: list }, s: { name: 's', color: '#00f', tags: [], separate: true, autotile: list, joins: [] } } } }],
    }],
  };
  const { page, errors } = await openPage(browser, playerUrl, { project });
  await until(page, () => window.__game, null, 30000);
  const r = await page.evaluate(() => {
    const g = window.__game;
    const pictureOf = (x, y) => {
      const e = g.entities.find((e) => e.def.id === 'map' && Math.abs(e.x - x) < 1 && Math.abs(e.y - y) < 1);
      const texture = e?.view.children?.[0]?.texture;
      return [...g.textures.entries()].find(([, t]) => t.texture === texture)?.[0] ?? null;
    };
    return { stone: pictureOf(80, 80), grassAboveIt: pictureOf(80, 0) };
  });
  check('joins: stone inside grass keeps all its edges (picture 0), the grass around it joins it (top middle: 14)', r.stone === 't0' && r.grassAboveIt === 't14', JSON.stringify(r));
  check('joins: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}
{
  // The flagship's five levels, from their Tiled maps, in a new empty game.
  const { page, errors } = await openPage(browser, editorUrl, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('بازی جدید'))?.click());
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('بله، بازی خالی'))?.click());
  await new Promise((r) => setTimeout(r, 300));
  await page.click('[data-library="objects"]');
  await page.click('[data-library-tab="genre"]');
  await page.click('[data-genre="platform"]');
  await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 180000 });
  const project = await page.evaluate(() => window.__editor.getState().project);
  const levels = project.scenes.filter((s) => s.objects.some((o) => o.tags.includes('بازیکن') && !o.fixed));
  const names = project.scenes.map((s) => s.name);
  const has = (s, tag) => s.objects.some((o) => o.tags.includes(tag));
  check('the flagship has five levels, a start, a levels screen, a win and a game-over screen', levels.length === 5 && ['Start', 'Levels', 'You win', 'Game over'].every((n) => names.includes(n)), names.join(', '));
  check('each level is longer than the one before, and has three gems and a star at the end', levels.every((s, i) => (i === 0 || s.width > levels[i - 1].width) && s.objects.filter((o) => o.tags.includes('الماس')).length === 3 && has(s, 'پایان')), levels.map((s) => s.width).join(','));
  check('level 2 brings enemies, level 3 moving planks, level 4 spikes, a key and a gate', has(levels[1], 'دشمن') && levels[2].objects.some((o) => o.name.startsWith('سکوی متحرک')) && has(levels[3], 'تیغ') && has(levels[3], 'کلید') && has(levels[3], 'دروازه'));
  const ls = project.scenes.find((s) => s.name === 'Levels');
  check('the levels screen has a button for each level, laid out in rows, locked until earned', ls.objects.filter((o) => o.name.startsWith('دکمه‌ی مرحله ')).length === 5 && ls.objects.some((o) => o.behaviors.some((b) => b.type === 'layout')) && ls.rules.some((r) => r.condition?.name === 'unlocked'));
  const problems = await page.evaluate((p) => window.__editor.agent.check(p), project);
  check('the flagship checks clean, with no warnings', problems.problems.length === 0 && problems.warnings.length === 0, [...problems.problems, ...problems.warnings.map((w) => w.text)].join(' | '));
  // Game feel in one place (flagship Phase F): the "tight" preset sets every level's gravity and the hero's jump,
  // run and camera, from a jump 260 px high lasting 0.75 s.
  await page.evaluate(() => [...document.querySelectorAll('.tabs button')].find((b) => b.textContent.trim() === 'بازی')?.click());
  await page.waitForSelector('[data-feel="tight"]', { timeout: 20000 });
  await page.click('[data-feel="tight"]');
  await new Promise((r) => setTimeout(r, 300));
  const felt = await page.evaluate(() => {
    const p = window.__editor.getState().project;
    return p.scenes.filter((s) => s.objects.some((o) => !o.fixed && o.behaviors.some((b) => b.type === 'jumper'))).map((s) => {
      const hero = s.objects.find((o) => !o.fixed && o.behaviors.some((b) => b.type === 'jumper'));
      const of = (t) => hero.behaviors.find((b) => b.type === t);
      return [s.gravity, of('jumper').jumpSpeed, of('walker')?.speed, of('walker')?.ease, of('camera')?.lookAhead].join('/');
    });
  });
  check('the feel presets set every level at once (gravity, jump, run, ease, look-ahead)', felt.length === 5 && felt.every((f) => f === '3698/1387/380/0.08/160'), felt.join(' '));
  check('flagship levels: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

// ── The camera (flagship Phase F): a dead zone, looking ahead, settling on landing ──
{
  const project = (camera) => ({
    formatVersion: 3, lists: [],
    meta: { name: 'Camera', orientation: 'portrait', width: 720, height: 1280, background: '#202833', fontFamily: 'Fredoka', transition: 'none' },
    app: { appId: 'com.example.camera', versionCode: 1, versionName: '1.0', icon: null },
    ads: { enabled: false, testMode: true, banner: false, appId: '', bannerId: '', interstitialId: '', rewardedId: '' },
    sound: false, assets: {}, variables: [], startScene: 's',
    scenes: [{ id: 's', name: 's', width: 6000, height: 4000, background: null, music: null, gravity: 0, prefabs: [], rules: [],
      objects: [{ id: 'hero', name: 'hero', x: 3000, y: 2000, width: 80, height: 100, visual: { kind: 'rect', color: '#fff' }, tags: [], visible: true, behaviors: [{ type: 'camera', lock: 'free', smooth: 0, ...camera }] }] }],
  });
  const run = async (camera, script) => {
    const { page, errors } = await openPage(browser, playerUrl, { project: project(camera) });
    await until(page, () => window.__game, null, 30000);
    const r = await page.evaluate(script);
    check(`camera ${JSON.stringify(camera)}: no errors in the page`, errors.length === 0, errors.join(' | '));
    await page.close();
    return r;
  };
  const dead = await run({ deadZone: 100 }, () => {
    const g = window.__game;
    g.app.ticker.stop();
    const hero = g.entities.find((e) => e.def.id === 'hero');
    for (let i = 0; i < 5; i++) g.advance(1 / 60);
    const before = g.camera.x;
    hero.x += 60;
    for (let i = 0; i < 5; i++) g.advance(1 / 60);
    const small = g.camera.x - before;
    hero.x += 200;
    for (let i = 0; i < 5; i++) g.advance(1 / 60);
    return { small, big: g.camera.x - before };
  });
  check('camera: a step inside the dead zone does not move the view; a big one moves it by what is past the zone', dead.small === 0 && Math.abs(dead.big - 160) < 1, JSON.stringify(dead));
  const ahead = await run({ lookAhead: 150 }, () => {
    const g = window.__game;
    g.app.ticker.stop();
    const hero = g.entities.find((e) => e.def.id === 'hero');
    for (let i = 0; i < 120; i++) {
      hero.vx = 300;
      hero.x += 5;
      g.advance(1 / 60);
    }
    const view = g.view.width / g.z;
    return { ahead: g.camera.x + view / 2 - (hero.x + hero.width / 2) };
  });
  check('camera: running right, the view looks about 150 px ahead', ahead.ahead > 130 && ahead.ahead <= 151, JSON.stringify(ahead));
}

await browser.close();
finish();
