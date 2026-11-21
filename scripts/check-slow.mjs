// The whole check (build, the three test suites, every bot) one piece at a time, with Chrome in its
// low-memory mode and a pause between pieces, for a computer that is busy with other things.
// npm run check:slow   (takes about twice as long as npm run check)
import { spawnSync } from 'node:child_process';

const env = { ...process.env, LOW_MEMORY: '1' };
const steps = [
  ['build', 'npm run build'],
  ['runtime tests', 'node scripts/smoke.mjs'],
  ['editor tests', 'node scripts/editor.smoke.mjs'],
  ['server tests', 'node scripts/server.smoke.mjs'],
  ['bots', 'node scripts/bots/all.mjs'],
];
for (const [name, command] of steps) {
  console.log(`\n=== ${name} ===`);
  const run = spawnSync(command, { shell: true, stdio: 'inherit', env });
  if (run.status !== 0) {
    console.log(`\n${name} failed.`);
    process.exit(1);
  }
  // A moment for the memory to settle before the next piece.
  await new Promise((resolve) => setTimeout(resolve, 15000));
}
console.log('\nEverything passed.');
