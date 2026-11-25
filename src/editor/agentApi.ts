/**
 * What an agent (through scripts/game.mjs) can ask of the editor without clicking: an empty game, the checks,
 * the picture library and the ready-made parts, and the level maker. Each takes a project and gives one back;
 * nothing here touches the game open in the editor. See AGENTS-GAMES.md.
 */
import type { GameProject, Visual } from '../format/types';
import { validateProject } from '../format/validate';
import { blank } from '../templates';
import { character } from './games';
import { findIssues, sceneName } from './issues';
import { DEFAULT_LEVEL_OPTIONS, generateLevels } from './levelgen';
import { RECIPES } from './recipes';
import { SPRITES } from './sprites';

export interface AgentApi {
  blank: () => GameProject;
  /** What would stop the game from running (problems), and what the editor warns about (in Persian). */
  check: (project: GameProject) => { problems: string[]; warnings: { scene: string; text: string }[] };
  /** The pictures (with their size and whether they are animated) and the ready-made parts. */
  library: () => {
    pictures: { id: string; name: string; category: string; width: number; height: number; animated: boolean }[];
    parts: { id: string; title: string; about: string }[];
  };
  /** Stores a library picture in the project; the visual to give an object (animated, and mirrored when walking left, for characters). */
  picture: (project: GameProject, id: string) => Promise<{ project: GameProject; visual: Visual; width: number; height: number }>;
  /** Adds a ready-made part (score, hearts, pause menu, on-screen buttons, ...) to a scene, around a point. */
  part: (project: GameProject, sceneId: string, id: string, at?: { x: number; y: number }) => Promise<{ project: GameProject; note: string }>;
  /** `count` harder levels made after a scene, as the editor's level maker makes them. */
  levels: (project: GameProject, sceneId: string, count: number, seed?: number) => { project: GameProject; changes: string[] };
}

export const agentApi: AgentApi = {
  blank,
  check: (project) => {
    const problems = validateProject(project);
    // The warnings need a game that runs; they are not looked for while it would not.
    const warnings = problems.length ? [] : findIssues(project).map((i) => ({ scene: sceneName(project, i), text: i.text }));
    return { problems, warnings };
  },
  library: () => ({
    pictures: SPRITES.map((s) => ({ id: s.id, name: s.name, category: s.category, width: s.width, height: s.height, animated: Boolean(s.frames?.length || s.move?.length) })),
    parts: RECIPES.map((r) => ({ id: r.id, title: r.title, about: r.about })),
  }),
  picture: async (project, id) => {
    const sprite = SPRITES.find((s) => s.id === id);
    if (!sprite) throw new Error(`No library picture "${id}"`);
    const made = await character(project, id);
    return { project: made.project, visual: made.visual, width: sprite.width, height: sprite.height };
  },
  part: async (project, sceneId, id, at) => {
    const recipe = RECIPES.find((r) => r.id === id);
    if (!recipe) throw new Error(`No part "${id}"`);
    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) throw new Error(`No scene "${sceneId}"`);
    const made = await recipe.apply(project, sceneId, at ?? { x: project.meta.width / 2, y: project.meta.height / 2 });
    return { project: made.project, note: made.note ?? '' };
  },
  levels: (project, sceneId, count, seed = 7) => {
    const made = generateLevels(project, sceneId, { ...DEFAULT_LEVEL_OPTIONS, count, seed });
    return { project: made.project, changes: made.changes };
  },
};
