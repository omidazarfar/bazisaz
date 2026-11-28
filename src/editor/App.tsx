import { useEffect, useReducer, useRef, useState } from 'react';
import { BRAND } from '../brand';
import type { GameProject } from '../format/types';
import { validateProject } from '../format/validate';
import { migrate } from '../format/migrate';
import type { EditView, Game, GameMode } from '../runtime/Game';
import { blank } from '../templates';
import { agentApi, type AgentApi } from './agentApi';
import { DebugPanel } from './DebugPanel';
import type { Editor } from './editor';
import { ExportDialog } from './ExportDialog';
import { GamePanel } from './GamePanel';
import { Help } from './Help';
import { pickFile } from './images';
import { Inspector } from './Inspector';
import { findIssues, sceneName, type Issue } from './issues';
import { fa } from './labels';
import { ObjectList } from './ObjectList';
import { PhoneDialog, phoneStatus, sendToPhone, stopPhone, type PhoneLink, type PhoneReport } from './PhoneDialog';
import { Dialog } from './Pick';
import { Preview } from './Preview';
import { Rules } from './Rules';
import { DEFAULT_LEVEL_OPTIONS, generateLevels } from './levelgen';
import { Tutor, Welcome } from './Tutor';
import {
  copyObjects, duplicateObjects, getScene, initialState, newId, pasteObjects, reducer, removeObjects, saveProject, syncTemplates, updateScene,
  type Clipboard, type EditorState,
} from './state';

declare global {
  interface Window {
    /** For automated tests: read the editor's state, and open a game as "open file" would. */
    __editor?: {
      getState: () => EditorState;
      open: (project: GameProject) => void;
      makeLevels: (count: number, seed?: number) => void;
      /** For agents and tools (scripts/game.mjs); see AGENTS-GAMES.md. */
      agent: AgentApi;
    };
  }
}

type Tab = 'object' | 'rules' | 'game';
const TABS: { id: Tab; label: string }[] = [
  { id: 'object', label: 'شیء' },
  { id: 'rules', label: 'قانون‌ها' },
  { id: 'game', label: 'بازی' },
];
const ZOOM_STEPS = [0.1, 0.15, 0.25, 0.35, 0.5, 0.75, 1, 1.5, 2, 3];

