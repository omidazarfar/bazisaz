// Builds the ten genre-helper games fresh and lets a bot play each one from the start screen to the end;
// then three of them again with two levels made by the level maker, played one after another to the win.
// Fails if any game cannot be won, freezes, or shows an error. npm run bots  (needs npm run build first)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const run = (file, args = [], game = null) => spawnSync(process.execPath, [here + file, ...args], {
  encoding: 'utf8', timeout: 1500000, env: game ? { ...process.env, BOT_GAME: game } : process.env,
});
const steering = run('shooter-steering.test.mjs');
if (steering.status !== 0) { console.log(steering.stdout, steering.stderr); process.exit(1); }
const exported = run('export.mjs', ['platform,adventure,shooter,puzzle,physics,rescue,tower,bricks,runner,hopper,runner:2,hopper:2,bricks:2']);
if (exported.status !== 0) { console.log(exported.stdout, exported.stderr); process.exit(1); }
const bots = [
  ['platform', ['60']], ['adventure', ['60']], ['shooter', ['35']], ['puzzle'], ['physics'], ['rescue'], ['tower', ['90']], ['bricks', ['240']], ['runner', ['90']], ['hopper', ['90']],
  // The same games with their next two levels made: the bot must win all three in a row.
  ['runner', ['120'], 'runner-levels'], ['hopper', ['90'], 'hopper-levels'], ['bricks', ['300'], 'bricks-levels'],
];
let failed = 0;
const play = (genre, args, game) => {
  const r = run(`${genre}.mjs`, args, game);
  const result = r.stdout.split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((x) => x?.genre === genre);
  // The shooter bot plays the waves (35 s without losing everything); the others must reach "You win".
  const ok = Boolean(r.status === 0 && result && !result.errors.length && (result.outcome === 'You win' || (genre === 'shooter' && result.outcome === 'timeout' && result.elapsed >= Number(args[0]) && result.lives > 0)));
  return { ok, text: result ? JSON.stringify(result) : (r.stdout + r.stderr).slice(-600) };
};
for (const [genre, args = [], game = null] of bots) {
  const label = game ?? genre;
  // A bot, like a person, can be unlucky with random waves or boards: one more go is allowed, and said.
  let { ok, text } = play(genre, args, game);
  if (!ok) {
    console.log(`  ${label} lost once (${text}); trying again`);
    ({ ok, text } = play(genre, args, game));
  }
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${text}`);
}
console.log(failed ? `${failed} game(s) failed` : 'All ten games played through, and three of them over three levels');
process.exit(failed ? 1 : 0);
