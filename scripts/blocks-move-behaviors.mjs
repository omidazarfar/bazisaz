// Phase 1 helper (delete when every block is in src/blocks/): moves behaviors, as they are, out of Game.ts
// (the switch in update), labels.ts (BEHAVIORS) and sentences.ts (behaviorSentence) into one file each under
// src/blocks/behaviors/, and lists them in src/blocks/registry.ts under a family comment.
//
//   node scripts/blocks-move-behaviors.mjs "Finger control" jumper walker
//
// The code is moved as it is: `this.` becomes `game.`; what the cases shared as locals of update is in `frame`
// (`steered = true` becomes `frame.steered = true`; dt, W, H and screenTapped are read from it); a `break;` that
// ended the case becomes `return;`. A behavior with no case of its own (handled elsewhere) gets no step. Checks
// in validate.ts are moved by hand. Then: node scripts/blocks-move.mjs --open, npx tsc --noEmit, and read every
// new file.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './lib.mjs';

const [family, ...types] = process.argv.slice(2);
if (!family || !types.length) throw new Error('usage: node scripts/blocks-move-behaviors.mjs "<family>" <behavior> ...');
const read = (f) => readFileSync(resolve(root, f), 'utf8');
const write = (f, t) => writeFileSync(resolve(root, f), t);

const game = read('src/runtime/Game.ts').split('\n');
const labels = read('src/editor/labels.ts').split('\n');
const sentences = read('src/editor/sentences.ts').split('\n');
let registry = read('src/blocks/registry.ts');

