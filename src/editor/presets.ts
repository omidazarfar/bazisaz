import type { Action, Behavior, GameObject, GameProject, PhysicsBehavior, Rule } from '../format/types';
import { makeObject, newId, updateObject, updateScene } from './state';

/**
 * Ready-made roles. A role is a shortcut, not a different kind of object: it
 * adds ordinary groups, behaviors and rules in one step, and everything it
 * adds can be changed or removed afterwards like anything made by hand.
 */
export interface Preset {
  id: string;
  title: string;
  about: string;
  /** Offered only for objects it makes sense for. */
  fits?: (object: GameObject) => boolean;
  apply: (project: GameProject, sceneId: string, objectId: string) => GameProject;
}

// The group names the roles agree on, so that a "player" and a "prize" made separately find each other.
export const PLAYER = 'بازیکن';
export const GROUND = 'زمین';
export const PRIZE = 'جایزه';
export const DANGER = 'خطر';
export const CRATE = 'جعبه';
export const THROWN = 'پرتابی';

/** Real physics that stands on the ground and stays inside the world; the roles and parts start from this. */
export const physics = (extra: Partial<PhysicsBehavior> = {}): PhysicsBehavior => ({
  type: 'physics', kind: 'moving', solidTag: GROUND, bounce: 0.1, friction: 0.6, weight: 1, rotates: true, gravity: true, slowdown: 0, edges: true, drag: 'none', power: 8, ...extra,
});

/** An object still carrying the name it was created with ("شکل ۳") takes the role's name; one the user named keeps its own. */
const nameFor = (o: GameObject, name: string) => (/^(شکل|متن)( |$)/.test(o.name) ? name : o.name);

/** Changes one object: names it, adds it to a group and gives it behaviors, replacing any of the same type. */
function shape(project: GameProject, sceneId: string, id: string, name: string, tag: string, behaviors: Behavior[] = []): GameProject {
  return updateObject(project, sceneId, id, (o) => ({
    ...o,
    name: nameFor(o, name),
    tags: !o.tags.includes(tag) ? [...o.tags, tag] : o.tags,
    behaviors: [...o.behaviors.filter((b) => !behaviors.some((n) => n.type === b.type)), ...behaviors],
  }));
}

export function withVariable(project: GameProject, name: string): GameProject {
  if (project.variables.some((v) => v.name === name)) return project;
  return { ...project, variables: [...project.variables, { name, initial: 0, saved: false }] };
}

/** Adds "when group a touches group b, do this", unless the scene already has a rule for that pair. */
export function withTouchRule(project: GameProject, sceneId: string, a: string, b: string, then: Action[]): GameProject {
  return updateScene(project, sceneId, (s) => {
    const exists = s.rules.some(
      (r) => r.when.type === 'touch' && r.when.a.by === 'tag' && r.when.a.tag === a && r.when.b.by === 'tag' && r.when.b.tag === b,
    );
    if (exists) return s;
    const rule: Rule = { id: newId('rule'), when: { type: 'touch', a: { by: 'tag', tag: a }, b: { by: 'tag', tag: b } }, condition: null, then };
    return { ...s, rules: [...s.rules, rule] };
  });
}

/** Losing: a sound, a breath, then the scene again with the score back at its start. */
/**
 * What shooting enemies fire: a glowing red ball, made during play, that
 * flies at the nearest player and is gone after a few seconds. The shooter
 * fires one every `seconds`, on its own clock.
 */
function withBullets(project: GameProject, sceneId: string, shooterId: string, seconds: number): GameProject {
  const bullet = makeObject('گلوله‌ی دشمن', { kind: 'ellipse', color: '#ff4d5e', shade: true }, 30, 30, { x: 0, y: 0 }, {
    tags: [DANGER], round: true, glow: '#ff4d5e',
    behaviors: [{ type: 'launch', vx: 0, vy: 0, toward: 'group', targetTag: PLAYER, speed: 420 }, { type: 'lifetime', seconds: 3 }],
  });
  const fire: Rule = {
    id: newId('rule'),
    when: { type: 'eachEvery', target: { by: 'id', id: shooterId }, seconds },
    condition: null,
    then: [{ type: 'spawn', prefab: bullet.id, at: 'first' }, { type: 'playSound', sound: 'laser' }],
  };
  return updateScene(project, sceneId, (s) => ({ ...s, prefabs: [...s.prefabs, bullet], rules: [...s.rules, fire] }));
}

export const LOSE: Action[] = [{ type: 'shake', strength: 14 }, { type: 'playSound', sound: 'lose' }, { type: 'wait', seconds: 0.4 }, { type: 'resetVariables' }, { type: 'restartScene' }];
const isShape = (o: GameObject) => o.visual.kind !== 'text' && o.visual.kind !== 'bar';

