// Builds each of the genre helper's games in the editor and saves it as a project file, for the bots to play.
// node scripts/bots/export.mjs [genre,genre]   (all ten by default)
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, openPage, sleep } from '../lib.mjs';

const dir = fileURLToPath(new URL('./games/', import.meta.url));
mkdirSync(dir, { recursive: true });
const genres = (process.argv[2] ?? 'platform,adventure,shooter,puzzle,physics,rescue,tower,bricks,runner,hopper').split(',');
const browser = await launch();
try {
  for (const entry of genres) {
    const [genre, levels] = entry.split(':');
    const { page, errors } = await openPage(browser, new URL('../../dist-editor/editor.html', import.meta.url).href, { viewport: { width: 1440, height: 900 } });
    const click = (t) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t || b.textContent.includes(t))?.click(), t);
    await page.waitForFunction(() => window.__game && window.__editor);
    await click('بازی جدید'); await sleep(150); await click('بله، بازی خالی'); await sleep(300);
    await page.click('[data-library="objects"]');
    await page.click('[data-library-tab="genre"]');
    await page.click(`[data-genre="${genre}"]`);
    await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 60000 });
    // The genre helper leaves the level open in the editor: its next levels are made from it.
    if (levels) {
      await page.evaluate((n) => window.__editor.makeLevels(Number(n)), levels);
      await sleep(300);
    }
    const project = await page.evaluate(() => window.__editor.getState().project);
    const name = levels ? `${genre}-levels` : genre;
    writeFileSync(`${dir}${name}.json`, JSON.stringify(project));
    console.log(name, 'saved', `${Math.round(JSON.stringify(project).length / 1024)} KB`, errors.length ? errors : '');
    await page.close();
  }
} finally {
  await browser.close();
}
