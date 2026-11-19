// Every library picture, large, on a light and a dark backdrop, to judge the art by eye.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Pictures go to scripts/look/out/. Run `npm run build` first.
const out = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\/g, '/');
mkdirSync(out, { recursive: true });
const EDITOR = new URL('../../dist-editor/editor.html', import.meta.url).href;
const PLAYER = new URL('../../dist/index.html', import.meta.url).href;
import { launch, openPage, sleep } from '../lib.mjs';
const browser = await launch();
const { page, errors } = await openPage(browser, EDITOR, { viewport: { width: 1600, height: 1000 } });
await page.waitForFunction(() => window.__game && window.__editor, { timeout: 20000 });
await sleep(500);
await page.click('button[data-library="objects"]');
await page.waitForSelector('.modal img');
const items = await page.evaluate(() => [...document.querySelectorAll('.modal button[data-sprite]')].map((b) => ({ id: b.dataset.sprite, src: b.querySelector('img').src })));
const half = Math.ceil(items.length / 2);
for (const [n, part] of [items.slice(0, half), items.slice(half)].entries()) {
  await page.setContent(`<body style="margin:0;background:linear-gradient(90deg,#9fd3f0 50%,#1b2140 50%);display:flex;flex-wrap:wrap;gap:6px;padding:8px">${part.map((i) => `<div style="width:190px;height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;font:12px sans-serif;color:#fff;text-shadow:0 1px 2px #000"><img src="${i.src}" style="max-width:180px;max-height:125px"><span>${i.id}</span></div>`).join('')}</body>`);
  await sleep(600);
  await page.screenshot({ path: `${out}sheet${n + 1}.png`, fullPage: true });
}
console.log(items.length, errors);
await browser.close();
