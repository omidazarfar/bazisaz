import type { Action, Behavior, BodyBehavior, GameObject, GameProject, Place, Ref, Rule, Scene, Trigger } from '../format/types';
import type { Context as RuleContext, Entity, Game } from '../runtime/Game';
import type { Block } from './fields';
import type { Subjects } from './say';

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
  /** The scene the rule is in. */
  scene: Scene;
  /** The name must be one of the game's lists. */
  needList: (name: string) => void;
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
  /**
   * Never moves, makes, removes, hides, resizes or reorders an object (a value, a sound, a message, the screen):
   * contact questions and the groups of objects need not be gathered again after it (the performance budget).
   */
  still?: boolean;
  /** What it does in a running game. `context` holds the objects the rule's trigger was about. */
  run: (game: Game, action: Extract<Action, { type: T }>, context: RuleContext, rest: Action[]) => void;
}

/** Declares an action block, keeping its fields typed to its own action. */
export const actionBlock = <T extends Action['type']>(block: ActionBlock<T>): ActionBlock<T> => block;

/** What a trigger's sentence may need: the scene it is in. */
export interface TriggerSentenceKit {
  scene: Scene;
}

/** What happened this step that some triggers look at. */
export interface TriggerStep {
  /** The length of the step, in seconds (0 while the game is paused). */
  dt: number;
  /** Whether the screen itself (not a button on it) was tapped. */
  screenTapped: boolean;
  /** The objects that went off the screen this step. */
  left: Entity[];
}

export interface TriggerBlock<T extends Trigger['type'] = Trigger['type']> {
  type: T;
  /** Its Persian title, help, starting value and fields in the editor. */
  editor: Block<Extract<Trigger, { type: T }>>;
  /** The Persian sentence that starts a rule ("when …"). */
  sentence: (trigger: Extract<Trigger, { type: T }>, kit: TriggerSentenceKit) => string;
  /** What "first" and "second" mean in the rule's actions, in words; none when the trigger is about no object. */
  subjects?: (trigger: Extract<Trigger, { type: T }>, kit: TriggerSentenceKit) => Subjects;
  /** Problems beyond the common ones (a `target` that is missing is checked for every block). */
  check?: (trigger: Extract<Trigger, { type: T }>, kit: CheckKit) => void;
  /** The occasions, this step, on which it happened: one context (its first and second objects) for each. */
  fired: (game: Game, trigger: Extract<Trigger, { type: T }>, rule: Rule, step: TriggerStep) => RuleContext[];
}

/** Declares a trigger block, keeping its fields typed to its own trigger. */
export const triggerBlock = <T extends Trigger['type']>(block: TriggerBlock<T>): TriggerBlock<T> => block;

/** What one object's behaviors share while it takes its step: the step itself, and what they leave for the core. */
export interface BehaviorStep {
  /** The length of the step, in seconds. */
  dt: number;
  /** The size of the view. */
  W: number;
  H: number;
  /** Whether the screen itself (not a button on it) was tapped. */
  screenTapped: boolean;
  /** Objects made this step, each to be put just above the object that made it. */
  spawned: { entity: Entity; above: Entity }[];
  /** Left for the core: the object's body (it then moves as a body), whether the player steers it, whether it is attached. */
  body: BodyBehavior | null;
  steered: boolean;
  attached: boolean;
}

/** What a behavior's check may need: the project, the object, a way to report a problem (said after the scene), and common checks. */
export interface BehaviorCheckKit {
  project: GameProject;
  object: GameObject;
  say: (problem: string) => void;
  needVariable: (name: string) => void;
  /** Whether the object's scene has this prefab. */
  hasPrefab: (id: string) => boolean;
}

export interface BehaviorBlock<T extends Behavior['type'] = Behavior['type']> {
  type: T;
  /** Its Persian title, help, starting value and fields in the editor. */
  editor: Block<Extract<Behavior, { type: T }>>;
  /** What it makes an object do, as a short Persian sentence. */
  sentence: (behavior: Extract<Behavior, { type: T }>, kit: TriggerSentenceKit) => string;
  /** Problems with it. */
  check?: (behavior: Extract<Behavior, { type: T }>, kit: BehaviorCheckKit) => void;
  /**
   * What it does to its object at every step of a running game, in the order of the object's behaviors. None for a
   * behavior whose work the core does elsewhere (camera, real physics, joints, fields, light, wave, launch,
   * dragging, special moves, animation).
   */
  step?: (game: Game, e: Entity, behavior: Extract<Behavior, { type: T }>, frame: BehaviorStep) => void;
}

/** Declares a behavior block, keeping its fields typed to its own behavior. */
export const behaviorBlock = <T extends Behavior['type']>(block: BehaviorBlock<T>): BehaviorBlock<T> => block;
