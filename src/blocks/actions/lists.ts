import type { GameProject } from '../../format/types';
import { fillTemplate } from '../../runtime/text';
import { namesOf, type Field } from '../fields';
import { amountText } from '../say';
import { actionBlock } from '../types';

// Lists of numbers or of text (Phase 4): put in, take out, read one, count them, and do something for each.
// They share this file as they share their fields. Items are numbered from 1.
declare module '../../format/types' {
  interface MoreActions {
    listAdd: { type: 'listAdd'; list: string; value: Amount; text: string; at?: 'end' | 'start' };
    listRemove: { type: 'listRemove'; list: string; which: 'first' | 'last' | 'at' | 'all'; at?: Amount };
    listGet: { type: 'listGet'; list: string; at: Amount; into: string };
    listCount: { type: 'listCount'; list: string; into: string };
    forEach: { type: 'forEach'; list: string; into: string; name: string };
  }
}

const hasLists = ({ project }: { project: GameProject }) => (project.lists?.length ?? 0) > 0;
const firstList = ({ project }: { project: GameProject }) => project.lists?.[0]?.name ?? '';
/** Whether a name is one of the game's values, of numbers or of text. */
const isValue = (project: GameProject, name: string) => [...project.variables, ...(project.textVariables ?? [])].some((v) => v.name === name);
const LIST: Field = { key: 'list', label: 'کدام فهرست', kind: 'list' };
const INTO: Field = { key: 'into', label: 'در کدام مقدار بگذارد', hint: 'برای فهرست عددی یک مقدار عددی، برای فهرست متنی یک مقدار متنی.', kind: 'anyValue' };

export const listAdd = actionBlock({
  type: 'listAdd',
  still: true,
  editor: {
    title: 'گذاشتن در فهرست',
    short: 'یک عدد یا متن به آخر (یا اول) یک فهرست اضافه می‌کند.',
    available: hasLists,
    make: (ctx) => ({ type: 'listAdd', list: firstList(ctx), value: 1, text: '' }),
    fields: [
      LIST,
      { key: 'value', label: 'چه عددی (فهرست عددی)', kind: 'amount' },
      { key: 'text', label: 'چه متنی (فهرست متنی)', hint: 'می‌تواند مقدارها را با {نام} نشان دهد.', kind: 'text' },
      { key: 'at', label: 'کجای فهرست', kind: 'choice', fallback: 'end', advanced: true, options: [{ value: 'end', label: 'آخر' }, { value: 'start', label: 'اول' }] },
    ],
  },
  sentence: (a, { project, who }) => {
    const text = project.lists?.find((l) => l.name === a.list)?.kind === 'text';
    return `${text ? `«${a.text}»` : amountText(a.value, who)} را به ${a.at === 'start' ? 'اول' : 'آخر'} فهرست ${a.list || '؟'} اضافه کن`;
  },
  check: (a, { needList }) => needList(a.list),
  run: (game, action, context) => {
    const item = game.listIsText(action.list) ? fillTemplate(action.text, game.variables, new Map(), game.textVariables) : game.amount(action.value, context);
    const items = game.list(action.list);
    if (action.at === 'start') items.unshift(item);
    else items.push(item);
    game.valuesChanged = true;
  },
});

export const listRemove = actionBlock({
  type: 'listRemove',
  still: true,
  editor: {
    title: 'برداشتن از فهرست',
    short: 'اولین، آخرین، یکی به شماره، یا همه‌ی چیزهای یک فهرست را برمی‌دارد.',
    available: hasLists,
    make: (ctx) => ({ type: 'listRemove', list: firstList(ctx), which: 'first', at: 1 }),
    fields: [
      LIST,
      { key: 'which', label: 'کدام', kind: 'choice', options: [
        { value: 'first', label: 'اولی' },
        { value: 'last', label: 'آخری' },
        { value: 'at', label: 'به شماره' },
        { value: 'all', label: 'همه (خالی کن)' },
      ] },
      { key: 'at', label: 'شماره‌ی چندم', hint: 'از ۱ شمرده می‌شود.', kind: 'amount', fallback: 1, showIf: (v) => v.which === 'at' },
    ],
  },
  sentence: (a, { who }) => {
    const which = { first: 'اولین چیز', last: 'آخرین چیز', all: 'همه‌ی چیزهای', at: `چیز شماره‌ی ${amountText(a.at ?? 1, who)}` }[a.which];
    return `${which} فهرست ${a.list || '؟'} را بردار`;
  },
  check: (a, { needList }) => needList(a.list),
  run: (game, action, context) => {
    const items = game.list(action.list);
    if (action.which === 'all') items.length = 0;
    else if (action.which === 'first') items.shift();
    else if (action.which === 'last') items.pop();
    else {
      const i = Math.round(game.amount(action.at ?? 1, context)) - 1;
      if (i >= 0 && i < items.length) items.splice(i, 1);
    }
    game.valuesChanged = true;
  },
});

