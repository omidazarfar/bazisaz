// The local server: serves the editor and turns a game into Android files.
//
//   npm start        → http://localhost:5180
//
// One export at a time is built, because every build reuses the same Android
// project folder. Building needs Android Studio installed on this computer
// (for its Java and Android SDK); nothing is sent anywhere else.

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 5180);
const ANDROID = path.join(ROOT, 'android');
const RES = path.join(ANDROID, 'app/src/main/res');
const WEB = path.join(ANDROID, 'app/src/main/assets/public');
const EXPORTS = path.join(ROOT, 'exports');
const KEYS = path.join(ROOT, 'keys');
/** A copy of the Android project's original icons, restored before every build. */
const DEFAULT_RES = path.join(ROOT, 'server/default-res');
const WINDOWS = process.platform === 'win32';

const APP_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const MAX_BODY = 40 * 1024 * 1024;
/** Launcher icon sizes in pixels, per Android screen density. */
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

// ── Finding Java and the Android SDK ───────────────────────────────────────

function firstExisting(candidates) {
  return candidates.filter(Boolean).find((p) => existsSync(p)) ?? null;
}

/** Android Studio ships its own Java; using it means the user installs nothing else. */
function findJavaHome() {
  const exe = WINDOWS ? 'java.exe' : 'java';
  const home = os.homedir();
  return firstExisting(
    [
      process.env.JAVA_HOME,
      'C:\\Program Files\\Android\\Android Studio\\jbr',
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Android Studio', 'jbr'),
      '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
      '/opt/android-studio/jbr',
      path.join(home, 'android-studio/jbr'),
    ].filter((dir) => dir && existsSync(path.join(dir, 'bin', exe))),
  );
}

function findSdk() {
  const home = os.homedir();
  return firstExisting([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    path.join(home, 'Library/Android/sdk'),
    path.join(home, 'Android/Sdk'),
  ]);
}

/** Gradle looks for the SDK in android/local.properties; Android Studio writes it, and so do we if it is missing. */
async function ensureLocalProperties() {
  const file = path.join(ANDROID, 'local.properties');
  if (existsSync(file)) return true;
  const sdk = findSdk();
  if (!sdk) return false;
  // In a .properties file, backslashes and colons must be escaped.
  await fs.writeFile(file, `sdk.dir=${sdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}\n`);
  return true;
}

/** What is missing before an export can work, as messages for the user. */
async function problems() {
  const list = [];
  if (!existsSync(path.join(ROOT, 'dist/index.html'))) list.push('فایل بازی ساخته نشده است. دستور npm run build را اجرا کن.');
  if (!existsSync(path.join(WEB, 'cordova.js'))) list.push('پروژه‌ی اندروید آماده نیست. دستور npx cap sync android را اجرا کن.');
  if (process.env.EXPORT_GRADLE) return list; // Tests replace Gradle and need neither Java nor the SDK.
  if (!findJavaHome() && !(await runs('java', ['-version']))) {
    list.push('Java پیدا نشد. Android Studio را نصب کن؛ Java همراه آن می‌آید.');
  }
  if (!(await ensureLocalProperties())) {
    list.push('Android SDK پیدا نشد. Android Studio را یک بار باز کن تا آن را نصب کند.');
  }
  return list;
}

// ── Running commands ───────────────────────────────────────────────────────

/** Runs a command, feeding each line of output to `onLine`. Resolves with the exit code. */
function run(command, args, { cwd, env, onLine = () => {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, windowsHide: true });
    let rest = '';
    const feed = (chunk) => {
      const lines = (rest + chunk).split(/\r?\n/);
      rest = lines.pop();
      lines.forEach(onLine);
    };
    child.stdout.on('data', (d) => feed(String(d)));
    child.stderr.on('data', (d) => feed(String(d)));
    child.on('error', (error) => {
      onLine(String(error));
      resolve(-1);
    });
    child.on('close', (code) => {
      if (rest) onLine(rest);
      resolve(code ?? -1);
    });
  });
}
const runs = async (command, args) => (await run(command, args)) === 0;

// ── One export ─────────────────────────────────────────────────────────────

/** id → { status: queued|building|done|failed, step, log: string[], files: {apk, aab}, error } */
const jobs = new Map();
let queue = Promise.resolve();

