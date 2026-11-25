import type { Action, GameProject, Place, Ref, Scene } from '../format/types';
import type { Context as RuleContext, Game } from '../runtime/Game';
import type { Block } from './fields';

/**
 * One block of the engine, described in one file: what it is called and edited with in the editor, how it is
 * said in a rule's Persian sentence, what makes it invalid, and what it does in a running game. The lists in
 * src/blocks/registry.ts hold them all; the editor's panels, the sentences, the checks and the runtime all read
 * the blocks from there. Adding an action is one new file and one line in the registry.
 */

/** What a sentence may need: the project and scene it is in, and how "first", "second" and a ref are said. */
export interface SentenceKit {
  project: GameProject;
  scene: Scene;
  /** A target or place in words, in terms of the rule's trigger ("the coin it touched"). */
  who: (target: Place) => string;
}

/** What a check may need: the project, a way to report a problem (said after where it is), and the common checks. */
export interface CheckKit {
  project: GameProject;
  say: (problem: string) => void;
  /** A ref to one object must name an object that exists. */
  checkRef: (ref: Ref | Place) => void;
  needVariable: (name: string) => void;
  /** The name must be a thing the player can carry. */
  needItem: (name: string) => void;
  /** A text variable, and a text to give it. */
  checkText: (name: string, text: string) => void;
  /** Whether the rule's scene has this prefab; whether the game has this scene. */
  hasPrefab: (id: string) => boolean;
  hasScene: (id: string) => boolean;
}

export interface ActionBlock<T extends Action['type'] = Action['type']> {
  type: T;
  /** Its Persian title, help, starting value and fields in the editor. */
  editor: Block<Extract<Action, { type: T }>>;
  /** The Persian sentence in a rule. */
  sentence: (action: Extract<Action, { type: T }>, kit: SentenceKit) => string;
  /** Problems beyond the common ones (a target that is missing is checked for every block). */
  check?: (action: Extract<Action, { type: T }>, kit: CheckKit) => void;
  /**
   * Takes over the rest of the rule's actions, to run them later (after a wait, once words are read): they are
   * passed to `run` as `rest` and are not run now.
   */
  takesRest?: boolean;
  /** What it does in a running game. `context` holds the objects the rule's trigger was about. */
  run: (game: Game, action: Extract<Action, { type: T }>, context: RuleContext, rest: Action[]) => void;
}

/** Declares an action block, keeping its fields typed to its own action. */
export const actionBlock = <T extends Action['type']>(block: ActionBlock<T>): ActionBlock<T> => block;