export const PRESETS: Preset[] = [
  {
    id: 'jump-player',
    title: 'بازیکنی که با لمس صفحه می‌پرد',
    about: 'جاذبه دارد و روی اشیای گروه «زمین» می‌ایستد. به زمین بازی‌ات هم نقش «زمین یا دیوار» بده.',
    fits: isShape,
    apply: (p, s, id) =>
      updateObject(
        shape(p, s, id, 'بازیکن', PLAYER, [
          { type: 'body', gravity: true, solidTag: GROUND, bounce: 0, edges: 'stop', oneWay: false },
          { type: 'jumper', jumpSpeed: 1100, maxJumps: 1, on: 'tap', buttonTag: '' },
        ]),
        s, id, (o) => ({ ...o, shadow: true }),
      ),
  },
  {
    id: 'finger-player',
    title: 'بازیکنی که دنبال انگشت می‌آید',
    about: 'هر جا انگشت باشد، به همان طرف می‌رود.',
    fits: isShape,
    apply: (p, s, id) => shape(p, s, id, 'بازیکن', PLAYER, [{ type: 'followFinger', speed: 1200, axis: 'both' }]),
  },
  {
    id: 'steer-player',
    title: 'بازیکنی که در چهار جهت حرکت می‌کند',
    about: 'با کشیدن انگشت روی صفحه به هر طرف می‌رود و از اشیای گروه «زمین» (دیوارها) رد نمی‌شود. برای بازی‌هایی که از بالا دیده می‌شوند.',
    fits: isShape,
    apply: (p, s, id) =>
      shape(p, s, id, 'بازیکن', PLAYER, [
        { type: 'body', gravity: false, solidTag: GROUND, bounce: 0, edges: 'stop', oneWay: false },
        { type: 'steer', speed: 320, control: 'stick', upTag: '', downTag: '', leftTag: '', rightTag: '', face: false },
      ]),
  },
  {
    id: 'ground',
    title: 'زمین یا دیوار',
    about: 'بازیکن از میان آن رد نمی‌شود.',
    fits: isShape,
    apply: (p, s, id) => shape(p, s, id, 'زمین', GROUND),
  },
  {
    id: 'prize',
    title: 'جایزه‌ای که امتیاز می‌دهد',
    about: 'وقتی بازیکن به آن بخورد، یک امتیاز می‌گیرد و جایزه ناپدید می‌شود.',
    fits: isShape,
    apply: (p, s, id) =>
      withTouchRule(shape(withVariable(p, 'score'), s, id, 'جایزه', PRIZE), s, PLAYER, PRIZE, [
        { type: 'setVariable', name: 'score', op: 'add', amount: 1 },
        // A little shower of sparks where the prize was makes taking it feel like something.
        { type: 'burst', target: 'second', color: '#ffd54a', count: 8 },
        { type: 'destroy', target: 'second' },
        { type: 'playSound', sound: 'coin' },
      ]),
  },
  {
    id: 'danger',
    title: 'خطر: برخورد با آن یعنی باخت',
    about: 'وقتی بازیکن به آن بخورد، صحنه از اول شروع می‌شود.',
    fits: isShape,
    apply: (p, s, id) => withTouchRule(shape(p, s, id, 'خطر', DANGER), s, PLAYER, DANGER, LOSE),
  },
  {
    id: 'chaser',
    title: 'دشمنی که دنبال بازیکن می‌آید',
    about: 'آرام به طرف بازیکن می‌رود و اگر به او برسد، بازیکن می‌بازد.',
    fits: isShape,
    apply: (p, s, id) =>
      withTouchRule(shape(p, s, id, 'دشمن', DANGER, [{ type: 'chase', targetTag: PLAYER, speed: 150 }]), s, PLAYER, DANGER, LOSE),
  },
  {
    id: 'patrol-enemy',
    title: 'دشمن نگهبان',
    about: 'به چپ و راست رفت و برگشت می‌کند، مثل نگهبان؛ اگر بازیکن به او بخورد، بازیکن می‌بازد. فاصله و سرعتش در رفتار «رفت و برگشت» است.',
    fits: isShape,
    apply: (p, s, id) =>
      withTouchRule(updateObject(shape(p, s, id, 'نگهبان', DANGER, [{ type: 'patrol', axis: 'x', distance: 240, speed: 120 }]), s, id, (o) => ({ ...o, health: 2, healthBar: true, invincible: 0.3 })), s, PLAYER, DANGER, LOSE),
  },
  {
    id: 'shooter-enemy',
    title: 'دشمن تیرانداز',
    about: 'سر جایش می‌ماند و هر ۲ ثانیه یک گلوله‌ی قرمز درخشان به طرف بازیکن شلیک می‌کند. خوردن به خودش یا گلوله‌اش یعنی باخت.',
    fits: isShape,
    apply: (p, s, id) =>
      withTouchRule(withBullets(updateObject(shape(p, s, id, 'تیرانداز', DANGER), s, id, (o) => ({ ...o, health: 2, healthBar: true, invincible: 0.3 })), s, id, 2), s, PLAYER, DANGER, LOSE),
  },
  {
    id: 'boss',
    title: 'غول آخر',
    about: 'دوازده جان و نوار جان بالای سرش؛ آرام دنبال بازیکن می‌آید و هر یک‌ونیم ثانیه شلیک می‌کند. وقتی جانش تمام شود، منفجر می‌شود و پیام «برد» را می‌فرستد. برای زدنش، در یک قانون از جانش کم کن.',
    fits: isShape,
    apply: (p, s, id) => {
      const boss = updateObject(shape(p, s, id, 'غول آخر', DANGER, [{ type: 'chase', targetTag: PLAYER, speed: 70 }]), s, id, (o) => ({ ...o, health: 12, healthBar: true, invincible: 0.4 }));
      const dies: Rule = {
        id: newId('rule'),
        when: { type: 'dead', target: { by: 'id', id } },
        condition: null,
        then: [
          { type: 'burst', target: 'first', color: '#ffd23f', count: 40 },
          { type: 'shake', strength: 18 },
          { type: 'playSound', sound: 'boom' },
          { type: 'destroy', target: 'first' },
          { type: 'wait', seconds: 0.6 },
          { type: 'playSound', sound: 'win' },
          { type: 'send', name: 'برد' },
        ],
      };
      const armed = withBullets(boss, s, id, 1.5);
      return withTouchRule(updateScene(armed, s, (scene) => ({ ...scene, rules: [...scene.rules, dies] })), s, PLAYER, DANGER, LOSE);
    },
  },
  {
    id: 'physics-crate',
    title: 'جعبه‌ای که واقعاً می‌افتد و واژگون می‌شود',
    about: 'فیزیک واقعی دارد: روی «زمین» و جعبه‌های دیگر می‌ایستد، با ضربه کج می‌شود و می‌افتد. چند تا را روی هم بچین تا برج بسازی.',
    fits: isShape,
    apply: (p, s, id) => shape(p, s, id, 'جعبه', CRATE, [physics()]),
  },
  {
    id: 'physics-ball',
    title: 'توپی که قل می‌خورد و بالا می‌پرد',
    about: 'فیزیک واقعی و برخورد دایره‌ای دارد: روی سراشیبی قل می‌خورد و از زمین و دیوار برمی‌گردد.',
    fits: isShape,
    apply: (p, s, id) => updateObject(shape(p, s, id, 'توپ', 'توپ', [physics({ bounce: 0.6, friction: 0.4 })]), s, id, (o) => ({ ...o, round: true })),
  },
  {
    id: 'sling-stone',
    title: 'سنگی که با کشیدن پرتاب می‌شود (تیرکمان)',
    about: 'سنگ همان‌جا که گذاشتی در هوا منتظر می‌ماند. بازیکن آن را با انگشت عقب می‌کشد و رها می‌کند؛ نقطه‌ها نشان می‌دهند کجا می‌رود. بعد از هر پرتاب، وقتی ایستاد، به همان‌جا برمی‌گردد.',
    fits: isShape,
    apply: (p, s, id) => updateObject(shape(p, s, id, 'سنگ', THROWN, [physics({ drag: 'sling', power: 8, reload: true, weight: 2, friction: 0.8 })]), s, id, (o) => ({ ...o, round: true })),
  },
  {
    id: 'button',
    title: 'دکمه',
    about: 'با زدن روی آن، بازی به صحنه‌ی دیگری می‌رود. مقصد را در قانونی که ساخته می‌شود عوض کن.',
    apply: (p, s, id) => {
      // With one scene there is nowhere else to go yet, so the button restarts it.
      const other = p.scenes.find((x) => x.id !== s);
      const go: Action = other ? { type: 'goToScene', scene: other.id } : { type: 'restartScene' };
      const rule: Rule = { id: newId('rule'), when: { type: 'tapObject', target: { by: 'id', id } }, condition: null, then: [{ type: 'playSound', sound: 'click' }, go] };
      const named = updateObject(p, s, id, (o) => ({ ...o, name: nameFor(o, 'دکمه'), fixed: true }));
      return updateScene(named, s, (x) => ({ ...x, rules: [...x.rules, rule] }));
    },
  },
  {
    id: 'score-text',
    title: 'نمایش امتیاز',
    about: 'امتیاز را نشان می‌دهد و با حرکت دوربین سر جایش می‌ماند.',
    fits: (o) => o.visual.kind === 'text',
    apply: (p, s, id) =>
      updateObject(withVariable(p, 'score'), s, id, (o) => ({
        ...o,
        name: nameFor(o, 'امتیاز'),
        fixed: true,
        visual: o.visual.kind === 'text' ? { ...o.visual, text: 'Score: {score}' } : o.visual,
      })),
  },
];
