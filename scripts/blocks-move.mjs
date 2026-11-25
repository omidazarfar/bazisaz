// Phase 1 helper (delete when every block is in src/blocks/): moves actions, as they are, out of Game.ts
// (perform), labels.ts (ACTIONS_HERE), sentences.ts (actionSentence) and validate.ts into one file each under
// src/blocks/actions/, and lists them in src/blocks/registry.ts under a family comment.
//
//   node scripts/blocks-move.mjs "Looks" setColor setImage setText
//
// The code is moved as it is: `this.` becomes `game.`, a `break;` that ended the switch case becomes `return;`.
// Then: npx tsc --noEmit, and read every new file. What the moved code needs from Game.ts must be made
// non-private there; helpers it needs from labels.ts must move to src/blocks/fields.ts (as they are).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './lib.mjs';

const [family, ...types] = process.argv.slice(2);
if (family === '--open') {
  // What the moved blocks use from Game.ts: tsc names each private member; it stops being private.
  const { spawnSync } = await import('node:child_process');
  const out = spawnSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit'], { cwd: root, encoding: 'utf8' }).stdout;
  const names = [...new Set([...out.matchAll(/Property '(\w+)' is private and only accessible within class 'Game'/g)].map((m) => m[1]))];
  let src = readFileSync(resolve(root, 'src/runtime/Game.ts'), 'utf8');
  for (const n of names) src = src.replace(new RegExp(`^  private ((?:readonly |get |async )?${n}(?![\\w$]))`, 'gm'), '  $1');
  writeFileSync(resolve(root, 'src/runtime/Game.ts'), src);
  // A `break` deeper in a case that left the switch (no loop around it) is now outside any loop: tsc says so
  // (TS1107), and it becomes `return`.
  for (const m of out.matchAll(/^(src\/blocks\/[^(]+)\((\d+),\d+\): error TS1107/gm)) {
    const file = resolve(root, m[1]);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines[Number(m[2]) - 1] = lines[Number(m[2]) - 1].replace(/\bbreak;/, 'return;');
    writeFileSync(file, lines.join('\n'));
    console.log(`${m[1]}:${m[2]}: break -> return (it left the case)`);
  }
  console.log(names.length ? `No longer private in Game.ts: ${names.join(', ')}` : 'Nothing private in the way.');
  process.exit(0);
}
if (!family || !types.length) throw new Error('usage: node scripts/blocks-move.mjs "<family>" <action> ...');
const read = (f) => readFileSync(resolve(root, f), 'utf8');
const write = (f, t) => writeFileSync(resolve(root, f), t);

let game = read('src/runtime/Game.ts').split('\n');
let labels = read('src/editor/labels.ts').split('\n');
let sentences = read('src/editor/sentences.ts').split('\n');
let validate = read('src/format/validate.ts').split('\n');
let registry = read('src/blocks/registry.ts');

function cutCase(name) {
  const start = game.findIndex((l) => l.startsWith('  private perform(action'));
  const end = game.findIndex((l, i) => i > start && l === '  }');
  const a = game.findIndex((l, i) => i > start && i < end && (l === `      case '${name}':` || l === `      case '${name}': {`));
  if (a < 0) throw new Error(`no case '${name}' in perform (shared with another case? move by hand)`);
  if (/^      case '/.test(game[a - 1])) throw new Error(`case '${name}' shares its code with another case: move by hand`);
  let b = game.findIndex((l, i) => i > a && (/^      case '/.test(l) || /^      default:/.test(l) || l === '    }'));
  while (/^      \/\//.test(game[b - 1])) b--;
  let a0 = a;
  while (/^      \/\//.test(game[a0 - 1])) a0--;
  const comments = game.slice(a0, a);
  let body = game.slice(a + 1, b);
  if (game[a].endsWith('{')) {
    if (body.at(-1) !== '      }') throw new Error(`case '${name}': no closing brace`);
    body = body.slice(0, -1);
  }
  game.splice(a0, b - a0);
  if (body.at(-1)?.trim() === 'break;' && /^ {8}break;$/.test(body.at(-1))) body = body.slice(0, -1);
  body = body.map((l) => {
    // `this` in code only: a comment saying "this device" keeps its words.
    let line = /^\s*\/\//.test(l) ? l : l.replace(/\bthis\./g, 'game.').replace(/\bthis\b/g, 'game');
    if (/^ {8}\S/.test(line)) line = line.replace(/\bbreak;/, 'return;');
    return line.replace(/^ {4}/, '');
  });
  if (body.some((l) => /\b[WH]\b/.test(l))) body.unshift('    const { width: W, height: H } = game.view;');
  return { comments: comments.map((l) => l.replace(/^ {4}/, '')), body };
}

function cutLabel(name) {
  const start = labels.findIndex((l) => l.startsWith('const ACTIONS_HERE'));
  // A short description on one line: `  destroy: { title: …, make: …, fields: […] },`.
  const one = labels.findIndex((l, i) => i > start && l.startsWith(`  ${name}: { `) && l.endsWith(' },'));
  if (one >= 0) {
    const inner = labels[one].slice(`  ${name}: { `.length, -' },'.length);
    labels.splice(one, 1);
    return [`  ${inner},`];
  }
  const a = labels.findIndex((l, i) => i > start && l === `  ${name}: {`);
  if (a < 0) throw new Error(`no label for '${name}'`);
  const b = labels.findIndex((l, i) => i > a && l === '  },');
  const entry = labels.slice(a + 1, b);
  labels.splice(a, b - a + 1);
  return entry.map((l) => l.replace(/^ {2}/, ''));
}

function cutSentence(name) {
  const start = sentences.findIndex((l) => l.startsWith('export function actionSentence'));
  const a = sentences.findIndex((l, i) => i > start && l.startsWith(`    case '${name}':`));
  if (a < 0) throw new Error(`no sentence for '${name}'`);
  if (/^    case '[^']+':$/.test(sentences[a])) throw new Error(`sentence of '${name}' is shared: move by hand`);
  let lines;
  if (sentences[a].trimEnd().endsWith('{')) {
    const b = sentences.findIndex((l, i) => i > a && l === '    }');
    lines = sentences.slice(a + 1, b).map((l) => l.replace(/^ {4}/, ''));
    sentences.splice(a, b - a + 1);
    return { block: lines };
  }
  const expr = sentences[a].replace(`    case '${name}': return `, '').replace(/;$/, '');
  sentences.splice(a, 1);
  return { expr };
}

function cutChecks(name) {
  const found = [];
  if (process.env.KEEP_CHECKS) return found;
  validate = validate.filter((l) => {
    const m = new RegExp(`^ {8}if \\(a\\.type === '${name}' && (.*)\\) say\\(\`\\$\\{where\\}: \\$\\{name\\} (.*)\`\\);$`).exec(l);
    if (m) {
      found.push(`    if (${m[1]}) say(\`${m[2]}\`);`);
      return false;
    }
    if (l.includes(`a.type === '${name}'`)) throw new Error(`validate.ts checks '${name}' in a way this tool does not move: by hand\n${l}`);
    return true;
  });
  return found;
}

const made = [];
for (const name of types) {
  const run = cutCase(name);
  const editor = cutLabel(name);
  const sentence = cutSentence(name);
  const checks = cutChecks(name);
  const all = [...run.body, ...editor, ...(sentence.block ?? [sentence.expr]), ...checks].join('\n');
  const uses = (word) => new RegExp(`\\b${word}\\b`).test(all);
  const fromFields = ['fa', 'firstRef', 'slider', 'TARGET', 'SOUND_LABEL', 'LOOK_OPTIONS'].filter(uses);
  const sentenceText = sentence.block ? sentence.block.join('\n') : sentence.expr;
  const kit = ['project', 'scene', 'who'].filter((k) => new RegExp(`\\b${k}\\b`).test(sentenceText));
  const kitArg = kit.length ? `, { ${kit.join(', ')} }` : '';
  const sentenceArg = /\ba\b/.test(sentenceText) ? 'a' : '_a';
  const ctx = /\bcontext\b/.test(run.body.join('\n'));
  const act = /\baction\b/.test(run.body.join('\n'));
  const imports = [
    uses('clamp') ? "import { clamp } from '../../runtime/math';" : null,
    fromFields.length ? `import { ${fromFields.join(', ')} } from '../fields';` : null,
    "import { actionBlock } from '../types';",
  ].filter(Boolean);
  const text = [
    ...imports,
    '',
    `export const ${name} = actionBlock({`,
    `  type: '${name}',`,
    '  editor: {',
    ...editor.map((l) => `  ${l}`),
    '  },',
    sentence.block
      ? [`  sentence: (${sentenceArg}${kitArg}) => {`, ...sentence.block.map((l) => `  ${l}`), '  },'].join('\n')
      : `  sentence: (${sentenceArg}${kitArg}) => ${sentence.expr},`,
    ...(checks.length ? [`  check: (a, { ${checks.some((c) => c.includes("project")) ? "project, " : ""}say }) => {`, ...checks, "  },"] : []),
    ...run.comments.map((l) => `  ${l}`),
    `  run: (game, ${act ? 'action' : '_action'}${ctx ? ', context' : ''}) => {`,
    ...run.body,
    '  },',
    '});',
    '',
  ].join('\n');
  write(`src/blocks/actions/${name}.ts`, text);
  made.push(name);
}

// The registry: imports, and the family's line.
const importLines = made.map((n) => `import { ${n} } from './actions/${n}';`).join('\n');
registry = registry.replace(/(import type \{ ActionBlock \} from '\.\/types';)/, `${importLines}\n$1`);
registry = registry.replace('\n] as const;', `\n  // ${family}.\n  ${made.join(', ')},\n] as const;`);
write('src/blocks/registry.ts', registry);
write('src/runtime/Game.ts', game.join('\n'));
write('src/editor/labels.ts', labels.join('\n'));
write('src/editor/sentences.ts', sentences.join('\n'));
write('src/format/validate.ts', validate.join('\n'));
console.log(`Moved ${made.join(', ')}. Now: npx tsc --noEmit, then read each file in src/blocks/actions/.`);
