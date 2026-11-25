// Old projects must open and play (Phase 3, src/format/migrate.ts). Every project in scripts/fixtures/ (named
// v<format>-<what>.json) is opened in the player and played 3 s of game time, and checked by the editor as it
// would open it. There must be a fixture of every format from the oldest that opens to the current one.
// Run `npm run build` first.
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { check, finish, launch, openPage, root, shots, until } from './lib.mjs';

const player = pathToFileURL(resolve(root, 'dist/index.html')).href;
const editor = pathToFileURL(resolve(root, 'dist-editor/editor.html')).href;
const dir = resolve(root, 'scripts/fixtures');
const files = readdirSync(dir).filter((f) => /^v\d+-.+\.json$/.test(f)).sort();
const current = Number(/export const FORMAT_VERSION = (\d+);/.exec(readFileSync(resolve(root, 'src/format/types.ts'), 'utf8'))[1]);
const oldest = Number(/export const OLDEST_FORMAT = (\d+);/.exec(readFileSync(resolve(root, 'src/format/migrate.ts'), 'utf8'))[1]);

for (let v = oldest; v <= current; v++) {
  check(`there is a fixture of format ${v}`, files.some((f) => f.startsWith(`v${v}-`)), files.join(', '));
}

const browser = await launch();

// The player: each fixture opens and plays.
for (const file of files) {
  const project = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
  const { page, errors } = await openPage(browser, player, { project });
  const opened = await until(page, () => window.__game || document.querySelector('.load-error'), null, 30000);
  const refused = await page.evaluate(() => document.querySelector('.load-error')?.textContent ?? null);
  check(`${file}: opens in the player`, opened && !refused, refused ?? '');
  if (opened && !refused) {
    const played = await page.evaluate(() => {
      const g = window.__game;
      g.app.ticker.stop();
      for (let i = 0; i < 180; i++) g.advance(1 / 60);
      // A tap, as a player starting from a menu would.
      g.tap();
      for (let i = 0; i < 60; i++) g.advance(1 / 60);
      g.app.ticker.start();
      const s = g.getState();
      return { time: s.time, scene: s.scene, objects: s.entities.length, version: window.__project.formatVersion };
    });
    check(`${file}: plays 4 s of game time`, played.time >= 3.9 && played.objects > 0, JSON.stringify(played));
    check(`${file}: is current once opened (format ${played.version})`, played.version === current, JSON.stringify(played));
    await page.screenshot({ path: resolve(shots, `fixture-${file.replace(/\.json$/, '')}.png`) });
  }
  check(`${file}: no errors in the page`, errors.length === 0, errors.join(' | '));
  await page.close();
}

// A project from a newer Bazisaz is refused, saying so.
{
  const project = { ...JSON.parse(readFileSync(resolve(dir, files[0]), 'utf8')), formatVersion: current + 1 };
  const { page } = await openPage(browser, player, { project });
  await page.waitForSelector('.load-error', { timeout: 30000 });
  const message = await page.$eval('.load-error', (el) => el.textContent);
  check('a project of a newer format is refused, saying it is newer', message.includes('newer Bazisaz'), message.replace(/\n/g, ' '));
  await page.close();
}

// The editor: each fixture passes its checks as it would be opened (made current first).
{
  const { page, errors } = await openPage(browser, editor, { viewport: { width: 1440, height: 900 } });
  await page.waitForFunction(() => window.__game && window.__editor, { timeout: 60000 });
  for (const file of files) {
    const project = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
    const result = await page.evaluate((p) => window.__editor.agent.check(p), project);
    check(`${file}: the editor finds nothing that stops it running`, result.problems.length === 0, result.problems.join(' | '));
  }
  check('editor: no errors in the page', errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
finish();
