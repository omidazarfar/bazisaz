// Removes files that earlier versions of the project had and this one does not.
// Unpacking a new version over an old folder leaves such files behind, and a
// leftover source file that no longer fits would stop the build.
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
for (const stale of ['src/editor/Picker.tsx', 'src/templates/runner.json']) {
  rmSync(resolve(root, stale), { force: true });
}
