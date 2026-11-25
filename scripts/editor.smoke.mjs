// Drives the built editor in a real browser the way a user would: build a
// small game from an empty screen, resize and nudge things, then open a larger
// example and edit its objects, rules and settings, try it, and reload.
// Run `npm run build` first.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { check, finish, gameState, launch, openPage, png, root, shots, silentWav, sleep, solidPng, toPage, until } from './lib.mjs';

const url = pathToFileURL(resolve(root, 'dist-editor/editor.html')).href;
const browser = await launch();
const { page, errors } = await openPage(browser, url, { viewport: { width: 1500, height: 950 } });

const editor = () => page.evaluate(() => window.__editor.getState());
const scene = async () => {
  const s = await editor();
  return s.project.scenes.find((x) => x.id === s.sceneId);
};
const object = async (id) => {
  const s = await scene();
  return [...s.objects, ...s.prefabs].find((o) => o.id === id);
};
/** Clicks the first button whose text contains `text`. */
async function click(text, within = 'body') {
  const ok = await page.evaluate((text, within) => {
    const button = [...document.querySelectorAll(`${within} button`)].find((b) => b.textContent.includes(text));
    button?.click();
    return Boolean(button);
  }, text, within);
  if (!ok) throw new Error(`No button with text "${text}" in ${within}`);
  await sleep(100);
}
/** Clicks the row of the object list with exactly this name. */
async function clickRow(name, shiftKey = false) {
  const ok = await page.evaluate((name, shiftKey) => {
    const row = [...document.querySelectorAll('.object-list .row')].find((r) => r.querySelector('.row-name').textContent === name);
    row?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey }));
    return Boolean(row);
  }, name, shiftKey);
  if (!ok) throw new Error(`No object named "${name}" in the list`);
  await sleep(100);
}
/** Sets the control labelled `label` (slider, text box or pick list) the way typing or dragging would. */
async function setControl(label, value, within = '.panel-inspector') {
  const ok = await page.evaluate((label, value, within) => {
    const control = [...document.querySelectorAll(`${within} .control`)].find((c) => c.querySelector('label')?.textContent === label);
    const input = control?.querySelector('input, select');
    if (!input) return false;
    const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, String(value));
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  }, label, value, within);
  if (!ok) throw new Error(`No control labelled "${label}"`);
  await sleep(100);
}
/** Clicks a button with a real mouse press, which the browser requires before it will open a file picker, and picks files. */
async function upload(text, within, files) {
  const find = (text, within) => [...document.querySelectorAll(`${within} button`)].find((b) => b.textContent.includes(text));
  await page.evaluate(`(${find})(${JSON.stringify(text)}, ${JSON.stringify(within)}).scrollIntoView({ block: 'center' })`);
  // Let the page settle, so the button is where it was measured when the click lands.
  await sleep(250);
  const [x, y] = await page.evaluate(`(() => { const r = (${find})(${JSON.stringify(text)}, ${JSON.stringify(within)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  // The browser must be listening for the file picker before the click that opens it.
  const waiting = page.waitForFileChooser();
  await sleep(200);
  await page.mouse.click(x, y);
  const chooser = await waiting;
  await chooser.accept(files);
  await sleep(400);
}
/** Ticks or unticks the checkbox with this label. */
async function tick(label, within = '.panel-inspector') {
  const ok = await page.evaluate((label, within) => {
    const box = [...document.querySelectorAll(`${within} label.check`)].find((l) => l.textContent.startsWith(label));
    box?.querySelector('input').click();
    return Boolean(box);
  }, label, within);
  if (!ok) throw new Error(`No checkbox labelled "${label}"`);
  await sleep(100);
}
async function chooseOption(selector, value) {
  await page.select(selector, value);
  await sleep(100);
}
/** Opens the pick list behind the button named `label` (inside `within`) and chooses the block `value` from it. */
async function pick(label, value, within = 'body') {
  await page.evaluate((label, within) => document.querySelector(`${within} button[aria-label="${label}"]`).click(), label, within);
  await page.waitForSelector('.modal');
  // A list that opens on its most used choices shows the rest one press away.
  if (!(await page.$(`.modal button[data-block="${value}"]`)) && (await page.$('.modal .pick-more'))) await page.click('.modal .pick-more');
  await page.waitForSelector(`.modal button[data-block="${value}"]`);
  await page.click(`.modal button[data-block="${value}"]`);
  await sleep(120);
}
/** Adds a rule that starts with `trigger` and returns its id; the rule is left open. */
async function newRule(trigger) {
  await pick('قانون تازه', trigger, '.rules');
  return (await scene()).rules.at(-1).id;
}
const addAction = (ruleId, action) => pick('اضافه کردن کار', action, `article.rule[data-rule="${ruleId}"]`);
/** Opens the library for the scene's objects, on the tab whose name contains `tab`. */
async function openLibrary(tab) {
  await page.click('button[data-library="objects"]');
  await page.waitForSelector('.modal');
  await page.evaluate((tab) => [...document.querySelectorAll('.modal [role=tab]')].find((b) => b.textContent.includes(tab)).click(), tab);
  await sleep(100);
}
/** Page coordinates of a point in the world, whatever the zoom and wherever the view is. */
async function worldToPage(x, y) {
  const g = await gameState(page);
  return toPage(page, (x - g.camera.x) * g.zoom, (y - g.camera.y) * g.zoom);
}
async function drag(from, to, keys = {}) {
  if (keys.shift) await page.keyboard.down('Shift');
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 6 });
  await page.mouse.up();
  if (keys.shift) await page.keyboard.up('Shift');
  await sleep(180);
}

// ── An empty game, no picking ──────────────────────────────────────────────
await page.evaluate(() => new Promise((done) => { const r = indexedDB.deleteDatabase('editor'); r.onsuccess = r.onerror = r.onblocked = done; }));
await page.reload();
await until(page, () => window.__game && window.__editor, null, 20000);
check('the editor opens straight onto an empty game', (await scene()).objects.length === 0 && (await page.$('.picker')) === null);
const hint = () => page.$eval('.stage-hint', (p) => p.textContent);
check('an empty game says what to do first', (await hint()).includes('کتابخانه'));
check('and offers a guided first game', (await page.$('.welcome')) !== null);
await page.screenshot({ path: resolve(shots, 'editor-0-empty.png') });

// ── Build a tiny game from nothing, with ready-made roles ──────────────────
await click('+ شکل', '.object-list');
const hero = (await editor()).selection;
check('after the first object, the hint moves on to roles', (await hint()).includes('نقش آماده'));
await pick('نقش آماده', 'jump-player');
let made = await object(hero);
check('the «jumping player» role adds its group, body and jump', made.tags.includes('بازیکن') && ['body', 'jumper'].every((t) => made.behaviors.some((b) => b.type === t)));

await click('+ شکل', '.object-list');
const ground = (await editor()).selection;
await pick('نقش آماده', 'ground');
await setControl('پهنا', 720);
await setControl('فاصله از چپ', 0);
await setControl('فاصله از بالا', 900);
made = await object(ground);
check('the «ground» role and typed position apply', made.tags.includes('زمین') && made.x === 0 && made.y === 900 && made.width === 720);

await click('+ شکل', '.object-list');
const prize = (await editor()).selection;
await pick('نقش آماده', 'prize');
let sc = await scene();
check(
  'the «prize» role adds a score variable and the rule that awards it',
  (await editor()).project.variables.some((v) => v.name === 'score') && sc.rules.length === 1 && sc.rules[0].when.type === 'touch' && sc.rules[0].then[0].type === 'setVariable',
);
await click('+ متن', '.object-list');
await pick('نقش آماده', 'score-text');
made = await object((await editor()).selection);
check('the «score» role turns a text into a fixed score display', made.visual.text === 'Score: {score}' && made.fixed === true);
check('with objects, roles and a rule in place, the hint points to «امتحان کن»', (await hint()).includes('امتحان کن'));

await click('امتحان کن');
check('the game built from nothing plays: the player falls and lands on the ground', await until(page, (id) => {
  const e = window.__game.getState().entities.find((x) => x.id === id);
  return e && Math.abs(e.y + e.height - 900) < 0.5;
}, hero, 15000));
await click('توقف');

// ── Resize with a corner handle, nudge and delete with the keyboard ────────
await clickRow((await object(prize)).name);
const before = await object(prize);
const [hx, hy] = await toPage(page, before.x + before.width, before.y + before.height);
const [nx, ny] = await toPage(page, before.x + before.width + 60, before.y + before.height + 40);
await page.mouse.move(hx, hy);
await page.mouse.down();
await page.mouse.move(nx, ny, { steps: 5 });
// (Let the last move land before letting go: a slow machine can still be busy with the one before.)
await sleep(120);
await page.mouse.up();
await sleep(150);
let after = await object(prize);
// The mouse moves in whole screen pixels: on a small stage one pixel is several game pixels.
const onePixel = 100 / ((await toPage(page, 100, 0))[0] - (await toPage(page, 0, 0))[0]);
const near = Math.max(3, onePixel * 2 + 1);
check('dragging a corner handle resizes the object', Math.abs(after.width - before.width - 60) <= near && Math.abs(after.height - before.height - 40) <= near && after.x === before.x, `${before.width}x${before.height} → ${after.width}x${after.height}, one screen pixel = ${onePixel.toFixed(1)}`);
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press('ArrowRight');
await page.keyboard.down('Shift');
await page.keyboard.press('ArrowDown');
await page.keyboard.up('Shift');
await sleep(150);
after = await object(prize);
check('arrow keys nudge the selected object', after.x === before.x + 1 && after.y === before.y + 10, `${after.x},${after.y}`);
await page.keyboard.press('Delete');
await sleep(150);
check('Delete removes the selected object', (await object(prize)) === undefined);
await page.screenshot({ path: resolve(shots, 'editor-1-built.png') });

// ── A larger game, opened the way «باز کردن فایل» opens one ─────────────────
const example = await browser.newPage();
await example.goto(pathToFileURL(resolve(root, 'dist/index.html')).href);
await example.waitForFunction(() => window.__project, { timeout: 20000 });
const runner = await example.evaluate(() => window.__project);
await example.close();
await page.evaluate((p) => window.__editor.open(p), runner);
await sleep(400);
let g = await gameState(page);
check('an opened game is shown at its start scene, frozen for editing', g.mode === 'edit' && g.scene === 'start');

await chooseOption('#scene-select', 'play');
check('the scene picker switches the scene being edited', (await gameState(page)).scene === 'play');
await clickRow('بازیکن');
check('choosing «بازیکن» in the list selects the player', (await editor()).selection === 'player' && (await gameState(page)).selection === 'player');
await page.click('.swatch[aria-label="رنگ #1565c0"]');
await sleep(100);
check('picking a colour changes the player', (await object('player')).visual.color === '#1565c0');
await setControl('قدرت پرش', 1500);
check('a behavior slider changes the behavior', (await object('player')).behaviors.find((b) => b.type === 'jumper').jumpSpeed === 1500);
await setControl('بلندی', 140);
let player = await object('player');
check('making the player taller keeps its feet on the ground', player.height === 140 && player.y + player.height === 940);
await setControl('چرخش', 45);
await setControl('پررنگی', 0.5);
player = await object('player');
check('rotation and opacity can be set', player.rotation === 45 && player.opacity === 0.5);

// ── Click and drag in the game ─────────────────────────────────────────────
const [sx, sy] = await toPage(page, 590, 200);
const [ex, ey] = await toPage(page, 290, 300);
await page.mouse.move(sx, sy);
await page.mouse.down();
check('clicking the sun in the game selects it', await until(page, () => window.__editor.getState().selection === 'sun', null, 3000));
await page.mouse.move(ex, ey, { steps: 6 });
await page.mouse.up();
await sleep(150);
const sun = await object('sun');
check('dragging moves the object and saves its new place', Math.abs(sun.x - 220) <= 3 && Math.abs(sun.y - 230) <= 3, `${sun.x},${sun.y}`);

// ── Groups and behaviors ───────────────────────────────────────────────────
await page.type('.panel-inspector .inline-form input', 'sky');
await click('اضافه کن', '.panel-inspector');
check('an object can be put in a new group', (await object('sun')).tags.includes('sky'));
await pick('اضافه کردن رفتار', 'wave');
check('one of the new behaviors can be added', (await object('sun')).behaviors.some((b) => b.type === 'wave'));
await pick('اضافه کردن رفتار', 'jumper');
let types = (await object('sun')).behaviors.map((b) => b.type);
check('adding «پرش» brings the body it needs', types.includes('jumper') && types.includes('body'));
await click('حذف رفتار', '.panel-inspector');
await click('حذف رفتار', '.panel-inspector');
check('removing the body also removes the jump that depends on it', (await object('sun')).behaviors.length === 0);

// ── Copy, and deleting something other things depend on ────────────────────
const countBefore = (await scene()).objects.length;
await click('کپی', '.panel-inspector');
check('«کپی» makes a second one and selects it', (await scene()).objects.length === countBefore + 1 && (await editor()).selection !== 'sun');
await click('حذف', '.panel-inspector .panel-head');
check('«حذف» removes the selected object', (await scene()).objects.length === countBefore && (await editor()).selection === null);
await clickRow('سکه');
check('choosing a spawned object shows a sample of it', (await gameState(page)).entities.some((e) => e.id === 'coin'));
await click('حذف', '.panel-inspector .panel-head');
sc = await scene();
check('deleting the coin also takes away the spawner job that made it', !sc.prefabs.some((p) => p.id === 'coin') && sc.objects.find((o) => o.id === 'coin-spawner').behaviors.length === 0);
check('the game is still valid after that', (await page.$('.problem')) === null);

// ── Rules ──────────────────────────────────────────────────────────────────
await click('قانون‌ها', '.tabs');
const rulesBefore = (await scene()).rules.length;
const closedText = await page.$$eval('.rule-closed', (cards) => cards.map((c) => c.textContent));
check('rules are listed as sentences', closedText.length === rulesBefore && closedText[0].includes('وقتی چیزی از گروه «بازیکن» به چیزی از گروه «مانع» می‌خورد'), closedText[0]);
const touchRule = await newRule('touch');
check('a new rule can be added, and opens for editing', (await scene()).rules.length === rulesBefore + 1 && (await page.$$('article.rule')).length === 1);
const inRule = (fn, ...args) => page.evaluate((id, body, args) => {
  const card = document.querySelector(`article.rule[data-rule="${id}"]`);
  const set = (select, value) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const labelled = (label) => [...card.querySelectorAll('.control')].find((c) => c.querySelector('label')?.textContent === label).querySelector('select');
  return new Function('card', 'set', 'labelled', 'args', body)(card, set, labelled, args);
}, touchRule, fn, args).then(async (r) => { await sleep(120); return r; });
await inRule(`set(labelled('اولی'), 'tag:بازیکن')`);
await inRule(`set(labelled('دومی'), 'tag:زمین')`);
await addAction(touchRule, 'wait');
await addAction(touchRule, 'destroy');
await page.click(`article.rule[data-rule="${touchRule}"] button[aria-label="کار 2 بالاتر برود"]`);
await sleep(100);
check('an action can be moved earlier in its rule', (await scene()).rules.at(-1).then.map((a) => a.type).join() === 'destroy,wait');
await page.click(`article.rule[data-rule="${touchRule}"] button[aria-label="کار 1 پایین‌تر برود"]`);
await sleep(100);
let rule = (await scene()).rules.at(-1);
check('a rule can be given a trigger and several actions', rule.when.type === 'touch' && rule.when.a.tag === 'بازیکن' && rule.when.b.tag === 'زمین' && rule.then.map((a) => a.type).join() === 'wait,destroy');
const targetOptions = await inRule(`return [...card.querySelectorAll('.action .control select option')].map((o) => o.value)`);
check('actions of a touch rule can aim at "the first" and "the second" object', targetOptions.includes('first') && targetOptions.includes('second'));
await page.screenshot({ path: resolve(shots, 'editor-2-rules.png') });
await click('حذف این قانون', 'article.rule');
check('a rule can be deleted', (await scene()).rules.length === rulesBefore);

// ── Game settings, a larger world, and sliding the view ───────────────────
await click('بازی', '.tabs');
await page.type('input[aria-label="نام مقدار تازه"]', 'lives');
await click('مقدار تازه', '.panel-inspector');
check('a new variable can be added', (await editor()).project.variables.some((v) => v.name === 'lives'));
await setControl('شناسه‌ی اپ', 'com.omid.runner');
check('the app id can be changed', (await editor()).project.app.appId === 'com.omid.runner');
await setControl('پهنای دنیا', 2000);
check('the world can be made wider than the screen', (await scene()).width === 2000);
await click('دست', '.stage-tools');
await drag(await toPage(page, 600, 520), await toPage(page, 300, 520));
g = await gameState(page);
check('with the hand tool, dragging slides the view over the world', Math.abs(g.camera.x - 300) <= 3, `camera ${g.camera.x}`);
await click('انتخاب', '.stage-tools');
await page.mouse.move(...(await toPage(page, 360, 640)));
await page.mouse.wheel({ deltaX: 0, deltaY: 100 });
await page.keyboard.down('Shift');
await page.mouse.wheel({ deltaY: -120 });
await page.keyboard.up('Shift');
await sleep(150);
check('the wheel slides the view too; with Shift, sideways', (await gameState(page)).camera.x < g.camera.x - 50, `camera ${(await gameState(page)).camera.x}`);
await setControl('پهنای دنیا', 100);
check('the world cannot be made smaller than the screen', (await scene()).width === 720 && (await page.$('.problem')) === null);

await click('افقی', '.panel-inspector');
let meta = (await editor()).project.meta;
check('turning the screen swaps its sides', meta.orientation === 'landscape' && meta.width === 1280 && meta.height === 720 && (await page.$('.problem')) === null);
await sleep(300);
const shape = await page.$eval('.phone-screen canvas', (c) => c.getBoundingClientRect().width / c.getBoundingClientRect().height);
check('the preview takes the new shape without bars', Math.abs(shape - 1280 / 720) < 0.02, shape.toFixed(3));
await click('یک قدم به عقب');
meta = (await editor()).project.meta;
check('undo turns it back', meta.orientation === 'portrait' && meta.width === 720);
await page.screenshot({ path: resolve(shots, 'editor-4-game.png') });

// ── Try the game ───────────────────────────────────────────────────────────
await click('امتحان کن');
g = await gameState(page);
check('«امتحان کن» runs the real game from its start scene', g.mode === 'play' && g.scene === 'start');
await until(page, () => window.__game.getState().time > 0.5);
await page.mouse.click(...(await toPage(page, 360, 640)));
check('a click plays like a finger', await until(page, () => window.__game.getState().scene === 'play', null, 10000));
await click('توقف');
check('stopping returns to editing', (await gameState(page)).mode === 'edit');

// ── Export dialog, opened as a plain file ──────────────────────────────────
await click('خروجی اندروید', '.topbar');
await page.waitForSelector('.modal .field-error');
check('without the local server, the export dialog says how to start it', (await page.$eval('.modal', (m) => m.textContent)).includes('npm start'));
await click('بستن', '.modal');

// ── Changes survive a reload ───────────────────────────────────────────────
await sleep(300);
await page.reload();
await until(page, () => window.__game && window.__editor, null, 20000);
const reloaded = (await editor()).project;
check('the game is still there after reloading the page', reloaded.app.appId === 'com.omid.runner' && reloaded.variables.some((v) => v.name === 'lives'));

// ── A new game is an empty game ────────────────────────────────────────────
await click('بازی جدید', '.topbar');
await click('بله، بازی خالی', '.topbar');
await sleep(300);
check('«بازی جدید» starts an empty game, with nothing to choose between', (await editor()).project.meta.name === 'My game' && (await scene()).objects.length === 0 && (await page.$('.problem')) === null);

// ── Pictures, animation, sounds, music, fonts and effects ──────────────────
const file = (name, data) => {
  const path = resolve(shots, name);
  writeFileSync(path, Buffer.from(data.split(',')[1], 'base64'));
  return path;
};
const pictures = [file('a.png', solidPng(255, 140, 0)), file('b.png', solidPng(0, 120, 255)), file('c.png', solidPng(0, 200, 90))];
await upload('+ عکس', '.object-list', [pictures[0]]);
// Reading the file and adding it takes a moment after the file is chosen.
await until(page, () => window.__editor.getState().selection !== null, null, 5000);
let pic = await object((await editor()).selection);
check('a picture can be added from a file', pic?.visual.kind === 'image' && (await editor()).project.assets[pic.visual.asset].type === 'image');
await upload('+ عکس‌های بعدی', '.panel-inspector', pictures.slice(1));
await until(page, (id) => { const s = window.__editor.getState(); return s.project.scenes.some((x) => x.objects.some((o) => o.id === id && o.visual.frames?.length === 2)); }, pic.id, 5000);
await sleep(200);
await setControl('سرعت انیمیشن', 12);
await tick('رو به جهت حرکت برگردد');
pic = await object(pic.id);
check('more pictures make it an animation with a speed', pic.visual.frames.length === 2 && pic.visual.fps === 12 && pic.visual.flip === true);
await pick('اضافه کردن رفتار', 'scrollImage');
check('«تصویر روان» is offered for an object with a picture', (await object(pic.id)).behaviors.some((b) => b.type === 'scrollImage'));
await click('حذف رفتار', '.panel-inspector');
await pick('نقش آماده', 'button');
sc = await scene();
check('the «button» role adds a tap rule and fixes it to the screen', (await object(pic.id)).fixed === true && sc.rules.at(-1).when.type === 'tapObject' && sc.rules.at(-1).then.at(-1).type === 'restartScene');

await click('+ متن', '.object-list');
const label = (await editor()).selection;
await tick('دور حرف‌ها خط داشته باشد');
check('a text can be given an outline', (await object(label)).visual.outline === '#ffffff');
await page.click('.panel-inspector button[aria-label="اضافه کردن رفتار"]');
await page.waitForSelector('.modal .pick-more');
check('the list of behaviors opens on the few most used ones', (await page.$('.modal button[data-block="scrollImage"]')) === null && (await page.$('.modal button[data-block="jumper"]')) !== null);
await page.click('.modal .pick-more');
await page.waitForSelector('.modal button[data-block="scrollImage"]');
const scrollOffer = await page.$eval('.modal button[data-block="scrollImage"]', (b) => ({ disabled: b.disabled, text: b.textContent }));
check('«تصویر روان» cannot be chosen for a text, and says why', scrollOffer.disabled && scrollOffer.text.includes('عکس دارد'), scrollOffer.text);
await page.keyboard.press('Escape');
await sleep(100);
check('Escape closes a pick list', (await page.$('.modal')) === null);

await click('بازی', '.tabs');
await setControl('فونت متن‌های بازی', 'Bangers');
check('the game font can be changed', (await editor()).project.meta.fontFamily === 'Bangers');
await upload('+ صدا یا موسیقی', '.panel-inspector', [file('beep.wav', silentWav())]);
const assets = (await editor()).project.assets;
const sound = Object.keys(assets).find((id) => assets[id].type === 'sound');
check('a sound file can be added', Boolean(sound) && assets[sound].name === 'beep.wav');
await setControl('موسیقی این صحنه', sound);
check('it can be set as the scene music', (await scene()).music === sound);

await click('قانون‌ها', '.tabs');
const fxRule = await newRule('tap');
const inFx = (body) => page.evaluate((id, body) => {
  const card = document.querySelector(`article.rule[data-rule="${id}"]`);
  const set = (select, value) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  return new Function('card', 'set', body)(card, set);
}, fxRule, body).then(async (r) => { await sleep(120); return r; });
await addAction(fxRule, 'playSound');
const soundOptions = await inFx(`return [...card.querySelectorAll('.action .control select option')].map((o) => o.value)`);
check('the «پخش صدا» action offers the added sound next to the built-in ones', soundOptions.includes(sound) && soundOptions.includes('coin'));
await setControl('بلندی صدا', 35, `article[data-rule="${fxRule}"]`);
await page.click(`article[data-rule="${fxRule}"] button[aria-label="شنیدن نمونه صدا"]`);
check('sound preview leaves the rule at its chosen volume', (await scene()).rules.find(r => r.id === fxRule).then[0].volume === 35);
await addAction(fxRule, 'burst');
await addAction(fxRule, 'shake');
check('effects can be added to a rule', (await scene()).rules.at(-1).then.map((a) => a.type).join() === 'playSound,burst,shake' && (await page.$('.problem')) === null);
await page.screenshot({ path: resolve(shots, 'editor-5-effects.png') });
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.6);
await page.mouse.click(...(await toPage(page, 360, 300)));
check('the game with pictures, music and effects plays', await until(page, () => window.__game.getState().particles > 0, null, 10000));
await click('توقف');

// ── Adding by role, health, a value bar, and a rewarded ad ──────────────────
const objectsBefore = (await scene()).objects.length;
await openLibrary('با نقش آماده');
await page.click('.modal button[data-block="finger-player"]');
await until(page, (n) => { const s = window.__editor.getState(); return s.project.scenes.find((x) => x.id === s.sceneId).objects.length === n; }, objectsBefore + 1, 10000);
made = await object((await editor()).selection);
check('an object can be added already playing a role, with a ready-made picture', made.name === 'بازیکن' && made.visual.kind === 'image' && made.behaviors.some((b) => b.type === 'followFinger'), JSON.stringify(made?.visual));
const fingerPlayer = made.id;
await openLibrary('با نقش آماده');
await page.click('.modal button[data-block="steer-player"]');
await until(page, (id) => window.__editor.getState().selection !== id && document.querySelector('.modal') === null, fingerPlayer, 10000);
made = await object((await editor()).selection);
check('a player that moves in four directions can be added in one step', made.behaviors.some((b) => b.type === 'steer') && made.behaviors.find((b) => b.type === 'body')?.gravity === false, JSON.stringify(made.behaviors.map((b) => b.type)));
await clickRow((await object(fingerPlayer)).name);
await tick('این شیء جان داشته باشد');
await tick('برخورد دایره‌ای');
made = await object(made.id);
check('an object can be given health and a round shape', made.health === 3 && made.round === true);
await click('+ نوار', '.object-list');
made = await object((await editor()).selection);
check('a value bar can be added', made.visual.kind === 'bar' && made.visual.variable === 'score' && (await page.$('.problem')) === null);

await click('قانون‌ها', '.tabs');
for (const [trigger, action] of [['tap', 'showRewardedAd'], ['reward', 'setVariable']]) {
  await addAction(await newRule(trigger), action);
}
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.6);
await page.mouse.click(...(await toPage(page, 360, 900)));
check('a rewarded ad in the preview grants its reward', await until(page, () => window.__game.getState().variables.score >= 1, null, 15000));
await click('توقف');

// ── The library: ready-made pictures, roles and parts make a game that plays ──
await click('بازی جدید', '.topbar');
await click('بله، بازی خالی', '.topbar');
await sleep(300);
const countIs = (n) => until(page, (n) => { const s = window.__editor.getState(); return s.project.scenes.find((x) => x.id === s.sceneId).objects.length === n; }, n, 10000);
await openLibrary('عکس‌های آماده');
await page.click('.modal button[data-sprite="bird"]');
await countIs(1);
const bird = await object((await editor()).selection);
const birdAsset = (await editor()).project.assets['art-bird'];
check('a ready-made picture can be added, with its wing-beat animation', bird.visual.kind === 'image' && bird.visual.frames.length === 1 && birdAsset.src.startsWith('data:image/png'), JSON.stringify(bird.visual));
check('the library closes after adding, and the game shows the picture', (await page.$('.modal')) === null && (await page.$('.problem')) === null && (await gameState(page)).entities.some((e) => e.id === bird.id));
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press('Delete');
await countIs(0);

await openLibrary('با نقش آماده');
await page.click('.modal button[data-block="jump-player"]');
await countIs(1);
const jumper = (await editor()).selection;
await openLibrary('با نقش آماده');
await page.click('.modal button[data-block="ground"]');
await countIs(2);
const groundId = (await editor()).selection;
check('the library ground repeats its picture instead of stretching', (await object(groundId)).visual.repeat === 'x');
await click('عکس کش بیاید', '.panel-inspector');
check('a picture can be set to stretch again', (await object(groundId)).visual.repeat === undefined && (await page.$('.problem')) === null);
await click('تکرار به پهلو', '.panel-inspector');
await setControl('عمق', 0.5);
check('an object can be given depth, for scenery', (await object(groundId)).parallax === 0.5 && (await object(groundId)).visual.repeat === 'x');
await setControl('عمق', 1);
check('full depth is stored as no depth at all', (await object(groundId)).parallax === undefined);
await setControl('پهنا', 720);
await setControl('فاصله از چپ', 0);
await setControl('فاصله از بالا', 1000);
const firstScene = (await editor()).sceneId;
for (const part of ['score', 'obstacles', 'gameover', 'pause', 'sound']) {
  const rulesNow = (await scene()).rules.length;
  await openLibrary('قطعه‌های آماده');
  await page.click(`.modal button[data-block="${part}"]`);
  await until(page, () => document.querySelector('.modal') === null, null, 10000);
  if (part === 'obstacles') check('a part adds its objects and its rule in one step', (await scene()).prefabs.length === 1 && (await scene()).rules.length === rulesNow + 1);
}
let built = (await editor()).project;
const overScene = built.scenes.find((s) => s.id !== firstScene);
sc = await scene();
const losing = sc.rules.find((r) => r.when.type === 'touch');
check('the game-over part makes a scene and points the losing rule at it', built.scenes.length === 2 && losing.then.at(-1).type === 'goToScene' && losing.then.at(-1).scene === overScene.id);
check('a part says what it did', (await page.$eval('.stage-note', (t) => t.textContent)).length > 20);
check('the finished game has nothing to point out', (await page.$('.chip-warn')) === null, await page.$eval('.stage-controls', (c) => c.textContent));
await page.screenshot({ path: resolve(shots, 'editor-6-library.png') });

await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.6);
const playerY = async () => (await gameState(page)).entities.find((e) => e.id === jumper).y;
await until(page, (id) => { const e = window.__game.getState().entities.find((x) => x.id === id); return e && Math.abs(e.y + e.height - 1000) < 0.5; }, jumper, 10000);
const standing = await playerY();
await page.mouse.click(...(await toPage(page, 75, 75)));
check('the sound button switches sound off', await until(page, () => window.__game.getState().soundOn === false, null, 5000));
await page.mouse.click(...(await toPage(page, 75, 75)));
check('and a second press switches it back on', await until(page, () => window.__game.getState().soundOn === true, null, 5000));
await page.mouse.click(...(await toPage(page, 645, 75)));
check('the pause button holds the game', await until(page, () => window.__game.getState().paused, null, 5000));
await page.mouse.click(...(await toPage(page, 360, 640)));
check('the continue button lets it go on', await until(page, () => !window.__game.getState().paused, null, 5000));
await until(page, (t) => window.__game.getState().time >= t, (await gameState(page)).time + 0.15);
check('a press on a button is not also a press on the screen: the player did not jump', Math.abs((await playerY()) - standing) < 1, `${standing} -> ${await playerY()}`);
check('obstacles keep coming', await until(page, () => window.__game.getState().entities.some((e) => e.tags.includes('خطر')), null, 20000));
check('running into one leads to the game-over scene', await until(page, (id) => window.__game.getState().scene === id, overScene.id, 30000));
await until(page, () => window.__game.getState().time > 0.6);
await page.mouse.click(...(await toPage(page, 360, 794)));
check('«Play again» goes back to the game', await until(page, (id) => window.__game.getState().scene === id, firstScene, 10000));
await click('توقف');

// ── Several objects at once ────────────────────────────────────────────────
await click('+ شکل', '.object-list');
const boxA = (await editor()).selection;
await setControl('فاصله از چپ', 100);
await setControl('فاصله از بالا', 300);
await click('+ شکل', '.object-list');
const boxB = (await editor()).selection;
await setControl('فاصله از چپ', 400);
await setControl('فاصله از بالا', 500);
await clickRow((await object(boxA)).name, true);
check('Shift and a click adds a second object to the selection', (await editor()).selected.length === 2 && (await gameState(page)).selected.length === 2);
await click('لبه‌ی چپ', '.panel-inspector');
check('several objects can be lined up', (await object(boxA)).x === 100 && (await object(boxB)).x === 100);
await drag(await toPage(page, 150, 350), await toPage(page, 250, 380), {});
check('dragging one of them moves them all', (await object(boxA)).x - 100 === (await object(boxB)).x - 100 && (await object(boxA)).x > 150 && (await object(boxB)).y > 500, `${(await object(boxA)).x},${(await object(boxB)).x}`);
const manyBefore = (await scene()).objects.length;
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.down('Control');
await page.keyboard.press('KeyD');
await page.keyboard.up('Control');
await sleep(150);
check('Ctrl+D copies everything selected', (await scene()).objects.length === manyBefore + 2 && (await editor()).selected.length === 2);
await page.keyboard.press('Delete');
await sleep(150);
check('Delete removes everything selected', (await scene()).objects.length === manyBefore);
await page.keyboard.press('Escape');
await drag(await toPage(page, 20, 250), await toPage(page, 700, 760));
const covered = (await editor()).selected;
check('a drag over empty space selects what it covers', covered.includes(boxA) && covered.includes(boxB), covered.join());
await page.keyboard.press('Escape');
await sleep(100);
check('Escape clears the selection', (await editor()).selected.length === 0);

// ── Snapping, locking, and looking at the whole world ──────────────────────
// Both boxes go where nothing else of the game lies under them.
for (const [id, x, y] of [[boxA, 60, 200], [boxB, 300, 250]]) {
  await clickRow((await object(id)).name);
  await setControl('فاصله از چپ', x);
  await setControl('فاصله از بالا', y);
}
let a = await object(boxA);
let b = await object(boxB);
await drag(await toPage(page, b.x + 60, b.y + 60), await toPage(page, a.x + 60 + 6, b.y + 60 + 200));
b = await object(boxB);
check('a dragged object snaps into line with another', (await editor()).selection === boxB && b.x === a.x && b.y > 400, `${b.x},${b.y} vs ${a.x}`);
await tick('قفل باشد');
await page.keyboard.press('Escape');
await page.mouse.click(...(await toPage(page, b.x + 60, b.y + 60)));
await sleep(150);
check('a locked object is not picked up by a click in the scene', (await object(boxB)).locked === true && (await editor()).selection !== boxB, `locked ${(await object(boxB)).locked}, selection ${(await editor()).selection}, b ${boxB}`);
await click('کل دنیا', '.stage-tools');
await sleep(200);
g = await gameState(page);
check('«کل دنیا» zooms out to show the whole world', g.zoom < 1 && g.camera.x < 0, `zoom ${g.zoom}`);
await page.mouse.click(...(await worldToPage(a.x + 60, a.y + 60)));
await sleep(150);
check('objects can still be picked while zoomed out', (await editor()).selection === boxA);
await drag(await worldToPage(a.x + 60, a.y + 60), await worldToPage(a.x + 60 + 300, a.y + 60 + 150));
const moved = await object(boxA);
check('and dragged by the right distance', Math.abs(moved.x - (a.x + 300)) <= 12 && Math.abs(moved.y - (a.y + 150)) <= 12, `${moved.x},${moved.y}`);
await click('اندازه‌ی گوشی', '.stage-tools');
await sleep(150);
check('«اندازه‌ی گوشی» returns to the size the player sees', (await gameState(page)).zoom === 1);

// ── Scenes, notes, and rules from an object ────────────────────────────────
await click('کپی این صحنه', '.object-list');
await sleep(200);
const copyScene = await scene();
const original = (await editor()).project.scenes.find((s) => s.id === firstScene);
const ownIds = new Set([...copyScene.objects, ...copyScene.prefabs].map((o) => o.id));
const spawnerCopy = copyScene.objects.find((o) => o.behaviors.some((x) => x.type === 'spawner'));
check(
  'a scene can be copied, with everything in the copy pointing at the copy',
  copyScene.id !== firstScene && copyScene.objects.length === original.objects.length && copyScene.rules.length === original.rules.length &&
    !original.objects.some((o) => ownIds.has(o.id)) && ownIds.has(spawnerCopy.behaviors.find((x) => x.type === 'spawner').prefabs[0]) &&
    copyScene.rules.filter((r) => r.when.type === 'tapObject').every((r) => ownIds.has(r.when.target.id)) && (await page.$('.problem')) === null,
);
const notes = await page.$eval('.chip-warn', (c) => c.textContent).catch(() => '');
check('the copied scene, which nothing leads to yet, is pointed out', notes.includes('نکته'), notes);
await click('نکته', '.stage-controls');
await page.waitForSelector('.modal .card');
check('the note says what is wrong in plain words', (await page.$eval('.modal', (m) => m.textContent)).includes('هیچ قانونی بازی را به صحنه'));
await page.keyboard.press('Escape');
await clickRow((await object(copyScene.objects.find((o) => o.tags.includes('بازیکن')).id)).name);
await click('+ وقتی از صفحه بیرون رفت', '.panel-inspector');
sc = await scene();
check('a rule about an object can be started from the object itself', sc.rules.at(-1).when.type === 'offscreen' && (await page.$$('article.rule')).length === 1);
await click('امتحان همین صحنه', '.stage-controls');
check('«امتحان همین صحنه» plays the scene being edited', await until(page, (id) => window.__game.getState().mode === 'play' && window.__game.getState().scene === id, copyScene.id, 5000));
await click('توقف');

// ── Turned shapes touch as the shapes they are ─────────────────────────────
const turnedGame = structuredClone((await editor()).project);
const plain = (id, x, y, width, height, extra = {}) => ({ id, name: id, x, y, width, height, visual: { kind: 'rect', color: '#ff5a5f' }, tags: [], visible: true, behaviors: [], ...extra });
turnedGame.variables = [{ name: 'onEnd', initial: 0, saved: false }, { name: 'inBox', initial: 0, saved: false }];
turnedGame.scenes = [{
  id: 'turn', name: 'turn', width: 720, height: 1280, background: null, music: null, gravity: 0,
  objects: [plain('bar', 160, 500, 400, 20, { rotation: 45 }), plain('end', 490, 640, 20, 20), plain('corner', 200, 500, 20, 20)],
  prefabs: [],
  rules: [
    { id: 'r1', when: { type: 'touch', a: { by: 'id', id: 'bar' }, b: { by: 'id', id: 'end' } }, condition: null, then: [{ type: 'setVariable', name: 'onEnd', op: 'set', amount: 1 }] },
    { id: 'r2', when: { type: 'touch', a: { by: 'id', id: 'bar' }, b: { by: 'id', id: 'corner' } }, condition: null, then: [{ type: 'setVariable', name: 'inBox', op: 'set', amount: 1 }] },
  ],
}];
turnedGame.startScene = 'turn';
await page.evaluate((p) => window.__editor.open(p), turnedGame);
await sleep(300);
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.3);
g = await gameState(page);
check('a turned bar touches what lies along it, not what lies in its unturned box', g.variables.onEnd === 1 && g.variables.inBox === 0, JSON.stringify(g.variables));
await click('توقف');
await click('راهنما', '.topbar');
check('the help window lists the first steps and the shortcuts', (await page.$eval('.modal', (m) => m.textContent)).includes('Ctrl+D'));
await page.keyboard.press('Escape');

// ── Board games: an object's own values, a board of copies, and the memory-cards part ──
await click('بازی جدید', '.topbar');
await click('بله، بازی خالی', '.topbar');
await sleep(300);
await click('+ شکل', '.object-list');
const tileId = (await editor()).selection;
await page.type('.panel-inspector input[aria-label="نام مقدار تازه"]', 'kind');
await page.keyboard.press('Enter');
await sleep(150);
await setControl('kind', 4);
check('an object can be given a value of its own', (await object(tileId)).values?.kind === 4, JSON.stringify((await object(tileId)).values));
await setControl('چند ستون', 2);
await setControl('چند ردیف', 2);
await click('بچین', '.panel-inspector');
sc = await scene();
check('copies of an object can be laid out in rows and columns, values included', sc.objects.length === 4 && sc.objects.every((o) => o.values?.kind === 4) && new Set(sc.objects.map((o) => `${o.x},${o.y}`)).size === 4);
await click('بازی', '.tabs');
await setControl('اندازه‌ی خانه‌ها', 170);
check('a scene can be given a board of cells', (await scene()).cell === 170 && (await page.$('.problem')) === null);

await click('بازی جدید', '.topbar');
await click('بله، بازی خالی', '.topbar');
await sleep(300);
await openLibrary('قطعه‌های آماده');
await page.click('.modal button[data-block="memory"]');
await until(page, () => document.querySelector('.modal') === null, null, 15000);
sc = await scene();
check('the memory part adds twelve cards in six pairs, each with its own kind', sc.objects.length === 12 && [1, 2, 3, 4, 5, 6].every((k) => sc.objects.filter((o) => o.values.kind === k).length === 2) && sc.rules.length === 6 && (await page.$('.problem')) === null);
await click('قانون‌ها', '.tabs');
const ruleTexts = await page.$$eval('.rule-closed', (rules) => rules.map((r) => r.textContent));
check('rules about values read as sentences', ruleTexts.some((t) => t.includes('open') && t.includes('فقط اگر')), ruleTexts[1]);
await page.click('.rule-closed:nth-of-type(2)');
await click('+ شرط روی مقدار یک شیء', '.rules');
const twoConditions = (await scene()).rules.find((r) => r.also?.length === 1);
check('a rule can be given a second condition, on an object\'s own value', twoConditions?.also[0].of === 'first', JSON.stringify(twoConditions?.also));
await page.keyboard.down('Control');
await page.keyboard.press('KeyZ');
await page.keyboard.up('Control');
await sleep(150);

await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.6);
const cardsNow = async () => (await gameState(page)).entities.filter((e) => e.tags.includes('کارت'));
const tapCard = async (card) => page.mouse.click(...(await toPage(page, card.x + card.width / 2, card.y + card.height / 2)));
let deck = await cardsNow();
const pair = deck.filter((c) => c.values.kind === deck[0].values.kind);
await tapCard(pair[0]);
check('a touched card turns over and shows its face', await until(page, (x) => { const c = window.__game.getState().entities.find((e) => e.tags.includes('کارت') && e.x === x.x && e.y === x.y); return c?.values.open === 1 && c.frame === 1; }, { x: pair[0].x, y: pair[0].y }, 5000));
await tapCard(pair[1]);
check('two cards of a kind are taken away and count as a point', await until(page, () => { const s = window.__game.getState(); return s.entities.filter((e) => e.tags.includes('کارت')).length === 10 && s.variables.score === 1 && s.variables.opened === 0; }, null, 10000));
deck = await cardsNow();
const other = deck.find((c) => c.values.kind !== deck[0].values.kind);
await tapCard(deck[0]);
await until(page, () => window.__game.getState().variables.opened === 1, null, 5000);
await tapCard(other);
check('two different cards are both shown', await until(page, () => window.__game.getState().entities.filter((e) => e.values.open === 1).length === 2, null, 5000));
check('and then turn back over, and stay in the game', await until(page, () => { const s = window.__game.getState(); return s.entities.filter((e) => e.tags.includes('کارت')).length === 10 && s.entities.every((e) => !e.values.open) && s.variables.opened === 0 && s.variables.score === 1; }, null, 10000));
await page.screenshot({ path: resolve(shots, 'editor-7-memory.png') });
await click('توقف');

// ── Board-game parts: noughts and crosses, match three, and the controls that narrow a group ──
/** Chooses an option of the pick list with this label. */
async function selectByLabel(label, value, within = '.panel-inspector') {
  const ok = await page.evaluate((label, value, within) => {
    const field = [...document.querySelectorAll(`${within} label`)].find((l) => l.textContent.trim().startsWith(label));
    const select = field?.control ?? field?.querySelector('select') ?? field?.parentElement?.querySelector('select');
    if (!(select instanceof HTMLSelectElement)) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, label, value, within);
  if (!ok) throw new Error(`No pick list labelled "${label}"`);
  await sleep(150);
}
const freshGame = async () => {
  await click('بازی جدید', '.topbar');
  await click('بله، بازی خالی', '.topbar');
  await sleep(300);
};
const addPart = async (part) => {
  await openLibrary('قطعه‌های آماده');
  await page.click(`.modal button[data-block="${part}"]`);
  await until(page, () => document.querySelector('.modal') === null, null, 20000);
};
const tapAt = async (e) => page.mouse.click(...(await toPage(page, e.x + e.width / 2, e.y + e.height / 2)));

await freshGame();
await addPart('tictactoe');
sc = await scene();
check('the noughts-and-crosses part adds nine cells on the scene\'s grid', sc.objects.filter((o) => o.tags.includes('خانه')).length === 9 && sc.cell === 240 && sc.rules.length === 5 && (await page.$('.problem')) === null);
await clickRow('خانه 1');
await selectByLabel('کدام عکس دیده شود', '');
check('a picture can be set back to plain animation', (await object((await editor()).selection)).visual.frameBy === undefined);
await selectByLabel('کدام عکس دیده شود', 'mark');
check('and to follow one of the object\'s values', (await object((await editor()).selection)).visual.frameBy === 'mark');
await click('قانون‌ها', '.tabs');
await page.click('.rule-closed:nth-of-type(2)');
await sleep(150);
await selectByLabel('و جایشان', 'home', 'article.rule');
await tick('فقط یکی از آن‌ها، به‌تصادف');
let narrowed = (await scene()).rules[1].when.target;
check('a group can be narrowed by value, by place and to one at random, from the rule itself', narrowed.where?.name === 'mark' && narrowed.spot?.is === 'home' && narrowed.pick === 'random', JSON.stringify(narrowed));
await selectByLabel('و جایشان', '', 'article.rule');
await tick('فقط یکی از آن‌ها، به‌تصادف');
narrowed = (await scene()).rules[1].when.target;
check('and widened again', narrowed.where?.name === 'mark' && narrowed.spot === undefined && narrowed.pick === undefined, JSON.stringify(narrowed));

await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.6);
const grid = (await gameState(page)).entities.filter((e) => e.tags.includes('خانه')).sort((a, b) => a.y - b.y || a.x - b.x);
// Each tap is given a few frames of the game's own time, so a busy computer cannot run two taps into one frame.
for (const i of [0, 3, 1, 4, 2]) {
  const before = (await gameState(page)).time;
  await tapAt(grid[i]);
  await until(page, (t) => window.__game.getState().time > t + 0.1, before, 10000);
}
check('noughts and crosses: three crosses in a row end the round', await until(page, () => window.__game.getState().variables.over === 1, null, 8000));
g = await gameState(page);
check('and each cell shows the mark it was given', g.entities.filter((e) => e.tags.includes('خانه') && e.frame === 1).length === 3 && g.entities.filter((e) => e.frame === 2).length === 2);
await click('توقف');

await freshGame();
await addPart('match3');
sc = await scene();
check('the match-three part lays out a board with nothing to clear yet', sc.objects.filter((o) => o.tags.includes('مهره')).length === 42 && sc.prefabs.length === 6 && sc.cell === 120 && (await page.$('.problem')) === null);
check('and leaves nothing for the checker to point out', (await page.$('.chip-warn')) === null, await page.$eval('.stage-controls', (c) => c.textContent));
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 1.2);
g = await gameState(page);
const gemsAt = (state) => state.entities.filter((e) => e.tags.includes('مهره'));
check('match three: the board stands still until the first move', gemsAt(g).length === 42 && g.variables.score === 0, `${gemsAt(g).length} pieces, score ${g.variables.score}`);
const first = gemsAt(g).sort((a, b) => a.y - b.y || a.x - b.x)[0];
const next = gemsAt(g).find((e) => e.y === first.y && e.x === first.x + 120);
// Whether swapping these two would put either into a row or column of three alike.
const kindsAt = new Map(gemsAt(g).map((e) => [`${e.x},${e.y}`, e.values.kind]));
const wouldLine = (() => {
  const board = new Map(kindsAt);
  board.set(`${first.x},${first.y}`, next.values.kind);
  board.set(`${next.x},${next.y}`, first.values.kind);
  const run = (x, y, dx, dy) => {
    const kind = board.get(`${x},${y}`);
    let n = 1;
    for (const way of [1, -1]) for (let i = 1; board.get(`${x + dx * i * way * 120},${y + dy * i * way * 120}`) === kind; i++) n += 1;
    return n;
  };
  return [first, next].some((e) => run(e.x, e.y, 1, 0) >= 3 || run(e.x, e.y, 0, 1) >= 3);
})();
await tapAt(first);
check('match three: a touched piece is marked', await until(page, () => { const st = window.__game.getState(); return st.variables.picked === 1 && st.entities.some((e) => e.tags.includes('نشانگر')); }, null, 5000));
await tapAt(next);
await until(page, () => window.__game.getState().variables.picked === 0, null, 5000);
g = await gameState(page);
const kindAt = (x, y) => gemsAt(g).find((e) => e.x === x && e.y === y)?.values.kind;
const stayed = kindAt(first.x, first.y) === first.values.kind && kindAt(next.x, next.y) === next.values.kind && g.variables.score === 0;
check('match three: a swap happens when it lines three up, and only then', wouldLine ? await until(page, () => window.__game.getState().variables.score >= 3, null, 5000) : stayed, `would line: ${wouldLine}; now ${kindAt(first.x, first.y)},${kindAt(next.x, next.y)} from ${first.values.kind},${next.values.kind}; score ${g.variables.score}`);
check('match three: the marker goes, and the board is kept full', await until(page, () => { const st = window.__game.getState(); return !st.entities.some((e) => e.tags.includes('نشانگر')) && st.entities.filter((e) => e.tags.includes('مهره')).length === 42; }, null, 10000));
await page.screenshot({ path: resolve(shots, 'editor-8-match3.png') });
await click('توقف');

// ── The 2048 part and the start screen ─────────────────────────────────────
await freshGame();
await addPart('g2048');
sc = await scene();
check('the 2048 part lays out sixteen cells and two tiles', sc.objects.filter((o) => o.tags.includes('خانه‌ی صفحه')).length === 16 && sc.objects.filter((o) => o.tags.includes('کاشی')).length === 2 && sc.rules.length === 6 && (await page.$('.problem')) === null);
const gameScene = (await editor()).sceneId;
await addPart('startscreen');
const withStart = (await editor()).project;
check('the start-screen part adds a scene and makes the game begin there', withStart.scenes.length === 2 && withStart.startScene !== gameScene && (await page.$('.chip-warn')) === null);
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.6);
check('the game opens on the start screen', (await gameState(page)).scene === withStart.startScene);
await page.mouse.click(...(await toPage(page, 360, 1280 * 0.58)));
check('and Play leads into the game', await until(page, (id) => { const st = window.__game.getState(); return st.scene === id && !st.fading && st.time > 0.5; }, gameScene, 10000));
const tilesNow = async () => (await gameState(page)).entities.filter((e) => e.tags.includes('کاشی'));
const tilesBefore = await tilesNow();
// A quick drag to the left is a swipe. Sent in one go inside the page: on a slow machine, three separate
// mouse steps from here can take longer than a swipe may (0.6 s) and count as a slow drag.
const swipeFrom = await toPage(page, 500, 700);
const swipeTo = await toPage(page, 200, 700);
await page.evaluate(([a, b]) => {
  const el = document.querySelector('canvas');
  const at = (x, y) => ({ clientX: x, clientY: y, pointerId: 7, isPrimary: true, pointerType: 'touch', bubbles: true });
  el.dispatchEvent(new PointerEvent('pointerdown', at(a[0], a[1])));
  el.dispatchEvent(new PointerEvent('pointermove', at((a[0] + b[0]) / 2, a[1])));
  el.dispatchEvent(new PointerEvent('pointermove', at(b[0], b[1])));
  el.dispatchEvent(new PointerEvent('pointerup', at(b[0], b[1])));
}, [swipeFrom, swipeTo]);
check('2048: a swipe sends every tile to that side and brings a new one', await until(page, () => {
  const tiles = window.__game.getState().entities.filter((e) => e.tags.includes('کاشی'));
  // Two tiles on different rows both end against the left edge; the third is the newcomer.
  return tiles.length === 3 && tiles.filter((e) => e.x < 180).length >= 2;
}, null, 8000), JSON.stringify((await tilesNow()).map((e) => [e.x, e.y])) + ' from ' + JSON.stringify(tilesBefore.map((e) => [e.x, e.y])));
await page.screenshot({ path: resolve(shots, 'editor-9-2048.png') });
await click('توقف');

// ── Real physics: the sling-and-tower part and the car ─────────────────────
await freshGame();
await addPart('sling-tower');
sc = await scene();
const slung = sc.objects.find((o) => o.behaviors.some((b) => b.type === 'physics' && b.drag === 'sling'));
check('the sling-and-tower part adds a tower of crates with stars, a stone to throw and a ground', sc.objects.filter((o) => o.tags.includes('جعبه')).length === 6 && sc.objects.filter((o) => o.tags.includes('هدف')).length === 3 && slung && sc.objects.some((o) => o.tags.includes('زمین')) && sc.rules.length === 5 && (await page.$('.problem')) === null);
check('and leaves nothing for the checker to point out', (await page.$('.chip-warn')) === null, await page.$eval('.stage-controls', (c) => c.textContent));
check('the object panel says in words that the stone is thrown like a sling', (await page.$eval('.about-object', (el) => el.textContent)).includes('تیرکمان'));
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 1);
const stoneAt = async () => (await gameState(page)).entities.find((e) => e.id === slung.id);
const rest = await stoneAt();
await page.mouse.move(...(await toPage(page, rest.x + rest.width / 2, rest.y + rest.height / 2)));
await page.mouse.down();
await page.mouse.move(...(await toPage(page, rest.x + rest.width / 2 - 130, rest.y + rest.height / 2 + 70)), { steps: 8 });
await sleep(200);
await page.mouse.up();
check('sling: in the try-out, a stone pulled back and let go flies toward the tower', await until(page, (from) => window.__game.getState().entities.find((e) => e.tags.includes('پرتابی')).x > from + 150, rest.x, 8000));
await page.screenshot({ path: resolve(shots, 'editor-10-sling.png') });
await click('توقف');

await freshGame();
await addPart('car');
sc = await scene();
const carBody = sc.objects.find((o) => o.tags.includes('ماشین'));
check('the car part adds a body and two wheels joined to it on springy axles with motors the player drives', carBody && sc.objects.filter((o) => o.behaviors.some((b) => b.type === 'joint' && b.kind === 'wheel' && b.motor > 0 && b.drive === 'player')).length === 2 && (await page.$('.chip-warn')) === null);
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 1);
const carFrom = (await gameState(page)).entities.find((e) => e.id === carBody.id).x;
// Watched on the game's own clock, so a busy computer does not make the car look slow.
await until(page, () => window.__game.getState().time > 2.5, null, 30000);
const carParked = (await gameState(page)).entities.find((e) => e.id === carBody.id).x;
check('in the try-out the car waits while nobody presses the pedal', Math.abs(carParked - carFrom) < 30, `${carFrom.toFixed(0)} → ${carParked.toFixed(0)}`);
await page.keyboard.down('ArrowRight');
await until(page, () => window.__game.getState().time > 5, null, 30000);
await page.keyboard.up('ArrowRight');
const carTo = (await gameState(page)).entities.find((e) => e.id === carBody.id).x;
check('and drives along while the pedal (the right arrow) is held', carTo > carParked + 120, `${carParked.toFixed(0)} → ${carTo.toFixed(0)}`);
await click('توقف');

await freshGame();
await addPart('gears');
sc = await scene();
const podDef = sc.objects.find((o) => o.name === 'کپسول نجات');
const geared = sc.objects.filter((o) => o.behaviors.some((b) => b.type === 'joint' && b.kind === 'gear'));
check('the gears part adds a crank, a big gear and a rack, coupled by gear joints, with a capsule-shaped pod', geared.length === 2 && podDef?.behaviors.some((b) => b.type === 'physics' && b.shape === 'capsule') && (await page.$('.chip-warn')) === null && (await page.$('.problem')) === null);
await clickRow('دسته‌ی چرخ‌دنده');
check('the object panel says in words that it is a gear', (await page.$eval('.about-object', (el) => el.textContent)).includes('چرخ‌دنده است'));
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 1);
const podFrom = (await gameState(page)).entities.find((e) => e.id === podDef.id).y;
await page.keyboard.down('ArrowRight');
const podStart = (await gameState(page)).time;
await until(page, (t) => window.__game.getState().time > t + 1.5, podStart, 30000);
await page.keyboard.up('ArrowRight');
const podTo = (await gameState(page)).entities.find((e) => e.id === podDef.id).y;
check('in the try-out, holding the pedal winds the gears and the rack lifts the pod', podTo < podFrom - 100, `${podFrom.toFixed(0)} → ${podTo.toFixed(0)}`);
await page.screenshot({ path: resolve(shots, 'editor-gears.png') });
await click('توقف');

// ── More physics parts: a rope bridge, a pool, a rope to cut ───────────────
await freshGame();
await addPart('bridge');
sc = await scene();
check('the bridge part adds planks pinned one to the next in a chain', sc.objects.filter((o) => o.behaviors.some((b) => b.type === 'joint' && b.at === 'between')).length === 9 && (await page.$('.problem')) === null);
const plankStart = sc.objects.find((o) => o.name === 'تخته 4');
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 2.5, null, 20000);
const plank = (await gameState(page)).entities.find((e) => e.id === plankStart.id);
check('the bridge sags under the ball that lands on it, and holds', plank.y > plankStart.y + 5 && plank.y < plankStart.y + 200, `${plankStart.y} → ${plank.y.toFixed(0)}`);
await click('توقف');

await freshGame();
await addPart('pool');
sc = await scene();
check('the pool part adds water, with things to float or sink in it', sc.objects.some((o) => o.behaviors.some((b) => b.type === 'field' && b.kind === 'water')) && (await page.$('.problem')) === null && (await page.$('.chip-warn')) === null);
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 3, null, 20000);
g = await gameState(page);
const lightBox = g.entities.find((e) => e.id === sc.objects.find((o) => o.name === 'جعبه‌ی سبک').id);
const heavyBox = g.entities.find((e) => e.id === sc.objects.find((o) => o.name === 'جعبه‌ی سنگین').id);
check('in the pool the light crate floats above the heavy one, which sinks', lightBox.y + 120 < heavyBox.y, `light ${lightBox.y.toFixed(0)}, heavy ${heavyBox.y.toFixed(0)}`);
await click('توقف');

await freshGame();
await addPart('cut-rope');
sc = await scene();
const candy = sc.objects.find((o) => o.name === 'آب‌نبات');
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 1, null, 10000);
await page.mouse.click(...(await toPage(page, 360, 200)));
check('cut the rope: a tap cuts it and the candy falls', await until(page, ({ id, y }) => window.__game.getState().entities.find((e) => e.id === id)?.y > y + 300 || window.__game.getState().time < 0.5, { id: candy.id, y: candy.y }, 8000));
await click('توقف');

// ── Try-out tools, messages and "otherwise" ────────────────────────────────
await freshGame();
await page.evaluate(() => {
  const p = structuredClone(window.__editor.getState().project);
  p.variables.push({ name: 'got', initial: 0, saved: false }, { name: 'missed', initial: 0, saved: false });
  p.scenes[0].rules = [
    { id: 'r-ping', when: { type: 'every', seconds: 0.2 }, condition: null, then: [{ type: 'send', name: 'ping' }] },
    { id: 'r-got', when: { type: 'message', name: 'ping' }, condition: { name: 'got', op: '<', value: 3 }, then: [{ type: 'setVariable', name: 'got', op: 'add', amount: 1 }], otherwise: [{ type: 'setVariable', name: 'missed', op: 'add', amount: 1 }] },
  ];
  window.__editor.open(p);
});
await sleep(300);
await click('قانون‌ها', '.tabs');
const closedRules = await page.$$eval('.rule-closed', (rules) => rules.map((r) => r.textContent));
check('rules read as sentences with messages and "otherwise"', closedRules.some((t) => t.includes('پیام «ping» را بفرست')) && closedRules.some((t) => t.includes('وقتی پیام «ping» می‌رسد') && t.includes('وگرنه')), closedRules.join(' / '));
check('a message that is both sent and waited for is not pointed out', (await page.$('.chip-warn')) === null);
await page.click('.rule-closed[data-rule="r-got"]');
await sleep(150);
check('an open rule with a condition shows its «وگرنه» part', (await page.$('article.rule .rule-part-else')) !== null);
await click('امتحان کن');
check('during a try-out the settings give way to the game\'s inside view', await until(page, () => document.querySelector('.debug') !== null && document.querySelector('.tabs') === null, null, 5000));
check('the inside view shows values as they change', await until(page, () => document.querySelector('.debug-value[data-variable="got"] dd')?.textContent === '۳', null, 10000));
check('and lists the rules that ran, telling apart those stopped by their condition', await until(page, () => document.querySelector('.debug-rule-stopped') !== null && document.querySelector('.debug-rule:not(.debug-rule-stopped)') !== null, null, 10000));
await click('نگه دار', '.debug');
await sleep(300);
const frozen = (await gameState(page)).time;
await sleep(300);
check('«نگه دار» freezes the game', (await gameState(page)).time === frozen && (await page.evaluate(() => window.__game.getDebug().paused)));
await click('یک قدم جلو', '.debug');
check('«یک قدم جلو» moves it on by one frame', await until(page, (t) => window.__game.getState().time > t, frozen, 3000));
await tick('شکل برخورد اشیا را نشان بده', '.debug');
check('the shapes that touch can be drawn', await page.evaluate(() => window.__game.getDebug().shapes));
await page.click('.debug-rule[data-debug-rule="r-got"]');
check('a listed rule opens in the rules tab, and the try-out stops', await until(page, () => window.__game.getState().mode === 'edit' && document.querySelector('article.rule[data-rule="r-got"]') !== null, null, 5000));

// ── Levels: a screen to choose one, each opening after the last is won ─────
await freshGame();
await addPart('levels');
const withLevels = (await editor()).project;
const levelsScene = withLevels.scenes.find((x) => x.name === 'Levels');
check('the levels part adds a scene with a button per level, opens the game on it, and remembers progress on the phone', levelsScene && withLevels.startScene === levelsScene.id && withLevels.variables.some((v) => v.name === 'unlocked' && v.saved && v.initial === 1) && levelsScene.rules.some((r) => r.otherwise?.length));
check('each level gets a rule that opens the next one on the message «برد»', withLevels.scenes[0].rules.some((r) => r.when.type === 'message' && r.when.name === 'برد' && r.then.some((a) => a.type === 'setVariable' && a.name === 'unlocked')));
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.6);
const levelButton = (await gameState(page)).entities.find((e) => levelsScene.objects.find((o) => o.id === e.id)?.name.startsWith('دکمه‌ی مرحله'));
await page.mouse.click(...(await toPage(page, levelButton.x + levelButton.width / 2, levelButton.y + levelButton.height / 2)));
check('tapping level 1 starts it', await until(page, (id) => window.__game.getState().scene === id, withLevels.scenes[0].id, 5000));
await click('توقف');

// ── Painting, sprite sheets, particles, music, light and looks ─────────────
await freshGame();
await openLibrary('شکل، متن و عکس خودت');
await page.click('.modal button[data-basic="draw"]');
await page.waitForSelector('.modal .pixel-canvas');
const sheetBox = await page.$eval('.modal .pixel-canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
await tick('آینه‌ای', '.modal');
await page.mouse.move(sheetBox.x + sheetBox.w * 0.1, sheetBox.y + sheetBox.h * 0.5);
await page.mouse.down();
await page.mouse.move(sheetBox.x + sheetBox.w * 0.4, sheetBox.y + sheetBox.h * 0.5, { steps: 10 });
await page.mouse.up();
await click('ذخیره‌ی نقاشی', '.modal');
await until(page, () => document.querySelector('.modal') === null, null, 5000);
const painted = await object((await editor()).selection);
const paintedAsset = (await editor()).project.assets[painted.visual.asset];
check('the painter makes a picture of pixels, kept crisp, as a new object', painted.visual.kind === 'image' && paintedAsset.pixel === 16 && paintedAsset.src.startsWith('data:image/png'));
check('the panel offers to paint it again', (await page.$eval('.panel-inspector', (p) => p.textContent)).includes('نقاشی دوباره'));
await click('نقاشی دوباره', '.panel-inspector');
await page.waitForSelector('.modal .pixel-canvas');
const reread = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  // Row 8 of 16: painted from the left (and mirrored on the right), clear in the middle.
  const at = (cell) => g.getImageData(cell * 8 + 4, 8 * 8 + 4, 1, 1).data[3];
  return [at(2), at(13), at(8)];
}, paintedAsset.src);
check('what was painted, and its mirror image, are in the picture', reread[0] === 255 && reread[1] === 255 && reread[2] === 0, JSON.stringify(reread));
await click('انصراف', '.modal');

const sheetFile = file('sheet.png', png(64, 16, (x) => [[255, 0, 0, 255], [0, 200, 0, 255], [0, 0, 255, 255], [255, 200, 0, 255]][Math.floor(x / 16)]));
await openLibrary('شکل، متن و عکس خودت');
await upload('انیمیشن از یک عکس چندتکه', '.modal', [sheetFile]);
await page.waitForSelector('.modal .sheet-cutter');
check('a strip of four square pictures is guessed to be four frames', (await page.$eval('.modal .sheet-cutter', (c) => c.textContent)).includes('ساختن شیء با ۴ عکس'));
await click('ساختن شیء با', '.modal');
await until(page, () => document.querySelector('.modal') === null, null, 5000);
const animated = await object((await editor()).selection);
check('the sheet becomes an animated object, one picture per frame', animated.visual.kind === 'image' && animated.visual.frames?.length === 3 && animated.width === animated.height);

await pick('اضافه کردن رفتار', 'particles', '.panel-inspector');
check('particles stream even while editing, so they can be judged', await until(page, () => window.__game.getState().particles > 5, null, 5000));
await click('برف', '.panel-inspector');
check('choosing another kind of particle brings its own colour', (await object(animated.id)).behaviors.find((b) => b.type === 'particles').color === '#ffffff');
const stream = async () => (await object(animated.id)).behaviors.find(b => b.type === 'particles');
await page.click('[data-edit-particles]');
await setControl('چه جور ذره‌ای', 'dust', '.modal');
await click('انصراف', '.modal');
check('closing a particle draft keeps the saved stream', (await stream()).preset === 'snow');
await page.click('[data-edit-particles]');
await setControl('چه جور ذره‌ای', 'dust', '.modal');
await setControl('چند تا در ثانیه', 64, '.modal');
await setControl('سرعت', 1.7, '.modal');
await setControl('اندازه‌ی هر ذره', 22, '.modal');
await page.click('.modal button[aria-label="رنگ #26c6da"]');
const previewDrawn = await until(page, () => {
  const canvas = document.querySelector('.particle-preview canvas');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return false;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 70 && data[i + 1] > 150 && data[i + 2] > 160 && data[i + 3] > 30) return true;
  }
  return false;
}, null, 10000);
check('particle workshop draws the selected colour in its live preview', previewDrawn);
await page.screenshot({ path: resolve(shots, 'editor-particle-workshop.png') });
await page.click('[data-apply-particles]');
await click('یک قدم به عقب', '.topbar');
check('one undo restores the entire previous particle effect', (await stream()).preset === 'snow' && (await stream()).rate === 40);
await click('یک قدم به جلو', '.topbar');
await page.reload();
await until(page, () => window.__game && window.__editor, null, 20000);
const keptStream = await stream();
check('applied particles survive reopening the editor', keptStream.preset === 'dust' && keptStream.color === '#26c6da' &&
  keptStream.rate === 64 && keptStream.speed === 1.7 && keptStream.size === 22);
await clickRow(animated.name);
await pick('اضافه کردن رفتار', 'light', '.panel-inspector');
await click('بازی', '.tabs');
await setControl('تاریکی صحنه', 0.8);
await selectByLabel('حال و هوای تصویر', 'old');
const availableMusic = await page.$$eval('.panel-inspector select option', options => options.map(o => o.value));
check('the three new music pieces can be selected for a scene', ['music:dungeon', 'music:orbit', 'music:forest'].every(id => availableMusic.includes(id)));
await selectByLabel('موسیقی این صحنه', 'music:forest');
await selectByLabel('پس‌زمینه‌ی نقاشی‌شده', 'snow');
await tick('درخشش نورها');
const lit = await scene();
check('a scene can be made dark, given a look and given ready-made music', lit.darkness === 0.8 && lit.look === 'old' && lit.music === 'music:forest' && (await page.$('.problem')) === null);
check('and given a painted backdrop and bloom', lit.sky === 'snow' && lit.bloom === true && (await gameState(page)).sky === 'snow');
await click('شیء', '.tabs');
await click('+ شکل', '.object-list');
const plainShape = (await editor()).selection;
// New shapes start shaded; the rest is ticked on.
await tick('خط دور');
await tick('سایه‌ی نرم زیرش');
await tick('درخشش دورش');
const styled = await object(plainShape);
const drawnWithEffects = await until(page, (id) => window.__game.getState().entities.find((e) => e.id === id)?.effects === 2, plainShape, 5000);
check('a shape can be shaded, outlined, given a soft shadow and a glow', styled.visual.shade === true && Boolean(styled.visual.outline) && styled.shadow === true && Boolean(styled.glow) && drawnWithEffects, JSON.stringify(styled));
await click('بازی', '.tabs');
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.5);
g = await gameState(page);
check('in play: the look, the darkness and the ready-made music are on', g.look === 'old' && Math.abs(g.darkness - 0.8) < 0.01 && g.music === 'music:forest');
await page.screenshot({ path: resolve(shots, 'editor-11-light.png') });
await click('توقف');

// ── The guided first game, and plain words for what things do ─────────────
await freshGame();
check('a new empty game offers the guided first game', (await page.$('.welcome')) !== null);
await click('شروع آموزش قدم‌به‌قدم', '.welcome');
const glowing = (selector) => until(page, (s) => document.querySelector(s)?.classList.contains('tutor-target'), selector, 5000);
check('the guide starts, and the button to press glows', (await page.$('.tutor')) !== null && (await page.$('.welcome')) === null && await glowing('button[data-library="objects"]'));
await page.click('button[data-library="objects"]');
check('inside the library, it points at the right tab', await glowing('.modal [data-library-tab="roles"]'));
await page.click('.modal [data-library-tab="roles"]');
check('and then at the right card', await glowing('.modal button[data-block="jump-player"]'));
await page.click('.modal button[data-block="jump-player"]');
check('a step that is done gives way to the next by itself', await until(page, () => document.querySelector('.tutor-count')?.textContent.startsWith('قدم ۲'), null, 5000));
const aboutText = await page.$eval('.about-object', (d) => d.textContent);
check('an object says what it does in plain words', aboutText.includes('با لمس صفحه می‌پرد') && aboutText.includes('«زمین»'), aboutText);
check('rarely needed settings wait behind «more settings»', (await page.$('.panel-inspector .more-link')) !== null && !(await page.$eval('.panel-inspector', (p) => p.textContent)).includes('اصطکاک'));
await click('تنظیمات بیشتر', '.panel-inspector');
check('and are there when asked for', (await page.$eval('.panel-inspector', (p) => p.textContent)).includes('اصطکاک'));
await click('رد شدن از این قدم', '.tutor');
check('a step can be skipped', await until(page, () => document.querySelector('.tutor-count')?.textContent.startsWith('قدم ۳'), null, 5000) && await glowing('.stage-controls .block'));
await click('قدم قبلی', '.tutor');
await click('قدم قبلی', '.tutor');
await sleep(800);
check('and a step already done can be gone back to, to read again', (await page.$eval('.tutor-count', (c) => c.textContent)).startsWith('قدم ۱'));
await click('بستن آموزش', '.tutor');
check('the guide can be closed, and nothing is left glowing', (await page.$('.tutor')) === null && (await page.$('.tutor-target')) === null);
await click('قانون‌ها', '.tabs');
await newRule('tap');
check('an open rule without conditions keeps them out of the way', (await page.$eval('article.rule', (r) => r.textContent)).includes('+ شرط بگذار (اختیاری)') && !(await page.$eval('article.rule', (r) => r.textContent)).includes('+ شرط روی یک مقدار بازی'));
await click('+ شرط بگذار', 'article.rule');
check('and shows them when asked', (await page.$eval('article.rule', (r) => r.textContent)).includes('+ شرط روی مقدار یک شیء'));
await click('شیء', '.tabs');

// Draw across the complete inspector surface. The saved collision profile must follow the stroke.
await freshGame();
await openLibrary('شکل، متن و عکس خودت');
await page.click('[data-basic="terrain"]');
const profile = await page.waitForSelector('svg[aria-label="خط بالای زمین"]');
await profile.evaluate(el => el.scrollIntoView({ block: 'center' }));
const bounds = await profile.boundingBox();
await drag([bounds.x + 2, bounds.y + 14], [bounds.x + bounds.width - 2, bounds.y + bounds.height - 14]);
const drawn = (await object((await editor()).selection)).visual.heights;
check('drawn terrain saves a continuous rising or falling stroke', drawn.length === 65 && drawn[1] < 0.2 && drawn[63] > 0.77 && drawn[32] > 0.35 && drawn[32] < 0.65);
await page.screenshot({ path: resolve(shots, 'editor-drawn-terrain.png') });

// ── A tile map, painted with the mouse ─────────────────────────────────────
await freshGame();
await openLibrary('شکل، متن و عکس خودت');
await page.click('.modal button[data-basic="tiles"]');
await until(page, () => document.querySelector('.modal') === null, null, 10000);
await sleep(300);
const mapId = (await editor()).selection;
let map = await object(mapId);
const mapRows = map.visual.rows;
check('a tile map covers the world in whole cells, with ground along its bottom', map.visual.kind === 'tiles' && mapRows.length === Math.floor(1280 / 60) && mapRows.at(-1) === 'a'.repeat(12) && map.width === 720, JSON.stringify([mapRows.length, mapRows.at(-1), map.width]));
check('and the brush is in hand', await page.$eval('.stage-tools', (t) => [...t.querySelectorAll('button[aria-pressed="true"]')].some((b) => b.textContent === 'قلم')));
const cellAt = (col, row) => worldToPage(col * 60 + 30, row * 60 + 30);
await drag(await cellAt(2, 5), await cellAt(6, 5));
map = await object(mapId);
check('painting: a stroke fills the cells it passes over', map.visual.rows[5] === '..aaaaa.....', map.visual.rows[5]);
await page.mouse.click(...(await cellAt(4, 5)), { button: 'right' });
await sleep(200);
map = await object(mapId);
check('the right button rubs a cell out', map.visual.rows[5] === '..aa.aa.....', map.visual.rows[5]);
await click('پاک‌کن', '.panel-inspector');
await page.mouse.click(...(await cellAt(2, 5)));
await sleep(200);
map = await object(mapId);
check('and so does the rubber', map.visual.rows[5] === '...a.aa.....', map.visual.rows[5]);
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.3);
g = await gameState(page);
const pieces = g.entities.filter((e) => e.id === mapId);
check('in play, each run of cells is one solid piece in the kind\'s group', pieces.length === 3 && pieces.every((e) => e.tags.includes('زمین')) && pieces.some((e) => e.width === 120), JSON.stringify(pieces.map((e) => [e.x, e.y, e.width])));
await click('توقف');
check('no errors with the tile map', errors.length === 0, errors.join(' | '));

// ── A sample of something made during play says what it is ─────────────────
await freshGame();
await page.evaluate(() => [...document.querySelectorAll('.object-list button')].filter((b) => b.textContent.includes('+ شکل')).at(-1).click());
await sleep(200);
const sampleId = (await editor()).selection;
check('something made during play is shown as a sample, and the hint says so', (await scene()).prefabs.length === 1 && (await hint()).includes('نمونه') && (await gameState(page)).entities.some((e) => e.id === sampleId), await hint());
await drag(await toPage(page, 360, 640), await toPage(page, 200, 400));
check('the sample cannot be dragged, and stays on show while it is selected', (await gameState(page)).entities.some((e) => e.id === sampleId) && (await editor()).selection === sampleId);
await page.mouse.click(...(await toPage(page, 100, 300)));
await sleep(200);
check('choosing something else takes the sample off the scene but not out of the game', !(await gameState(page)).entities.some((e) => e.id === sampleId) && (await scene()).prefabs.length === 1 && !(await hint()).includes('نمونه'));
check('no errors in the page', errors.length === 0, errors.join(' | '));

// ── The bag: things the player carries ─────────────────────────────────────
await freshGame();
await click('بازی', '.tabs');
await page.click('[data-new-item]');
await page.waitForSelector('.modal button[data-sprite="heart"]');
await page.click('.modal button[data-sprite="heart"]');
check('a thing to carry is made from a library picture, named after it', await until(page, () => window.__editor.getState().project.variables.some((v) => v.name === 'Heart' && v.item), null, 10000) && (await page.$('.item[data-item="Heart"] img')) !== null);
check('and it is not listed again among the plain numbers', !(await page.$$eval('.panel-inspector .variable:not(.item) .variable-name', (els) => els.map((e) => e.textContent))).includes('Heart'));
await addPart('key-door');
let ed = await editor();
sc = await scene();
const keyItem = ed.project.variables.find((v) => v.name === 'Key');
check('the key-and-door part adds a key to carry, a key, a locked door and a bag', keyItem?.item && ed.project.assets[keyItem.item.asset] && sc.objects.some((o) => o.visual.kind === 'bag' && o.fixed) && sc.objects.some((o) => o.tags.includes('در قفل')) && sc.rules.some((r) => r.then.some((a) => a.type === 'give' && a.item === 'Key')) && sc.rules.some((r) => r.condition?.name === 'Key' && r.otherwise?.length));
await openLibrary('با نقش آماده');
await page.click('.modal button[data-block="jump-player"]');
await until(page, () => document.querySelector('.modal') === null, null, 10000);
await sleep(300);
check('with a player, nothing is pointed out as missing', (await page.$('.problem')) === null && (await page.$('.chip-warn')) === null);
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.5);
await page.evaluate(() => {
  const key = window.__game.entities.find((e) => e.alive && e.def.tags.includes('کلید'));
  const player = window.__game.entities.find((e) => e.def.tags.includes('بازیکن'));
  player.x = key.x;
  player.y = key.y - 20;
});
check('in the try-out, walking into the key puts it in the bag', await until(page, () => window.__game.getState().variables.Key === 1 && window.__game.getState().bag.includes('Key'), null, 10000));
await click('توقف');
check('no errors with the bag', errors.length === 0, errors.join(' | '));

for (const part of ['hearts', 'dialogue', 'shop']) {
  await freshGame();
  await addPart(part);
  sc = await scene();
  check(`the "${part}" part adds its objects and rules, with nothing pointed out as wrong`, sc.objects.length >= 3 && sc.rules.length >= 3 && (await page.$('.problem')) === null, `${sc.objects.length} objects, ${sc.rules.length} rules`);
}
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.6);
const opener = (await gameState(page)).entities.find((e) => e.width === 90 && e.height === 90);
await tapAt(opener);
check('in the try-out, the shop button opens the shop', await until(page, () => window.__game.getState().variables.shopOpen === 1, null, 5000));
await click('توقف');

for (const role of ['patrol-enemy', 'shooter-enemy', 'boss']) {
  await freshGame();
  await openLibrary('با نقش آماده');
  await page.click(`.modal button[data-block="${role}"]`);
  await until(page, () => document.querySelector('.modal') === null, null, 10000);
  await sleep(200);
  sc = await scene();
  check(`the "${role}" role makes an enemy, with nothing pointed out as wrong`, sc.objects.some((o) => o.tags.includes('خطر')) && (await page.$('.problem')) === null, JSON.stringify(sc.objects.map((o) => o.tags)));
}
check('the boss has health, a health bar and a rule for when it dies', sc.objects.some((o) => o.health === 12 && o.healthBar) && sc.rules.some((r) => r.when.type === 'dead'));
await click('امتحان کن');
check('in the try-out, the boss fires at the player', await until(page, () => window.__game.getState().entities.filter((e) => e.tags.includes('خطر')).length > 1));
await click('توقف');

await freshGame();
for (const role of ['jump-player', 'patrol-enemy']) {
  await openLibrary('با نقش آماده');
  await page.click(`.modal button[data-block="${role}"]`);
  await until(page, () => document.querySelector('.modal') === null, null, 10000);
  await sleep(200);
}
await addPart('sword');
check('the sword part adds a sword button, a swing made during play, and its rules', (await scene()).prefabs.some((o) => o.tags.includes('ضربه')) && (await page.$('.problem')) === null);
await click('امتحان کن');
check('adding a patrol beside the player lets the try-out run past the loss delay', await until(page, () => window.__game.getState().time > 0.6));
// The enemy is put right in front of the player, who faces right; then the sword button is tapped.
await page.evaluate(() => {
  const player = window.__game.entities.find((e) => e.def.tags.includes('بازیکن'));
  const enemy = window.__game.entities.find((e) => e.def.tags.includes('خطر'));
  // Both hold still (there is no ground here, so the player would otherwise be falling).
  enemy.def = { ...enemy.def, behaviors: [] };
  enemy.vx = enemy.vy = 0;
  player.def = { ...player.def, behaviors: [] };
  player.vx = player.vy = 0;
  enemy.x = player.x + player.width + 10;
  enemy.y = player.y;
});
const swordButton = (await gameState(page)).entities.find((e) => e.tags.includes('دکمه‌ی شمشیر'));
await tapAt(swordButton);
const swordHit = await until(page, () => window.__game.getState().entities.find((e) => e.tags.includes('خطر'))?.health < 2);
check('in the try-out, the sword hits the enemy in front of the player', swordHit, JSON.stringify((await gameState(page)).entities.filter((e) => e.tags.includes('خطر')).map((e) => e.health)));
await click('توقف');

// ── Templates: live copies ─────────────────────────────────────────────────
await freshGame();
await openLibrary('با نقش آماده');
await page.click('.modal button[data-block="patrol-enemy"]');
await until(page, () => document.querySelector('.modal') === null, null, 10000);
await sleep(200);
await page.click('[data-make-template]');
await sleep(200);
await page.click('[data-add-copy]');
await sleep(200);
await page.click('[data-add-copy]');
await sleep(200);
sc = await scene();
const liveCopies = sc.objects.filter((o) => o.template);
check('an object made into a template gets live copies', liveCopies.length === 3 && sc.prefabs.some((p) => p.id === liveCopies[0].template), `${liveCopies.length} copies`);
// Change one copy (its health): every copy follows, each keeping its place.
await setControl('چند ضربه تحمل کند', 5);
sc = await scene();
const followed = sc.objects.filter((o) => o.template);
check('changing one copy changes them all, and each keeps its own place', followed.every((o) => o.health === 5) && new Set(followed.map((o) => o.x)).size === 3, JSON.stringify(followed.map((o) => [o.health, o.x])));
check('no errors with templates', errors.length === 0, errors.join(' | '));

await freshGame();
await openLibrary('عکس‌های آماده');
check('the three art packs are available', await page.$$eval('.modal [data-sprite]', buttons =>
  ['torch', 'skeleton', 'chest', 'dungeon-stone', 'space-ship', 'asteroid', 'alien', 'mushroom', 'log', 'fox'].every(id => buttons.some(b => b.dataset.sprite === id))));
await page.click('.modal [data-sprite="knight"]');
await until(page, () => !document.querySelector('.modal'));
const knightArt = (await scene()).objects.at(-1);
check('a placed knight carries run, jump and hurt pictures', knightArt.visual.moveFrames?.length === 2 && knightArt.visual.airFrames?.length === 1 && knightArt.visual.hurtFrames?.length === 1);
await openLibrary('راهنمای سبک');
check('the helper offers ten genres', (await page.$$('.modal [data-genre]')).length === 10);
await page.click('.modal [data-genre="shooter"]');
await until(page, () => !document.querySelector('.modal'));
sc = await scene();
check('shooter helper keeps existing objects and wires a camera, finger controls, laser, score and hearts',
  sc.objects.some(o => o.id === knightArt.id) && sc.objects.some(o => o.behaviors.some(b => b.type === 'camera') && o.behaviors.some(b => b.type === 'followFinger')) &&
  sc.prefabs.some(o => o.behaviors.some(b => b.type === 'launch')) && sc.rules.some(r => r.then.some(a => a.name === 'score')) && sc.rules.some(r => r.then.some(a => a.name === 'lives')));

await click('یک قدم به عقب', '.topbar');
sc = await scene();
check('one undo removes the helper addition and keeps the original knight', sc.objects.length === 1 && sc.objects[0].id === knightArt.id && sc.prefabs.length === 0);

await freshGame();
await openLibrary('راهنمای سبک');
await page.click('.modal [data-genre="rescue"]');
await until(page, () => !document.querySelector('.modal'), null, 30000);
const rescue = (await editor()).project;
const leg = name => rescue.scenes.find(s => s.name === name);
check('each rescue checkpoint awards points only on its first contact', ['Cliff rescue', 'Orbital relay', 'Mountain trail', 'Rescue ridge', 'Harbor crossing'].every(name => {
  const finish = leg(name).rules.find(r => r.when.type === 'touch' && r.then.some(a => a.type === 'goToScene'));
  return finish?.condition?.name === 'claimed' && finish.condition.of === 'second' && finish.condition.value === 0 &&
    finish.then[0].type === 'setValue' && finish.then[0].name === 'claimed' && finish.then[0].amount === 1;
}));
const hinges = leg('Cliff rescue').objects.flatMap(o => o.behaviors.filter(b => b.type === 'joint'));
check('rescue chain and limbs have individual limited hinges with exactly one anchor each',
  hinges.length === 15 && hinges.every(b => b.kind === 'hinge' && b.limit > 0 && leg('Cliff rescue').objects.filter(o => o.tags.includes(b.targetTag)).length === 1));
for (const [name, count] of [['Mountain trail', 2], ['Rescue ridge', 4]]) {
  const wheels = leg(name).objects.filter(o => o.behaviors.some(b => b.type === 'joint' && b.drive === 'player'));
  check(name + ' has a steerable vehicle on an editable trail', wheels.length === count && leg(name).objects.some(o => o.visual.kind === 'terrain'));
}
check('the boat engine and the water field can be edited independently', leg('Harbor crossing').objects.some(o => o.behaviors.some(b => b.propeller > 0)) &&
  leg('Harbor crossing').objects.some(o => o.behaviors.some(b => b.kind === 'water')));

// ── The genre helper's platformer: a whole game, played ───────────────────
await freshGame();
await openLibrary('راهنمای سبک');
await page.click('.modal [data-genre="platform"]');
await until(page, () => !document.querySelector('.modal'), null, 30000);
ed = await editor();
check('the platformer is a whole game: a start screen, a win and a game-over screen, opening on the start',
  ['Start', 'You win', 'Game over'].every((n) => ed.project.scenes.some((x) => x.name === n)) && ed.project.scenes.find((x) => x.id === ed.project.startScene)?.name === 'Start' && (await page.$('.problem')) === null);
sc = await scene();
check('its level has a painted map, enemies, gems, checkpoints, a goal and a moving platform',
  sc.objects.some((o) => o.visual.kind === 'tiles') && sc.objects.filter((o) => o.tags.includes('دشمن')).length >= 4 && sc.objects.some((o) => o.tags.includes('الماس')) &&
  sc.objects.filter((o) => o.tags.includes('ایست بازرسی')).length === 2 && sc.objects.some((o) => o.tags.includes('پایان')) && sc.objects.some((o) => o.behaviors.some((b) => b.type === 'patrol') && o.tags.includes('زمین')));
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.8, null, 60000);
const playButton = (await gameState(page)).entities.find((e) => e.width === 220 && e.height === 220);
await tapAt(playButton);
await until(page, (start) => window.__game.getState().scene !== start && window.__game.getState().time > 0.6, (await gameState(page)).scene, 60000);
// Drop the hero onto a slime: it is squashed, the hero bounces, and no life is lost.
const slimesBefore = (await gameState(page)).entities.filter((e) => e.tags.includes('دشمن')).length;
await page.evaluate(() => {
  const g = window.__game;
  const slime = g.entities.find((e) => e.def.tags.includes('دشمن') && e.def.name.startsWith('لجن'));
  const hero = g.entities.find((e) => e.def.tags.includes('بازیکن'));
  slime.def = { ...slime.def, behaviors: [] };
  hero.x = slime.x + (slime.width - hero.width) / 2;
  hero.y = slime.y - 240;
  hero.vx = 0;
  hero.vy = 0;
});
check('jumping on an enemy squashes it and scores, without losing a life',
  await until(page, (n) => window.__game.getState().entities.filter((e) => e.tags.includes('دشمن')).length < n && window.__game.getState().variables.score >= 5, slimesBefore, 20000) &&
  (await gameState(page)).variables.lives === 3, JSON.stringify((await gameState(page)).variables));
await click('توقف');

// ── The genre helper's dungeon: rooms, darkness, skeletons that notice you ─
await freshGame();
await openLibrary('راهنمای سبک');
await page.click('.modal [data-genre="adventure"]');
await until(page, () => !document.querySelector('.modal'), null, 30000);
sc = await scene();
check('the dungeon has four rooms in the dark, torches, a locked door, a key to carry and skeletons with states',
  sc.objects.filter((o) => o.tags.includes('اتاق')).length === 4 && (sc.darkness ?? 0) > 0 && sc.objects.some((o) => o.behaviors.some((b) => b.type === 'light' && b.flicker)) &&
  sc.objects.some((o) => o.tags.includes('در قفل')) && (await editor()).project.variables.some((v) => v.name === 'Key' && v.item) &&
  sc.objects.some((o) => o.behaviors.some((b) => b.type === 'chase' && b.onlyIn?.includes(1))) && (await page.$('.problem')) === null);
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 0.8, null, 60000);
await tapAt((await gameState(page)).entities.find((e) => e.width === 220 && e.height === 220));
await until(page, (start) => window.__game.getState().scene !== start && window.__game.getState().time > 0.6, (await gameState(page)).scene, 60000);
// Put the knight next to a skeleton: it changes to its chasing state.
const skeletonId = await page.evaluate(() => {
  const g = window.__game;
  const bones = g.entities.find((e) => e.def.name === 'اسکلت ۱');
  const knight = g.entities.find((e) => e.def.tags.includes('بازیکن'));
  knight.x = bones.x - 260;
  knight.y = bones.y;
  return bones.def.id;
});
check('a skeleton that sees the knight starts chasing it', await until(page, (id) => window.__game.getState().entities.find((e) => e.id === id)?.values.state === 1, skeletonId, 20000));
// Room by room, nothing to pick up (coins, gems, the key, the treasure, the door) lies under the score, the
// hearts, the backpack, the stick or a button: the key once sat under the roll button and could not be seen.
const hiddenUnderHud = await page.evaluate(async () => {
  const g = window.__game;
  const knight = g.entities.find((e) => e.def.tags.includes('بازیکن'));
  const wanted = ['سکه', 'الماس', 'کلید', 'پایان', 'در قفل'];
  const box = (e) => { const b = e.view.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  const meet = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const { width: W, height: H } = g.app.renderer.screen;
  const hidden = [];
  for (const room of g.entities.filter((e) => e.def.tags.includes('اتاق'))) {
    g.variables.set('hurt', 1);
    knight.x = room.x + 100;
    knight.y = room.y + room.height * 0.4;
    g.followCameraTarget(true);
    // A few frames, for the pictures to be drawn where the camera now looks.
    for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    // (Words that come and go, like the goal at the start, are not counted.)
    const hud = g.entities.filter((e) => e.alive && e.def.fixed && e.visible && e.opacity > 0.05 && e.width < W * 0.9 && e.def.visual.kind !== 'text').map((e) => ({ name: e.def.name, ...box(e) }));
    // The resting stick, drawn in the bottom left corner.
    hud.push({ name: 'stick', x: 40, y: H - 220, w: 160, h: 160 });
    for (const e of g.entities.filter((e) => e.alive && !e.def.fixed && e.def.tags.some((t) => wanted.includes(t)))) {
      const b = box(e);
      if (b.x + b.w / 2 < 0 || b.y + b.h / 2 < 0 || b.x + b.w / 2 > W || b.y + b.h / 2 > H) continue;
      const over = hud.find((h) => meet(b, h));
      if (over) hidden.push(`${e.def.name} under ${over.name} in ${room.def.name}`);
    }
  }
  return hidden;
});
check('nothing to pick up hides under the score, hearts, backpack, stick or buttons', hiddenUnderHud.length === 0, hiddenUnderHud.join('; '));
// The sword swings the way the knight walks: up and down too, not only to the side it faces.
const swings = await page.evaluate(() => {
  const g = window.__game;
  g.app.ticker.stop();
  // Played one frame at a time, the knight's words tapped away first.
  for (let i = 0; i < 120; i++) { if (g.dialogue) g.tap(); g.advance(1 / 60); }
  const k = g.entities.find((e) => e.def.tags.includes('بازیکن'));
  const room = g.entities.find((e) => e.def.name === 'اتاق A');
  [k.x, k.y] = [room.x + room.width / 2, room.y + room.height / 2];
  const button = g.entities.find((e) => e.def.name === 'دکمه‌ی شمشیر');
  const out = {};
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft']) {
    g.variables.set('hurt', 1);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: key, bubbles: true }));
    for (let i = 0; i < 20; i++) g.advance(1 / 60);
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code: key, bubbles: true }));
    g.advance(1 / 60);
    g.tap(button.x + button.width / 2, button.y + button.height / 2);
    g.advance(1 / 60);
    const slash = g.entities.filter((e) => e.def.name === 'ضربه‌ی شمشیر' && e.alive).pop();
    out[key] = slash ? [Math.round(slash.x + slash.width / 2 - k.x - k.width / 2), Math.round(slash.y + slash.height / 2 - k.y - k.height / 2)] : null;
    for (let i = 0; i < 30; i++) g.advance(1 / 60);
  }
  g.app.ticker.start();
  return out;
});
check('the sword swings up, down and to the side, the way the knight walks',
  swings.ArrowUp?.[1] < -60 && swings.ArrowDown?.[1] > 60 && swings.ArrowLeft?.[0] < -60 && Math.abs(swings.ArrowLeft?.[1]) < 10, JSON.stringify(swings));
await click('توقف');

// ── A quest label authored in the editor ───────────────────────────────────
await freshGame();
await click('بازی', '.tabs');
await page.select('select[aria-label="نوع مقدار تازه"]', 'text');
await page.type('input[aria-label="نام مقدار تازه"]', 'quest');
await page.keyboard.press('Enter');
await setControl('متن اول بازی', 'Find the key');
await click('+ متن', '.object-list');
await setControl('متن', '{quest}');
await click('قانون‌ها', '.tabs');
await addAction(await newRule('tap'), 'setTextVariable');
await setControl('چه متنی', 'Open the gate', 'article.rule');
await click('امتحان کن');
check('quest: the editor renders the starting text', await until(page, () => window.__game.getState().time > 0.6 && window.__game.getState().entities.some(e => e.text === 'Find the key')));
await page.mouse.click(...(await toPage(page, 200, 300)));
check('quest: tapping updates the label and live debugger', await until(page, () =>
  window.__game.getState().entities.some(e => e.text === 'Open the gate') &&
  document.querySelector('.debug-values [data-variable="quest"] dd')?.textContent === 'Open the gate'));
await page.screenshot({ path: resolve(shots, 'editor-quest.png') });
await click('توقف');

// ── The game panel's tools: making a sound, the map of scenes, versions to go back to ──
await freshGame();
await openLibrary('راهنمای سبک');
await page.click('.modal [data-genre="puzzle"]');
await until(page, () => !document.querySelector('.modal'), null, 30000);
await click('بازی', '.tabs');
const sceneCount = (await editor()).project.scenes.length;
check('scene map: a card for every scene, and arrows where rules lead from one to another',
  (await page.$$eval('[data-scene-card]', (c) => c.length)) === sceneCount && (await page.$$eval('[data-link]', (l) => l.length)) >= 3,
  `${await page.$$eval('[data-scene-card]', (c) => c.length)} cards for ${sceneCount}, ${await page.$$eval('[data-link]', (l) => l.length)} links`);
const lastScene = (await editor()).project.scenes.at(-1);
await page.click(`[data-scene-card="${lastScene.id}"]`);
check('scene map: a card opens its scene', await until(page, (id) => window.__editor.getState().sceneId === id, lastScene.id, 5000));

const soundsBefore = Object.values((await editor()).project.assets).filter((a) => a.type === 'sound').length;
await page.click('[data-make-sound]');
await page.waitForSelector('[data-sfx="laser"]');
await page.click('[data-sfx="laser"]');
await page.click('[data-sfx-add]');
await until(page, () => !document.querySelector('[data-sfx-add]'), null, 5000);
const sounds = Object.values((await editor()).project.assets).filter((a) => a.type === 'sound');
check('sound maker: a made sound is added to the game as a WAV file', sounds.length === soundsBefore + 1 && sounds.some((a) => a.name === 'laser' && a.src.startsWith('data:audio/wav;base64,') && a.src.length > 2000), `${soundsBefore} → ${sounds.length}`);

await page.click('[data-keep-version]');
check('versions: keeping one lists it', await until(page, () => document.querySelectorAll('[data-restore]').length >= 1, null, 5000));
const keptObjects = (await editor()).project.scenes.reduce((n, s) => n + s.objects.length, 0);
await click('+ متن', '.object-list');
check('(a change after it)', (await editor()).project.scenes.reduce((n, s) => n + s.objects.length, 0) === keptObjects + 1);
await click('بازی', '.tabs');
// Reopening this tab loads versions from IndexedDB before the restore button appears.
await page.waitForSelector('[data-restore]', { visible: true });
await page.click('[data-restore]');
check('versions: going back to a kept version undoes what came after', await until(page, (n) => window.__editor.getState().project.scenes.reduce((m, s) => m + s.objects.length, 0) === n, keptObjects, 5000));
await page.screenshot({ path: resolve(shots, 'editor-game-tools.png') });

// ── The pictures of a game, and a pause menu whose sound setting is kept ──
await freshGame();
await addPart('pause-menu');
await click('+ عکس', '.object-list').catch(() => undefined);
await click('بازی', '.tabs');
const imageCount = Object.values((await editor()).project.assets).filter((a) => a.type === 'image').length;
check('pictures: every picture of the game is shown with how often it is used', (await page.$$eval('[data-asset]', (a) => a.length)) === imageCount && imageCount > 0, `${imageCount} pictures`);
// A picture no object uses any more: the pause button's, once the button is gone.
const pauseDef = (await scene()).objects.find((o) => o.name === 'دکمه‌ی مکث');
await page.evaluate((project) => window.__editor.open(project), { ...(await editor()).project, assets: { ...(await editor()).project.assets, spare: { type: 'image', src: (await editor()).project.assets[pauseDef.visual.asset].src } } });
await click('بازی', '.tabs');
check('pictures: one no longer used is marked, and can be removed with the others like it', await until(page, () => document.querySelector('[data-asset="spare"].unused') !== null, null, 5000));
await page.click('[data-remove-unused]');
check('pictures: removing the unused ones keeps every picture that is used', await until(page, (n) => !('spare' in window.__editor.getState().project.assets) && Object.values(window.__editor.getState().project.assets).filter((a) => a.type === 'image').length === n, imageCount, 5000));

const pauseObjects = (await scene()).objects;
check('pause menu: it has a sound button, and the game keeps the choice in a saved value', pauseObjects.some((o) => o.name === 'دکمه‌ی صدا') && (await editor()).project.variables.some((v) => v.name === 'sound' && v.saved));
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 1);
const live = async (name) => (await gameState(page)).entities.find((e) => e.id === pauseObjects.find((o) => o.name === name).id);
await tapAt(await live('دکمه‌ی مکث'));
await until(page, () => window.__game.getState().paused, null, 5000);
await sleep(200);
await tapAt(await live('دکمه‌ی صدا'));
check('pause menu: the sound button turns the sound off and says so', await until(page, () => { const s = window.__game.getState(); return !s.soundOn && s.variables.sound === 0 && s.entities.some((e) => e.text === 'Sound: off'); }, null, 5000));
await sleep(200);
await tapAt(await live('دکمه‌ی صدا'));
check('and on again', await until(page, () => { const s = window.__game.getState(); return s.soundOn && s.variables.sound === 1; }, null, 5000));
await page.screenshot({ path: resolve(shots, 'editor-pause-sound.png') });
await click('توقف');

// ── Ready-made fights: a boss with attack patterns, waves of enemies; dragging actions in a rule ──
await freshGame();
await addPart('boss');
sc = await scene();
const bossDef = sc.objects.find((o) => o.name === 'غول آخر');
check('the boss part adds a boss with a health bar, its orbs, and rules for a ring and an aimed fan', bossDef?.healthBar && sc.prefabs.some((p) => p.name === 'گوی غول') &&
  sc.rules.some((r) => r.then.some((a) => a.type === 'shoot' && a.pattern === 'ring')) && sc.rules.some((r) => r.then.some((a) => a.type === 'shoot' && a.pattern === 'aimed')));
await click('امتحان کن');
// The try-out runs slowly in a test browser: wait on the game's own clock.
 await until(page, () => window.__game.getState().time > 3, null, 90000);
check('in the try-out the boss fires a ring of orbs', await until(page, () => window.__game.getState().entities.filter((e) => e.tags.includes('گوی غول')).length >= 12, null, 30000));
await click('توقف');

await freshGame();
await addPart('waves');
sc = await scene();
check('the waves part adds two hidden gates, a wave counter and the enemy that comes', sc.objects.filter((o) => o.tags.includes('دروازه‌ی دشمن')).length === 2 && sc.prefabs.some((p) => p.name === 'دشمن موج') && (await editor()).project.variables.some((v) => v.name === 'wave' && v.initial === 1));
await click('امتحان کن');
await until(page, () => window.__game.getState().time > 4, null, 90000);
check('in the try-out enemies come in from both sides', await until(page, () => window.__game.getState().entities.filter((e) => e.tags.includes('دشمن موج')).length >= 2, null, 30000));
check('and the counter says which wave it is', (await gameState(page)).entities.some((e) => e.text === 'Wave 1'));
await click('توقف');

// A rule whose actions are put in another order by dragging one onto another.
await click('قانون‌ها', '.tabs');
const waveRule = () => page.evaluate(() => {
  const s = window.__editor.getState();
  const scene = s.project.scenes.find((x) => x.id === s.sceneId);
  return scene.rules.find((r) => r.when.type === 'every' && r.when.seconds === 15).then.map((a) => a.type);
});
const orderBefore = await waveRule();
// Open the rule that brings the next wave, so its actions and their handles show.
await page.evaluate(() => {
  const s = window.__editor.getState();
  const scene = s.project.scenes.find((x) => x.id === s.sceneId);
  const id = scene.rules.find((r) => r.when.type === 'every' && r.when.seconds === 15).id;
  document.querySelector('[data-rule="' + id + '"]').click();
});
await sleep(300);
const dragged = await page.evaluate(() => {
  const card = [...document.querySelectorAll('article.rule')].find((a) => a.querySelectorAll('[data-drag-action]').length === 3);
  if (!card) return false;
  const handles = card.querySelectorAll('[data-drag-action]');
  const target = handles[2].closest('.action');
  const data = new DataTransfer();
  handles[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: data }));
  target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }));
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  handles[0].dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: data }));
  return true;
});
const orderAfter = await waveRule();
check('dragging the first action of a rule onto the last moves it to the end', dragged && orderAfter.join() === [orderBefore[1], orderBefore[2], orderBefore[0]].join(), orderBefore.join() + ' → ' + orderAfter.join());

// ── An animation made on the timeline ──
await freshGame();
await click('+ شکل', '.object-list');
const animDef = await object((await editor()).selection);
await pick('اضافه کردن رفتار', 'animate', '.panel-inspector');
const animOf = async () => (await object(animDef.id)).behaviors.find((b) => b.type === 'animate');
check('an animation behavior starts with a gentle float of three keys', (await animOf())?.keys.length === 3);
await page.click('[data-edit-animation]');
await page.waitForSelector('[data-anim-object]');
const transformNow = () => page.$eval('[data-anim-object]', (el) => el.style.transform);
const animFirst = await transformNow();
// The preview runs on the browser's frames; a busy computer may take a moment to start them.
check('timeline: the preview plays the animation', await until(page, (first) => document.querySelector('[data-anim-object]').style.transform !== first, animFirst, 5000), animFirst);
await page.click('[data-anim-preset="spin"]');
await page.click('[data-anim-play]');
await page.evaluate(() => { const r = document.querySelector('[data-anim-scrub]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, '1'); r.dispatchEvent(new Event('input', { bubbles: true })); });
await sleep(200);
check('timeline: moving the slider shows that moment (a spin is halfway round at one second of two)', (await transformNow()).includes('rotate(180deg)'), await transformNow());
await page.click('[data-anim-add]');
check('timeline: a key can be added where the slider is', (await page.$$('[data-anim-key]')).length === 3);
await click('انصراف', '.modal');
check('cancel keeps the animation as it was', (await animOf()).keys.length === 3 && (await animOf()).keys[1].y === -24);
await page.click('[data-edit-animation]');
await page.waitForSelector('[data-anim-preset="swing"]');
await page.click('[data-anim-preset="swing"]');
await page.click('[data-anim-apply]');
check('apply puts the whole new animation on the object', (await animOf()).repeat === 'bounce' && (await animOf()).keys.some((k) => k.angle === 15));
await click('یک قدم به عقب', '.topbar');
check('and one undo takes it back', (await animOf()).repeat === 'loop' && (await animOf()).keys.length === 3);
await page.screenshot({ path: resolve(shots, 'editor-animation.png') });

// ── Making music, a cut-out character, a map's back layer ──
await freshGame();
await click('بازی', '.tabs');
await page.click('[data-make-music]');
await page.waitForSelector('[data-music-add]');
await page.click('[data-music-new]');
await page.click('[data-music-add]');
await until(page, () => !document.querySelector('[data-music-add]'), null, 15000);
const musicState = await editor();
const sceneNow = musicState.project.scenes.find((s) => s.id === musicState.sceneId);
const tune = musicState.project.assets[sceneNow.music];
check('music maker: the piece made becomes this scene\'s music, as a WAV in the game', tune?.type === 'sound' && tune.src.startsWith('data:audio/wav;base64,') && tune.src.length > 100000, sceneNow.music);

await freshGame();
await addPart('cutout');
sc = await scene();
const limbs = sc.objects.filter((o) => o.behaviors.some((b) => b.type === 'animate' && b.pivot));
check('cut-out part: four limbs pinned to a body, each swinging about its joint', sc.objects.length === 6 && limbs.length === 4 && limbs.every((o) => o.behaviors.some((b) => b.type === 'attach')));
await click('امتحان کن');
// A swing takes half a second each way: a quarter of the way and halfway are far apart.
await until(page, () => window.__game.getState().time > 0.25, null, 60000);
const armId = sc.objects.find((o) => o.name === 'دست جلویی').id;
const angle1 = (await gameState(page)).entities.find((e) => e.id === armId).angle;
await until(page, () => window.__game.getState().time > 0.5, null, 60000);
const angle2 = (await gameState(page)).entities.find((e) => e.id === armId).angle;
check('in the try-out the arm swings', Math.abs(angle2 - angle1) > 0.1, angle1.toFixed(2) + ' → ' + angle2.toFixed(2));
await click('توقف');

await freshGame();
await openLibrary('شکل، متن و عکس خودت');
await page.click('.modal button[data-basic="tiles"]');
await until(page, () => document.querySelector('.modal') === null, null, 10000);
await sleep(300);
const frontMap = (await editor()).selection;
await page.click('[data-back-layer]');
sc = await scene();
const back = sc.objects.find((o) => o.visual.kind === 'tiles' && o.id !== frontMap);
check('a map\'s back layer: an empty map of the same grid behind it, slower and touching nothing',
  back && back.parallax === 0.7 && back.tags.length === 0 && back.visual.rows.every((r) => /^\.+$/.test(r)) && sc.objects.indexOf(back) < sc.objects.findIndex((o) => o.id === frontMap));

// ── Making a game's next levels ──
await freshGame();
await openLibrary('راهنمای سبک');
await page.click('.modal [data-genre="runner"]');
await until(page, () => !document.querySelector('.modal'), null, 30000);
const levelOne = (await editor()).sceneId;
const scenesBefore = (await editor()).project.scenes.length;
await page.click('[data-make-levels]');
await page.waitForSelector('[data-levels-make]');
check('the level maker offers a new layout for this kind of game', (await page.$eval('.modal', (m) => m.textContent)).includes('بام‌ها و شکاف‌های تازه'));
check('and says what it found in the level, from its rules', (await page.$eval('[data-levels-found]', (p) => p.textContent)).includes('جایزه'), await page.$eval('[data-levels-found]', (p) => p.textContent));
await page.click('[data-levels-make]');
await until(page, () => !document.querySelector('[data-levels-make]'), null, 15000);
let levelProject = (await editor()).project;
const levelNames = levelProject.scenes.map((s) => s.name);
const newLevels = levelProject.scenes.slice(levelProject.scenes.findIndex((s) => s.id === levelOne) + 1, levelProject.scenes.findIndex((s) => s.id === levelOne) + 6);
check('five new levels come right after the level, named in order', levelProject.scenes.length === scenesBefore + 5 && newLevels.every((s, i) => s.name.endsWith('مرحله‌ی ' + (i + 2).toLocaleString('fa-IR'))), levelNames.join(' | '));
const goesTo = (s) => [...new Set(s.rules.flatMap((r) => [...r.then, ...(r.otherwise ?? [])]).filter((a) => a.type === 'goToScene').map((a) => levelProject.scenes.find((x) => x.id === a.scene)?.name))];
const firstLevel = levelProject.scenes.find((s) => s.id === levelOne);
check('each level leads to the next, and the last to the win screen', goesTo(firstLevel).includes(newLevels[0].name) && goesTo(newLevels[4]).includes('You win') && goesTo(newLevels[1]).includes(newLevels[2].name), goesTo(firstLevel).join(',') + ' / ' + goesTo(newLevels[4]).join(','));
const roofWidths = (s) => s.objects.filter((o) => o.name.startsWith('بام')).map((o) => o.width).join(',');
check('each new level has its own rooftops', new Set([firstLevel, ...newLevels].map(roofWidths)).size === 6);
const widest = (s) => { const pits = s.objects.filter((o) => o.name.startsWith('چاله')).map((o) => o.width); return Math.max(...pits); };
const meanGap = (s) => { const pits = s.objects.filter((o) => o.name.startsWith('چاله')).map((o) => o.width - 80); return pits.reduce((a, b) => a + b, 0) / pits.length; };
check('and gaps that get wider from level to level, never too wide to jump', meanGap(newLevels[4]) > meanGap(newLevels[0]) && newLevels.every((s) => widest(s) <= 250 + 80), newLevels.map((s) => Math.round(meanGap(s))).join(','));
check('each new level says which it is when it starts', newLevels.every((s, i) => s.objects.some((o) => o.visual.kind === 'text' && o.visual.text === 'Level ' + (i + 2))));
check('the editor opens the first new level', (await editor()).sceneId === newLevels[0].id);
await click('یک قدم به عقب', '.topbar');
check('one undo takes all the new levels away', (await editor()).project.scenes.length === scenesBefore);

// A game with enemyCount: they get faster and more numerous, the coins move, the place changes.
await freshGame();
await openLibrary('راهنمای سبک');
await page.click('.modal [data-genre="platform"]');
await until(page, () => !document.querySelector('.modal'), null, 30000);
await page.evaluate(() => window.__editor.makeLevels(3, 11));
await until(page, () => window.__editor.getState().project.scenes.length >= 7, null, 10000);
levelProject = (await editor()).project;
const platformLevels = levelProject.scenes.filter((s) => s.objects.some((o) => o.name === 'مرحله' && o.visual.kind === 'tiles'));
const speedOf = (s) => Math.max(...s.objects.flatMap((o) => o.behaviors.filter((b) => b.type === 'patrol' && !o.tags.includes('زمین')).map((b) => b.speed)));
const enemyCount = (s) => s.objects.filter((o) => o.tags.includes('خطر') && o.behaviors.some((b) => b.type === 'patrol')).length;
// Coins painted into the map and gems placed as objects.
const coinsAt = (s) => s.objects.find((o) => o.name === 'مرحله').visual.rows.join('/') + '|' + s.objects.filter((o) => o.tags.includes('الماس')).map((o) => Math.round(o.x) + ':' + Math.round(o.y)).join(',');
check('enemies get faster level by level', platformLevels.length === 4 && speedOf(platformLevels[3]) > speedOf(platformLevels[0]), platformLevels.map(speedOf).join(','));
check('and there are more of them', enemyCount(platformLevels[3]) > enemyCount(platformLevels[0]), platformLevels.map(enemyCount).join(','));
check('coins are in new places', coinsAt(platformLevels[1]) !== coinsAt(platformLevels[0]));
check('the place and weather change', new Set(platformLevels.map((s) => s.sky + '/' + (s.weather ?? 'none'))).size >= 2, platformLevels.map((s) => s.sky + '/' + (s.weather ?? 'none')).join(','));
check('the player stays as fast as before', new Set(platformLevels.map((s) => JSON.stringify(s.objects.find((o) => o.name === 'قهرمان').behaviors))).size === 1);
const groundOf = (s) => s.objects.find((o) => o.name === 'مرحله').visual.rows.join('/');
check('each new level has new ground: gaps, steps and floating platforms laid out afresh, longer', new Set(platformLevels.map(groundOf)).size === 4 && platformLevels[1].width > platformLevels[0].width, platformLevels.map((s) => s.width).join(','));
const spikesOf = (s) => s.objects.filter((o) => o.tags.includes('تیغ')).length;
check('with more spikes, and the checkpoints and the goal still there', spikesOf(platformLevels[3]) > spikesOf(platformLevels[0]) && platformLevels.every((s) => s.objects.filter((o) => o.tags.includes('ایست بازرسی')).length === 2 && s.objects.some((o) => o.tags.includes('پایان'))), platformLevels.map(spikesOf).join(','));
await click('امتحان کن');
check('a newLevels level plays without errors in the try-out', await until(page, () => window.__game.getState().time > 0.5, null, 60000));
await click('توقف');

// Other kinds, found from what their parts do: each new level is laid out afresh in its own way.
const levelsOf = async (genre) => {
  await freshGame();
  await openLibrary('راهنمای سبک');
  await page.click(`.modal [data-genre="${genre}"]`);
  await until(page, () => !document.querySelector('.modal'), null, 30000);
  const first = (await editor()).sceneId;
  const count = (await editor()).project.scenes.length;
  await page.evaluate(() => window.__editor.makeLevels(2, 3));
  await until(page, (n) => window.__editor.getState().project.scenes.length >= n + 2, count, 10000);
  const p = (await editor()).project;
  const at = p.scenes.findIndex((s) => s.id === first);
  return [p.scenes[at], p.scenes[at + 1], p.scenes[at + 2]];
};
const spots = (s, pick) => s.objects.filter(pick).map((o) => Math.round(o.x) + ':' + Math.round(o.y)).sort().join(',');
let lv = await levelsOf('tower');
check('tower: the ladders (and the openings in the floors) move', spots(lv[1], (o) => o.tags.includes('نردبان')) !== spots(lv[0], (o) => o.tags.includes('نردبان')));
const meets = (a, b, m = 0) => a.x < b.x + b.width + m && b.x < a.x + a.width + m && a.y < b.y + b.height + m && b.y < a.y + a.height + m;
const onStart = lv.flatMap((s, i) => {
  const hero = s.objects.find((o) => o.tags.includes('بازیکن'));
  return s.objects.filter((o) => o.tags.includes('سکه') && meets(o, hero)).map((o) => `${o.name} in level ${i + 1}`);
});
check('tower: no coin where the hero starts (it was picked up unseen, the score began at 1)', onStart.length === 0, onStart.join(', '));
lv = await levelsOf('adventure');
check('dungeon: pillars and enemies stand somewhere new, and there are more enemies', spots(lv[1], (o) => o.name.startsWith('ستون')) !== spots(lv[0], (o) => o.name.startsWith('ستون'))
  && lv[2].objects.filter((o) => o.tags.includes('خطر')).length > lv[0].objects.filter((o) => o.tags.includes('خطر')).length);
// Each room is one screen: nothing to pick up in any level lies under the score, hearts, backpack, buttons or stick.
{
  const { width: RW, height: RH } = (await editor()).project.meta;
  const covered = lv.flatMap((s, i) => {
    const hud = s.objects.filter((o) => o.fixed && o.visible !== false && (o.opacity ?? 1) > 0.05 && o.visual.kind !== 'text' && !(o.width >= RW * 0.9 && o.height >= RH * 0.9));
    hud.push({ name: 'stick', x: 40, y: RH - 220, width: 160, height: 160 });
    return s.objects.filter((o) => !o.fixed && ['سکه', 'الماس', 'کلید'].some((t) => o.tags.includes(t))).flatMap((o) => {
      const local = { x: o.x - Math.floor((o.x + o.width / 2) / RW) * RW, y: o.y - Math.floor((o.y + o.height / 2) / RH) * RH, width: o.width, height: o.height };
      const over = hud.find((h) => meets(local, h));
      return over ? [`${o.name} under ${over.name} in level ${i + 1}`] : [];
    });
  });
  check('dungeon: in every level, coins, gems and the key are clear of the score, hearts, backpack, buttons and stick', covered.length === 0, covered.join('; '));
}
lv = await levelsOf('physics');
check('rock smash: new towers of blocks, with at least as many targets', spots(lv[1], (o) => o.tags.includes('جعبه')) !== spots(lv[0], (o) => o.tags.includes('جعبه'))
  && lv[1].objects.filter((o) => o.tags.includes('هدف')).length >= lv[0].objects.filter((o) => o.tags.includes('هدف')).length);
lv = await levelsOf('puzzle');
const board = (s) => s.objects.filter((o) => o.tags.includes('مهره')).sort((a, b) => a.y - b.y || a.x - b.x).map((o) => o.values?.kind).join('');
check('puzzle: the board is shuffled', board(lv[1]) !== board(lv[0]));

// ── Narrow screen ──────────────────────────────────────────────────────────
await page.setViewport({ width: 390, height: 844 });
await sleep(300);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('no sideways scrolling on a phone-sized screen', overflow <= 0, `overflow ${overflow}px`);

await browser.close();
finish();
