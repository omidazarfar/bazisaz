import type { Action } from '../format/types';
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
import type { ActionBlock } from './types';

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
] as const;
export const ACTION_BLOCKS = blocks as unknown as readonly ActionBlock[];

/** The actions that are blocks in their own files. */
export type BlockActionType = (typeof blocks)[number]['type'];

/** The blocks by type, for the runtime and the editor. */
export const actionBlocks: ReadonlyMap<Action['type'], ActionBlock> = new Map(ACTION_BLOCKS.map((b) => [b.type, b]));

/** Every action of the format is a block: this fails to compile, naming the action, if one has no block. */
type ActionWithoutBlock = Exclude<Action['type'], BlockActionType>;
export const everyActionIsABlock: [ActionWithoutBlock] extends [never] ? true : ActionWithoutBlock = true;
