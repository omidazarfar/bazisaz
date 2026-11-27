import { Fragment, useState, type ReactNode } from 'react';
import { mapRuleActions, type Action, type Condition, type GameProject, type Rule, type SubRule, type Trigger } from '../format/types';
import type { Editor } from './editor';
import { Fields, isNewPicture, type NewPicture } from './Fields';
import { useSprite } from './sprites';
import { ACTION_GROUPS, ACTIONS, COMMON_ACTIONS, COMMON_TRIGGERS, CHECK_CONDITION_FIELDS, CONDITION_FIELDS, OBJECT_CONDITION_FIELDS, TRIGGER_GROUPS, TRIGGERS, whyNot, type Context } from './labels';
import { PickButton, type PickGroup } from './Pick';
import { actionSentence, conditionSentence, subjectsOf, triggerSentence } from './sentences';
import { changeRule, moveRuleIn, moveRuleOut, newId, updateScene, valueNames, withNewIds } from './state';
import { namesOf } from '../blocks/fields';

type RuleNode = Rule | SubRule;

/** The action being dragged in a rule, by its list and place. */
let dragging: { which: string; index: number } | null = null;

/** The pick lists of triggers and actions, with the ones that cannot be used yet saying why. */
export function triggerChoices(ctx: Context): PickGroup[] {
  return TRIGGER_GROUPS.map((g) => ({
    title: g.title,
    items: g.types.map((type) => ({ value: type, title: TRIGGERS[type].title, about: TRIGGERS[type].about ?? TRIGGERS[type].short, why: whyNot(TRIGGERS[type], ctx) })),
  }));
}
export function actionChoices(ctx: Context): PickGroup[] {
  return ACTION_GROUPS.map((g) => ({
    title: g.title,
    items: g.types.map((type) => ({ value: type, title: ACTIONS[type].title, about: ACTIONS[type].about ?? ACTIONS[type].short, why: whyNot(ACTIONS[type], ctx) })),
  }));
}

