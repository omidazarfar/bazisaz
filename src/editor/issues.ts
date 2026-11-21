import { ruleActions, type Action, type GameObject, type GameProject, type Ref, type Scene, type Target } from '../format/types';
import { BEHAVIORS } from './labels';
import { describeRef, triggerSentence } from './sentences';
import { allTags, valueNames } from './state';

/** Every name of an object's own value that a rule reads, wherever in the rule it is read. */
function valuesRead(part: unknown, into: Set<string>): void {
  if (Array.isArray(part)) return part.forEach((inner) => valuesRead(inner, into));
  if (part === null || typeof part !== 'object') return;
  const entry = part as Record<string, unknown>;
  // A group narrowed by a value, an amount taken from an object's value, a condition on an object's value.
  if (entry.where && typeof entry.where === 'object') into.add(String((entry.where as { name: unknown }).name));
  if (typeof entry.value === 'string' && 'of' in entry) into.add(entry.value);
  if (typeof entry.name === 'string' && 'of' in entry && 'op' in entry) into.add(entry.name);
  Object.values(entry).forEach((inner) => valuesRead(inner, into));
}

/**
 * Things that are allowed but almost certainly not what the maker meant: a
 * rule that does nothing, a group nobody belongs to, an object that can never
 * appear. Each is said in a sentence, with the place to go and fix it.
 */
export interface Issue {
  sceneId: string;
  text: string;
  /** The object to select, or the rule to open, to deal with it. */
  object?: string;
  rule?: string;
}