function check(project) {
  if (!project || typeof project !== 'object' || !project.meta || !project.app) return 'فایل بازی ناقص است.';
  if (!APP_ID.test(String(project.app.appId))) return 'شناسه‌ی اپ درست نیست.';
  if (!Number.isInteger(project.app.versionCode) || project.app.versionCode < 1) return 'شماره‌ی نسخه باید عدد صحیح مثبت باشد.';
  if (!/^[0-9A-Za-z._-]{1,30}$/.test(String(project.app.versionName))) return 'نام نسخه فقط می‌تواند عدد، حرف انگلیسی، نقطه و خط تیره باشد.';
  if (!String(project.meta.name).trim()) return 'بازی نام ندارد.';
  return null;
}

const xml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '\\"').replace(/'/g, "\\'");
const fileSafe = (text) => String(text).replace(/[^0-9A-Za-z._-]+/g, '-').replace(/^-+|-+$/g, '') || 'game';

async function writeDataUrl(file, dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/.exec(String(dataUrl));
  if (!match) throw new Error('آیکون باید PNG باشد.');
  await fs.writeFile(file, Buffer.from(match[1], 'base64'));
}

/** Creates (once per app id) the key that proves later updates come from the same developer. */
async function signingKey(appId, javaHome, log) {
  await fs.mkdir(KEYS, { recursive: true });
  const store = path.join(KEYS, `${appId}.jks`);
  const info = path.join(KEYS, `${appId}.json`);
  if (existsSync(store) && existsSync(info)) return { store, ...JSON.parse(await fs.readFile(info, 'utf8')) };

  const secret = { password: randomBytes(18).toString('base64url'), alias: 'upload' };
  const keytool = javaHome ? path.join(javaHome, 'bin', WINDOWS ? 'keytool.exe' : 'keytool') : 'keytool';
  const code = await run(
    keytool,
    ['-genkeypair', '-keystore', store, '-alias', secret.alias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
      '-storepass', secret.password, '-keypass', secret.password, '-dname', `CN=${appId}`],
    { onLine: log },
  );
  if (code !== 0) throw new Error('ساخت کلید امضا ناموفق بود.');
  await fs.writeFile(info, JSON.stringify(secret, null, 2));
  return { store, ...secret };
}

/**
 * The player page with a game inside it. The player is one HTML file; the
 * game is handed to it as a script placed before its own. "<" is escaped so
 * that nothing inside the game's texts can end the script early.
 */
async function playerWith(project, extra = '') {
  const json = JSON.stringify(project).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const player = await fs.readFile(path.join(ROOT, 'dist/index.html'), 'utf8');
  const at = player.indexOf('<script');
  if (at < 0) throw new Error('فایل بازی شکل مورد انتظار را ندارد.');
  return `${player.slice(0, at)}<script>window.__GAME_PROJECT__=${json}${extra}</script>\n${player.slice(at)}`;
}

async function build(job, project, icons) {
  const log = (line) => {
    job.log.push(line);
    if (job.log.length > 400) job.log.shift();
  };
  const step = (text) => {
    job.step = text;
    log(`== ${text}`);
  };
  const out = path.join(EXPORTS, job.id);
  await fs.mkdir(out, { recursive: true });

  step('آماده کردن فایل‌های بازی');
  await fs.writeFile(path.join(WEB, 'index.html'), await playerWith(project));

  // Icons: back to the originals first, so one game's icon never leaks into the next.
  if (!existsSync(DEFAULT_RES)) {
    for (const d of Object.keys(DENSITIES)) await fs.cp(path.join(RES, `mipmap-${d}`), path.join(DEFAULT_RES, `mipmap-${d}`), { recursive: true });
  }
  for (const d of Object.keys(DENSITIES)) await fs.cp(path.join(DEFAULT_RES, `mipmap-${d}`), path.join(RES, `mipmap-${d}`), { recursive: true });
  if (icons) {
    for (const d of Object.keys(DENSITIES)) {
      const dir = path.join(RES, `mipmap-${d}`);
      await writeDataUrl(path.join(dir, 'ic_launcher.png'), icons.legacy[d]);
      await writeDataUrl(path.join(dir, 'ic_launcher_round.png'), icons.legacy[d]);
      await writeDataUrl(path.join(dir, 'ic_launcher_foreground.png'), icons.foreground[d]);
    }
  }

  const { appId, versionCode, versionName } = project.app;
  await fs.writeFile(
    path.join(RES, 'values/strings.xml'),
    `<?xml version='1.0' encoding='utf-8'?>\n<resources>\n    <string name="app_name">${xml(project.meta.name)}</string>\n    <string name="title_activity_main">${xml(project.meta.name)}</string>\n    <string name="package_name">${appId}</string>\n    <string name="custom_url_scheme">${appId}</string>\n</resources>\n`,
  );

  step('آماده کردن کلید امضا');
  const javaHome = findJavaHome();
  const key = await signingKey(appId, javaHome, log);

  step('ساختن با Gradle (بار اول چند دقیقه طول می‌کشد)');
  const args = [
    'assembleRelease', 'bundleRelease', '--console=plain',
    `-PappId=${appId}`, `-PversionCode=${versionCode}`, `-PversionName=${versionName}`,
    `-Porientation=${project.meta.orientation === 'landscape' ? 'landscape' : 'portrait'}`,
  ];
  if (project.ads?.enabled && !project.ads.testMode && /^ca-app-pub-\d+~\d+$/.test(project.ads.appId)) args.push(`-PadmobAppId=${project.ads.appId}`);
  // Secrets and paths go through the environment, where Gradle reads ORG_GRADLE_PROJECT_* as
  // project properties: nothing to quote, and nothing visible in the process list.
  const env = {
    ...(javaHome ? { JAVA_HOME: javaHome } : {}),
    ORG_GRADLE_PROJECT_keystoreFile: key.store,
    ORG_GRADLE_PROJECT_keystorePassword: key.password,
    ORG_GRADLE_PROJECT_keyAlias: key.alias,
  };
  const stub = process.env.EXPORT_GRADLE;
  const [command, prefix] = stub ? [process.execPath, [stub]] : WINDOWS ? ['cmd.exe', ['/c', 'gradlew.bat']] : ['./gradlew', []];
  const code = await run(command, [...prefix, ...args], { cwd: ANDROID, env, onLine: log });
  await fs.writeFile(path.join(out, 'build.log'), job.log.join('\n'));
  if (code !== 0) throw new Error('ساخت ناموفق بود. متن خطا در گزارش پایین آمده است.');

  step('کپی کردن فایل‌های آماده');
  const base = `${fileSafe(project.meta.name)}-${versionName}`;
  const outputs = path.join(ANDROID, 'app/build/outputs');
  await fs.copyFile(path.join(outputs, 'apk/release/app-release.apk'), path.join(out, `${base}.apk`));
  await fs.copyFile(path.join(outputs, 'bundle/release/app-release.aab'), path.join(out, `${base}.aab`));
  job.files = { apk: `${base}.apk`, aab: `${base}.aab` };
}

function startExport(project, icons) {
  const job = { id: `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`, status: 'queued', step: 'در صف', log: [], files: null, error: null };
  jobs.set(job.id, job);
  queue = queue.then(async () => {
    job.status = 'building';
    try {
      await build(job, project, icons);
      job.status = 'done';
      job.step = 'آماده است';
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
    }
  });
  return job;
}

// ── Trying a game on a phone ───────────────────────────────────────────────
//
// The editor sends the game it has open; a second, small server shows it to
// phones on the same Wi-Fi. That server can do nothing but show the last game
// sent (and say when a newer one has come, so the phone reloads); everything
// that builds or writes files stays on the local-only server above. It starts
// only when the user first asks to try a game on a phone.

const PHONE_PORT = Number(process.env.PHONE_PORT ?? 5181);
const phone = { project: null, version: 0, server: null, reports: new Map(), marks: [] };

/** This computer's addresses on its local networks, where a phone can reach it. */
function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address)
    // Home and office networks first; addresses of virtual adapters are less likely to be the Wi-Fi.
    .sort((a, b) => Number(/^192\.168\./.test(b)) - Number(/^192\.168\./.test(a)));
}

