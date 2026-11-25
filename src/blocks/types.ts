import type { Action, GameProject, Place, Scene } from '../format/types';
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

/** What a check may need: the project, and a way to report a problem (said after where it is). */
export interface CheckKit {
  project: GameProject;
  say: (problem: string) => void;
}

export interface ActionBlock<T extends Action['type'] = Action['type']> {
  type: T;
  /** Its Persian title, help, starting value and fields in the editor. */
  editor: Block<Extract<Action, { type: T }>>;
  /** The Persian sentence in a rule. */
  sentence: (action: Extract<Action, { type: T }>, kit: SentenceKit) => string;
  /** Problems beyond the common ones (a target that is missing is checked for every block). */
  check?: (action: Extract<Action, { type: T }>, kit: CheckKit) => void;
  /** What it does in a running game. `context` holds the objects the rule's trigger was about. */
  run: (game: Game, action: Extract<Action, { type: T }>, context: RuleContext) => void;
}

/** Declares an action block, keeping its fields typed to its own action. */
export const actionBlock = <T extends Action['type']>(block: ActionBlock<T>): ActionBlock<T> => block;
