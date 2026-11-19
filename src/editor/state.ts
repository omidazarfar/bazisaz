import { EMPTY_TILE, ruleActions, type Action, type Behavior, type GameObject, type GameProject, type Place, type Ref, type Rule, type Scene, type TilesVisual, type Visual } from '../format/types';
import { validateProject } from '../format/validate';
import { blank } from '../templates';

export interface EditorState {
  project: GameProject;
  /** Earlier versions, oldest first, for undo. */
  past: GameProject[];
  /** Versions that were undone, for redo. */
  future: GameProject[];
  /** The scene being edited. */
  sceneId: string;
  /** Ids of the selected objects in that scene, in the order they were picked. */
  selected: string[];
  /** The last of `selected`: the object whose settings are shown. Null when nothing is selected. */
  selection: string | null;
  /** What the last change touched and when, used to merge a slider drag into one undo step. */
  lastChange: { key: string; at: number } | null;
}

export type EditorAction =
  | { type: 'change'; project: GameProject; key: string; select?: string | string[] | null }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; ids: string[] }
  | { type: 'scene'; id: string }
  /** Starts working on a different game (a new empty one or an opened file). */
  | { type: 'open'; project: GameProject };

const HISTORY_LIMIT = 100;
/** Changes to the same setting within this time count as one undo step. */
const MERGE_WINDOW_MS = 800;

/** Opens the game saved in this browser, or an empty one. */
export function initialState(saved: GameProject | null): EditorState {
  const project = saved ?? blank();
  return { project, past: [], future: [], sceneId: project.startScene, selected: [], selection: null, lastChange: null };
}

const asList = (select: string | string[] | null): string[] => (select === null ? [] : typeof select === 'string' ? [select] : select);

export function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'change': {
      const now = Date.now();
      const merge = state.lastChange?.key === action.key && now - state.lastChange.at < MERGE_WINDOW_MS;
      return settle({
        ...state,
        project: action.project,
        past: merge ? state.past : [...state.past, state.project].slice(-HISTORY_LIMIT),
        future: [],
        selected: action.select === undefined ? state.selected : asList(action.select),
        lastChange: { key: action.key, at: now },
      });
    }
    case 'undo': {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return settle({ ...state, project: previous, past: state.past.slice(0, -1), future: [state.project, ...state.future], lastChange: null });
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return settle({ ...state, project: next, past: [...state.past, state.project], future: rest, lastChange: null });
    }
    case 'select':
      return settle({ ...state, selected: action.ids });
    case 'scene':
      return { ...state, sceneId: action.id, selected: [], selection: null };
    case 'open':
      return initialState(action.project);
  }
}

/** After any change of project, makes sure the scene and selection still exist. */
function settle(state: EditorState): EditorState {
  const project = state.project;
  const scene = project.scenes.find((s) => s.id === state.sceneId) ?? project.scenes[0];
  const all = [...scene.objects, ...scene.prefabs];
  const selected = state.selected.filter((id) => all.some((o) => o.id === id));
  return { ...state, sceneId: scene.id, selected, selection: selected.at(-1) ?? null };
}

// ── Reading and changing a project ─────────────────────────────────────────
// A project is never modified in place: every change returns a new project
// that shares the untouched parts. That is what makes undo a simple list of
// earlier projects.

export type ObjectList = 'objects' | 'prefabs';

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getScene(project: GameProject, sceneId: string): Scene {
  return project.scenes.find((s) => s.id === sceneId) ?? project.scenes[0];
}

export function findObject(scene: Scene, id: string): { object: GameObject; list: ObjectList } | null {
  for (const list of ['objects', 'prefabs'] as const) {
    const object = scene[list].find((o) => o.id === id);
    if (object) return { object, list };
  }
  return null;
}

export function updateScene(project: GameProject, sceneId: string, change: (scene: Scene) => Scene): GameProject {
  return { ...project, scenes: project.scenes.map((s) => (s.id === sceneId ? change(s) : s)) };
}

export function updateObject(project: GameProject, sceneId: string, id: string, change: (object: GameObject) => GameObject): GameProject {
  const mapList = (list: GameObject[]) => list.map((o) => (o.id === id ? change(o) : o));
  return updateScene(project, sceneId, (s) => ({ ...s, objects: mapList(s.objects), prefabs: mapList(s.prefabs) }));
}

