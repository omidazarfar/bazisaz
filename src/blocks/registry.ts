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
] as const;
export const ACTION_BLOCKS = blocks as unknown as readonly ActionBlock[];

/** The actions that are blocks in their own files. */
export type BlockActionType = (typeof blocks)[number]['type'];

/** The blocks by type, for the runtime and the editor. */
export const actionBlocks: ReadonlyMap<Action['type'], ActionBlock> = new Map(ACTION_BLOCKS.map((b) => [b.type, b]));
