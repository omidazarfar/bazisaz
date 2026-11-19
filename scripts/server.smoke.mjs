// Checks the export server end to end with Gradle replaced by a stand-in:
// requests, queueing, what is written into the Android project, signing keys
// and downloads. The real Gradle build can only be checked on a computer with
// Android Studio. Run `npm run build` and `npx cap sync android` first.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { check, finish, root, sleep } from './lib.mjs';

const PORT = 5199;
const PHONE_PORT = 5198;
const base = `http://127.0.0.1:${PORT}`;
const strings = resolve(root, 'android/app/src/main/res/values/strings.xml');
const web = resolve(root, 'android/app/src/main/assets/public/index.html');
const before = { strings: readFileSync(strings, 'utf8'), web: readFileSync(web, 'utf8') };
const APP = 'com.test.smoke';
const keyFiles = [resolve(root, `keys/${APP}.jks`), resolve(root, `keys/${APP}.json`)];
keyFiles.forEach((f) => rmSync(f, { force: true }));

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), PHONE_PORT: String(PHONE_PORT), EXPORT_GRADLE: resolve(root, 'scripts/fake-gradle.mjs') },
  stdio: 'ignore',
});
const made = [];
try {
  for (let i = 0; i < 50; i++) {
    if (await fetch(`${base}/api/health`).then((r) => r.ok, () => false)) break;
    await sleep(100);
  }

  const health = await (await fetch(`${base}/api/health`)).json();
  check('the server reports itself ready', health.ok && health.problems.length === 0, health.problems.join(' | '));
  const page = await (await fetch(base)).text();
  check('the editor is served at /', page.includes('<div id="root">'));

  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEklEQVR4nGP438fwHxkzkC4AADxAH+HggXe0AAAAAElFTkSuQmCC';
  const sizes = Object.fromEntries(['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].map((d) => [d, png]));
  const project = {
    formatVersion: 2,
    meta: { name: 'Tom & "Jerry" </script><b>', orientation: 'landscape', width: 1280, height: 720, background: '#000000', fontFamily: 'Fredoka' },
    app: { appId: APP, versionCode: 7, versionName: '1.2', icon: png },
    ads: { enabled: true, testMode: false, banner: false, appId: 'ca-app-pub-1234567890123456~1234567890', bannerId: '', interstitialId: 'x', rewardedId: '' },
    sound: true, assets: {}, variables: [], startScene: 's',
    scenes: [{ id: 's', name: 's', width: 1280, height: 720, background: null, music: null, gravity: 0, objects: [], prefabs: [], rules: [] }],
  };
  const post = (body, type = 'application/json') =>
    fetch(`${base}/api/export`, { method: 'POST', headers: { 'content-type': type }, body: JSON.stringify(body) });
  const wait = async (id) => {
    for (let i = 0; i < 200; i++) {
      const s = await (await fetch(`${base}/api/export/${id}`)).json();
      if (s.status === 'done' || s.status === 'failed') return s;
      await sleep(100);
    }
    return { status: 'timeout' };
  };

  check('a request that is not JSON is refused', (await post({ project }, 'text/plain')).status === 415);
  const bad = await post({ project: { ...project, app: { ...project.app, appId: 'Not Valid' } } });
  check('an invalid app id is refused with a message', bad.status === 400 && Boolean((await bad.json()).error));

  const first = await (await post({ project, icons: { legacy: sizes, foreground: sizes } })).json();
  made.push(first.id);
  const done = await wait(first.id);
  check('an export runs to the end', done.status === 'done', `${done.status} ${done.error ?? ''}`);
  check('the files are named after the game and version', done.files?.apk === 'Tom-Jerry-script-b-1.2.apk' && done.files?.aab === 'Tom-Jerry-script-b-1.2.aab', JSON.stringify(done.files));

  const apk = await fetch(`${base}/api/export/${first.id}/apk`);
  const record = JSON.parse(await apk.text());
  check('the APK downloads as an attachment', apk.headers.get('content-disposition')?.includes('Tom-Jerry-script-b-1.2.apk') === true);
  check('Gradle is told the app id, version and orientation', ['-PappId=com.test.smoke', '-PversionCode=7', '-PversionName=1.2', '-Porientation=landscape'].every((a) => record.args.includes(a)), record.args.join(' '));
  check('the real AdMob app id is passed when test ads are off', record.args.includes('-PadmobAppId=ca-app-pub-1234567890123456~1234567890'));
  check('a signing key is created and handed to Gradle', keyFiles.every(existsSync) && record.keystoreFile === keyFiles[0] && record.hasPassword && record.keyAlias === 'upload');

  const html = readFileSync(web, 'utf8');
  const injected = html.slice(html.indexOf('window.__GAME_PROJECT__='), html.indexOf('</script>', html.indexOf('window.__GAME_PROJECT__=')));
  check('the game is placed in the page before the player', html.indexOf('window.__GAME_PROJECT__=') > 0 && html.indexOf('window.__GAME_PROJECT__=') < html.indexOf('type="module"'));
  check('text inside the game cannot break out of its script', JSON.parse(injected.replace('window.__GAME_PROJECT__=', '')).meta.name === project.meta.name);
  const xml = readFileSync(strings, 'utf8');
  check('the app name is written safely for Android', xml.includes('<string name="app_name">Tom &amp; \\"Jerry\\" &lt;/script&gt;&lt;b&gt;</string>') && xml.includes(`<string name="package_name">${APP}</string>`));
  const icon = readFileSync(resolve(root, 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png'));
  check('the icon replaces the default one', icon.length < 200);

  const keyBefore = readFileSync(keyFiles[0]);
  const second = await (await post({ project: { ...project, app: { ...project.app, icon: null } } })).json();
  made.push(second.id);
  check('a second export of the same game also finishes', (await wait(second.id)).status === 'done');
  check('the same signing key is used again', readFileSync(keyFiles[0]).equals(keyBefore));
  check('without an icon the default one comes back', readFileSync(resolve(root, 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png')).length > 200);

  const failing = await (await post({ project: { ...project, app: { ...project.app, versionName: 'fail' } } })).json();
  made.push(failing.id);
  const failed = await wait(failing.id);
  check('a failed build is reported with its log', failed.status === 'failed' && failed.log.some((l) => l.includes('FAILURE')));

  // Trying the game on a phone: a second, show-only server on the local network.
  const phoneBase = `http://127.0.0.1:${PHONE_PORT}`;
  const share = (body) => fetch(`${base}/api/phone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  check('sending to the phone needs JSON', (await fetch(`${base}/api/phone`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status === 415);
  const shared = await (await share({ project })).json();
  check('the game is put on show for phones, with this computer\'s addresses', Array.isArray(shared.urls) && shared.urls.every((u) => u.endsWith(`:${PHONE_PORT}/`)) && shared.version >= 1, JSON.stringify(shared));
  const onPhone = await (await fetch(`${phoneBase}/`)).text();
  check('a phone gets the player with the game inside, without the "made with" note', onPhone.includes('window.__GAME_PROJECT__=') && onPhone.includes('__WATERMARK__=false') && onPhone.includes(`var v=${shared.version}`));
  const again = await (await share({ project: { ...project, meta: { ...project.meta, name: 'Changed' } } })).json();
  const version = await (await fetch(`${phoneBase}/version`)).json();
  check('each change sent raises the version the phone watches, so it reloads', again.version === shared.version + 1 && version.version === again.version);
  check('the phone server only shows: it accepts no posts', (await fetch(`${phoneBase}/api/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status === 405);
  await fetch(`${base}/api/phone/stop`, { method: 'POST' });
  check('stopping takes the game off show', await fetch(`${phoneBase}/version`).then(() => false, () => true));
} finally {
  server.kill();
  writeFileSync(strings, before.strings);
  writeFileSync(web, before.web);
  keyFiles.forEach((f) => rmSync(f, { force: true }));
  made.forEach((id) => rmSync(resolve(root, 'exports', id), { recursive: true, force: true }));
  rmSync(resolve(root, 'android/app/build'), { recursive: true, force: true });
}
finish();
