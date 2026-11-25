// The agents' toolkit (scripts/game.mjs, AGENTS-GAMES.md) still works: every command on the example game
// and on fresh copies. Needs the built player and editor (npm run build).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { check, finish, root, shots } from './lib.mjs';

const work = resolve(shots, 'agent');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const game = (...args) => {
  const r = spawnSync(process.execPath, [resolve(root, 'scripts/game.mjs'), ...args], { cwd: work, encoding: 'utf8', timeout: 600000, env: process.env });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` };
};
const json = (file) => JSON.parse(readFileSync(resolve(work, file), 'utf8'));
copyFileSync(resolve(root, 'examples/star-catch.json'), resolve(work, 'star.json'));

let r = game('check', 'star.json');
check('the example game runs, with no warnings', r.ok && r.out.includes('It runs, and the editor has no warnings'), r.out);
r = game('run', 'star.json', '--seconds', '25');
check('played without a finger, it loses lives and reaches the game-over screen', r.ok && /lives: 5 -> 4/.test(r.out) && r.out.includes('goes to "Game over"'), r.out.slice(-800));
r = game('run', 'star.json', '--scene', 'You win', '--seconds', '1', '--tap-every', '0.5');
check('a tap on the win screen goes back to the level', r.ok && r.out.includes('goes to "Catch"'), r.out.slice(-600));
r = game('shots', 'star.json', '--out', 'shots', '--seconds', '1');
const pictures = ['01-Catch-design.png', '01-Catch-tall.png', '03-Game-over-tall.png'].map((f) => resolve(work, 'shots', f));
check('shots: a picture of every scene, in both shapes, without errors', r.ok && pictures.every((f) => existsSync(f)), r.out);

r = game('library');
const ids = [...r.out.matchAll(/^ {2}([a-z0-9-]+) +\d+x\d+/gm)].map((m) => m[1]);
check('library: lists the pictures and the parts', r.ok && ids.length > 50 && r.out.includes('pause-menu:'), r.out.slice(0, 300));
check('library: no two pictures share an id (the second could never be used)', new Set(ids).size === ids.length, ids.filter((id, i) => ids.indexOf(id) !== i).join(', '));

r = game('new', 'blank', 'mine.json');
check('new blank: an empty game that runs', r.ok && game('check', 'mine.json').ok, r.out);
r = game('picture', 'mine.json', 'knight');
const knight = r.out.split('\n').find((l) => l.startsWith('{'));
check('picture: a character is stored, with its animation and mirroring', r.ok && Boolean(knight) && JSON.parse(knight).moveFrames?.length > 0 && JSON.parse(knight).flip === true && Boolean(json('mine.json').assets['art-knight']), r.out);
r = game('part', 'mine.json', 'Level 1', 'pause-menu');
check('part: the pause menu is added to a scene, and the game still runs', r.ok && json('mine.json').scenes[0].objects.length >= 8 && game('check', 'mine.json').ok, r.out);
r = game('picture', 'mine.json', 'no-such-picture');
check('picture: an unknown id is refused with a pointer to the library', !r.ok && r.out.includes('library'), r.out);

r = game('new', 'bricks', 'bricks.json');
check('new <genre>: a finished genre game', r.ok && json('bricks.json').scenes.length === 4, r.out);
const level = json('bricks.json').scenes[0].name;
r = game('levels', 'bricks.json', level, '2');
check('levels: two harder levels after the first, and it still runs', r.ok && json('bricks.json').scenes.length === 6 && game('check', 'bricks.json').ok, r.out);

finish();