/**
 * On the phone: checks every 0.7 s whether a newer version was sent, and reloads if so; and every two seconds
 * tells the computer how the game runs there (frames a second, the scene, whether it lightened its effects,
 * the last errors), so the editor can show it. Reports go as GET queries: the phone server takes no posts.
 */
const RELOAD = (version) =>
  `;window.__WATERMARK__=false;(function(){var v=${version};setInterval(function(){fetch('/version',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){if(d.version!==v)location.reload()}).catch(function(){})},700);` +
  `var id;try{id=sessionStorage.getItem('phone-id')||Math.random().toString(36).slice(2,10);sessionStorage.setItem('phone-id',id)}catch(e){id=Math.random().toString(36).slice(2,10)}` +
  `var errors=[];function note(m){errors.push(String(m).slice(0,160));if(errors.length>3)errors.shift()}` +
  `addEventListener('error',function(e){note(e.message)});var ce=console.error;console.error=function(){note([].join.call(arguments,' '));return ce.apply(console,arguments)};` +
  `var frames=0,since=performance.now(),sent=0;(function count(){frames++;requestAnimationFrame(count)})();` +
  `setInterval(function(){var now=performance.now(),fps=Math.round(frames*1000/(now-since));frames=0;since=now;var s=null;try{s=window.__game&&window.__game.getState()}catch(e){}` +
  `var m=(window.__game&&window.__game.playtest)||[];if(m.length<sent)sent=0;var fresh=m.slice(sent).slice(-20);sent=m.length;` +
  `var q='id='+id+'&fps='+fps+'&v='+v+'&scene='+encodeURIComponent(s?s.scene:'')+'&light='+(s&&s.light?1:0)+'&ua='+encodeURIComponent(navigator.userAgent.slice(0,200))+'&errors='+encodeURIComponent(JSON.stringify(errors))+'&marks='+encodeURIComponent(JSON.stringify(fresh));` +
  `fetch('/report?'+q,{cache:'no-store'}).catch(function(){})},2000)})()`;