export const listGet = actionBlock({
  type: 'listGet',
  still: true,
  editor: {
    title: 'خواندن از فهرست',
    short: 'چیز شماره‌ی چندمِ یک فهرست را در یک مقدار می‌گذارد؛ مثلاً اولین کارت دسته.',
    available: hasLists,
    make: (ctx) => ({ type: 'listGet', list: firstList(ctx), at: 1, into: ctx.project.variables[0]?.name ?? '' }),
    fields: [LIST, { key: 'at', label: 'شماره‌ی چندم', hint: 'از ۱ شمرده می‌شود. شماره‌ای که در فهرست نیست صفر (یا متن خالی) می‌دهد.', kind: 'amount' }, INTO],
  },
  sentence: (a, { who }) => `چیز شماره‌ی ${amountText(a.at, who)} فهرست ${a.list || '؟'} را در ${a.into || '؟'} بگذار`,
  check: (a, { needList, say, project }) => {
    needList(a.list);
    if (!isValue(project, a.into)) say(`puts a list item into "${a.into}", which is not one of the game's values.`);
  },
  run: (game, action, context) => {
    const i = Math.round(game.amount(action.at, context)) - 1;
    game.putItem(action.into, game.list(action.list)[i], game.listIsText(action.list));
  },
});

export const listCount = actionBlock({
  type: 'listCount',
  still: true,
  editor: {
    title: 'شمردن فهرست',
    short: 'تعداد چیزهای یک فهرست را در یک مقدار عددی می‌گذارد.',
    available: hasLists,
    make: (ctx) => ({ type: 'listCount', list: firstList(ctx), into: ctx.project.variables[0]?.name ?? '' }),
    fields: [LIST, { key: 'into', label: 'در کدام مقدار', kind: 'variable' }],
  },
  sentence: (a) => `تعداد چیزهای فهرست ${a.list || '؟'} را در ${a.into || '؟'} بگذار`,
  check: (a, { needList, needVariable }) => {
    needList(a.list);
    needVariable(a.into);
  },
  run: (game, action) => {
    game.putItem(action.into, game.list(action.list).length, false);
  },
});

export const forEach = actionBlock({
  type: 'forEach',
  still: true,
  editor: {
    title: 'برای هر چیزِ فهرست',
    short: 'برای هر چیزِ یک فهرست، آن را در یک مقدار می‌گذارد و یک «تابع» خودت را اجرا می‌کند.',
    available: (ctx) => hasLists(ctx) && namesOf(ctx.scene, 'called').length > 0,
    make: (ctx) => ({ type: 'forEach', list: firstList(ctx), into: ctx.project.variables[0]?.name ?? '', name: namesOf(ctx.scene, 'called')[0] ?? '' }),
    fields: [LIST, INTO, { key: 'name', label: 'کدام تابع را اجرا کند', kind: 'function' }],
  },
  sentence: (a) => `برای هر چیزِ فهرست ${a.list || '؟'}: آن را در ${a.into || '؟'} بگذار و تابع «${a.name || '؟'}» را اجرا کن`,
  check: (a, { needList, say, project, scene }) => {
    needList(a.list);
    if (!isValue(project, a.into)) say(`puts each list item into "${a.into}", which is not one of the game's values.`);
    if (!scene.rules.some((r) => r.when.type === 'called' && r.when.name === a.name)) say(`calls function "${a.name}", which no rule of the scene is.`);
  },
  run: (game, action, context) => {
    // A copy: the function may change the list as it goes.
    const text = game.listIsText(action.list);
    for (const item of [...game.list(action.list)]) {
      game.putItem(action.into, item, text);
      game.callFunction(action.name, [], context);
    }
  },
});