/** A new object with nothing but a look, placed so that its middle is at `centre`. */
export function makeObject(name: string, visual: Visual, width: number, height: number, centre: { x: number; y: number }, extra: Partial<GameObject> = {}): GameObject {
  return {
    id: newId('obj'),
    name,
    // A text is placed by its anchor, which sits in the middle of its top edge.
    x: Math.round(visual.kind === 'text' ? centre.x : centre.x - width / 2),
    y: Math.round(centre.y - height / 2),
    width,
    height,
    visual,
    tags: [],
    visible: true,
    behaviors: [],
    ...extra,
  };
}

/** A place for a new object at or near `centre` where it will not land exactly on top of one already there. */
export function freeSpot(scene: Scene, centre: { x: number; y: number }): { x: number; y: number } {
  const taken = (p: { x: number; y: number }) =>
    scene.objects.some((o) => Math.abs(o.x + (o.visual.kind === 'text' ? 0 : o.width / 2) - p.x) < 24 && Math.abs(o.y + o.height / 2 - p.y) < 24);
  let spot = centre;
  for (let i = 0; i < 12 && taken(spot); i++) spot = { x: spot.x + 40, y: spot.y + 40 };
  return spot;
}

export function addObject(project: GameProject, sceneId: string, list: ObjectList, object: GameObject): GameProject {
  return updateScene(project, sceneId, (s) => ({ ...s, [list]: [...s[list], object] }));
}

const pointsAt = (ref: Ref | Place, id: string) => typeof ref === 'object' && ref.by === 'id' && ref.id === id;

function actionUses(action: Action, id: string): boolean {
  if ('target' in action && pointsAt(action.target, id)) return true;
  if (action.type === 'blast') return pointsAt(action.at, id);
  return action.type === 'spawn' && (action.prefab === id || pointsAt(action.at, id));
}

function ruleTriggerUses(rule: Rule, id: string): boolean {
  const w = rule.when;
  if ('target' in w) return pointsAt(w.target, id);
  return (w.type === 'touch' || w.type === 'near' || w.type === 'hit') && (pointsAt(w.a, id) || pointsAt(w.b, id));
}

/**
 * Removes an object and everything that only made sense with it: rules
 * triggered by it, actions aimed at it, and its place in spawners' lists.
 * A spawner left with nothing to create loses its spawner behavior.
 */
export function removeObject(project: GameProject, sceneId: string, id: string): GameProject {
  const clean = (o: GameObject): GameObject => ({
    ...o,
    behaviors: o.behaviors
      .map((b): Behavior => (b.type === 'spawner' ? { ...b, prefabs: b.prefabs.filter((p) => p !== id) } : b))
      .filter((b) => b.type !== 'spawner' || b.prefabs.length > 0),
  });
  return updateScene(project, sceneId, (s) => ({
    ...s,
    objects: s.objects.filter((o) => o.id !== id).map(clean),
    prefabs: s.prefabs.filter((o) => o.id !== id).map(clean),
    rules: s.rules
      .filter((r) => !ruleTriggerUses(r, id))
      .map((r) => ({ ...r, then: r.then.filter((a) => !actionUses(a, id)), ...(r.otherwise ? { otherwise: r.otherwise.filter((a) => !actionUses(a, id)) } : {}) })),
  }));
}

/** Removes several objects, each as `removeObject` does. */
export function removeObjects(project: GameProject, sceneId: string, ids: string[]): GameProject {
  return ids.reduce((next, id) => removeObject(next, sceneId, id), project);
}

/**
 * Copies objects within their scene, a little down and to the right of the
 * originals. Returns the new project and the ids of the copies.
 */
export function duplicateObjects(project: GameProject, sceneId: string, ids: string[], offset = 30): { project: GameProject; ids: string[] } {
  const scene = getScene(project, sceneId);
  const copies = new Map<string, GameObject>();
  for (const id of ids) {
    const found = findObject(scene, id);
    if (!found) continue;
    const shift = found.list === 'objects' ? offset : 0;
    copies.set(id, { ...found.object, id: newId('obj'), name: `${found.object.name} (کپی)`, x: found.object.x + shift, y: found.object.y + shift });
  }
  // A copied prefab joins the same spawners as the original, so it shows up in the game straight away.
  const joinSpawners = (o: GameObject): GameObject => ({
    ...o,
    behaviors: o.behaviors.map((b) =>
      b.type === 'spawner' ? { ...b, prefabs: [...b.prefabs, ...b.prefabs.flatMap((p) => (copies.has(p) ? [copies.get(p)!.id] : []))] } : b,
    ),
  });
  const withCopies = (list: GameObject[]) => [...list, ...list.flatMap((o) => (copies.has(o.id) ? [copies.get(o.id)!] : []))].map(joinSpawners);
  return {
    project: updateScene(project, sceneId, (s) => ({ ...s, objects: withCopies(s.objects), prefabs: withCopies(s.prefabs) })),
    ids: [...copies.values()].map((o) => o.id),
  };
}

