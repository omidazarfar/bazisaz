// Photograph the helper and each genre in the real try-out.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, openPage } from '../lib.mjs';

const editor = new URL('../../dist-editor/editor.html', import.meta.url).href;
const out = new URL('./out/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await launch();
try {
  for (const genre of ['platform', 'adventure', 'shooter', 'puzzle', 'physics']) {
    const context = await browser.createBrowserContext();
    const { page, errors } = await openPage(context, editor, { viewport: { width: 1440, height: 900 } });
    await page.waitForFunction(() => window.__game && window.__editor);
    await page.click('[data-library="objects"]');
    await page.click('[data-library-tab="genre"]');
    const save = name => page.screenshot({ path: fileURLToPath(new URL(name + '.png', out)) });
    if (genre === 'platform') await save('genre-helper');
    await page.click(`[data-genre="${genre}"]`);
    await page.waitForFunction(() => !document.querySelector('.modal'));
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'امتحان کن').click());
    await page.waitForFunction(() => window.__game.getState().time > 1, { timeout: 60000 });
    await save('genre-' + genre);
    if (errors.length) throw new Error(errors.join(' | '));
    await context.close();
    console.log(genre);
  }
} finally {
  await browser.close();
}