/** The rules of the current scene: "when this happens, do that". One is open for editing at a time. */
export function Rules({ editor, open, setOpen }: { editor: Editor; open: string | null; setOpen: (id: string | null) => void }) {
  const { project, scene, change } = editor;
  const ctx: Context = { project, scene };
  /** The rule whose "only if" part was opened while it has no condition yet. */
  const [asking, setAsking] = useState<string | null>(null);
  /** The rule whose "otherwise" part was opened while it has no actions yet. */
  const [askingElse, setAskingElse] = useState<string | null>(null);

  const setRules = (rules: Rule[], key: string) => change(updateScene(project, scene.id, (s) => ({ ...s, rules })), key);
  /** A rule or a sub-rule (item 2), at any depth, replaced by this one. */
  const setRule = (rule: RuleNode, key: string) =>
    setRules(changeRule(scene.rules, rule.id, () => [rule]), `${rule.id}.${key}`);

  const addRule = (type: Trigger['type']) => {
    const rule: Rule = { id: newId('rule'), when: TRIGGERS[type].make(ctx), condition: null, then: [] };
    setRules([...scene.rules, rule], `add.${rule.id}`);
    setOpen(rule.id);
  };

  /**
   * One rule card, closed as a sentence or open for editing, with its sub-rules (item 2) below it. `place` is its
   * number and its parents' (2.1 is the first sub-rule of rule 2); `top` is the rule at the top it is inside.
   */
  const drawRule = (rule: RuleNode, place: number[], top: Rule): ReactNode => {
        // A sub-rule is about the objects of the trigger of the rule at the top.
        const isTop = rule === top;
        const subjects = subjectsOf(scene, top.when);
        const name = isTop ? `قانون ${place[0]}` : `زیرقانون ${place.join('.')}`;
        // Every condition must hold. The first is kept where older games have their only one.
        const conditions = [rule.condition, ...(rule.also ?? [])].filter((c): c is Condition => c !== null);
        const setConditions = (list: Condition[], key: string) => {
          const { also: _also, ...rest } = rule;
          setRule({ ...rest, condition: list[0] ?? null, ...(list.length > 1 ? { also: list.slice(1) } : {}) }, key);
        };
        // Changing what the rule is about can leave actions pointing at a "second" object that no longer exists.
        const fixTargets = (then: Action[], when: Trigger): Action[] => {
          const allowed = subjectsOf(scene, when);
          const ok = (t: unknown) => (t === 'first' ? Boolean(allowed.first) : t === 'second' ? Boolean(allowed.second) : true);
          return then.filter((a) => (!('target' in a) || ok(a.target)) && (a.type !== 'spawn' || ok(a.at)));
        };
        const setWhen = (when: Trigger, key: string) => setRule(mapRuleActions({ ...top, when }, (list) => fixTargets(list, when)), key);
        type Which = 'then' | 'otherwise';
        const listOf = (which: Which): Action[] => rule[which] ?? [];
        /** The rule with one of its two lists of actions replaced; an empty "otherwise" is dropped. */
        const withList = (which: Which, list: Action[]): RuleNode => {
          if (which === 'then') return { ...rule, then: list };
          const { otherwise: _otherwise, ...rest } = rule;
          return list.length > 0 ? { ...rest, otherwise: list } : rest;
        };
        const setAction = (which: Which, index: number, action: Action, key: string, base: GameProject = project) =>
          change(
            updateScene(base, scene.id, (s) => ({ ...s, rules: changeRule(s.rules, rule.id, () => [withList(which, listOf(which).map((a, i) => (i === index ? action : a)))]) })),
            `${rule.id}.${which}.${index}.${key}`,
          );
        /** A picture new to the game joins its pictures in the same step that the action starts using it. */
        const setActionPicture = async (which: Which, index: number, action: Action, key: string, picture: NewPicture) => {
          if ('newImage' in picture) {
            const id = newId('img');
            setAction(which, index, { ...action, [key]: id } as Action, key, { ...project, assets: { ...project.assets, [id]: { type: 'image', src: picture.newImage } } });
          } else {
            const placed = await useSprite(project, picture.sprite);
            setAction(which, index, { ...action, [key]: placed.asset } as Action, key, placed.project);
          }
        };
        // Dragged by its handle and dropped on another action of the same list, an action moves there.
        const moveTo = (which: Which, from: number, to: number) => {
          const list = [...listOf(which)];
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);
          setRule(withList(which, list), which + '.move.' + newId('m'));
        };
        const moveAction = (which: Which, index: number, by: number) => {
          const list = [...listOf(which)];
          [list[index], list[index + by]] = [list[index + by], list[index]];
          setRule(withList(which, list), `${which}.move.${newId('m')}`);
        };
        /** One list of actions, each with its settings, and the button that adds another. */
        const actionList = (which: Which) => {
          const list = listOf(which);
          return (
            <>
              {list.map((action, index) => (
                <div key={index} className="action" data-action={action.type}
                  onDragOver={(ev) => { if (dragging?.which === which) ev.preventDefault(); }}
                  onDrop={(ev) => { ev.preventDefault(); if (dragging && dragging.which === which && dragging.index !== index) moveTo(which, dragging.index, index); dragging = null; }}>
                  <div className="action-head">
                    <span className="drag-handle" draggable title="بکش و روی کار دیگری رها کن تا جابه‌جا شود" data-drag-action={index}
                      onDragStart={(ev) => { dragging = { which, index }; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(index)); }}
                      onDragEnd={() => { dragging = null; }}>⠿</span>
                    <strong>{ACTIONS[action.type].title}</strong>
                    <span className="action-tools">
                      <button type="button" className="link" title="زودتر انجام شود" aria-label={`کار ${index + 1} بالاتر برود`} disabled={index === 0} onClick={() => moveAction(which, index, -1)}>▲</button>
                      <button type="button" className="link" title="دیرتر انجام شود" aria-label={`کار ${index + 1} پایین‌تر برود`} disabled={index === list.length - 1} onClick={() => moveAction(which, index, 1)}>▼</button>
                      <button type="button" className="link" onClick={() => setRule(withList(which, list.filter((_, i) => i !== index)), `${which}.remove.${index}`)}>
                        حذف
                      </button>
                    </span>
                  </div>
                  {ACTIONS[action.type].about && <p className="control-hint">{ACTIONS[action.type].about}</p>}
                  <Fields
                    fields={ACTIONS[action.type].fields}
                    value={action as unknown as Record<string, unknown>}
                    ctx={ctx}
                    subjects={subjects}
                    onChange={(key, value) =>
                      isNewPicture(value) ? void setActionPicture(which, index, action, key, value) : setAction(which, index, { ...action, [key]: value } as Action, key)
                    }
                  />
                </div>
              ))}
              <PickButton
                label={which === 'then' ? 'اضافه کردن کار' : 'اضافه کردن کار برای وگرنه'}
                title="چه کاری انجام شود؟"
                about="کارها به همان ترتیبی که در قانون آمده‌اند انجام می‌شوند."
                groups={actionChoices(ctx)}
                common={COMMON_ACTIONS}
                onPick={(type) => setRule(withList(which, [...list, ACTIONS[type as Action['type']].make(ctx)]), `${which}.add.${list.length}`)}
              >
                + یک کار اضافه کن
              </PickButton>
            </>
          );
        };

        const view = open !== rule.id ? (
            <button key={rule.id} type="button" className={isTop ? 'rule rule-closed' : 'rule rule-closed rule-sub'} data-rule={rule.id} data-sub={isTop ? undefined : ''} aria-label={name} onClick={() => setOpen(rule.id)}>
              {isTop ? (
                <span className="rule-when"><span dir="rtl">{triggerSentence(scene, top.when)}</span>{conditions.map((c, i) => <small key={i}> (فقط اگر {conditionSentence(scene, c, subjects)})</small>)}</span>
              ) : (
                <span className="rule-when"><span dir="rtl">{conditions.length ? `اگر ${conditions.map((c) => conditionSentence(scene, c, subjects)).join(' و ')}` : 'بدون شرط'}</span></span>
              )}
              {rule.then.length === 0 ? (
                <span className="rule-then">هنوز کاری انتخاب نشده</span>
              ) : (
                <ol className="rule-then">
                  {rule.then.map((a, i) => <li key={i}><span dir="rtl">{actionSentence(project, scene, a, subjects)}</span></li>)}
                </ol>
              )}
              {conditions.length > 0 && rule.otherwise && rule.otherwise.length > 0 && (
                <span className="rule-else">وگرنه: {rule.otherwise.map((a) => actionSentence(project, scene, a, subjects)).join('، ')}</span>
              )}
            </button>
        ) : (
          <article key={rule.id} className={isTop ? 'rule' : 'rule rule-sub'} data-rule={rule.id} data-sub={isTop ? undefined : ''} aria-label={name}>
            {!isTop && (
              <p className="control-hint">زیرقانون: وقتی قانونِ بالایی کارهایش را انجام داد (اتفاقش افتاد و شرط‌هایش برقرار بود)، این یکی هم درباره‌ی همان اشیا نگاه می‌شود.</p>
            )}
            {isTop && (
            <div className="rule-part">
              <span className="rule-word">وقتی</span>
              <PickButton
                label="انتخاب اتفاق"
                className="pick-current"
                title="این قانون با چه اتفاقی شروع شود؟"
                groups={triggerChoices(ctx)}
                common={COMMON_TRIGGERS}
                onPick={(type) => setWhen(TRIGGERS[type as Trigger['type']].make(ctx), 'type')}
              >
                {TRIGGERS[top.when.type].title}
              </PickButton>
              <Fields
                fields={TRIGGERS[top.when.type].fields}
                value={top.when as unknown as Record<string, unknown>}
                ctx={ctx}
                onChange={(key, value) => setWhen({ ...top.when, [key]: value } as Trigger, `when.${key}`)}
              />
            </div>
            )}

            {conditions.length === 0 && asking !== rule.id ? (
              <div className="rule-part rule-part-quiet">
                <button type="button" className="link" onClick={() => setAsking(rule.id)}>
                  + شرط بگذار (اختیاری)…
                </button>
                <p className="control-hint">مثلاً «فقط اگر امتیاز بیشتر از ۱۰ باشد». بدون شرط، هر بار که این اتفاق بیفتد کارها انجام می‌شوند.</p>
              </div>
            ) : (
            <div className="rule-part">
              <span className="rule-word">{isTop ? 'فقط اگر' : 'اگر'}</span>
              {conditions.length === 0 && <p className="control-hint">شرطی نیست: هر بار که این اتفاق بیفتد، کارها انجام می‌شوند.</p>}
              {conditions.map((c, i) => (
                <div key={i} className="action" data-condition={i}>
                  <div className="action-head">
                    <strong>{c.check !== undefined ? 'پرسش خودت' : c.of === undefined ? 'یک مقدار بازی' : 'مقدار یک شیء'}</strong>
                    <button type="button" className="link" onClick={() => setConditions(conditions.filter((_, j) => j !== i), `condition.remove.${i}`)}>حذف</button>
                  </div>
                  <Fields
                    fields={c.check !== undefined ? CHECK_CONDITION_FIELDS : c.of === undefined ? CONDITION_FIELDS : OBJECT_CONDITION_FIELDS}
                    value={c as unknown as Record<string, unknown>}
                    ctx={ctx}
                    subjects={subjects}
                    onChange={(key, value) => setConditions(conditions.map((x, j) => (j === i ? ({ ...x, [key]: value } as Condition) : x)), `condition.${i}.${key}`)}
                  />
                </div>
              ))}
              <div className="adders">
                {project.variables.length > 0 && (
                  <button type="button" className="chip" onClick={() => setConditions([...conditions, { name: project.variables[0].name, op: '>=', value: 1 }], `condition.add.${conditions.length}`)}>
                    + شرط روی یک مقدار بازی
                  </button>
                )}
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    const of = subjects.first ? ('first' as const) : scene.objects[0] ? { by: 'id' as const, id: scene.objects[0].id } : { by: 'tag' as const, tag: '' };
                    setConditions([...conditions, { of, name: valueNames(scene)[0] ?? 'open', op: '==', value: 1 }], `condition.add.${conditions.length}`);
                  }}
                >
                  + شرط روی مقدار یک شیء
                </button>
                {namesOf(scene, 'asked').length > 0 && (
                  <button type="button" className="chip" data-add-check onClick={() => setConditions([...conditions, { name: '', op: '==', value: 1, check: namesOf(scene, 'asked')[0], answer: true }], `condition.add.${conditions.length}`)}>
                    + شرط با یک پرسش
                  </button>
                )}
              </div>
            </div>
            )}

            <div className="rule-part">
              <span className="rule-word">آنگاه</span>
              {rule.then.length === 0 && <p className="empty">هنوز کاری انتخاب نشده. با دکمه‌ی زیر اولین کار را اضافه کن.</p>}
              {actionList('then')}
            </div>

            {conditions.length > 0 && (rule.otherwise?.length || askingElse === rule.id ? (
              <div className="rule-part rule-part-else">
                <span className="rule-word">وگرنه</span>
                <p className="control-hint">اگر اتفاق افتاد ولی شرط برقرار نبود، به‌جای کارهای بالا این‌ها انجام می‌شوند. مثلاً: اگر کلید داری در باز شود، وگرنه صدای «نه» پخش شود.</p>
                {actionList('otherwise')}
              </div>
            ) : (
              <div className="rule-part rule-part-quiet">
                <button type="button" className="link" onClick={() => setAskingElse(rule.id)}>+ وگرنه… (اختیاری)</button>
              </div>
            ))}

            <div className="adders">
              <button
                type="button"
                className="chip"
                data-add-sub
                title="قانونی بدون اتفاقِ خودش، که فقط وقتی این یکی کارهایش را انجام داد نگاه می‌شود."
                onClick={() => {
                  const sub: SubRule = { id: newId('rule'), condition: null, then: [] };
                  setRule({ ...rule, sub: [...(rule.sub ?? []), sub] }, `sub.add.${sub.id}`);
                  setOpen(sub.id);
                }}
              >
                + زیرقانون
              </button>
              {place[place.length - 1] > 1 && (
                <button
                  type="button"
                  className="chip"
                  data-move-in
                  title={isTop ? 'زیرقانونِ قانون بالایی شود؛ اتفاقِ خودش کنار می‌رود و با اتفاق آن قانون نگاه می‌شود.' : 'زیرقانونِ زیرقانون بالایی شود.'}
                  onClick={() => setRules(moveRuleIn(scene.rules, rule.id, (s, host) => mapRuleActions(s, (list) => fixTargets(list, host.when))), `in.${rule.id}.${newId('m')}`)}
                >
                  ببر داخل قانون بالایی
                </button>
              )}
              {!isTop && (
                <button type="button" className="chip" data-move-out title="از قانونِ بالایی بیرون بیاید و بعد از آن بنشیند." onClick={() => setRules(moveRuleOut(scene.rules, rule.id), `out.${rule.id}.${newId('m')}`)}>
                  بیرون بیاور
                </button>
              )}
            </div>

            <div className="rule-foot">
              <button type="button" className="chip" onClick={() => setOpen(null)}>بستن</button>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  const copy = withNewIds(rule);
                  setRules(changeRule(scene.rules, rule.id, (r) => [r, copy]), `copy.${copy.id}`);
                  setOpen(copy.id);
                }}
              >
                {isTop ? 'کپی این قانون' : 'کپی این زیرقانون'}
              </button>
              <button type="button" className="link link-danger" onClick={() => setRules(changeRule(scene.rules, rule.id, () => []), `remove.${rule.id}`)}>
                {isTop ? 'حذف این قانون' : 'حذف این زیرقانون'}
              </button>
            </div>
          </article>
        );
        // Its sub-rules, below it and set in.
        return (
          <Fragment key={rule.id}>
            {view}
            {rule.sub && rule.sub.length > 0 && <div className="rule-subs" data-subs-of={rule.id}>{rule.sub.map((s, i) => drawRule(s, [...place, i + 1], top))}</div>}
          </Fragment>
        );
  };

  return (
    <div className="rules">
      <header className="panel-head">
        <h2>قانون‌های این صحنه</h2>
        <p>هر قانون می‌گوید «وقتی فلان اتفاق افتاد، این کارها را بکن». قانون‌ها فقط در صحنه‌ی «{scene.name}» کار می‌کنند.</p>
      </header>

      {scene.rules.length === 0 && <p className="empty">هنوز قانونی نیست. مثلاً: وقتی بازیکن به سکه می‌خورد، یک امتیاز اضافه کن.</p>}

      {scene.rules.map((rule, number) => drawRule(rule, [number + 1], rule))}

      <PickButton label="قانون تازه" title="قانون تازه با چه اتفاقی شروع شود؟" about="بعد از انتخاب اتفاق، کارهایی را که باید انجام شوند اضافه می‌کنی." groups={triggerChoices(ctx)} common={COMMON_TRIGGERS} onPick={(type) => addRule(type as Trigger['type'])}>
        + قانون تازه
      </PickButton>
    </div>
  );
}