export function App({ saved }: { saved: GameProject | null }) {
  const [state, dispatch] = useReducer(reducer, saved, initialState);
  const { project, selection, selected } = state;
  const [tab, setTab] = useState<Tab>('object');
  /** Not playing, playing from the start of the game, or playing just the scene being edited. */
  const [playing, setPlaying] = useState<null | 'game' | 'scene'>(null);
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(true);
  const [dialog, setDialog] = useState<null | 'export' | 'help' | 'issues' | 'phone'>(null);
  /** The game being shown on phones: null when it is not, else how it went. */
  const [phoneLink, setPhoneLink] = useState<PhoneLink | null>(null);
  const [phones, setPhones] = useState<PhoneReport[]>([]);
  const [fromScene, setFromScene] = useState(true);
  const [confirmingNew, setConfirmingNew] = useState(false);
  const [adShown, setAdShown] = useState<string | null>(null);
  const [view, setView] = useState<EditView>({ zoom: 1, tool: 'select', grid: 0 });
  const [openRule, setOpenRule] = useState<string | null>(null);
  /** Whose rules the rules tab shows: the scene's (null), or one custom behavior's, by its id (item 3). */
  const [rulesOf, setRulesOf] = useState<string | null>(null);
  /** The step of the guided first game, or null when it is not running. */
  const [tutorStep, setTutorStep] = useState<number | null>(null);
  /** Try-outs since the editor opened, so the guide can tell when one has happened. */
  const [plays, setPlays] = useState(0);
  const [welcomeGone, setWelcomeGone] = useState(false);
  const game = useRef<Game | null>(null);
  const clipboard = useRef<Clipboard | null>(null);

  const scene = getScene(project, state.sceneId);
  const editor: Editor = {
    project,
    scene,
    selected,
    selection,
    change: (next, key, select) => {
      // Ready-made parts may introduce numeric names such as score or lives.
      const conflict = next.textVariables?.find(t => next.variables.some(n => n.name === t.name));
      if (conflict) {
        setNotice(`این تغییر به مقدار عددی «${conflict.name}» نیاز دارد. این نام را قبلاً برای متن انتخاب کرده‌ای.`);
        return false;
      }
      // Copies of a template are kept in step with it, whichever panel made the change.
      dispatch({ type: 'change', project: syncTemplates(project, next), key, select });
      // Something was just added and selected: show its settings, whichever tab was open.
      if (typeof select === 'string' || (Array.isArray(select) && select.length > 0)) setTab('object');
      return true;
    },
    select: (id, add) => {
      const ids = id === null ? [] : !add ? [id] : selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
      dispatch({ type: 'select', ids });
      setPlaying(null);
      if (ids.length > 0) setTab('object');
    },
    selectMany: (ids, add) => {
      const all = add ? [...selected, ...ids.filter((id) => !selected.includes(id))] : ids;
      dispatch({ type: 'select', ids: all });
      if (all.length > 0) setTab('object');
    },
    setScene: (id) => {
      dispatch({ type: 'scene', id });
      setPlaying(null);
    },
    viewCentre: () => game.current?.viewCentre() ?? { x: project.meta.width / 2, y: project.meta.height / 2 },
    showRule: (id) => {
      setRulesOf(null);
      setOpenRule(id);
      setTab('rules');
    },
    showBehavior: (id) => {
      setRulesOf(id);
      setOpenRule(null);
      setTab('rules');
    },
    brush: view.tool === 'paint' ? (view.brush ?? '.') : null,
    paint: (brush) => setView((v) => (brush === null ? { ...v, tool: 'select' } : { ...v, tool: 'paint', brush })),
  };
  // The paint tool only paints a selected tile map; with anything else selected it is put down.
  const paintable = selected.length === 1 && scene.objects.some((o) => o.id === selected[0] && o.visual.kind === 'tiles');
  useEffect(() => {
    if (!paintable && view.tool === 'paint') setView((v) => ({ ...v, tool: 'select' }));
  }, [paintable, view.tool]);
  const open = (next: GameProject) => {
    // A game of an older format (a test, a file an agent wrote) is made current first (src/format/migrate.ts).
    dispatch({ type: 'open', project: migrate(next) });
    setPlaying(null);
    setProblem(null);
    setNotice(null);
    setTab('object');
    setView((v) => ({ ...v, zoom: 1 }));
  };

  useEffect(() => {
    void saveProject(project).then(setSavedOk);
  }, [project]);
  // While the game is on show on a phone, each change is sent to it a moment after the last edit.
  const phoneOn = typeof phoneLink === 'object' && phoneLink !== null && 'urls' in phoneLink;
  const phoneScene = fromScene ? state.sceneId : null;
  useEffect(() => {
    if (!phoneOn) return;
    const timer = setTimeout(() => void sendToPhone(project, phoneScene), 500);
    return () => clearTimeout(timer);
  }, [project, phoneOn, phoneScene]);
  // What the phones say about the game: how fast it runs, and any errors.
  useEffect(() => {
    if (!phoneOn) {
      setPhones([]);
      return;
    }
    const look = () => void phoneStatus().then(setPhones);
    look();
    const timer = setInterval(look, 2000);
    return () => clearInterval(timer);
  }, [phoneOn]);
  const openPhone = () => {
    setDialog('phone');
    if (!phoneOn) {
      setPhoneLink('checking');
      void sendToPhone(project, phoneScene).then(setPhoneLink);
    }
  };
  useEffect(() => {
    window.__editor = {
      getState: () => state,
      open,
      // For the tests and bots: the next levels of the scene being edited (or of another), made as the dialog makes them.
      makeLevels: (count: number, seed = 7, sceneId = state.sceneId) => open(generateLevels(state.project, sceneId, { ...DEFAULT_LEVEL_OPTIONS, count, seed }).project),
      agent: agentApi,
    };
  });
  // A note about what was just done stays long enough to be read, then goes.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 12000);
    return () => clearTimeout(timer);
  }, [notice]);

  const play = (what: 'game' | 'scene' | null) => {
    setPlaying(what);
    if (what) {
      setTried(true);
      setPlays((n) => n + 1);
    }
  };
  const startTutor = () => {
    setWelcomeGone(true);
    setDialog(null);
    setTutorStep(0);
  };
  // An empty game, the first thing a newcomer sees, offers a guided way in.
  const welcome = !welcomeGone && tutorStep === null && !playing && project.scenes.length === 1 && scene.objects.length === 0 && scene.prefabs.length === 0;

  // Keyboard shortcuts. They read the latest editor through a ref, so the listener is attached once.
  const live = useRef({ editor, playing, dialog });
  live.current = { editor, playing, dialog };
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const { editor: ed, playing: isPlaying, dialog: busy } = live.current;
      // Inside a text box, a pick list or an open window, keys keep their usual meaning.
      if (busy || document.querySelector('.modal') || (ev.target as HTMLElement).closest('input:not([type=checkbox]), select, textarea')) return;
      const key = ev.key.toLowerCase();
      const ids = ed.selected;
      if (ev.key === 'Escape') {
        if (isPlaying) setPlaying(null);
        else ed.select(null);
        return;
      }
      if (ev.ctrlKey || ev.metaKey) {
        if (key === 'z' && !ev.shiftKey) dispatch({ type: 'undo' });
        else if (key === 'y' || (key === 'z' && ev.shiftKey)) dispatch({ type: 'redo' });
        else if (isPlaying) return;
        else if (key === 'a') ed.selectMany(ed.scene.objects.filter((o) => !o.locked).map((o) => o.id));
        else if (key === 'c' && ids.length > 0) clipboard.current = copyObjects(ed.scene, ids);
        else if (key === 'v' && clipboard.current) {
          const made = pasteObjects(ed.project, ed.scene.id, clipboard.current);
          ed.change(made.project, `paste.${made.ids.join('.')}`, made.ids);
        } else if (key === 'd' && ids.length > 0) {
          const made = duplicateObjects(ed.project, ed.scene.id, ids);
          ed.change(made.project, `copy.${made.ids.join('.')}`, made.ids);
        } else return;
        return ev.preventDefault();
      }
      if (isPlaying || ids.length === 0) return;
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ed.change(removeObjects(ed.project, ed.scene.id, ids), `delete.${ids.join('.')}`, null);
        return ev.preventDefault();
      }
      // Arrow keys nudge placed objects: one pixel, or ten with Shift.
      const step = ev.shiftKey ? 10 : 1;
      const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
      if (move && ed.scene.objects.some((o) => ids.includes(o.id))) {
        const nudge = updateScene(ed.project, ed.scene.id, (s) => ({ ...s, objects: s.objects.map((o) => (ids.includes(o.id) ? { ...o, x: o.x + move[0], y: o.y + move[1] } : o)) }));
        ed.change(nudge, `${ids.join('.')}.nudge`);
        ev.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const download = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${project.meta.name || 'game'}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const openFile = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      // A game saved by an older Bazisaz is made current first (src/format/migrate.ts).
      const loaded = migrate(JSON.parse(await file.text()) as GameProject);
      const problems = validateProject(loaded);
      if (problems.length > 0) return setNotice(`این فایل را نمی‌توان باز کرد: ${problems[0]}`);
      setNotice(null);
      open(loaded);
    } catch {
      setNotice('این فایل یک فایل بازی نیست.');
    }
  };

  /** What to do next, said in one line under the game, so an empty screen is never a dead end. */
  // Something made during play has no place in the scene; what is on show is a sample. Saying so
  // matters: otherwise it looks like an object that cannot be moved and then vanishes.
  const sample = scene.prefabs.find((p) => p.id === selection && selected.length === 1);
  const coach = (() => {
    if (sample) {
      return `این نمونه‌ی «${sample.name}» است، با دور آبی. «${sample.name}» حین بازی ساخته می‌شود و در صحنه جایی ندارد؛ برای همین با موس جابه‌جا نمی‌شود و با انتخاب چیز دیگری از دید می‌رود. حذف نشده: در فهرست سمت راست، زیر «چیزهایی که حین بازی ساخته می‌شوند» هست.`;
    }
    const everything = [...scene.objects, ...scene.prefabs];
    if (scene.objects.length === 0) return 'از ستون راست با «+ اضافه کردن از کتابخانه…» اولین چیز بازی‌ات را اضافه کن.';
    if (!everything.some((o) => o.behaviors.length > 0)) return 'روی یک شیء بزن و در برگه‌ی «شیء» به آن یک «نقش آماده» بده؛ مثلاً بازیکن.';
    if (scene.rules.length === 0) return 'در برگه‌ی «قانون‌ها» بگو چه وقت چه اتفاقی بیفتد.';
    return 'برای دیدن نتیجه «امتحان کن» را بزن. اشیا را می‌توانی با موس بکشی.';
  })();

  const issues = findIssues(project);
  const goToIssue = (issue: Issue) => {
    setDialog(null);
    if (issue.sceneId !== scene.id) dispatch({ type: 'scene', id: issue.sceneId });
    setPlaying(null);
    if (issue.object) {
      dispatch({ type: 'select', ids: [issue.object] });
      setTab('object');
    } else if (issue.rule) {
      setRulesOf(null);
      setOpenRule(issue.rule);
      setTab('rules');
    }
  };

  const zoomStep = (by: 1 | -1) => {
    const steps = by > 0 ? ZOOM_STEPS : [...ZOOM_STEPS].reverse();
    const next = steps.find((z) => (by > 0 ? z > view.zoom + 0.001 : z < view.zoom - 0.001));
    if (next) setView({ ...view, zoom: next });
  };

  const mode: GameMode = playing ? { kind: 'play', scene: playing === 'scene' ? scene.id : undefined } : { kind: 'edit', scene: scene.id };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">{BRAND.fa}</span>
          <bdi className="brand-game">{project.meta.name}</bdi>
        </div>
        <div className="topbar-actions">
          {!savedOk && <span className="notice">ذخیره در این مرورگر ممکن نیست؛ «ذخیره‌ی فایل» را بزن.</span>}
          <button type="button" className="btn" title="Ctrl+Z" disabled={state.past.length === 0} onClick={() => dispatch({ type: 'undo' })}>یک قدم به عقب</button>
          <button type="button" className="btn" title="Ctrl+Y" disabled={state.future.length === 0} onClick={() => dispatch({ type: 'redo' })}>یک قدم به جلو</button>
          {confirmingNew ? (
            <span className="confirm">
              بازی فعلی کنار برود؟
              <button type="button" className="btn btn-danger" onClick={() => { open(blank()); setConfirmingNew(false); }}>بله، بازی خالی</button>
              <button type="button" className="btn" onClick={() => setConfirmingNew(false)}>نه</button>
            </span>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirmingNew(true)}>بازی جدید</button>
          )}
          <button type="button" className="btn" onClick={() => void openFile()}>باز کردن فایل</button>
          <button type="button" className="btn" onClick={download}>ذخیره‌ی فایل</button>
          <button type="button" className="btn" onClick={() => setDialog('help')}>راهنما</button>
          <button type="button" className={phoneOn ? 'btn btn-live' : 'btn'} title="بازی را روی گوشی خودت امتحان کن" onClick={openPhone}>
            {phoneOn ? (phones.length ? `● روی گوشی · ${Math.min(...phones.map((p) => p.fps)).toLocaleString('fa-IR')} FPS` : '● روی گوشی') : 'امتحان روی گوشی'}
          </button>
          <button type="button" className="block block-small" onClick={() => setDialog('export')}>خروجی اندروید</button>
        </div>
      </header>

      <aside className="panel panel-list">
        <ObjectList editor={editor} onNote={setNotice} />
      </aside>

      <main className="stage">
        {!playing && (
          <div className="stage-tools" role="toolbar" aria-label="ابزارهای صحنه">
            <div className="segmented" role="group" aria-label="ابزار">
              <button type="button" aria-pressed={view.tool === 'select'} title="کلیک و کشیدن، اشیا را انتخاب و جابه‌جا می‌کند" onClick={() => setView({ ...view, tool: 'select' })}>انتخاب</button>
              <button type="button" aria-pressed={view.tool === 'hand'} title="کشیدن، دید را روی دنیا جابه‌جا می‌کند (یا Space را نگه دار)" onClick={() => setView({ ...view, tool: 'hand' })}>دست</button>
              {paintable && (
                <button type="button" aria-pressed={view.tool === 'paint'} title="روی خانه‌های نقشه بکش تا رنگ شوند؛ دکمه‌ی راست موس پاک می‌کند" onClick={() => setView({ ...view, tool: 'paint', brush: view.brush ?? '.' })}>قلم</button>
              )}
            </div>
            <div className="zoom" role="group" aria-label="بزرگ‌نمایی">
              <button type="button" className="chip" aria-label="کوچک‌تر" title="دید کوچک‌تر: بخش بیشتری از دنیا را می‌بینی" onClick={() => zoomStep(-1)}>−</button>
              <output className="zoom-value" aria-label="اندازه‌ی دید">{fa(Math.round(view.zoom * 100))}٪</output>
              <button type="button" className="chip" aria-label="بزرگ‌تر" title="دید بزرگ‌تر: برای کار دقیق" onClick={() => zoomStep(1)}>+</button>
              <button type="button" className="chip" title="کل دنیای این صحنه را نشان بده" onClick={() => game.current?.fitWorld()}>کل دنیا</button>
              <button type="button" className="chip" title="همان اندازه‌ای که بازیکن می‌بیند" disabled={view.zoom === 1} onClick={() => setView({ ...view, zoom: 1 })}>اندازه‌ی گوشی</button>
            </div>
            <label className="grid-pick">
              شبکه
              <select aria-label="شبکه" value={view.grid} onChange={(e) => setView({ ...view, grid: Number(e.target.value) })}>
                <option value={0}>خاموش</option>
                <option value={10}>{fa(10)}</option>
                <option value={20}>{fa(20)}</option>
                <option value={40}>{fa(40)}</option>
                <option value={80}>{fa(80)}</option>
              </select>
            </label>
          </div>
        )}

        <div className="phone-wrap">
          {/* The frame takes the shape of the game, so the screen has no empty bars. */}
          <div className={view.tool === 'hand' && !playing ? 'phone phone-hand' : 'phone'} style={{ '--ratio': project.meta.width / project.meta.height } as React.CSSProperties}>
            <Preview
              project={project}
              mode={mode}
              selected={playing ? [] : selected}
              // A scene with a board shows and snaps to its own cells.
              view={scene.cell ? { ...view, grid: scene.cell } : view}
              api={game}
              onPick={editor.select}
              onPickMany={editor.selectMany}
              onChange={(changes) => {
                const boxes = new Map(changes.map((c) => [c.id, c.box]));
                const next = updateScene(project, scene.id, (s) => ({ ...s, objects: s.objects.map((o) => (boxes.has(o.id) ? { ...o, ...boxes.get(o.id) } : o)) }));
                editor.change(next, `${[...boxes.keys()].join('.')}.drag`);
              }}
              onView={setView}
              onTiles={(id, rows) => {
                const next = updateScene(project, scene.id, (s) => ({ ...s, objects: s.objects.map((o) => (o.id === id && o.visual.kind === 'tiles' ? { ...o, visual: { ...o.visual, rows } } : o)) }));
                editor.change(next, `${id}.paint.${newId('p')}`);
              }}
              onShowAd={() => {
                setAdShown('اینجا یک تبلیغ تمام‌صفحه نشان داده می‌شود');
                setTimeout(() => setAdShown(null), 1800);
              }}
              // In the preview the "ad" is a note that always counts as watched, so the reward can be tried out.
              onShowRewardedAd={() =>
                new Promise((resolve) => {
                  setAdShown('اینجا تبلیغ جایزه‌ای نشان داده می‌شود؛ در پیش‌نمایش همیشه «دیده‌شده» حساب می‌شود');
                  setTimeout(() => {
                    setAdShown(null);
                    resolve(true);
                  }, 1500);
                })
              }
              onProblem={setProblem}
            />
            {adShown && <div className="ad-note">{adShown}</div>}
          </div>
          {welcome && <Welcome onTutor={startTutor} onAlone={() => setWelcomeGone(true)} />}
        </div>

        {tutorStep !== null && (
          <Tutor step={tutorStep} project={project} view={{ tab, playing: playing !== null, plays }} setStep={setTutorStep} />
        )}

        <div className="stage-controls">
          <button
            type="button"
            className={playing ? 'block block-stop' : 'block'}
            onClick={(ev) => {
              // Drop focus so Space reaches the game instead of pressing this button again.
              ev.currentTarget.blur();
              play(playing ? null : 'game');
            }}
          >
            {playing ? 'توقف و برگشت به ویرایش' : 'امتحان کن'}
          </button>
          {!playing && scene.id !== project.startScene && (
            <button type="button" className="btn" title="بازی از همین صحنه شروع می‌شود، نه از صحنه‌ی شروع" onClick={(ev) => { ev.currentTarget.blur(); play('scene'); }}>
              امتحان همین صحنه
            </button>
          )}
          {notice && !playing && !sample ? (
            // A note about what was just done takes the hint's place until it is read.
            <p className="stage-hint stage-note" role="status">
              <span dir="auto">{notice}</span>
              <button type="button" className="link" onClick={() => setNotice(null)}>باشه</button>
            </p>
          ) : tutorStep !== null && !playing && !sample ? null : (
            // While the guide is on, it is the one voice saying what to do next.
            <p className={sample && !playing ? 'stage-hint stage-sample' : 'stage-hint'}>{playing ? `بازی از ${playing === 'scene' ? `صحنه‌ی «${scene.name}»` : 'صحنه‌ی شروع'} اجرا می‌شود. موس جای انگشت است.` : coach}</p>
          )}
          {!playing && issues.length > 0 && (
            <button type="button" className="chip chip-warn" aria-label="نکته‌های بازی" onClick={() => setDialog('issues')}>
              {fa(issues.length)} نکته
            </button>
          )}
        </div>

        {problem && (
          <p className="problem" role="alert">
            این تغییر بازی را خراب می‌کند و در پیش‌نمایش اعمال نشد. با «یک قدم به عقب» برگرد.
            <br />
            <bdi dir="ltr">{problem}</bdi>
          </p>
        )}
      </main>

      <aside className="panel panel-inspector">
        {playing ? (
          // During a try-out the settings give way to a view of what goes on inside the game.
          <DebugPanel
            game={game}
            project={project}
            onOpenRule={(sceneId, ruleId) => {
              setPlaying(null);
              if (sceneId !== scene.id) dispatch({ type: 'scene', id: sceneId });
              setRulesOf(null);
              setOpenRule(ruleId);
              setTab('rules');
            }}
          />
        ) : (
          <>
            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" data-panel-tab={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                  {t.label}
                  {t.id === 'rules' && scene.rules.length > 0 && <small className="tab-count">{fa(scene.rules.length)}</small>}
                </button>
              ))}
            </div>
            {tab === 'object' && <Inspector editor={editor} />}
            {tab === 'rules' && <Rules editor={editor} open={openRule} setOpen={setOpenRule} rulesOf={rulesOf} setRulesOf={setRulesOf} />}
            {tab === 'game' && <GamePanel editor={editor} />}
          </>
        )}
      </aside>

      {dialog === 'export' && <ExportDialog project={project} onClose={() => setDialog(null)} />}
      {dialog === 'phone' && phoneLink !== null && (
        <PhoneDialog
          link={phoneLink}
          phones={phones}
          fromScene={fromScene}
          setFromScene={setFromScene}
          sceneNames={Object.fromEntries(project.scenes.map((s) => [s.id, s.name]))}
          onClose={() => {
            setDialog(null);
            // Nothing was put on show, so there is nothing to keep sending.
            if (!phoneOn) setPhoneLink(null);
          }}
          onStop={() => {
            void stopPhone();
            setPhoneLink(null);
            setDialog(null);
          }}
        />
      )}
      {dialog === 'help' && <Help project={project} tried={tried} onTutor={startTutor} onClose={() => setDialog(null)} />}
      {dialog === 'issues' && (
        <Dialog title="نکته‌های بازی" about="این‌ها خطا نیستند و بازی اجرا می‌شود، ولی احتمالاً آن‌طور که می‌خواهی کار نمی‌کند. روی هر کدام بزن تا به همان‌جا بروی." onClose={() => setDialog(null)}>
          <div className="pick-list">
            <div className="pick-items">
              {issues.map((issue, i) => (
                <button key={i} type="button" className="card" onClick={() => goToIssue(issue)}>
                  <strong>{issue.text}</strong>
                  <span>صحنه‌ی «{sceneName(project, issue)}»</span>
                </button>
              ))}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