const SHARED = ['body', 'steered', 'attached'];
function cutCase(name) {
  const start = game.findIndex((l) => l.startsWith('  private update(dt'));
  const end = game.findIndex((l, i) => i > start && l === '  }');
  const a = game.findIndex((l, i) => i > start && i < end && (l === `          case '${name}':` || l === `          case '${name}': {`));
  if (a < 0) return null;
  if (/^          case '/.test(game[a - 1]) || /^          case '/.test(game[a + 1])) throw new Error(`case '${name}' shares its code with another case: move by hand`);
  let b = game.findIndex((l, i) => i > a && (/^          case '/.test(l) || l === '        }'));
  while (/^          \/\//.test(game[b - 1])) b--;
  let a0 = a;
  while (/^          \/\//.test(game[a0 - 1])) a0--;
  const comments = game.slice(a0, a);
  let body = game.slice(a + 1, b);
  if (game[a].endsWith('{')) {
    if (body.at(-1) !== '          }') throw new Error(`case '${name}': no closing brace`);
    body = body.slice(0, -1);
  }
  game.splice(a0, b - a0);
  if (/^ {12}break;$/.test(body.at(-1))) body = body.slice(0, -1);
  body = body.map((l) => {
    // `this` in code only: a comment saying "this marker" keeps its words.
    let line = /^\s*\/\//.test(l) ? l : l.replace(/\bthis\./g, 'game.').replace(/\bthis\b/g, 'game');
    for (const v of SHARED) line = line.replace(new RegExp(`(^|[^.\\w])${v} = `), `$1frame.${v} = `);
    line = line.replace(/(^|[^.\w])spawned\.push\(/, '$1frame.spawned.push(');
    if (/^ {12}\S/.test(line)) line = line.replace(/\bbreak;/, 'return;');
    return line.replace(/^ {8}/, '');
  });
  return { comments: comments.map((l) => l.replace(/^ {8}/, '')), body };
}

function cutLabel(name) {
  const start = labels.findIndex((l) => l.startsWith('export const BEHAVIORS:'));
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

/** Returns the sentence as the lines of a function body (block) or one expression. */
function cutSentence(name) {
  const start = sentences.findIndex((l) => l.startsWith('export function behaviorSentence'));
  const a = sentences.findIndex((l, i) => i > start && (l.startsWith(`    case '${name}':`)));
  if (a < 0) throw new Error(`no sentence for '${name}'`);
  if (/^    case '[^']+':$/.test(sentences[a]) && /^    case '/.test(sentences[a + 1])) throw new Error(`sentence of '${name}' is shared: move by hand`);
  if (sentences[a].endsWith('{')) {
    const b = sentences.findIndex((l, i) => i > a && l === '    }');
    const lines = sentences.slice(a + 1, b).map((l) => l.replace(/^ {4}/, ''));
    sentences.splice(a, b - a + 1);
    return { block: lines };
  }
  let first = a;
  let text;
  if (sentences[a] === `    case '${name}':`) {
    first = a + 1;
    text = sentences[first].replace(/^ {6}return /, '');
  } else text = sentences[a].replace(`    case '${name}': return `, '');
  let b = first;
  while (!sentences[b].endsWith(';')) b++;
  const lines = [text, ...sentences.slice(first + 1, b + 1).map((l) => l.replace(/^ {4}/, ''))];
  sentences.splice(a, b - a + 1);
  lines[lines.length - 1] = lines.at(-1).replace(/;$/, '');
  return { expr: lines };
}

const FIELDS = ['COMPARE', 'custom', 'fa', 'firstItem', 'firstRef', 'groundTag', 'hasItems', 'hasPrefabs', 'hasTexts', 'hasVariables', 'LOOK_OPTIONS', 'messageNamesOf', 'moving', 'slider', 'SOUND_LABEL', 'SPEED', 'TARGET'];
const SAY = ['describeRef', 'group', 'MATERIAL_LABEL', 'OP_WORD'];
const CONSTANTS = ['JUMP_BUFFER', 'JUMP_CUT', 'STICK_REACH', 'TAP_GRACE', 'SHAKE_SECONDS'];

mkdirSync(resolve(root, 'src/blocks/behaviors'), { recursive: true });
const made = [];
for (const name of types) {
  const step = cutCase(name);
  const editor = cutLabel(name);
  const sentence = cutSentence(name);
  const runText = step ? step.body.join('\n') : '';
  const sentenceText = (sentence.block ?? sentence.expr).join('\n');
  const all = [runText, ...editor, sentenceText].join('\n');
  const uses = (word, text = all) => new RegExp(`\\b${word}\\b`).test(text);
  const fromFields = FIELDS.filter((w) => uses(w));
  const fromSay = SAY.filter((w) => uses(w, sentenceText));
  const fromConstants = CONSTANTS.filter((w) => uses(w, runText));
  const imports = [
    uses('TilingSprite', runText) ? "import { TilingSprite } from 'pixi.js';" : null,
    uses('Point', runText) ? "import type { Point } from '../../runtime/Game';" : null,
    uses('PARTICLE_COLORS') ? "import { PARTICLE_COLORS } from '../../runtime/particles';" : null,
    uses('clamp', runText) ? "import { clamp } from '../../runtime/math';" : null,
    fromConstants.length ? `import { ${fromConstants.join(', ')} } from '../../runtime/constants';` : null,
    fromFields.length ? `import { ${fromFields.join(', ')} } from '../fields';` : null,
    fromSay.length ? `import { ${fromSay.join(', ')} } from '../say';` : null,
    "import { behaviorBlock } from '../types';",
  ].filter(Boolean);
  const sentenceArg = uses('b', sentenceText) ? 'b' : '_b';
  const kit = uses('scene', sentenceText) ? ', { scene }' : '';
  const sentenceLines = sentence.block
    ? [`  sentence: (${sentenceArg}${kit}) => {`, ...sentence.block.map((l) => `  ${l}`), '  },']
    : [`  sentence: (${sentenceArg}${kit}) => ${sentence.expr.join('\n')},`];
  let stepLines = [];
  if (step) {
    const fromFrame = ['dt', 'W', 'H', 'screenTapped'].filter((w) => uses(w, runText));
    const usesFrame = fromFrame.length || /\bframe\./.test(runText);
    const params = [uses('game', runText) ? 'game' : '_game', uses('e', runText) ? 'e' : '_e', uses('b', runText) ? 'b' : '_b', usesFrame ? 'frame' : null];
    while (params.length && (params.at(-1) === null || params.at(-1).startsWith('_'))) params.pop();
    stepLines = [
      ...step.comments,
      `  step: (${params.join(', ')}) => {`,
      ...(fromFrame.length ? [`    const { ${fromFrame.join(', ')} } = frame;`] : []),
      ...step.body,
      '  },',
    ];
  }
  const text = [
    ...imports,
    '',
    `export const ${name} = behaviorBlock({`,
    `  type: '${name}',`,
    '  editor: {',
    ...editor.map((l) => `  ${l}`),
    '  },',
    ...sentenceLines,
    ...stepLines,
    '});',
    '',
  ];
  write(`src/blocks/behaviors/${name}.ts`, text.join('\n'));
  made.push(name);
}

registry = registry.replace('import type { ActionBlock', `${made.map((n) => `import { ${n} } from './behaviors/${n}';`).join('\n')}\nimport type { ActionBlock`);
registry = registry.replace('const behaviors = [\n', `const behaviors = [\n  // ${family}.\n  ${made.join(', ')},\n`);
write('src/blocks/registry.ts', registry);
write('src/runtime/Game.ts', game.join('\n'));
write('src/editor/labels.ts', labels.join('\n'));
write('src/editor/sentences.ts', sentences.join('\n'));
console.log(`Moved ${made.length}: ${made.join(', ')}`);
