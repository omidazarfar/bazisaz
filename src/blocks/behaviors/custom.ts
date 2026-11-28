import { behaviorBlock } from '../types';

declare module '../../format/types' {
  interface MoreBehaviors {
    /**
     * One of the game's custom behaviors (item 3 of the 2026-11-27 roadmap): `behavior` is the id of a
     * `CustomBehavior` in `project.customBehaviors`. Its rules run for this object, with "this object" meaning it;
     * `settings` are this object's own numbers for the behavior's settings (one left out keeps the behavior's own).
     */
    custom: { type: 'custom'; behavior: string; settings?: Record<string, number> };
  }
}

/**
 * A behavior the user made from rules. It is not offered in the list of built-in behaviors: each custom behavior
 * is offered by its own name (Inspector.tsx). Its work is done by its rules (Game.runBehaviorRules), not here.
 */
export const custom = behaviorBlock({
  type: 'custom',
  editor: {
    title: 'رفتار خودت',
    about: 'رفتاری که خودت با قانون‌ها ساخته‌ای.',
    make: () => ({ type: 'custom', behavior: '' }),
    fields: [],
  },
  sentence: (b, { project }) => {
    const def = project?.customBehaviors?.find((d) => d.id === b.behavior);
    return def ? `«${def.name}» دارد (رفتار خودت)` : 'رفتاری دارد که دیگر نیست';
  },
  check: (b, { project, object, say }) => {
    const def = project.customBehaviors?.find((d) => d.id === b.behavior);
    if (!def) return say(`"${object.id}" has the custom behavior "${b.behavior}", which the game does not have.`);
    const names = new Set(def.settings.map((s) => s.name));
    for (const key of Object.keys(b.settings ?? {})) {
      if (!names.has(key)) say(`"${object.id}" sets "${key}" for the behavior "${def.name}", which has no such setting.`);
      else if (typeof b.settings![key] !== 'number' || !Number.isFinite(b.settings![key])) say(`"${object.id}": the setting "${key}" of "${def.name}" must be a number.`);
    }
    // A setting is an object value of that name: it cannot also be one of the object's own values, or a setting
    // of another of its custom behaviors.
    for (const name of names) {
      if (object.values && name in object.values) say(`"${object.id}" has a value "${name}" of its own and a setting "${name}" of "${def.name}"; rename one.`);
      const other = object.behaviors.find((x) => x !== b && x.type === 'custom' && project.customBehaviors?.find((d) => d.id === x.behavior)?.settings.some((s) => s.name === name));
      if (other && other.type === 'custom' && other.behavior !== b.behavior) say(`"${object.id}": two of its behaviors have a setting "${name}".`);
    }
    if (object.behaviors.filter((x) => x.type === 'custom' && x.behavior === b.behavior).length > 1) say(`"${object.id}" has the behavior "${def.name}" twice.`);
  },
});