/** A phone's model, as far as its browser says: the part of the user agent in brackets, without the noise. */
function phoneName(ua) {
  const inside = /\(([^)]*)\)/.exec(ua)?.[1] ?? ua;
  const parts = inside.split(';').map((p) => p.trim().replace(/\s*Build\/.*$/, '')).filter((p) => p && !/^(Linux|U|K|wv|Mobile|x11|en-..)$/i.test(p));
  return parts.slice(0, 2).join(' · ').slice(0, 60) || 'گوشی';
}

function startPhoneServer() {
  if (phone.server) return Promise.resolve();
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') return send(res, 405, { error: 'فقط دیدن بازی ممکن است.' });
      const url = new URL(req.url, 'http://phone');
      if (url.pathname === '/version') return send(res, 200, { version: phone.version });
      if (url.pathname === '/report') {
        const q = url.searchParams;
        const id = (q.get('id') ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
        if (!id) return send(res, 400, { error: 'بدون شناسه.' });
        let errors = [];
        try { errors = JSON.parse(q.get('errors') ?? '[]').map((e) => String(e).slice(0, 160)).slice(0, 3); } catch { /* A broken report keeps its numbers. */ }
        phone.reports.set(id, {
          id, name: phoneName(q.get('ua') ?? ''), fps: Math.max(0, Math.min(240, Number(q.get('fps')) || 0)), version: Number(q.get('v')) || 0,
          scene: (q.get('scene') ?? '').slice(0, 60), light: q.get('light') === '1', errors, at: Date.now(),
        });
        // Only a handful of phones are ever looked at; forget the oldest beyond that.
        if (phone.reports.size > 8) phone.reports.delete(phone.reports.keys().next().value);
        // Playtest marks (flagship Phase G): where testers lost a life, got stuck or left, for the editor to show.
        try {
          const marks = JSON.parse(q.get('marks') ?? '[]');
          for (const m of Array.isArray(marks) ? marks.slice(0, 20) : []) {
            if (!m || !['hurt', 'stuck', 'quit'].includes(m.kind) || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
            phone.marks.push({ scene: String(m.scene ?? '').slice(0, 60), kind: m.kind, x: Math.round(m.x), y: Math.round(m.y), t: Number(m.t) || 0, phone: id, version: Number(q.get('v')) || 0 });
          }
          if (phone.marks.length > 2000) phone.marks.splice(0, phone.marks.length - 2000);
        } catch { /* A broken report keeps its numbers. */ }
        return send(res, 200, { ok: true });
      }
      if (url.pathname === '/' && phone.project) return send(res, 200, await playerWith(phone.project, RELOAD(phone.version)));
      send(res, 404, { error: 'هنوز بازی‌ای فرستاده نشده.' });
    } catch (error) {
      send(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PHONE_PORT, '0.0.0.0', () => {
      phone.server = server;
      console.log(`  بازی برای گوشی‌های همین شبکه آماده است: ${lanAddresses().map((ip) => `http://${ip}:${PHONE_PORT}/`).join('  ')}`);
      resolve();
    });
  });
}

function stopPhoneServer() {
  phone.server?.close();
  // A phone still connected would otherwise keep being served.
  phone.server?.closeAllConnections();
  phone.server = null;
  phone.project = null;
  phone.reports.clear();
}

// ── HTTP ───────────────────────────────────────────────────────────────────

function send(res, status, body, headers = {}) {
  const json = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, { 'content-type': json ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(json ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) reject(new Error('too large'));
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const route = `${req.method} ${url.pathname}`;

    if (route === 'GET /') return send(res, 200, await fs.readFile(path.join(ROOT, 'dist-editor/editor.html')));
    if (route === 'GET /api/health') return send(res, 200, { ok: true, problems: await problems(), keys: KEYS });

    if (route === 'POST /api/export') {
      // Requiring JSON stops other websites from quietly posting here: browsers
      // will not send this content type across sites without permission.
      if (!String(req.headers['content-type']).startsWith('application/json')) return send(res, 415, { error: 'JSON لازم است.' });
      const { project, icons } = JSON.parse(await readBody(req));
      const error = check(project) ?? (await problems())[0] ?? null;
      if (error) return send(res, 400, { error });
      return send(res, 200, { id: startExport(project, icons ?? null).id });
    }

    if (route === 'POST /api/phone') {
      if (!String(req.headers['content-type']).startsWith('application/json')) return send(res, 415, { error: 'JSON لازم است.' });
      const { project } = JSON.parse(await readBody(req));
      if (!project || typeof project !== 'object' || !project.meta || !Array.isArray(project.scenes)) return send(res, 400, { error: 'فایل بازی ناقص است.' });
      phone.project = project;
      phone.version += 1;
      try {
        await startPhoneServer();
      } catch (error) {
        return send(res, 500, { error: `نشد بازی را برای گوشی آماده کرد: ${error instanceof Error ? error.message : String(error)}` });
      }
      return send(res, 200, { urls: lanAddresses().map((ip) => `http://${ip}:${PHONE_PORT}/`), version: phone.version });
    }
    if (route === 'GET /api/phone/status') {
      // The phones heard from in the last ten seconds, newest first.
      const now = Date.now();
      const devices = [...phone.reports.values()].filter((r) => now - r.at < 10000).sort((a, b) => b.at - a.at)
        .map((r) => ({ ...r, current: r.version === phone.version, seen: now - r.at }));
      return send(res, 200, { on: Boolean(phone.server), version: phone.version, devices });
    }
    // Playtest marks from testers' phones (flagship Phase G); cleared to start a new round of tests.
    if (route === 'GET /api/phone/playtest') return send(res, 200, { marks: phone.marks });
    if (route === 'POST /api/phone/playtest/clear') {
      phone.marks = [];
      return send(res, 200, { ok: true });
    }
    if (route === 'POST /api/phone/stop') {
      stopPhoneServer();
      return send(res, 200, { ok: true });
    }

    const status = /^GET \/api\/export\/([a-z0-9-]+)$/.exec(route);
    if (status) {
      const job = jobs.get(status[1]);
      if (!job) return send(res, 404, { error: 'چنین خروجی‌ای نیست.' });
      return send(res, 200, { status: job.status, step: job.step, error: job.error, files: job.files, log: job.log.slice(-25) });
    }

    const file = /^GET \/api\/export\/([a-z0-9-]+)\/(apk|aab)$/.exec(route);
    if (file) {
      const job = jobs.get(file[1]);
      const name = job?.files?.[file[2]];
      if (!name) return send(res, 404, { error: 'فایل آماده نیست.' });
      return send(res, 200, await fs.readFile(path.join(EXPORTS, job.id, name)), {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="${name}"`,
      });
    }

    send(res, 404, { error: 'پیدا نشد.' });
  } catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

// Local only: this server can run builds, so it must not be reachable from the network.
server.listen(PORT, '127.0.0.1', async () => {
  console.log(`\n  ویرایشگر آماده است:  http://localhost:${PORT}\n`);
  for (const p of await problems()) console.log(`  توجه: ${p}`);
  console.log('  برای بستن، Ctrl+C را بزن.\n');
});
