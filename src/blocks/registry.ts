import type { Action, Behavior, Trigger } from '../format/types';
import { burst } from './actions/burst';
import { effect } from './actions/effect';
import { floatText } from './actions/floatText';
import { focus } from './actions/focus';
import { playMusic } from './actions/playMusic';
import { playSound } from './actions/playSound';
import { setSound } from './actions/setSound';
import { shake } from './actions/shake';
import { shockwave } from './actions/shockwave';
import { slowMotion } from './actions/slowMotion';
import { vibrate } from './actions/vibrate';
import { zoomPunch } from './actions/zoomPunch';
import { setColor } from './actions/setColor';
import { setImage } from './actions/setImage';
import { setText } from './actions/setText';
import { resize } from './actions/resize';
import { setOpacity } from './actions/setOpacity';
import { flash } from './actions/flash';
import { layer } from './actions/layer';
import { setLook } from './actions/setLook';
import { setDarkness } from './actions/setDarkness';
import { showAd } from './actions/showAd';
import { showRewardedAd } from './actions/showRewardedAd';
import { setValue } from './actions/setValue';
import { shuffle } from './actions/shuffle';
import { swap } from './actions/swap';
import { settle } from './actions/settle';
import { slideAll } from './actions/slideAll';
import { step } from './actions/step';
import { checkpoint } from './actions/checkpoint';
import { respawn } from './actions/respawn';
import { moveTo } from './actions/moveTo';
import { glide } from './actions/glide';
import { moveBy } from './actions/moveBy';
import { moveRandom } from './actions/moveRandom';
import { push } from './actions/push';
import { jump } from './actions/jump';
import { turn } from './actions/turn';
import { kick } from './actions/kick';
import { spin } from './actions/spin';
import { cut } from './actions/cut';
import { setPhysics } from './actions/setPhysics';
import { resetVariables } from './actions/resetVariables';
import { recordScore } from './actions/recordScore';
import { achieve } from './actions/achieve';
import { destroy } from './actions/destroy';
import { show } from './actions/show';
import { hide } from './actions/hide';
import { damage } from './actions/damage';
import { shoot } from './actions/shoot';
import { nextScene } from './actions/nextScene';
import { restartScene } from './actions/restartScene';
import { saveGame } from './actions/saveGame';
import { send } from './actions/send';
import { pause } from './actions/pause';
import { resume } from './actions/resume';
import { setGravity } from './actions/setGravity';
import { zoom } from './actions/zoom';
import { setVariable } from './actions/setVariable';
import { setTextVariable } from './actions/setTextVariable';
import { spawn } from './actions/spawn';
import { goToScene } from './actions/goToScene';
import { loadGame } from './actions/loadGame';
import { blast } from './actions/blast';
import { give, take } from './actions/giveTake';
import { say } from './actions/say';
import { wait } from './actions/wait';
import { start } from './triggers/start';
import { tap } from './triggers/tap';
import { tapObject } from './triggers/tapObject';
import { swipe } from './triggers/swipe';
import { holding } from './triggers/holding';
import { touch } from './triggers/touch';
import { near } from './triggers/near';
import { land } from './triggers/land';
import { offscreen } from './triggers/offscreen';
import { noneLeft } from './triggers/noneLeft';
import { dead } from './triggers/dead';
import { every } from './triggers/every';
import { after } from './triggers/after';
import { eachEvery } from './triggers/eachEvery';
import { variable } from './triggers/variable';
import { value } from './triggers/value';
import { textEquals } from './triggers/textEquals';
import { message } from './triggers/message';
import { line } from './triggers/line';
import { hit } from './triggers/hit';
import { snap } from './triggers/snap';
import { rest, thrown } from './triggers/thrownRest';
import { useItem } from './triggers/useItem';
import { useItemOn } from './triggers/useItemOn';
import { reward } from './triggers/reward';
import { animate } from './behaviors/animate';
import { particles } from './behaviors/particles';
import { light } from './behaviors/light';
import { rotate } from './behaviors/rotate';
import { pulse } from './behaviors/pulse';
import { blink } from './behaviors/blink';
import { trail } from './behaviors/trail';
import { scrollImage } from './behaviors/scrollImage';
import { spawner } from './behaviors/spawner';
import { lifetime } from './behaviors/lifetime';
import { body } from './behaviors/body';
import { physics } from './behaviors/physics';
import { joint } from './behaviors/joint';
import { field } from './behaviors/field';
import { camera } from './behaviors/camera';
import { mover } from './behaviors/mover';
import { homing } from './behaviors/homing';
import { patrol } from './behaviors/patrol';
import { route } from './behaviors/route';
import { chase } from './behaviors/chase';
import { launch } from './behaviors/launch';
import { wave } from './behaviors/wave';
import { attach } from './behaviors/attach';
import { jumper } from './behaviors/jumper';
import { walker } from './behaviors/walker';
import { moves } from './behaviors/moves';
import { steer } from './behaviors/steer';
import { followFinger } from './behaviors/followFinger';
import { draggable } from './behaviors/draggable';
import { call } from './actions/call';
import { forEach, listAdd, listCount, listGet, listRemove } from './actions/lists';
import { asked } from './triggers/asked';
import { called } from './triggers/called';
import type { ActionBlock, BehaviorBlock, TriggerBlock } from './types';

