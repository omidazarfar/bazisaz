import { actionBlocks } from '../blocks/registry';
import { FORMAT_VERSION, isBuiltinMusic, ruleActions, type GameObject, type GameProject, type Place, type Ref } from './types';

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
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
    say(`formatVersion is ${String(project.formatVersion)}; this runtime reads version ${FORMAT_VERSION}.`);
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
    if (!VARIABLE_NAME.test(v.name)) say(`Variable name "${v.name}" must be Latin letters, digits or _.`);
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
      if (obj.visual.kind === 'bag' && !(obj.visual.slots >= 1)) say(`${where}: bag "${obj.id}" needs at least one place.`);
      if (obj.visual.kind === 'tiles') {
        const tiles = obj.visual;
        if (!(tiles.cell > 0)) say(`${where}: tile map "${obj.id}" needs a cell size above zero.`);
        if (!Array.isArray(tiles.rows) || tiles.rows.some((r) => typeof r !== 'string')) say(`${where}: tile map "${obj.id}" has broken rows.`);
        for (const [key, kind] of Object.entries(tiles.kinds ?? {})) {
          if (key.length !== 1 || key === '.') say(`${where}: tile map "${obj.id}" names a kind "${key}"; kinds are one character other than ".".`);
          if (kind.asset && project.assets[kind.asset]?.type !== 'image') say(`${where}: tile map "${obj.id}" uses missing image "${kind.asset}".`);
        }
      }
      if (obj.behaviors.some((b) => b.type === 'scrollImage') && obj.visual.kind !== 'image') {
        say(`${where}: "${obj.id}" scrolls its image but has no image.`);
      }
      const types = new Set(obj.behaviors.map((b) => b.type));
      if (types.has('jumper') && !types.has('body') && !types.has('physics')) say(`${where}: "${obj.id}" jumps but has no body.`);
      if (types.has('body') && types.has('physics')) say(`${where}: "${obj.id}" has both a body and real physics; it can have only one.`);
      for (const b of obj.behaviors) {
        if (b.type === 'particles' && b.onGroundMove !== undefined && typeof b.onGroundMove !== 'boolean')
          say(`${where}: "${obj.id}" needs a boolean for moving ground particles.`);
        if (b.type === 'physics' && !(b.weight > 0)) say(`${where}: "${obj.id}" needs a weight above zero.`);
        if (b.type === 'animate' && (!Array.isArray(b.keys) || b.keys.length === 0 || !b.keys.every((k) => [k.t, k.x, k.y, k.angle, k.scale, k.opacity].every(Number.isFinite) && k.t >= 0)))
          say(`${where}: "${obj.id}" has an animation without proper keys.`);
      }
      for (const b of obj.behaviors) {
        if (b.type === 'mover' && b.speedVariable) needVariable(b.speedVariable, `${where}: "${obj.id}"`);
        if (b.type !== 'spawner') continue;
        if (b.prefabs.length === 0) say(`${where}: spawner "${obj.id}" has nothing to create.`);
        for (const id of b.prefabs) {
          if (!prefabIds.has(id)) say(`${where}: spawner "${obj.id}" refers to missing prefab "${id}".`);
        }
        if (!(b.minInterval > 0) || b.maxInterval < b.minInterval) {
          say(`${where}: spawner "${obj.id}" needs 0 < minInterval <= maxInterval.`);
        }
      }
    };
    scene.objects.forEach(checkObject);
    scene.prefabs.forEach(checkObject);

    const checkRef = (ref: Ref | Place, rule: string) => {
      if (typeof ref === 'object' && ref.by === 'id' && !ids.has(ref.id)) {
        say(`${where}: ${rule} refers to missing object "${ref.id}".`);
      }
    };
    for (const rule of scene.rules) {
      const name = `rule "${rule.id}"`;
      const w = rule.when;
      if ('target' in w) checkRef(w.target, name);
      if (w.type === 'touch' || w.type === 'near' || w.type === 'hit') [w.a, w.b].forEach((r) => checkRef(r, name));
      if (w.type === 'textEquals') checkText(w.name, w.text, where);
      if (w.type === 'variable') needVariable(w.name, `${where}: ${name}`);
      if (w.type === 'useItem' || w.type === 'useItemOn') needItem(w.item, `${where}: ${name}`);
      if ((w.type === 'every' || w.type === 'after' || w.type === 'eachEvery') && !(w.seconds > 0)) {
        say(`${where}: ${name} needs a time above zero.`);
      }
      for (const condition of [rule.condition, ...(rule.also ?? [])]) {
        if (!condition) continue;
        // A condition about an object's own value names no game variable.
        if (condition.of === undefined) needVariable(condition.name, `${where}: ${name}`);
        const than = condition.value;
        if (typeof than === 'object' && 'variable' in than) needVariable(than.variable, `${where}: ${name}`);
      }

      for (const a of ruleActions(rule)) {
        if ('target' in a) checkRef(a.target, name);
        // Blocks in their own files (src/blocks/) check themselves.
        actionBlocks.get(a.type)?.check?.(a as never, {
          project,
          say: (problem) => say(`${where}: ${name} ${problem}`),
          checkRef: (ref) => checkRef(ref, name),
          needVariable: (variable) => needVariable(variable, `${where}: ${name}`),
          needItem: (item) => needItem(item, `${where}: ${name}`),
          checkText: (text, value) => checkText(text, value, where),
          hasPrefab: (id) => prefabIds.has(id),
          hasScene: (id) => sceneIds.has(id),
        });
        // An empty picture or music is "not chosen yet" (or, for music, silence), which plays fine.
      }
    }
  }
  return problems;
}
