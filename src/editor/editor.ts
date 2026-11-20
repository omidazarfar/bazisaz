import type { GameProject, Scene } from '../format/types';

/** What every panel gets: the game, where the user is in it, and how to change it. */
export interface Editor {
  project: GameProject;
  /** The scene being edited. */
  scene: Scene;
  /** Everything selected, in the order it was picked. */
  selected: string[];
  /** The last of `selected`: the object whose settings are shown. */
  selection: string | null;
  /**
   * Replaces the project. `key` names the setting being changed, so a slider
   * drag becomes one undo step. `select` optionally changes the selection in
   * the same step (after adding or deleting objects).
   */
  change: (project: GameProject, key: string, select?: string | string[] | null) => boolean;
  /** Selects one object, or nothing. With `add`, the object joins the selection, or leaves it if it was in it. */
  select: (id: string | null, add?: boolean) => void;
  selectMany: (ids: string[], add?: boolean) => void;
  setScene: (id: string) => void;
  /** The middle of the part of the scene on view, where new things should appear. */
  viewCentre: () => { x: number; y: number };
  /** Opens the rules tab with one rule open for editing. */
  showRule: (id: string) => void;
  /** The kind of cell the paint tool lays on the selected tile map ("." rubs out), or null while not painting. */
  brush: string | null;
  /** Takes up the paint tool with a brush, or puts it down with null. */
  paint: (brush: string | null) => void;
}