/**
 * Every block that lives in its own file (src/blocks/). The runtime, the editor's panels, the sentences and the
 * checks look a block up here first; blocks not yet moved out of Game.ts and labels.ts are still handled there.
 * A new action: one file in src/blocks/actions/, and one line below.
 */
const blocks = [
  // Sound and effects.
  playSound, playMusic, effect, burst, floatText, shake, focus, zoomPunch, shockwave, slowMotion, vibrate, setSound,
  // Looks.
  setColor, setImage, setText, resize, setOpacity, flash, layer, setLook, setDarkness,
  // Ads.
  showAd, showRewardedAd,
  // Puzzles and logic.
  setValue, shuffle, swap, settle, slideAll, step,
  // Movement.
  checkpoint, respawn, moveTo, glide, moveBy, moveRandom, push, jump, turn,
  // Real physics.
  kick, spin, cut, setPhysics,
  // Values and score.
  resetVariables, recordScore, achieve,
  // Objects.
  destroy, show, hide, damage, shoot,
  // Scene and flow.
  nextScene, restartScene, saveGame, send, pause, resume, setGravity, zoom,
  // Values and score.
  setVariable, setTextVariable,
  // Objects.
  spawn,
  // Scene and flow.
  goToScene, loadGame,
  // Real physics.
  blast,
  // Bag; words; waiting.
  give, take, say, wait,
  // Functions and lists (Phase 4).
  call, listAdd, listRemove, listGet, listCount, forEach,
] as const;
export const ACTION_BLOCKS = blocks as unknown as readonly ActionBlock[];

/** The actions that are blocks in their own files. */
export type BlockActionType = (typeof blocks)[number]['type'];

/** The blocks by type, for the runtime and the editor. */
export const actionBlocks: ReadonlyMap<Action['type'], ActionBlock> = new Map(ACTION_BLOCKS.map((b) => [b.type, b]));

/** Every action of the format is a block: this fails to compile, naming the action, if one has no block. */
type ActionWithoutBlock = Exclude<Action['type'], BlockActionType>;
export const everyActionIsABlock: [ActionWithoutBlock] extends [never] ? true : ActionWithoutBlock = true;

/** Every trigger, in its own file in src/blocks/triggers/. A new trigger: one file there, and one line below. */
const triggers = [
  // The screen.
  tap, tapObject, swipe, holding,
  // Objects.
  touch, near, land, offscreen, noneLeft, dead,
  // Real physics.
  hit, thrown, rest, snap,
  // Time.
  start, every, eachEvery, after,
  // Puzzles and logic.
  message, value, line,
  // Values and ads.
  variable, textEquals, reward,
  // Bag.
  useItem, useItemOn,
  // Functions and questions (Phase 4).
  called, asked,
] as const;
export const TRIGGER_BLOCKS = triggers as unknown as readonly TriggerBlock[];

/** The triggers that are blocks in their own files. */
export type BlockTriggerType = (typeof triggers)[number]['type'];

/** The trigger blocks by type, for the runtime and the editor. */
export const triggerBlocks: ReadonlyMap<Trigger['type'], TriggerBlock> = new Map(TRIGGER_BLOCKS.map((b) => [b.type, b]));

/** Every trigger of the format is a block: this fails to compile, naming the trigger, if one has no block. */
type TriggerWithoutBlock = Exclude<Trigger['type'], BlockTriggerType>;
export const everyTriggerIsABlock: [TriggerWithoutBlock] extends [never] ? true : TriggerWithoutBlock = true;

/** Every behavior, in its own file in src/blocks/behaviors/. A new behavior: one file there, and one line below. */
const behaviors = [
  // Finger control.
  jumper, walker, moves, steer, followFinger, draggable,
  // Moving by itself.
  mover, homing, patrol, route, chase, launch, wave, attach,
  // Physics and camera.
  body, physics, joint, field, camera,
  // Making and ending.
  spawner, lifetime,
  // Looks.
  animate, particles, light, rotate, pulse, blink, trail, scrollImage,
] as const;
export const BEHAVIOR_BLOCKS = behaviors as unknown as readonly BehaviorBlock[];

/** The behaviors that are blocks in their own files. */
export type BlockBehaviorType = (typeof behaviors)[number]['type'];

/** The behavior blocks by type, for the runtime and the editor. */
export const behaviorBlocks: ReadonlyMap<Behavior['type'], BehaviorBlock> = new Map(BEHAVIOR_BLOCKS.map((b) => [b.type, b]));

/** Every behavior of the format is a block: this fails to compile, naming the behavior, if one has no block. */
type BehaviorWithoutBlock = Exclude<Behavior['type'], BlockBehaviorType>;
export const everyBehaviorIsABlock: [BehaviorWithoutBlock] extends [never] ? true : BehaviorWithoutBlock = true;
