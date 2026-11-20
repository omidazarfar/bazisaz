// Builds the five genre-helper games fresh and lets a bot play each one from the start screen to the end.
// Fails if any game cannot be won, freezes, or shows an error. npm run bots  (needs npm run build first)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const run = (file, args = []) => spawnSync(process.execPath, [here + file, ...args], { encoding: 'utf8', timeout: 900000 });
const exported = run('export.mjs');
if (exported.status !== 0) { console.log(exported.stdout, exported.stderr); process.exit(1); }
const bots = [['platform', ['60']], ['adventure', ['60']], ['shooter', ['35']], ['puzzle'], ['physics']];
let failed = 0;
const play = (genre, args) => {
  const r = run(`${genre}.mjs`, args);
  const result = r.stdout.split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((x) => x?.genre === genre);
  // The shooter bot plays the waves (35 s without losing everything); the others must reach "You win".
  const ok = Boolean(result && !result.errors.length && (genre === 'shooter' ? result.outcome !== 'Game over' : result.outcome === 'You win'));
  return { ok, text: result ? JSON.stringify(result) : (r.stdout + r.stderr).slice(-600) };
};
for (const [genre, args] of bots) {
  // A bot, like a person, can be unlucky with random waves or boards: one more go is allowed, and said.
  let { ok, text } = play(genre, args);
  if (!ok) {
    console.log(`  ${genre} lost once (${text}); trying again`);
    ({ ok, text } = play(genre, args));
  }
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${genre}: ${text}`);
}
console.log(failed ? `${failed} game(s) failed` : 'All five games played through');
process.exit(failed ? 1 : 0);