/** Objects taken with "copy", to be put into any scene with "paste". */
export interface Clipboard {
  objects: GameObject[];
  prefabs: GameObject[];
}

export function copyObjects(scene: Scene, ids: string[]): Clipboard {
  return { objects: scene.objects.filter((o) => ids.includes(o.id)), prefabs: scene.prefabs.filter((o) => ids.includes(o.id)) };
}

/** Adds copied objects to a scene. What they pointed at in the scene they came from (things to spawn) is kept only if it is here too. */
export function pasteObjects(project: GameProject, sceneId: string, clip: Clipboard, offset = 30): { project: GameProject; ids: string[] } {
  const scene = getScene(project, sceneId);
  const here = new Set(scene.prefabs.map((p) => p.id));
  const fresh = (o: GameObject, shift: number): GameObject => ({
    ...o,
    id: newId('obj'),
    x: o.x + shift,
    y: o.y + shift,
    behaviors: o.behaviors
      .map((b): Behavior => (b.type === 'spawner' ? { ...b, prefabs: b.prefabs.filter((p) => here.has(p)) } : b))
      .filter((b) => b.type !== 'spawner' || b.prefabs.length > 0),
  });
  const objects = clip.objects.map((o) => fresh(o, offset));
  const prefabs = clip.prefabs.map((o) => fresh(o, 0));
  return {
    project: updateScene(project, sceneId, (s) => ({ ...s, objects: [...s.objects, ...objects], prefabs: [...s.prefabs, ...prefabs] })),
    ids: [...objects, ...prefabs].map((o) => o.id),
  };
}

/**
 * Makes a copy of a whole scene, for building the next level from this one.
 * Every object and rule gets a new id, and everything that pointed at an
 * object of the old scene points at its copy in the new one.
 */
export function duplicateScene(project: GameProject, sceneId: string, name: string): { project: GameProject; id: string } {
  const scene = getScene(project, sceneId);
  const ids = new Map([...scene.objects, ...scene.prefabs].map((o) => [o.id, newId('obj')]));
  const object = (o: GameObject): GameObject => ({
    ...o,
    id: ids.get(o.id)!,
    behaviors: o.behaviors.map((b) => (b.type === 'spawner' ? { ...b, prefabs: b.prefabs.map((p) => ids.get(p) ?? p) } : b)),
  });
  const renamed = (old: unknown) => (typeof old === 'string' ? (ids.get(old) ?? old) : old);
  // A rule can point at an object from many places: its trigger, a condition, an action, an amount inside an action.
  // Rather than list them all, every reference by id found anywhere in the rule is redirected.
  const redirect = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redirect);
    if (value === null || typeof value !== 'object') return value;
    const entry = value as Record<string, unknown>;
    if (entry.by === 'id') return { ...entry, id: renamed(entry.id) };
    return Object.fromEntries(
      Object.entries(entry).map(([key, inner]) => [key, key === 'prefab' ? renamed(inner) : key === 'prefabs' && Array.isArray(inner) ? inner.map(renamed) : redirect(inner)]),
    );
  };
  const id = newId('scene');
  const copy: Scene = {
    ...scene,
    id,
    name,
    objects: scene.objects.map(object),
    prefabs: scene.prefabs.map(object),
    rules: scene.rules.map((r) => ({ ...(redirect(r) as Rule), id: newId('rule') })),
  };
  return { project: { ...project, scenes: [...project.scenes, copy] }, id };
}

/** Removes a scene, and every "go to scene" action that led to it. */
export function removeScene(project: GameProject, sceneId: string): GameProject {
  const scenes = project.scenes
    .filter((s) => s.id !== sceneId)
    .map((s) => ({
      ...s,
      rules: s.rules.map((r) => {
        const keep = (a: Action) => a.type !== 'goToScene' || a.scene !== sceneId;
        return { ...r, then: r.then.filter(keep), ...(r.otherwise ? { otherwise: r.otherwise.filter(keep) } : {}) };
      }),
    }));
  return { ...project, scenes, startScene: project.startScene === sceneId ? scenes[0].id : project.startScene };
}

