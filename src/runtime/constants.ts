/** Numbers the runtime core and the blocks both need (moved out of Game.ts as they were). */

export const SHAKE_SECONDS = 0.35;

/** A scene ignores taps for its first moments, so the tap that led into it does not also act in it. */
export const TAP_GRACE = 0.35;

/** A press this long before landing still jumps (see COYOTE in Game.ts, the other half of the same forgiveness). */
export const JUMP_BUFFER = 0.12;
/** How much of its upward speed a jump keeps when the finger lets go early. */
export const JUMP_CUT = 0.45;
/** How far a finger has to be dragged for the on-screen stick to give full speed. */
export const STICK_REACH = 80;
