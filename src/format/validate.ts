import { actionBlocks, behaviorBlocks, triggerBlocks } from '../blocks/registry';
import type { BehaviorCheckKit, CheckKit } from '../blocks/types';
import { OLDEST_FORMAT } from './migrate';
import { EFFECT_PLACES, effectProblems } from './effects';
import { FORMAT_VERSION, isBuiltinMusic, nameGroups, ruleActions, ruleConditions, ruleTree, VALUE_NAME, type GameObject, type GameProject, type Place, type Ref, type Rule, type Scene, type SubRule } from './types';

const VARIABLE_NAME = VALUE_NAME;
export const APP_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/**
 * Checks the parts of a project that would otherwise fail at an unhelpful
 * moment during play: missing scenes, dangling references, duplicate ids.
 * Returns a list of problems; an empty list means the project can run.
 */
export function validateProject(project: GameProject): string[] {
  const problems: string[] = [];
  const say = (text: string) => problems.push(text);

  if (project.formatVersion !== FORMAT_VERSION) {
    const v = project.formatVersion as unknown;
    const why = typeof v === 'number' && v > FORMAT_VERSION ? ' It was made with a newer Bazisaz.' : '';
    say(`formatVersion is ${String(v)}; this runtime reads version ${FORMAT_VERSION} (and older ones from ${OLDEST_FORMAT}, made current first).${why}`);
    return problems; // Nothing below can be trusted on another version's shape.
  }
  if (!(project.meta.width > 0) || !(project.meta.height > 0)) {
    say('meta.width and meta.height must be positive numbers.');
  }
  if (!APP_ID.test(project.app.appId)) {
    say(`app.appId "${project.app.appId}" is not a valid package name (example: com.example.mygame).`);
  }

  const variables = new Set<string>();
  for (const v of project.variables) {
    if (!VARIABLE_NAME.test(v.name)) say(`Variable name "${v.name}" must be Latin letters, digits or _, or such parts joined by dots.`);
    if (variables.has(v.name)) say(`Variable "${v.name}" is defined more than once.`);
    variables.add(v.name);
  }
  const texts = new Set<string>();
  if (project.textVariables !== undefined && !Array.isArray(project.textVariables)) {
    say('textVariables must be a list.');
    return problems;
  }
  for (const v of project.textVariables ?? []) {
    if (!v || typeof v.name !== 'string' || !VARIABLE_NAME.test(v.name) || typeof v.initial !== 'string' || typeof v.saved !== 'boolean') {
      say('A text variable needs a valid name, initial text and a save setting.');
      continue;
    }
    if (variables.has(v.name) || texts.has(v.name)) say(`Variable "${v.name}" is defined more than once.`);
    texts.add(v.name);
  }
  // Lists (format 3): a name like a variable's, numbers or text, and items of that kind.
  const listNames = new Set<string>();
  if (!Array.isArray(project.lists)) {
    say('lists must be a list.');
    return problems;
  }
  for (const l of project.lists) {
    if (!l || typeof l.name !== 'string' || !VARIABLE_NAME.test(l.name) || (l.kind !== 'number' && l.kind !== 'text') || !Array.isArray(l.initial)) {
      say('A list needs a valid name, a kind (number or text) and its starting items.');
      continue;
    }
    if (listNames.has(l.name) || variables.has(l.name) || texts.has(l.name)) say(`"${l.name}" is defined more than once.`);
    if (l.initial.some((item) => typeof item !== (l.kind === 'number' ? 'number' : 'string'))) say(`List "${l.name}" starts with an item that is not ${l.kind === 'number' ? 'a number' : 'text'}.`);
    listNames.add(l.name);
  }
  // Values with parts (item 2): "player.hp" makes "player" a group of values, which is then not a value itself.
  const allNames = [...variables, ...texts, ...listNames];
  const groups = new Set(allNames.flatMap(nameGroups));
  for (const n of allNames) if (groups.has(n)) say(`"${n}" is a value and also the group of other values (${n}.…).`);
  const checkText = (name: string, text: string, where: string) => {
    if (!texts.has(name)) say(`${where} uses missing text variable "${name}".`);
    if (typeof text !== 'string') say(`${where} needs a text value.`);
  };
  const needVariable = (name: string, where: string) => {
    if (!variables.has(name)) say(`${where} uses missing variable "${name}".`);
  };
  const items = new Set(project.variables.filter((v) => v.item).map((v) => v.name));
  for (const v of project.variables) {
    if (v.item && project.assets[v.item.asset]?.type !== 'image') say(`Item "${v.name}" uses missing image "${v.item.asset}".`);
  }
  const needItem = (name: string, where: string) => {
    if (!items.has(name)) say(`${where} uses "${name}", which is not a thing the player can carry.`);
  };

  const sceneIds = new Set<string>();
  for (const scene of project.scenes) {
    if (sceneIds.has(scene.id)) say(`Scene id "${scene.id}" is used more than once.`);
    sceneIds.add(scene.id);
  }
  if (!sceneIds.has(project.startScene)) say(`startScene "${project.startScene}" is not one of the scenes.`);

  for (const scene of project.scenes) {
    const where = `scene "${scene.id}"`;
    if (scene.music !== null && project.assets[scene.music]?.type !== 'sound' && !isBuiltinMusic(scene.music)) {
      say(`${where}: its music "${scene.music}" is missing.`);
    }
    if (scene.width < project.meta.width || scene.height < project.meta.height) {
      say(`${where}: the world cannot be smaller than the screen.`);
    }
    if (scene.effects !== undefined) {
      if (typeof scene.effects !== 'object' || scene.effects === null) say(`${where}: effects must be places with lists of effects.`);
      else for (const [place, list] of Object.entries(scene.effects)) {
        if (!(EFFECT_PLACES as readonly string[]).includes(place)) say(`${where}: effects on "${place}", which is not a place in a scene (all, sky, world, screen).`);
        else effectProblems(list, `${where}: ${place}`).forEach(say);
      }
    }
    const ids = new Set<string>();
    const prefabIds = new Set(scene.prefabs.map((p) => p.id));

    const checkObject = (obj: GameObject) => {
      if (ids.has(obj.id)) say(`${where}: id "${obj.id}" is used more than once.`);
      ids.add(obj.id);
      if (obj.visual.kind === 'image') {
        for (const asset of [obj.visual.asset, ...(obj.visual.frames ?? [])]) {
          if (project.assets[asset]?.type !== 'image') say(`${where}: "${obj.id}" uses missing image "${asset}".`);
        }
      }
      if (obj.visual.kind === 'image') {
        for (const asset of [...(obj.visual.moveFrames ?? []), ...(obj.visual.airFrames ?? []), ...(obj.visual.hurtFrames ?? [])]) {
          if (project.assets[asset]?.type !== 'image') say(`${where}: "${obj.id}" uses missing image "${asset}".`);
        }
      }
      if (obj.visual.kind === 'terrain') {
        const h = obj.visual.heights;
        if (!Array.isArray(h) || h.length < 2 || h.length > 129 || !h.every(y => Number.isFinite(y) && y >= 0 && y <= 0.95))
          say(`${where}: terrain "${obj.id}" needs 2–129 heights from 0 to 0.95.`);
      }
      if (obj.visual.kind === 'bar') needVariable(obj.visual.variable, `${where}: bar "${obj.id}"`);
      // A text-input box (item 6) fills a text value.
      if (obj.visual.kind === 'input') {
        if (!texts.has(obj.visual.variable)) say(`${where}: text input "${obj.id}" fills text value "${obj.visual.variable}", which the game does not have.`);
        if (!(obj.visual.size > 0)) say(`${where}: text input "${obj.id}" needs a letter size above zero.`);
      }
      if (obj.visual.kind === 'bag' && !(obj.visual.slots >= 1)) say(`${where}: bag "${obj.id}" needs at least one place.`);
      if (obj.visual.kind === 'tiles') {
        const tiles = obj.visual;
        if (!(tiles.cell > 0)) say(`${where}: tile map "${obj.id}" needs a cell size above zero.`);
        if (!Array.isArray(tiles.rows) || tiles.rows.some((r) => typeof r !== 'string')) say(`${where}: tile map "${obj.id}" has broken rows.`);
        for (const [key, kind] of Object.entries(tiles.kinds ?? {})) {
          if (key.length !== 1 || key === '.') say(`${where}: tile map "${obj.id}" names a kind "${key}"; kinds are one character other than ".".`);
          if (kind.asset && project.assets[kind.asset]?.type !== 'image') say(`${where}: tile map "${obj.id}" uses missing image "${kind.asset}".`);
          for (const asset of kind.autotile ?? []) if (asset && project.assets[asset]?.type !== 'image') say(`${where}: tile map "${obj.id}" uses missing image "${asset}".`);
        }
      }
      if (obj.behaviors.some((b) => b.type === 'scrollImage') && obj.visual.kind !== 'image') {
        say(`${where}: "${obj.id}" scrolls its image but has no image.`);
      }
      // Visual effects (item 4): kinds Bazisaz has, one of each, settings they have.
      effectProblems(obj.effects, `${where}: "${obj.id}"`).forEach(say);
      const types = new Set(obj.behaviors.map((b) => b.type));
      if (types.has('jumper') && !types.has('body') && !types.has('physics')) say(`${where}: "${obj.id}" jumps but has no body.`);
      if (types.has('body') && types.has('physics')) say(`${where}: "${obj.id}" has both a body and real physics; it can have only one.`);
      // Every behavior is a block in its own file (src/blocks/behaviors/), which checks itself.
      const kit: BehaviorCheckKit = {
        project,
        object: obj,
        say: (problem) => say(`${where}: ${problem}`),
        needVariable: (variable) => needVariable(variable, `${where}: "${obj.id}"`),
        hasPrefab: (id) => prefabIds.has(id),
      };
      for (const b of obj.behaviors) behaviorBlocks.get(b.type)?.check?.(b as never, kit);
    };
    scene.objects.forEach(checkObject);
    scene.prefabs.forEach(checkObject);

    checkRules(scene.rules, scene, where, ids, prefabIds, null);
  }

  // Custom behaviors (item 3): a name, settings with names like values', and rules about "this object" and groups.
  const made = project.customBehaviors;
  if (made !== undefined && !Array.isArray(made)) say('customBehaviors must be a list.');
  const madeIds = new Set<string>();
  for (const behavior of Array.isArray(made) ? made : []) {
    if (!behavior || typeof behavior.id !== 'string' || typeof behavior.name !== 'string' || !Array.isArray(behavior.settings) || !Array.isArray(behavior.rules)) {
      say('A custom behavior needs an id, a name, a list of settings and a list of rules.');
      continue;
    }
    const where = `custom behavior "${behavior.id}"`;
    if (madeIds.has(behavior.id)) say(`Custom behavior id "${behavior.id}" is used more than once.`);
    madeIds.add(behavior.id);
    if (!behavior.name.trim()) say(`${where} has no name.`);
    const settingNames = new Set<string>();
    for (const setting of behavior.settings) {
      if (!setting || typeof setting.name !== 'string' || !VALUE_NAME.test(setting.name) || typeof setting.initial !== 'number' || !Number.isFinite(setting.initial)) {
        say(`${where}: a setting needs a name of Latin letters, digits or _ and a starting number.`);
        continue;
      }
      if (settingNames.has(setting.name)) say(`${where}: the setting "${setting.name}" is there twice.`);
      settingNames.add(setting.name);
    }
    // Its rules are checked against every scene that has an object with it (or the start scene, if none yet).
    const using = project.scenes.filter((sc) => [...sc.objects, ...sc.prefabs].some((o) => o.behaviors.some((b) => b.type === 'custom' && b.behavior === behavior.id)));
    const scenes = using.length ? using : project.scenes.filter((sc) => sc.id === project.startScene).slice(0, 1);
    for (const scene of scenes) {
      const ids = new Set([...scene.objects, ...scene.prefabs].map((o) => o.id));
      checkRules(behavior.rules, scene, `${where} (in scene "${scene.id}")`, ids, new Set(scene.prefabs.map((p) => p.id)), behavior.id);
    }
  }
  return problems;

  /**
   * The rules of a scene, or of a custom behavior (`behavior`, its id), seen from that scene: dangling references,
   * duplicate ids, and what every block checks itself.
   */
  function checkRules(rules: Rule[], scene: Scene, where: string, ids: Set<string>, prefabIds: Set<string>, behavior: string | null): void {
    const checkRef = (ref: Ref | Place, rule: string) => {
      if (typeof ref !== 'object') return;
      if (ref.by === 'id' && behavior !== null) say(`${where}: ${rule} names one object ("${ref.id}"); a behavior's rules name "this object" or groups.`);
      else if (ref.by === 'id' && !ids.has(ref.id)) say(`${where}: ${rule} refers to missing object "${ref.id}".`);
      if (ref.by === 'self' && behavior === null) say(`${where}: ${rule} says "this object", which only a custom behavior's rules can.`);
    };
    const ruleIds = new Set(rules.map((r) => r.id));
    for (const rule of rules) {
      const name = `rule "${rule.id}"`;
      if (behavior !== null && (rule.when.type === 'called' || rule.when.type === 'asked')) {
        say(`${where}: ${name} is a function or a question; those belong to a scene's rules, not a behavior's.`);
      }
      const w = rule.when;
      // What every block checks with; a problem is said after where the rule is.
      const kit: CheckKit = {
        project,
        scene,
        needList: (list) => {
          if (!listNames.has(list)) say(`${where}: ${name} uses list "${list}", which the game does not have.`);
        },
        say: (problem) => say(`${where}: ${name} ${problem}`),
        checkRef: (ref) => checkRef(ref, name),
        needVariable: (variable) => needVariable(variable, `${where}: ${name}`),
        needItem: (item) => needItem(item, `${where}: ${name}`),
        checkText: (text, value) => checkText(text, value, where),
        hasPrefab: (id) => prefabIds.has(id),
        hasScene: (id) => sceneIds.has(id),
      };
      if ('target' in w) checkRef(w.target, name);
      // Every trigger is a block in its own file (src/blocks/triggers/), which checks itself.
      triggerBlocks.get(w.type)?.check?.(w as never, kit);
      // Sub-rules (item 2): each a rule without a trigger, with its own id, conditions and actions.
      const badSub = (s: SubRule): boolean =>
        !s || typeof s.id !== 'string' || !Array.isArray(s.then) || (s.sub !== undefined && (!Array.isArray(s.sub) || s.sub.some(badSub)));
      if (rule.sub !== undefined && (!Array.isArray(rule.sub) || rule.sub.some(badSub))) {
        say(`${where}: ${name} has a sub-rule without an id or a list of actions.`);
        continue;
      }
      for (const r of ruleTree(rule)) {
        if (r !== rule && ruleIds.has(r.id)) say(`${where}: ${name} has a sub-rule "${r.id}" whose id is used twice.`);
        ruleIds.add(r.id);
      }
      for (const condition of ruleConditions(rule)) {
        const amounts = [condition.value, condition.a1, condition.a2, condition.a3];
        if (condition.check !== undefined) {
          // A question the user made: some rule of the scene must answer it.
          if (!scene.rules.some((r) => r.when.type === 'asked' && r.when.name === condition.check)) {
            say(`${where}: ${name} asks "${condition.check}", which no rule of the scene answers.`);
          }
        } else if (condition.of === undefined) needVariable(condition.name, `${where}: ${name}`);
        // A condition about an object's own value names no game variable.
        for (const than of amounts) if (typeof than === 'object' && than !== null && 'variable' in than) needVariable(than.variable, `${where}: ${name}`);
      }

      for (const a of ruleActions(rule)) {
        if ('target' in a) checkRef(a.target, name);
        // Blocks in their own files (src/blocks/) check themselves.
        actionBlocks.get(a.type)?.check?.(a as never, kit);
        // An empty picture or music is "not chosen yet" (or, for music, silence), which plays fine.
      }
    }
  }
}
