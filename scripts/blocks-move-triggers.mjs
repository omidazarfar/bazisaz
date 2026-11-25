// Phase 1 helper (delete when every block is in src/blocks/): moves triggers, as they are, out of Game.ts
// (fired), labels.ts (TRIGGERS), sentences.ts (triggerSentence, subjectsOf) into one file each under
// src/blocks/triggers/, and lists them in src/blocks/registry.ts under a family comment.
//
//   node scripts/blocks-move-triggers.mjs "Screen" tap holding swipe
//
// The code is moved as it is: `this.` becomes `game.`. Checks in validate.ts are moved by hand. Then:
// node scripts/blocks-move.mjs --open, npx tsc --noEmit, and read every new file. A case shared by two triggers
// (thrown and rest) is refused: move it by hand.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './lib.mjs';

const [family, ...types] = process.argv.slice(2);
if (!family || !types.length) throw new Error('usage: node scripts/blocks-move-triggers.mjs "<family>" <trigger> ...');
const read = (f) => readFileSync(resolve(root, f), 'utf8');
const write = (f, t) => writeFileSync(resolve(root, f), t);

const game = read('src/runtime/Game.ts').split('\n');
const labels = read('src/editor/labels.ts').split('\n');
const sentences = read('src/editor/sentences.ts').split('\n');
let registry = read('src/blocks/registry.ts');

function cutCase(name) {
  const start = game.findIndex((l) => l.startsWith('  private fired(rule'));
  const end = game.findIndex((l, i) => i > start && l === '  }');
  const a = game.findIndex((l, i) => i > start && i < end && (l === `      case '${name}':` || l === `      case '${name}': {`));
  if (a < 0) throw new Error(`no case '${name}' in fired`);
  if (/^      case '/.test(game[a - 1]) || /^      case '/.test(game[a + 1])) throw new Error(`case '${name}' shares its code with another case: move by hand`);
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
  // `this` in code only: a comment saying "this frame" keeps its words.
  body = body.map((l) => (/^\s*\/\//.test(l) ? l : l.replace(/\bthis\./g, 'game.').replace(/\bthis\b/g, 'game')).replace(/^ {4}/, ''));
  return { comments: comments.map((l) => l.replace(/^ {4}/, '')), body };
}

function cutLabel(name) {
  const start = labels.findIndex((l) => l.startsWith('export const TRIGGERS:'));
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

/** `    case 'x': return …;`, perhaps over several lines (until one ends with `;`). */
function cutSentence(name) {
  const start = sentences.findIndex((l) => l.startsWith('export function triggerSentence'));
  const a = sentences.findIndex((l, i) => i > start && l.startsWith(`    case '${name}': return `));
  if (a < 0) throw new Error(`no sentence for '${name}'`);
  let b = a;
  while (!sentences[b].endsWith(';')) b++;
  const lines = sentences.slice(a, b + 1);
  sentences.splice(a, b - a + 1);
  lines[0] = lines[0].replace(`    case '${name}': return `, '');
  lines[lines.length - 1] = lines.at(-1).replace(/;$/, '');
  return lines.map((l, i) => (i === 0 ? l : l.replace(/^ {4}/, '')));
}

function cutSubjects(name) {
  const at = sentences.findIndex((l) => l.startsWith(`  if (when.type === '${name}') return `));
  if (at < 0) return null;
  const expr = sentences[at].replace(`  if (when.type === '${name}') return `, '').replace(/;$/, '');
  sentences.splice(at, 1);
  return expr;
}

mkdirSync(resolve(root, 'src/blocks/triggers'), { recursive: true });
const made = [];
for (const name of types) {
  const fired = cutCase(name);
  const editor = cutLabel(name);
  const sentence = cutSentence(name);
  const subjects = cutSubjects(name);
  const runText = fired.body.join('\n');
  const sentenceText = sentence.join('\n');
  const all = [runText, ...editor, sentenceText, subjects ?? ''].join('\n');
  const uses = (word) => new RegExp(`\\b${word}\\b`).test(all);
  const calls = (word) => new RegExp(`\\b${word}\\(`).test(runText);
  const fromFields = ['COMPARE', 'fa', 'firstItem', 'firstRef', 'hasItems', 'hasTexts', 'hasVariables', 'messageNamesOf', 'slider'].filter(uses);
  const fromSay = ['describeRef', 'OP_WORD'].filter(uses);
  const fromGeometry = ['contains', 'overlaps', 'test'].filter(calls);
  const imports = [
    /\bTAP_GRACE\b/.test(runText) ? "import { TAP_GRACE } from '../../runtime/constants';" : null,
    fromGeometry.length ? `import { ${fromGeometry.join(', ')} } from '../../runtime/geometry';` : null,
    fromFields.length ? `import { ${fromFields.join(', ')} } from '../fields';` : null,
    fromSay.length ? `import { ${fromSay.join(', ')} } from '../say';` : null,
    "import { triggerBlock } from '../types';",
  ].filter(Boolean);
  const kit = (text) => (/\bscene\b/.test(text) ? ', { scene }' : '');
  const step = ['dt', 'screenTapped', 'left'].filter((k) => new RegExp(`\\b${k}\\b`).test(runText));
  const params = [
    /\bgame\b/.test(runText) ? 'game' : '_game',
    /\bw\b/.test(runText) ? 'w' : '_w',
    /\brule\b/.test(runText) ? 'rule' : '_rule',
    step.length ? `{ ${step.join(', ')} }` : null,
  ];
  while (params.length && (params.at(-1) === null || params.at(-1).startsWith('_'))) params.pop();
  const sentenceArg = /\bw\b/.test(sentenceText) ? 'w' : '_w';
  const text = [
    ...imports,
    '',
    `export const ${name} = triggerBlock({`,
    `  type: '${name}',`,
    '  editor: {',
    ...editor.map((l) => `  ${l}`),
    '  },',
    `  sentence: (${sentenceArg}${kit(sentenceText)}) => ${sentence.join('\n')},`,
    subjects ? `  subjects: (when${kit(subjects)}) => (${subjects}),` : null,
    ...fired.comments,
    `  fired: (${params.join(', ')}) => {`,
    ...fired.body,
    '  },',
    '});',
    '',
  ].filter((l) => l !== null);
  write(`src/blocks/triggers/${name}.ts`, text.join('\n'));
  made.push(name);
}

registry = registry.replace("import type { ActionBlock", `${made.map((n) => `import { ${n} } from './triggers/${n}';`).join('\n')}\nimport type { ActionBlock`);
registry = registry.replace('const triggers = [\n', `const triggers = [\n  // ${family}.\n  ${made.join(', ')},\n`);
write('src/blocks/registry.ts', registry);
write('src/runtime/Game.ts', game.join('\n'));
write('src/editor/labels.ts', labels.join('\n'));
write('src/editor/sentences.ts', sentences.join('\n'));
console.log(`Moved ${made.length}: ${made.join(', ')}`);