export function isVariableUsed(project: GameProject, name: string): boolean {
  return project.scenes.some(
    (s) =>
      [...s.objects, ...s.prefabs].some((o) => o.behaviors.some((b) => b.type === 'mover' && b.speedVariable === name)) ||
      s.rules.some(
        (r) =>
          (r.when.type === 'variable' && r.when.name === name) ||
          ((r.when.type === 'useItem' || r.when.type === 'useItemOn') && r.when.item === name) ||
          [r.condition, ...(r.also ?? [])].some((c) => c && c.of === undefined && c.name === name) ||
          ruleActions(r).some(
            (a) =>
              (a.type === 'setVariable' && (a.name === name || (typeof a.amount === 'object' && 'variable' in a.amount && a.amount.variable === name))) ||
              ((a.type === 'give' || a.type === 'take') && a.item === name),
          ),
      ),
  );
}

/** Every message a rule of a scene sends or waits for, for offering them when one is named. */
export function messageNames(scene: Scene): string[] {
  const names = new Set<string>();
  for (const r of scene.rules) {
    if (r.when.type === 'message' && r.when.name) names.add(r.when.name);
    for (const a of ruleActions(r)) if (a.type === 'send' && a.name) names.add(a.name);
  }
  return [...names].sort();
}

/** Every name used for an object's own value in a scene, for offering them when one is asked for. */
export function valueNames(scene: Scene): string[] {
  const names = new Set<string>();
  for (const o of [...scene.objects, ...scene.prefabs]) Object.keys(o.values ?? {}).forEach((n) => names.add(n));
  return [...names].sort();
}

/**
 * Lays copies of an object out in rows and columns, starting from the object
 * itself, each one `pitch` further along: a board of cards, a wall of bricks.
 */
export function tileObject(project: GameProject, sceneId: string, id: string, cols: number, rows: number, pitchX: number, pitchY: number): GameProject {
  return updateScene(project, sceneId, (s) => {
    const object = s.objects.find((o) => o.id === id);
    if (!object) return s;
    const copies: GameObject[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (row === 0 && col === 0) continue;
        copies.push({ ...object, id: newId('obj'), name: `${object.name} ${row * cols + col + 1}`, x: object.x + col * pitchX, y: object.y + row * pitchY });
      }
    }
    return { ...s, objects: [...s.objects, ...copies] };
  });
}

/** A tile map's rows made `cols` wide and `count` tall, keeping what is painted where it still fits. */
export function resizeRows(rows: string[], cols: number, count: number): string[] {
  return Array.from({ length: count }, (_, r) => (rows[r] ?? '').slice(0, cols).padEnd(cols, EMPTY_TILE));
}

/** A new tile map of `cols` by `rows` cells, with a row of ground along its bottom and a kind for coins. */
export function newTileMap(cell: number, cols: number, rows: number): TilesVisual {
  const grid = resizeRows([], cols, rows);
  grid[rows - 1] = 'a'.repeat(cols);
  return {
    kind: 'tiles',
    cell,
    rows: grid,
    kinds: {
      // Ground starts as grass on earth, a wall as stone: a level looks like a level from the first stroke.
      a: { name: 'زمین', color: '#6d4c41', tags: ['زمین'], style: 'grass' },
      b: { name: 'سکه', color: '#ffd54a', tags: ['سکه'], separate: true },
      c: { name: 'دیوار سنگی', color: '#8a96a3', tags: ['زمین'], style: 'stone' },
    },
  };
}

export function allTags(scene: Scene): string[] {
  const tags = new Set<string>();
  for (const o of [...scene.objects, ...scene.prefabs]) {
    o.tags.forEach((t) => tags.add(t));
    // The cells of a tile map belong to the groups of their kind as well.
    if (o.visual.kind === 'tiles') Object.values(o.visual.kinds).forEach((k) => k.tags.forEach((t) => tags.add(t)));
  }
  return [...tags].sort();
}

// ── Saving in the browser ──────────────────────────────────────────────────
// IndexedDB rather than localStorage, because a game with a few images is
// larger than localStorage allows. If it is unavailable the editor still
// works; it just starts empty next time.

const DB_NAME = 'editor';
const STORE = 'projects';
const KEY = 'current-v2';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSaved(): Promise<GameProject | null> {
  try {
    const db = await openDb();
    const project = await new Promise<GameProject | undefined>((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result as GameProject | undefined);
      request.onerror = () => reject(request.error);
    });
    return project && validateProject(project).length === 0 ? project : null;
  } catch {
    return null;
  }
}

/** Resolves to false when the project could not be saved. */
export async function saveProject(project: GameProject): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(project, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}
