// Shared helpers for the browser tests.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import puppeteer from 'puppeteer-core';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const shots = resolve(root, 'test-output');
mkdirSync(shots, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
export function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}
export function finish() {
  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

export function launch() {
  return puppeteer.launch({
    // Set CHROME_PATH if Chrome is installed somewhere else.
    executablePath: process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome'),
    headless: true,
    args: [
      '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      // LOW_MEMORY=1: slower, but leaves room for other programs (pages share one renderer, a smaller JS heap).
      ...(process.env.LOW_MEMORY ? ['--renderer-process-limit=1', '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--js-flags=--max-old-space-size=512'] : []),
    ],
  });
}

/** Opens a page and collects any errors it logs. */
export async function openPage(browser, url, { viewport, project, adaptiveGraphics = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport ?? { width: 412, height: 915, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  if (project) await page.evaluateOnNewDocument((p) => (window.__GAME_PROJECT__ = p), project);
  // Headless Chrome runs slowly; the player would drop its costly effects, which the tests check.
  if (!adaptiveGraphics) await page.evaluateOnNewDocument(() => (window.__LIGHTEN__ = false));
  await page.goto(url);
  return { page, errors };
}

export const gameState = (page) => page.evaluate(() => window.__game.getState());
export const entity = async (page, id) => (await gameState(page)).entities.find((e) => e.id === id);

/** Waits on the game's own clock or state, never wall-clock time: headless rendering runs slower than real time. */
export const until = (page, fn, arg, timeout = 60000) =>
  page.waitForFunction(fn, { timeout }, arg).then(() => true, () => false);
export const untilTime = (page, seconds) =>
  until(page, (t) => window.__game.getState().time >= t, seconds);

/** Page coordinates of a point given in the game's design pixels. */
export async function toPage(page, x, y, size = [720, 1280]) {
  const r = await page.$eval('canvas', (c) => {
    const b = c.getBoundingClientRect();
    return { left: b.left, top: b.top, width: b.width, height: b.height };
  });
  return [r.left + (x / size[0]) * r.width, r.top + (y / size[1]) * r.height];
}
export async function clickGame(page, x, y) {
  await page.mouse.click(...(await toPage(page, x, y)));
  await sleep(80);
}

/** A 4x4 PNG of one colour, as a data: URL. */
export function solidPng(r, g, b) {
  return png(4, 4, () => [r, g, b, 255]);
}

/** A PNG of any size, each pixel's [r, g, b, a] given by `pixel(x, y)`, as a data: URL. */
export function png(width, height, pixel) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Array.from({ length: height }, (_, y) => Buffer.from([0, ...Array.from({ length: width }, (_, x) => pixel(x, y)).flat()]));
  const file = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${file.toString('base64')}`;
}

/** A tenth of a second of silence as a WAV data: URL. */
export function silentWav() {
  const samples = 800;
  const wav = Buffer.alloc(44 + samples, 128);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + samples, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(8000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples, 40);
  return `data:audio/wav;base64,${wav.toString('base64')}`;
}