export function findIssues(project: GameProject): Issue[] {
  const issues: Issue[] = [];
  const variables = new Set([...project.variables, ...(project.textVariables ?? [])].map(v => v.name));
  const reached = new Set([project.startScene]);
  let showsAd = false;

  for (const scene of project.scenes) {
    const all = [...scene.objects, ...scene.prefabs];
    // Including the groups of tile map cells.
    const tags = new Set(allTags(scene));
    const say = (text: string, where: { object?: string; rule?: string } = {}) => issues.push({ sceneId: scene.id, text, ...where });
    const missing = (tag: string) => tag !== '' && !tags.has(tag);

    // Groups that behaviors rely on.
    const tagFields = (o: GameObject) =>
      o.behaviors.flatMap((b) => {
        const info = BEHAVIORS[b.type];
        const value = b as unknown as Record<string, unknown>;
        return info.fields.filter((f) => f.kind === 'tag' && (!f.showIf || f.showIf(value))).map((f) => ({ behavior: info.title, label: f.label, key: f.key, tag: String(value[f.key] ?? f.fallback ?? '') }));
      });
    // Groups that may well be left empty: nothing solid, no walls to go around.
    const optional = new Set(['solidTag', 'avoidTag', 'roomTag', 'bumpTag', 'passTag']);
    for (const o of all) {
      for (const f of tagFields(o)) {
        if (f.tag === '' && !optional.has(f.key)) say(`«${o.name}»: در رفتار «${f.behavior}» هنوز گروهی برای «${f.label}» انتخاب نشده.`, { object: o.id });
        else if (missing(f.tag)) say(`«${o.name}»: رفتار «${f.behavior}» با گروه «${f.tag}» کار می‌کند، ولی هیچ شیئی در این گروه نیست.`, { object: o.id });
      }
      const body = o.behaviors.find((b) => b.type === 'body');
      if (body?.type === 'body' && body.gravity && body.solidTag === '' && body.edges === 'none') {
        say(`«${o.name}» جاذبه دارد ولی روی چیزی نمی‌ایستد و از صفحه پایین می‌افتد. در «جسم فیزیکی» گروه زمین را انتخاب کن.`, { object: o.id });
      }
      const physics = o.behaviors.find((b) => b.type === 'physics');
      if (physics?.type === 'physics' && physics.kind === 'moving' && physics.gravity !== false && !physics.edges && physics.solidTag === '' && !o.behaviors.some((b) => b.type === 'joint') && !all.some((x) => x !== o && x.behaviors.some((b) => b.type === 'physics' && b.kind === 'still'))) {
        say(`«${o.name}» فیزیک واقعی دارد ولی چیزی زیرش نیست که رویش بایستد و از دنیا بیرون می‌افتد. در «فیزیک واقعی» گروه زمین را انتخاب کن یا «لبه‌های دنیا دیوار باشند» را روشن کن.`, { object: o.id });
      }
      if (o.behaviors.some((b) => b.type === 'joint') && !o.behaviors.some((b) => b.type === 'physics')) {
        say(`«${o.name}» «اتصال» دارد ولی «فیزیک واقعی» ندارد، پس تکان نمی‌خورد. رفتار «فیزیک واقعی» را هم به آن بده.`, { object: o.id });
      }
      if (o.behaviors.some((b) => b.type === 'field') && !all.some((x) => x.behaviors.some((b) => b.type === 'physics' && b.kind === 'moving'))) {
        say(`«${o.name}» منطقه‌ی نیرو است، ولی هیچ شیئی «فیزیک واقعی» ندارد که آن را هل بدهد.`, { object: o.id });
      }
      if (o.fixed && o.behaviors.some((b) => b.type === 'physics')) {
        say(`«${o.name}» به صفحه چسبیده، و چیزهای چسبیده به صفحه فیزیک واقعی ندارند.`, { object: o.id });
      }
      if (o.visual.kind === 'text') {
        // {time:time} shows the variable "time" as a clock; the part after the colon is how, not a name.
        for (const [, name] of o.visual.text.matchAll(/\{([^{}:]+)(?::(?:time|int))?\}/g)) {
          if (!variables.has(name)) say(`متن «${o.name}» می‌خواهد مقدار «${name}» را نشان بدهد، ولی چنین مقداری ساخته نشده.`, { object: o.id });
        }
      }
    }

    // Things that are never brought into the game.
    const spawned = new Set<string>();
    for (const o of all) for (const b of o.behaviors) if (b.type === 'spawner') b.prefabs.forEach((p) => spawned.add(p));
    for (const r of scene.rules) {
      for (const a of ruleActions(r)) {
        if (a.type === 'spawn' || a.type === 'slideAll') spawned.add(a.prefab);
        if (a.type === 'settle') a.prefabs.forEach((p) => spawned.add(p));
      }
    }
    for (const p of scene.prefabs) {
      if (!spawned.has(p.id)) say(`«${p.name}» هیچ‌وقت ساخته نمی‌شود. به یک شیء رفتار «ساخت خودکار» بده یا در یک قانون کار «ساختن یک شیء» را بگذار.`, { object: p.id });
    }

    // Values an object starts with, and values some rule gives to objects as the game goes.
    const knownValues = new Set([...valueNames(scene), ...scene.rules.flatMap((r) => ruleActions(r).flatMap((a) => (a.type === 'setValue' ? [a.name] : [])))]);
    const refMissing = (ref: Ref | Target) => typeof ref === 'object' && ref.by === 'tag' && (ref.tag === '' || missing(ref.tag));
    for (const r of scene.rules) {
      const where = { rule: r.id };
      const title = triggerSentence(scene, r.when);
      if (r.then.length === 0) say(`قانون «${title}» هنوز هیچ کاری انجام نمی‌دهد.`, where);
      const read = new Set<string>();
      valuesRead(r, read);
      if (r.when.type === 'value' || r.when.type === 'line') read.add(r.when.name);
      for (const name of read) {
        if (name !== '' && !knownValues.has(name)) say(`قانون «${title}» مقدار «${name}» را از اشیا می‌خواند، ولی هیچ شیئی در این صحنه چنین مقداری ندارد. شاید نامش اشتباه نوشته شده.`, where);
      }
      const w = r.when;
      const refs: Ref[] = w.type === 'touch' || w.type === 'near' || w.type === 'hit' ? [w.a, w.b] : 'target' in w ? [w.target] : [];
      for (const ref of refs) {
        if (refMissing(ref)) say(`قانون «${title}» با ${describeRef(scene, ref)} کار می‌کند، ولی هیچ شیئی در آن گروه نیست.`, where);
      }
      if (w.type === 'touch' && JSON.stringify(w.a) === JSON.stringify(w.b) && w.a.by === 'id') say('قانون برخورد: «اولی» و «دومی» یک شیء هستند، پس هیچ‌وقت رخ نمی‌دهد.', where);
      if (w.type === 'message' && !scene.rules.some((x) => ruleActions(x).some((a) => a.type === 'send' && a.name === w.name))) {
        say(`قانون «${title}» منتظر پیامی است که هیچ قانونی در این صحنه آن را نمی‌فرستد. در قانونی کار «فرستادن پیام» را با همین نام بگذار.`, where);
      }
      for (const a of ruleActions(r)) {
        if (a.type === 'send' && !scene.rules.some((x) => x.when.type === 'message' && x.when.name === a.name)) {
          say(`قانون «${title}» پیام «${a.name}» را می‌فرستد، ولی هیچ قانونی منتظرش نیست. یک قانون تازه با اتفاق «پیامی می‌رسد» بساز.`, where);
        }
      }
      if ((w.type === 'hit' || w.type === 'thrown' || w.type === 'rest' || w.type === 'snap') && !all.some((o) => o.behaviors.some((b) => b.type === 'physics'))) say(`قانون «${title}» فقط برای اشیای «فیزیک واقعی» کار می‌کند، ولی هیچ شیئی آن را ندارد.`, where);
      for (const a of ruleActions(r) as Action[]) {
        if (a.type === 'blast' && !all.some((o) => o.behaviors.some((b) => b.type === 'physics'))) say(`در قانون «${title}» انفجار هست، ولی هیچ شیئی «فیزیک واقعی» ندارد که پرت شود.`, where);
        if ('target' in a && refMissing(a.target)) say(`در قانون «${title}» کاری با گروهی سروکار دارد که هیچ شیئی در آن نیست.`, where);
        if (a.type === 'goToScene') reached.add(a.scene);
        if (a.type === 'nextScene') {
          const at = project.scenes.findIndex((s) => s.id === scene.id);
          reached.add(project.scenes[(at + 1) % project.scenes.length].id);
        }
        if (a.type === 'showAd' || a.type === 'showRewardedAd') showsAd = true;
        if (a.type === 'showRewardedAd' && !scene.rules.some((x) => x.when.type === 'reward')) {
          say('تبلیغ جایزه‌ای پیشنهاد می‌شود، ولی قانونی برای «بازیکن تبلیغ را تا آخر دید» نیست؛ بازیکن جایزه‌ای نمی‌گیرد.', where);
        }
      }
    }
  }

  for (const scene of project.scenes) {
    if (!reached.has(scene.id)) issues.push({ sceneId: scene.id, text: `هیچ قانونی بازی را به صحنه‌ی «${scene.name}» نمی‌برد.` });
  }
  if (showsAd && !project.ads.enabled) {
    issues.push({ sceneId: project.startScene, text: 'قانونی تبلیغ نشان می‌دهد، ولی تبلیغات در برگه‌ی «بازی» خاموش است.' });
  }
  return issues;
}

/** The scene an issue belongs to, for showing where it is. */
export function sceneName(project: GameProject, issue: Issue): string {
  return (project.scenes.find((s) => s.id === issue.sceneId) as Scene | undefined)?.name ?? '';
}
