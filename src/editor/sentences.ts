import type { Action, Behavior, Condition, GameObject, GameProject, Place, Scene, Trigger } from '../format/types';
import { actionBlocks, behaviorBlocks, triggerBlocks } from '../blocks/registry';
import { amountText, describeRef, OP_WORD, type Subjects } from '../blocks/say';

export { describeRef, type Subjects };
import { fa } from './labels';

/**
 * Rules said as plain Persian sentences, so a list of them can be read like a
 * description of the game instead of a list of settings.
 */




/** What "first" and "second" mean in a rule's actions, said in terms of its trigger. */
export function subjectsOf(scene: Scene, when: Trigger): Subjects {
  // Every trigger is a block in its own file (src/blocks/triggers/), which says itself.
  return triggerBlocks.get(when.type)?.subjects?.(when as never, { scene }) ?? {};
}

export function triggerSentence(scene: Scene, w: Trigger): string {
  return triggerBlocks.get(w.type)?.sentence(w as never, { scene }) ?? '';
}



export function actionSentence(project: GameProject, scene: Scene, a: Action, subjects: Subjects): string {
  const who = (target: Place) =>
    target === 'tap' ? 'جایی که لمس شد' : target === 'first' ? (subjects.first ?? 'همان شیء') : target === 'second' ? (subjects.second ?? 'همان شیء دوم') : describeRef(scene, target);
  // Every action is a block in its own file (src/blocks/actions/), which says itself.
  return actionBlocks.get(a.type)?.sentence(a as never, { project, scene, who }) ?? '';
}

/** What one behavior makes an object do, as a short sentence. */
export function behaviorSentence(scene: Scene, b: Behavior): string {
  // Every behavior is a block in its own file (src/blocks/behaviors/), which says itself.
  return behaviorBlocks.get(b.type)?.sentence(b as never, { scene }) ?? '';
}

/** Everything an object does or is, in plain sentences: for the top of its settings and its row in the list. */
export function describeObject(scene: Scene, object: GameObject): string[] {
  const lines = object.behaviors.map((b) => behaviorSentence(scene, b));
  if (object.visual.kind === 'tiles') lines.unshift('نقشه‌ای که با قلم رویش می‌کشی؛ هر خانه حین بازی یک تکه است');
  if (object.tags.length > 0) lines.push(`در گروه ${object.tags.map((t) => `«${t}»`).join(' و ')} است؛ قانون‌ها با این نام پیدایش می‌کنند`);
  if (object.health !== undefined) lines.push(`${fa(object.health)} جان دارد`);
  if (object.fixed) lines.push('به صفحه چسبیده و با دوربین حرکت نمی‌کند');
  if (!object.visible) lines.push('اول پنهان است تا قانونی نشانش بدهد');
  if (object.slope) lines.push('سراشیبی است؛ می‌شود رویش بالا و پایین رفت');
  return lines;
}

/** One of a rule's conditions, as the words that follow "only if". */
export function conditionSentence(scene: Scene, c: Condition, subjects: Subjects): string {
  const who = (target: Place) =>
    target === 'tap' ? 'جای لمس' : target === 'first' ? (subjects.first ?? 'همان شیء') : target === 'second' ? (subjects.second ?? 'همان شیء دوم') : describeRef(scene, target);
  const left = c.of === undefined ? c.name : `${c.name}ِ ${who(c.of)}`;
  return `${left} ${OP_WORD[c.op]} ${amountText(c.value, who)} باشد`;
}
