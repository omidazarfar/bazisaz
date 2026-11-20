import { FORMAT_VERSION, isBuiltinMusic, ruleActions, SOUND_NAMES, type GameObject, type GameProject, type Place, type Ref } from './types';

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
        if (b.type === 'physics' && !(b.weight > 0)) say(`${where}: "${obj.id}" needs a weight above zero.`);
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
        if (a.type === 'blast') checkRef(a.at, name);
        if (a.type === 'give' || a.type === 'take') needItem(a.item, `${where}: ${name}`);
        if (a.type === 'give' && a.from !== undefined) checkRef(a.from, name);
        if (a.type === 'spawn') {
          checkRef(a.at, name);
          if (!prefabIds.has(a.prefab)) say(`${where}: ${name} creates missing prefab "${a.prefab}".`);
        }
        if (a.type === 'setVariable') {
          needVariable(a.name, `${where}: ${name}`);
          if (typeof a.amount === 'object' && 'variable' in a.amount) needVariable(a.amount.variable, `${where}: ${name}`);
        }
        if ((a.type === 'effect' || a.type === 'glide') && !(a.seconds > 0)) say(`${where}: ${name} has an effect that takes no time.`);
        if (a.type === 'wait' && !(a.seconds > 0)) say(`${where}: ${name} waits for no time.`);
        if (a.type === 'playSound' && a.volume !== undefined && !(Number.isFinite(a.volume) && a.volume >= 0 && a.volume <= 100)) {
          say(`${where}: ${name} needs a sound volume between 0 and 100.`);
        }
        if (a.type === 'playSound' && !(SOUND_NAMES as readonly string[]).includes(a.sound) && project.assets[a.sound]?.type !== 'sound') {
          say(`${where}: ${name} plays missing sound "${a.sound}".`);
        }
        if ((a.type === 'goToScene' || a.type === 'loadGame') && !sceneIds.has(a.scene)) {
          say(`${where}: ${name} goes to missing scene "${a.scene}".`);
        }
        // An empty picture or music is "not chosen yet" (or, for music, silence), which plays fine.
        if (a.type === 'setImage' && a.asset !== '' && project.assets[a.asset]?.type !== 'image') say(`${where}: ${name} shows missing image "${a.asset}".`);
        if (a.type === 'playMusic' && a.music !== '' && project.assets[a.music]?.type !== 'sound' && !isBuiltinMusic(a.music)) say(`${where}: ${name} plays missing music "${a.music}".`);
        if (a.type === 'flash' && !(a.seconds > 0)) say(`${where}: ${name} has a flash that takes no time.`);
      }
    }
  }
  return problems;
}
