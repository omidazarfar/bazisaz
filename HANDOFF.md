# HANDOFF — shared notes between Claude Code and Codex

The owner switches between two AI agents (Claude Code and OpenAI Codex) on this
project when one runs out of tokens. This file is how each one knows what the
other did. **It is the single source of truth for "where are we".**

## The protocol (both agents, every session)

1. **At the start:** read this whole file, then `CLAUDE.md` (owner's rules),
   then the section "Where the project stands" in `README.md`.
2. **While working:** follow the rules below; build and test before calling
   anything done.
3. **At the end of every session, or when the owner says they are switching:**
   - Update "Current state" and "Next steps" below.
   - Add a dated entry at the **top** of "Session log": who you are (Claude or
     Codex), what was asked, what you changed (files), test results, anything
     left half-done or unverified.
   - Keep the entry short and factual. Do not rewrite other agents' entries.
   - Commit and push (see "Git" below).
4. If you find something in here that is wrong, fix it and say so in your log
   entry.

### Git (since 2026-11-19)

- The project is a git repository, branch `main`.
- It is pushed to a GitHub repository (public since 2026-11-24, at the owner's request):
  `https://github.com/omidazarfar/bazisaz.git` (remote `origin`).
- Git is installed at `C:\Program Files\Git\cmd\git.exe`. In a shell opened
  before the install, `git` may not be on the PATH; call it by that full path.
- Commits are authored as `omidazarfar <omidazarfar@users.noreply.github.com>`.
  This is set in the repo's local config; do not put the owner's personal
  email in commits.
- **At the start of a session:** run `git status`. If the other agent left
  changes uncommitted, commit them first as "work left by <agent>".
- **At the end of every session** (after build and tests pass, and after
  updating this file): `git add -A`, then a commit whose message says what
  changed, then `git push`.
- Commit at good stopping points in between too. Never force-push. Never
  rewrite history. Never commit `node_modules`, `dist*`, keystores or `keys/`.
  `.gitignore` already keeps these out; check `git status` before committing.
- To undo a bad change, use `git diff` / `git log`, then `git restore <file>`
  or `git revert <commit>`. Tell the owner what you undid.

---

## The owner and how to talk to them

- The owner is a **founder, not a programmer**. Explain simply, step by step,
  with examples. Tell them how to see a change (which button, which part).
- **Reply in Finglish** (Persian written in Latin letters). Persian script
  renders badly in their terminal. File contents (the guide, the editor's own
  texts) stay in real Persian script.
- **Do not use pop-up question dialogs / multi-choice tools.** If you must ask,
  ask in plain text with numbered options, and give your recommendation.
- They like to be given a short plan, then have the agent just do it end to end.
  They test hands-on in the editor and judge mostly by **how it looks and
  feels**, so check visually (see "Seeing your work" below) before reporting.
- They will test on a real phone themselves later; nothing has been tried on a
  phone yet.

## THE PLAN NOW: foundations, not features (owner's roadmap, 2026-11-25)

Bazisaz has more features than it needs (29 behaviors, 26 triggers, 68 actions, 31 parts, 95 pictures, ten
genre games). What it lacks next to GDevelop or Construct 3 is foundations. This replaces the feature plan
of 2026-11-20 (in git history). Android export is out of scope: it cannot be tested yet.

**The rule:** until the five phases are done, do NOT add behaviors, triggers, actions, parts, pictures, genre
games or visual polish unless the owner asks for one by name. A small issue that does not block the phase
goes in one line under "Later" below. Signs of drifting: renaming, reformatting, recommenting or restyling
code; a change of a few lines in one file rather than a system; tuning a genre game or a picture.
Each phase leaves the engine behaving exactly as before except where it means to change it. `npm run build`,
`npm test` and the bots on CI (`node scripts/ci.mjs run all`) pass after every step; commit after every
step that passes. One phase per session, in this order.

1. **A block registry (split Game.ts).** One file per block (src/blocks/actions/shake.ts…): its editor
   description (Persian title, help, fields, starting value), its Persian sentence, its checks, and what it
   does at run time; all listed in src/blocks/registry.ts. Game.ts keeps the core (loop, scenes, entities,
   input, drawing, edit mode) and asks the registry instead of the big switches. Code moves AS IT IS (no
   renaming or "improving"; doubts go under Later). Done when adding an action is one new file and one line
   in the registry. — IN PROGRESS, see "Phase 1 progress".
2. **One contact model.** First a short report, no code: every place where `body` and `physics` decide
   contact differently, with an example scene each; show the owner in Finglish, recommend one direction,
   wait for the choice. Then build it, with a broadphase (spatial hash grid) for touch, near and overlaps,
   and a contact lab that measures: 20 crates resting still, a fast bullet against a thin wall, walking up
   and down a ramp, standing on a moving platform, a crate pushed into a corner; each check states how much
   sinking, jitter or pass-through is allowed.
3. **Format migrations.** migrate(project): steps from each old formatVersion to the current one, run before
   validation in the editor and the player; fixture projects of every version in scripts/fixtures/ that must
   open and play. From then on every format change comes with its migration step and fixture.
4. **User-made functions and lists.** Functions: named lists of actions with inputs, called from any rule as
   one action; the same for a yes/no condition; shown like built-in blocks with Persian sentences. Lists:
   list variables (numbers or text) with add, remove, get by index, count, "for each item". Rebuild one genre
   game's repeated rules with functions; update GUIDE-fa.md.
5. **A performance budget.** A stress scene (500 objects, 100 rules, 50 physics bodies, particles, two
   lights) logging update time per step and per system; it must step in under 8 ms on CI. Fix the biggest
   costs (object pools, no per-step allocations in hot paths, cached matching()). The stress test runs on CI.

### Phase 1 progress

- The shape: `src/blocks/types.ts` (`ActionBlock`: `type`, `editor`, `sentence(action, { project, scene, who })`,
  optional `check(action, { project, say })`, `run(game, action, context)`), `src/blocks/registry.ts` (the list,
  by family; `actionBlocks` by type; `BlockActionType`). The runtime (`Game.perform`), the editor's `ACTIONS`
  (labels.ts: the rest are `ACTIONS_HERE`), `actionSentence` and `validateProject` ask the registry first.
- Shared pieces moved as they were: `src/blocks/fields.ts` (Field, Block, Context, slider, firstRef, TARGET,
  fa, SOUND_LABEL, LOOK_OPTIONS, hasPrefabs; labels.ts re-exports them), `src/blocks/say.ts` (describeRef,
  OP_WORD, amountText), `src/runtime/math.ts` (clamp), `src/runtime/constants.ts` (SHAKE_SECONDS). What a
  moved block uses from Game.ts is no longer `private`; `Entity` and `Context` are exported (types).
- `scripts/blocks-move.mjs` moves actions mechanically: `node scripts/blocks-move.mjs "<Family>" a b c`, then
  `node scripts/blocks-move.mjs --open` (un-privates what tsc names; a `break` that left the case becomes
  `return`), then `npx tsc --noEmit` and read every new file. It refuses shared cases and odd checks: move
  those by hand. A block file must not import labels.ts or sentences.ts (they import the registry): move the
  helper it needs to fields.ts or say.ts first, as it is.
- **All 68 actions are blocks** (steps 1–3). `Game.perform` and `runActions`, the editor's `ACTIONS` and
  `actionSentence` are now only the registry; `validateProject` keeps the checks common to every action (a
  missing target). A compile-time check in registry.ts (`everyActionIsABlock`) names any action with no block.
  `CheckKit` has the common checks (checkRef, needVariable, needItem, checkText, hasPrefab, hasScene; messages
  word for word as before). `takesRest` (wait, say): the block gets the rest of the rule's actions to run later.
  give and take share one file (giveTake.ts), as they shared their code. Every moved action's run code was
  compared line by line with the code before Phase 1 (no difference). Game.ts: 5365 → 4821 lines.
- Next: the triggers (`fired`: a TriggerBlock with `fired(game, trigger, rule, …) → Context[]`), then the
  behaviors (the switch in `update`), with the same steps and the same line-by-line comparison.
- Before Phase 1 counts as done: the Action union in src/format/types.ts still has to be edited for a new
  action; make the union include the registry's types (so a new action is truly one file and one line), and
  rewrite "A new block" under Gotchas. SHORT_ABOUT (labels.ts, one line of help per block) also belongs in the
  blocks' own files.

### Later (small things noticed, not blocking the phase)

- The player bundle now carries the moved blocks' Persian editor texts (+21 KB so far, 1.6%). When all are
  moved, let a block file export its runtime part separately so the player's registry leaves the editor part out.
- tower-levels bot: game over at score 56 on level 2 about one run in two (bot timing on the extra slimes);
  same before Phase 1.
- physics bot (Rock Smash): fails on CI (Game over, score 60–90) both before and after Phase 1 (checked on a
  temporary branch at a235f62); wins locally (score 123). The slow CI runner, not the game. platform-levels
  and bricks-levels bots also fail on CI, as before.
- puzzle bot (Gem Crush): random boards, so it wins some runs and loses some on CI (lost 80 and 85 of 90 twice after Phase 1 step 2, won once; won 92 on the commit before Phase 1). The moved puzzle actions are line for line the same code. Its losing runs show moves 21 of 20: worth a look later.
- Brick Blitz levels: the level maker's level 2 can have half the bricks of level 1 (a checkerboard shape)
  while being "harder".

## Owner decision, 2026-11-20: whole games in the genre helper

The owner asked to "go through the prepared games, make them 10x better, like really cool games with better features and better graphics". So the genre helper ("راهنمای سبک") now builds **whole, playable games**. This is the owner's own update to the old "no templates or starter games" rule.

The games are in `src/editor/games.ts`:
- `buildPlatformer` — Sky Quest
- `buildAdventure` — Dungeon Escape
- `buildShooter` — Star Raiders
- `buildPuzzle` — Gem Crush
- `buildPhysics` — Rock Smash
- `buildRescue` — Rescue Relay (five playable stages)

Each builds into the user's current scene, in one undo step. Each adds menu scenes: Start (the game opens there), You win and Game over. They are made only of ordinary editable objects, rules and parts. Keep it that way: no hidden logic, everything visible and changeable.

To see them: `node scripts/look/gameplay.mjs <genre>` and `node scripts/look/platformer.mjs <genre> <shares>`.

## Rules from CLAUDE.md (apply to Codex too)

- Games are in **English**; the editor is in **Persian** (right to left).
- **No templates or starter games.** Ready-made *roles* and *parts* (pieces a
  user adds to their own game) are fine and wanted.
- Ads accounts, user sign-up and hosting are **set aside** for now.
- Keep **`GUIDE-fa.md`** (the user guide, Persian) in step with every change a
  user would notice. Keep `README.md` "Where the project stands" up to date.
- Before saying something is done: **`npm run build`, then `npm test`**. Tests
  need Chrome (set `CHROME_PATH` if it is not in the usual place).

---

## What the product is

**Bazisaz (بازی‌ساز)**: a no-code 2D game maker.

- A Persian browser **editor** (React 19), where users build games from
  objects, ready-made behaviors, and rules ("when X happens, do Y").
- A **runtime** (PixiJS v8) that plays a game made of plain JSON data.
- A local **server** (`server/index.mjs`) that serves the editor and exports
  Android APK/AAB through Capacitor. It can also show the game on a phone on
  the same Wi-Fi.

### Commands (run in `C:\project\engine-week1\engine`)

| Command | What it does |
|---|---|
| `npm start` | build + Capacitor sync + start the server. The editor is at **http://localhost:5180**, the phone server is on port 5181 |
| `npm run build` | type-check, then build the player (`dist/`) and the editor (`dist-editor/editor.html`), each a single file |
| `npm test` | `scripts/smoke.mjs` (runtime labs 1–18), then `scripts/editor.smoke.mjs` (drives the real editor), then `scripts/server.smoke.mjs`; uses puppeteer-core and Chrome |
| `npx tsc --noEmit -p .` | type-check only |
| `npm run bots` | exports the ten genre-helper games fresh in the editor, then plays each in the real player and checks its goal (the shooter: survive 35 s). Build first. Run one bot with `node scripts/bots/<genre>.mjs`. Screenshots go to `scripts/bots/out/` |

Shell is **Windows PowerShell 5.1**: no `&&`. `Set-Content` writes ANSI and
corrupts Persian, so write files with an editor tool, or with
`[System.IO.File]::WriteAllText(path, text, (New-Object System.Text.UTF8Encoding $false))`.

### Where things are

| Path | What |
|---|---|
| `src/format/types.ts` | The game data format (version 2). Every behavior, trigger, action and visual, with comments. Start here |
| `src/format/validate.ts` | Checks a project before it runs (missing variables, items, images…) |
| `src/runtime/Game.ts` | The engine: scenes, rules, behaviors, drawing, input, edit mode for the editor (~4000 lines) |
| `src/runtime/physics.ts` | Real physics on planck.js (Box2D): slings, joints, fields, conveyors… |
| `src/runtime/sky.ts`, `tiles.ts`, `particles.ts`, `music.ts`, `bag.ts` | Painted backdrops, tile materials, particles, built-in music, the player's bag |
| `src/editor/` | The editor (React). `App.tsx` layout; `Inspector.tsx` object panel; `Rules.tsx` rules; `GamePanel.tsx` game settings; `Library.tsx` the "add" window; `labels.ts` **every block's Persian name and fields** (add a block here and the panels draw it); `Fields.tsx` field widgets; `sentences.ts` rules as Persian sentences; `state.ts` project helpers |
| `src/editor/art.ts` | **All 95 library pictures**, drawn as SVG in a glossy mobile-game style with a small gradient and glow kit. `sprites.ts` turns one into a PNG asset (key `art-<id>`) |
| `src/editor/recipes.ts` | The 31 ready-made **parts**, such as sling-and-tower, car, bridge, key-and-door, pause menu, levels |
| `src/editor/presets.ts` | The ready-made **roles**, such as jump-player, ground, prize, danger |
| `src/editor/editor.css` | The editor's look: a dark "studio at night" theme |
| `scripts/` | Tests (`smoke.mjs`, `editor.smoke.mjs`, `server.smoke.mjs`, shared `lib.mjs`) |
| `scripts/look/` | Scripts that photograph things so you can **see** them (below) |
| `GUIDE-fa.md` | User guide (Persian). `README.md`: technical notes and "Where the project stands" |

### Seeing your work (important for this owner)

After `npm run build`, these write PNGs to `scripts/look/out/`. Open them and
look:

- `node scripts/look/genres.mjs`: the genre helper and its choices in fresh editor try-outs.
- `node scripts/look/sheet.mjs`: every library picture, large, on light and dark.
- `node scripts/look/parts.mjs [id,id]`: each ready-made part in a fresh game, played. For example `parts.mjs sling-tower,car`.
- `node scripts/look/editorlook.mjs`: the editor in its main states (library, parts, object, rules, game tab, playing).
- `node scripts/look/keydoor.mjs`: plays the key-and-door part and the bag.
- `node scripts/look/looks.mjs day,night`: the painted backdrops.
- `node scripts/look/pool.mjs pool` (or `car`): traces positions on the game clock.
- `node scripts/look/tower.mjs`: throws the sling stone three times.

---

## What has been done (oldest first)

1. **Base engine and editor** (before Nov 18): scenes, objects, 26 behaviors,
   rules, variables, tile maps, Android export, Persian guide, tutorial.
2. **"Next level" roadmap**, agreed on 2026-11-18:
   1. **Real physics** (planck.js). Expanded after the owner found sling
      bugs: the stone reloads in the sling, conveyors, one-way platforms,
      water, wind and magnet fields, wheel and slider joints, breakable joints,
      cutting, rolling resistance, physics triggers and actions. Done.
   2. **Debugging tools**: live values, frame by frame, which rule fired, and
      trying the game on a phone by QR code. Done.
   3. **Stronger logic**: messages, "otherwise", next scene, level select.
      Done.
   4. **Content tools**: pixel painter, sprite-sheet cutter, particles,
      built-in music. Done.
   5. **Visual polish**: lights and darkness, looks, vignette, easing, pause
      menu, button press. Done.
   6. **AI helper** (describe a game, get a first version). **Not started**;
      it waits on the owner's hosting decision.
3. **Game graphics pass** (2026-11-19): 10 painted parallax backdrops, tile
   materials, shading, shadow and glow, bloom, squash and stretch.
4. **Premium art** (2026-11-19): every library picture was redrawn in
   `art.ts`. The parts were rebuilt from pictures instead of plain shapes
   (slingshot, rock, car body and tyres, planks, pegs, belt, water, basket,
   menu panel, level buttons). Score, best and timer badges were added. Menu
   scenes got skies and golden titles. Rope, spring and sling bands are drawn
   as real materials.
5. **The bag / inventory** (2026-11-19):
   - A variable with `item: { asset }` is a thing the player carries.
   - Visual `bag` (`src/runtime/bag.ts`).
   - Actions `give` (the picture flies into the bag) and `take`.
   - Trigger `useItem` (the player taps a thing in the bag).
   - Editor: section "کوله‌پشتی" in the Game tab, a bag in the library, and
     the part "key-door". Tested in lab 17 and the editor suite.
6. **Editor restyle** (2026-11-19): dark indigo theme, glassy panels, chunky
   glossy main buttons, gold selection, phone on a lit stage, picture icons on
   the cards of parts and roles.

## Current state (keep this up to date)

- Checks run on GitHub Actions (`.github/workflows/test.yml`), because the owner's 8 GB laptop cannot run the bots (Claude Code stops background runs when memory is low, and headless Chrome crashed in Brick Blitz). Every push to main (not docs-only): build once, then smoke / editor.smoke / server.smoke side by side. By hand: `node scripts/ci.mjs run all` (or names, or none) adds one job per bot, all at once. `node scripts/ci.mjs watch` prints each job and the time left, guessed from the last passing run. The repo was made public on 2026-11-24 at the owner's request (history checked first: no keys, passwords or keystores ever committed; all commits use the noreply email; AdMob ids in code are placeholders), so Actions minutes are free and unlimited. Bots still run only by hand (each three-level bot takes 15–60 min there). `node scripts/ci.mjs minutes` adds up what runs used. Failed runs upload `test-output` and bot photos as artifacts.

- 2026-11-22, Codex. Open an object's «ذرات» behaviour and choose «ویرایش جلوه‌ی ذرات» for a live preview of all 30 presets. Apply makes one undoable edit. The rear wheel in newly generated Rescue Relay games emits dust while rolling on the ground. Dungeon Escape's opening conversation exposed a bot timing bug, fixed in the shared bot wait. See today's session log for verification.

- Updated 2026-11-23 by Claude: the level maker («🪄 ساختن مرحله‌های بعدی»). Verified on the current code: `npm test` **656 PASS, 0 FAIL**. Bots: platform, adventure, shooter, puzzle, rescue, tower, runner, hopper, hopper-levels won; physics and runner-levels won after the fixes (run alone); bricks and bricks-levels not confirmed: headless Chrome crashed mid-game on this machine (see the 2026-11-23 entry).
- Updated 2026-11-22 (evening) by Claude: live editing on a phone with speed reports, and the animation timeline (see the session log). Verified on the current code: `npm test` **633 PASS, 0 FAIL** (331 runtime, 271 editor, 31 server); `npm run bots` **10 of 10 on the first try**. The owner tried a game on a real phone: 60 FPS.
- Updated 2026-11-22 by Claude: dissolve, camera focus, crouch, boss and waves parts, drag-and-drop actions (see the session log). Verified on the current code: `npm test` **612 PASS, 0 FAIL** (324 runtime, 264 editor, 24 server); `npm run bots` **10 of 10 on the first try**.
- Updated 2026-11-21 (night) by Claude: a picture manager (game panel «عکس‌ها»), a sound switch in the pause menu (saved value `sound`), Chrome's low-memory mode for the tests (`LOW_MEMORY=1`) and `npm run check:slow` (one piece at a time, for a busy computer). Verified on the current code: `npm test` **590 PASS, 0 FAIL** (312 runtime, 254 editor, 24 server); `npm run bots` 10 of 10 (Dungeon Escape on its second try: the first run timed out at score 0, probably stuck at the opening dialogue; worth a look).
- Updated 2026-11-21 (end of day) by Claude: phases 4 to 7 started (see the plan); ten genre games. Verified on commit 40b691f: `npm run build` passed; `npm test` **584 PASS, 0 FAIL** (312 runtime, 248 editor, 24 server); `npm run bots` **10 of 10 on the first try**. Memory on this computer is tight: `npm run check` in one go was stopped twice for low memory, so run `npm test` and `npm run bots` one after the other.
- Updated 2026-11-21 (later) by Claude: Phase 2 mostly done and Phase 3 started (see the plan). Verified after the last change: `npm test` **567 PASS, 0 FAIL** (301 runtime, 242 editor, 24 server); `npm run bots` 6 of 6 on the first try (the shooter met the boss and kept all three lives).
- Updated 2026-11-21 by Claude: Phase 1 done, Phase 2 started (see the plan). Verified after the last change: `npm run build` passed; `npm test` **544 PASS, 0 FAIL** (278 runtime, 242 editor, 24 server); `npm run bots` **6 of 6 games played through on the first try** (rescue 600 points, shooter 35 s with a life left).
- Updated 2026-11-21 by Codex. Phase 0 is complete. Phase 1 includes the new editable rescue game in Library → «راهنمای سبک» → «عملیات نجات». The terrain editor is in «شکل، متن و عکس خودت». The chain, bike, rescue crawler and boat are also independent parts.
- Verification before changes: build passed, runtime 243, editor 233, server 24 (500 PASS, 0 FAIL). All five original bots passed on their first run. The half-speed shooter survived the 35-second gate with two lives and 145 points.
- After the checkpoint fix, `npm run build` succeeded and `npm test` passed **512 checks, 0 FAIL** (249 runtime, 239 editor, 24 server).
- The six-game `npm run bots` run passed (6 PASS, 0 FAIL). Rescue Relay exposed a double award on its first attempt and won with 500 points on retry. Each goal now records its first contact before the scene fade. A fresh export of that fix passed the rescue bot on its first run, with exactly 500 points and no page errors.
- The player (`src/player/main.ts`, i.e. the game on a phone) passes
  `lighten: true`.
  - After 3 s below 28 fps it calls `Game.lighten()`, which drops bloom,
    shadow and glow filters for the session.
  - The editor's try-out does not do this.
  - The visual smoke tests set `window.__LIGHTEN__ = false` (in `scripts/lib.mjs`),
    because headless Chrome is slow enough to trigger it. Gameplay bots use the production adaptive setting.
- Nothing has been tested on a real phone. Bloom, shadows and glows may be
  slow on weak phones.
- A few editor tests used to be timing-sensitive on a busy computer. The car
  and noughts-and-crosses tests now wait on the game clock. If a test fails
  once and passes on a re-run, make it wait on
  `window.__game.getState().time` instead of wall time.

## Next steps (agreed or likely)

### FIRST issue resolved (2026-11-20)

The original placement helper only separated object centres by 40 pixels.
The player at (310,585), size 100×110, already overlapped the patrol at
(345,640), size 110×80. The first physics step fired their loss rule. Its
delayed restart repeatedly reset scene time before the sword check could run.
The ticker was advancing. The editor now searches using the new object's
bounds and a gap. Existing scenes keep their authored positions. To repair an
already overlapping pair, move the patrol clear of the player's start.

### Next work

Phase 1 is done. For Phase 2, the next small feature is dissolve with a playable use. Layered maps, animated tiles and autotile transitions remain. Then continue Phase 3. Use a playable scene, tests, a bot, visual inspection and a Persian guide entry for each. Verify touch driving, terrain drawing, wall shadows and weather speed on a real phone when the owner has one available. Debug helpers: `node scripts/bots/peek-scene.mjs <genre> "<scene>" [seconds] [hold|none] [names]` opens one scene of an exported game and prints objects over time; `node scripts/bots/probe-joints.mjs <genre> "<scene>"` lists its physics joints.

### Historical "complex games" roadmap (agreed by the owner 2026-11-19)

The owner said: "now it is just making simple games … making more complex
games is the priority". They also chose these earlier ideas:
- art packs
- a genre helper
- templates of objects (prefab instances)
- more sound
- level tools

Do the phases **in this order, one at a time**. For each phase:
1. Implement it in the format, the runtime, `validate.ts`, the editor
   (`labels.ts` and the panels), the sentences and the guide.
2. Add a lab test in `scripts/smoke.mjs` and editor checks in
   `scripts/editor.smoke.mjs`.
3. Photograph it (`scripts/look/`), build, test.
4. Commit and push.
5. Tick it off here.

The specs below are proposals; improve them if you find a better shape, and
say so in the log.

**Phase A: levels that feel like real games** (level tools, #10)
- [x] **Checkpoints and respawning.** DONE 2026-11-19 (Claude): actions `checkpoint` and `respawn` (with `Entity.checkpoint`), part `checkpoints`, lab 17 check.
  - New action `respawn { target }`: puts an object back at its last
    checkpoint, or its start, with its speed zeroed.
  - New behavior or role "checkpoint": a flag (sprite `flag`) that stores the
    position of the player who touches it, per entity. Runtime: `Entity.home`
    is updated.
  - A part "checkpoints": danger → lose a heart → respawn, instead of
    restarting the scene.
- [x] **Doors between scenes with an arrival point.** DONE 2026-11-19 (Claude): `goToScene.arriveAt` / `bring` (`Game.arrival`, applied in `loadScene`), lab 13 check, guide §۹.
  - `goToScene` gets an optional `arriveAt: tag`. In the new scene, objects
    tagged as players are moved to the first object with that tag.
  - Makes multi-room worlds (houses, dungeons) possible.
- [x] **Saving progress.** DONE 2026-11-19 (Claude): actions `saveGame` (key `save:<appId>:#game`, scene + all values) and `loadGame { scene }` (fallback); start-screen part has Play (reset) and Continue; lab 18. An action `saveGame` / trigger at start: remember
  the scene, plus every variable marked saved. A "Continue" button on the
  start screen part.
- [ ] (deferred, low priority: tiles already draw by open sides) **Autotile for tile maps.** Already partly there: `tiles.ts` knows which
  sides are open. Make sure corners and edges look right for every style, and
  that slopes join smoothly.
- [x] **Camera zones and limits.** DONE 2026-11-19 (Claude): `CameraBehavior.roomTag` (view clamped to the room box the followed object is in), lab 18 check; `issues.ts` treats roomTag as optional. A "camera stops at" behavior: the camera
  stays inside an object's box. Useful for rooms and arenas.

**Phase B: combat and smarter enemies** (complex games)
- [x] **Hurt properly.** DONE 2026-11-19 (Claude): `GameObject.invincible` (blinks, `Entity.hurtUntil`), `healthBar` (drawn by `drawHealthBars` in `Game.healthBars`), `damage.push` knockback; lab 17 checks.
  - A short invincibility after a hit (`invincible` seconds on health
    objects; blink while it lasts).
  - Knockback (push away from what hit it).
  - A health bar that follows an object: `bar` visual + `attach`, or a
    built-in option on health objects.
- [x] DONE 2026-11-19 (Claude): roles `patrol-enemy`, `shooter-enemy`, `boss` (bullets via `withBullets` in presets.ts: prefab + eachEvery spawn). Edge-turning walker and a jumping enemy still open. **Enemy brain role presets** (in `presets.ts`), built from the existing
  patrol, chase, near, eachEvery, spawn and launch blocks:
  - walker that turns at edges
  - shooter that fires every N seconds toward the player
  - jumper
  - boss with phases, using a value `phase` and value triggers
- [x] DONE 2026-11-19 (Claude): `spawn.ahead` (in front, same facing), part `sword` (btn-sword, slash prefab, damage with push, dead enemies explode); patrol and shooter roles now have 2 health. **Melee attack:** a button or tap that briefly creates a hitbox prefab
  in front of the player (spawn + lifetime + facing). Needs `spawn` to respect
  facing; check `Entity.facing`.
- [ ] **Projectiles aimed at the player.** `launch.toward: 'group'` exists;
  give it a part.

**Phase C: templates (prefab instances), #8**
- [x] DONE 2026-11-19 (Claude): `syncTemplates(before, after)` in state.ts, run inside `editor.change` in App.tsx; `TemplateTools` in Inspector.tsx; "کپی" note in the object list; editor checks. `GameObject.template?: string`: the id of a prefab this placed object
  copies. The editor offers "make this a template" and "place another".
  Editing the template (its behaviors, look, tags) updates every copy;
  position and size stay per copy. Resolve in the editor state (`state.ts`)
  when the template changes, so the runtime needs no change. Show copies
  with a small badge in the object list.

**Phase D: logic for bigger games**
- [x] **Text variables** (names and quest steps). Add one in the Game tab, display it with `{name}`, update it with `setTextVariable` and react with `textEquals`. Saved text survives reopening; save/continue includes all text. Numeric lists were an alternative proposal.
- [x] DONE 2026-11-19 (Claude): `StateGate.onlyIn` on every behavior; `Game.applyState` swaps `e.def` for the state's behaviors (`e.base` keeps the full one); body/physics/joint are never switched off; Inspector field under each behavior; lab 17 check. **Object states.** A value `state` plus behaviors that are on only in
  some states (`Behavior.onlyIn?: number[]`). For example, an enemy has
  patrol in state 0 and chase in state 1. This one is very powerful and cheap
  in the runtime: skip behaviors whose `onlyIn` does not contain the value.
- [ ] **Timers per object** exist (`eachEvery`). Add an "after N seconds,
  once, for this object" trigger.

**Phase E: content (completed 2026-11-20)**
- [x] Hero, robot, cat and knight have idle, two running frames, jumping and hit poses. Dungeon, space and forest packs add ten pictures.
- [x] Rule sound pickers have preview and per-action volume (0–100%). Dungeon, orbit and forest pieces are available for scenes and music actions.
- [x] The genre tab adds editable objects and rules to the current scene in one undo step. Each of five styles gets its own player/control combination, a camera, score, hearts and level pieces. Shooter includes a laser and a target. See `node scripts/look/genres.mjs` for all five try-outs.

### Also open
- The owner will test on their phone and report problems. Fix what they find
  first, before the roadmap.
- **AI helper** once the owner decides on hosting. Ask before starting; it
  needs a server and an API key.
- "What is not yet possible" is listed at the end of `GUIDE-fa.md`, §۱۳.
  Update it as phases land.

## Gotchas and lessons

- **Never put `backdrop-filter` (or `filter`/`transform`) on the editor
  panels.** It makes the panel the containing block for `position: fixed`, and
  the library dialog gets trapped inside the side panel.
- In tests, **wait on the game's clock** (`untilTime`, `until(... time ...)`),
  never on `sleep()`. Headless Chrome runs slower than real time.
- Physics events are kept until rules have run, then cleared in
  `Physics.endStep()`.
- Fixed (screen-stuck) objects use screen coordinates, not world coordinates.
- A new library picture: add it to `ART_SPRITES` in `art.ts`, with a unique
  `id`. Existing projects keep the PNGs already stored in their assets.
- A new action (Phase 1 way): its type in the Action union of `types.ts`, one file in `src/blocks/actions/`
  (copy one: editor description, sentence, check, run), one line in `src/blocks/registry.ts`, the GUIDE block
  list, a lab test. Nothing in Game.ts, labels.ts, sentences.ts or validate.ts. A new trigger or behavior is still the old way until they are moved:
- A new block (trigger or action), old way:
  1. Add it to `types.ts`.
  2. Implement it in `Game.ts` (`fired` for triggers, `perform` for actions).
  3. Check it in `validate.ts`.
  4. Add it to `TRIGGERS`/`ACTIONS` and a group in `labels.ts`.
  5. Write its sentence in `sentences.ts`.
  6. Update `isVariableUsed` in `state.ts` if it names a variable.
  7. Update the GUIDE block list and counts (§۵).
  8. Add a lab test.
- After any visual change, photograph it (scripts/look) and look before
  reporting.

---

## Session log (newest first)

### 2026-11-25 — Claude, roadmap "foundations, not features", Phase 1 started (block registry)

- The owner's roadmap replaces THE PLAN NOW (five phases; no new features until done). Phase 1 started:
  src/blocks/ (types, registry, fields, say), 29 actions moved as they were in four families, the mover
  script scripts/blocks-move.mjs. Then (owner: "go ahead") the other 39: all 68 actions are blocks (step 3).
  See "Phase 1 progress". Step 1 (registry + sound and effects) on CI: all
  four test suites pass; 12 of 16 bots win; the four that lose (physics, tower-levels, platform-levels,
  bricks-levels) lose the same way without Phase 1 (see Later). Steps 2 and 3 on CI: all four test suites pass; 12 of 16 bots win; the four that lose are the same, puzzle instead of physics (random boards; see Later). Game.ts 5365 -> 4821 lines.

### 2026-11-25 — Claude, a toolkit for other agents to make games (owner: "I want each agent to easily build its own game")

- `AGENTS-GAMES.md`: the guide for an agent making a game as a project file (setup, the loop, the model, behaviors/triggers/actions at a glance, coordinates and tall phones, the group names the parts expect, pitfalls learned in the bug hunts, a hand-over checklist). `src/format/types.ts` stays the full reference.
- `scripts/game.mjs`: `new <genre|blank>`, `check` (validateProject + the editor's warnings), `run` (plays 60 steps a second on the game's clock, holding keys and tapping, logs every variable and scene change), `shots` (every scene, design and tall), `levels` (the level maker), `library`, `picture` (a library picture into the assets, printing the visual to use), `part` (a ready-made part into a scene). It drives the built editor headlessly through `window.__editor.agent` (`src/editor/agentApi.ts`).
- `examples/star-catch.json`, made from blank with the toolkit (as an outside agent would). Making it found a trap now in the guide: a `mover` with `atEdge: remove` never fires `offscreen`.
- Library bug found by listing it: two pictures shared the id `mushroom`, so the second (scenery) could never be added; it is now `toadstool` (Rescue's meadow uses it, as was meant).
- `scripts/agent.smoke.mjs` (new CI suite `agent.smoke`) runs every command. README, AGENTS.md, CLAUDE.md and GUIDE-fa point to the guide.

### 2026-11-25 — Claude, bug hunt part 4 (each level in play, after the opening words, and with the pause menu open; design shape and tall phone; made levels too)

- Pause menu on tall phones: "Sound: on" fell off its button (the button empty, the word below it). `placeOnScreen` moved each screen-fixed thing by the smallest fixed thing around it: the word went by its button (in the bottom third → to the bottom), the button by the menu (middle → half). Now the outermost holder decides, so everything on a menu moves with the menu. Lab 28 has a word on a low button.
- Made levels: "Level n" went at 0.2 H, over Brick Blitz's bricks. When the game's goal words ("نوشته‌ی هدف") sit low (below 0.4 H), the level number goes just above them; Brick Blitz's goal words moved to 0.62 H, clear of nine rows of bricks.
- Sky Hopper: the hidden pipe body now reaches 16 px down over the top pipe and leaves out the outline at the end of the picture, hiding the line where they met on tall phones.

### 2026-11-25 — Claude, bug hunt part 3 (every scene of the ten games looked at on a tall phone)

- Tower Climb: the first floor (the hero's start, a slime, coins) was behind the arrow and jump buttons: the ground was 80 px thick at the bottom of the world. It is now 340 px (`BASE`; the tower is that much taller, so the top keeps its room). The hero also started on a coin, picked up unseen during the opening film (score 1 at the start): that coin is left out, and the level maker's coin rows avoid the hero's start (editor.smoke checks all three levels).
- Sky Hopper: on a tall phone more sky shows above the world, where each top pipe ended in mid-air (and a bird could fly over it). Each top pipe now has a hidden body (`بدنه‌ی لوله n`, the pipe picture cropped to its body so the cap keeps its size) going 0.7 H up out of the world; it hurts like the pipe.
- Gem Crush: the goal words ("90 points in 20 moves!") sat on the board's top row; now in the gap between "Goal" and the board (y 282). Brick Blitz: its words are between the bricks and the paddle (0.55 H).
- Win and game over screens: "Best: {best}" instead of "Top: {top1} · {top2} · {top3}", which read "0 · 0 · 0" until three games had been played.
- The "Made with Bazisaz" note goes at the first touch too (it sat over the left arrow if Play was tapped within 5 s).
- Level maker, dungeon: coins, gems and the key are never placed under what is fixed to the screen (score, hearts, backpack, buttons, the stick), since each room is one screen. editor.smoke checks levels 1–3.
- Brick Blitz levels: simulated with a perfect paddle, all three levels play 20 s without losing a life (level 3 ball ~750 px/s). The bricks-levels bot failures are the bot, not the game.

### 2026-11-25 — Claude, the blinking's real cause (owner's screen video of the dungeon)

- The owner filmed the phone: the knight stood still, no finger down, and its picture changed sides (sword left, then right) every 0.1–0.15 s. Cause: in `syncView`, `view.width = e.width` keeps the sign the Sprite's scale had (Pixi's `_setWidth`), and the next line multiplied it by `facing` again, so facing left the mirror flipped at every `syncView`. With an even count of syncs per frame (2 on the laptop) it was steady but wrong (facing left drawn facing right); on a phone, uneven frames mean 1, 2 or 3 updates a frame, so it blinked. Fix: `Math.abs(view.scale.x) * e.scale * e.facing`. Every flipped hero in every genre had it. Lab 29 steps uneven frames (1/60…1/20) after walking left: before the fix the sides seen were 1,1,-1,-1,-1,-1,1,1,1,-1; after, all -1.
- The 2026-11-24 "blinking" fix below (turning only on real sideways movement) was a real but smaller issue, not the one the owner saw. Lesson: when the owner reports a visual glitch, ask for a screen video first; frames can be pulled from an mp4 with headless Chrome (a `<video>` seeked and screenshotted; canvas export is blocked for file:// videos).

### 2026-11-24 — Claude, bug hunt part 2: the key and the blinking knight (owner: "I meant the key that must be taken"; blinking also on the phone)

- The key was hidden under the buttons: in room B's bottom right it sat under the roll button (design shape) and under the sword button (tall phones, where the buttons move down). It now lies in the open (room B, 0.86/0.47). A coin and two gems that sat under the backpack moved down too. editor.smoke checks room by room that no coin, gem, key, door or treasure is under a screen-fixed thing (words that come and go excepted).
- The dungeon's backpack is now two small places beside the hearts (x 335, y 160) instead of a row of five under them, which covered the top of every room (the knight walked under it).
- The blinking: a hero with `flip` turned round whenever x changed at all, so walking up or down with a finger on the stick (never quite straight) mirrored the picture nearly every frame (measured: 180 turns in 180 frames). Now, without gravity, it turns only when going sideways at least 30 px/s and at least 0.35 of its up-down speed, and not again within 0.15 s (`turnedAt`); measured 0 turns. With gravity it turns as before.
- The sword swings the way the knight walks: seen from above (no gravity), an object remembers the way it last went (`went`, one of eight, from 30 px/s); `spawn` with `ahead` puts the new thing that way and turns it to point there when the way has an up-down part (sideways keeps using `facing`). It used to strike only to the left or right, so a skeleton above or below could not be hit. editor.smoke checks up, down and left. One adventure bot run died in room C (score 12) right after the key move; the rerun won: luck, not the change.
- A picture that only bobs (the start screen's hero, a `wave`) no longer shows its walking pictures: up-down movement counts as walking only for a body without gravity or a steer/chase.

### 2026-11-24 — Claude, bug hunt in the games (owner's report: hearts behind, no keys in the dungeon, the knight blinking)

- Filling the phone: the player (not the editor) makes the view taller or wider to the screen's shape (up to 1.6×), so there are no strips on modern phones (`fill` option, `view` size in Game.ts; tests turn it off with `__FILL__ = false` unless `openPage(..., { fill: true })`). Screen-fixed objects keep to their edge: top third stays, bottom third goes to the bottom, middle stays in the middle; a thing inside another (word on a button, button on a menu) goes with it; a whole-screen cover grows. A world with gravity that fits the view stands on the bottom edge (more sky above). Lab 28.
- Text never runs off the screen: a line wider than its room is drawn smaller (`fitText`; "DUNGEON ESCAPE", "RESCUE RELAY" were cut). Outlines are thicker (size/7).
- Achievement note: slim, along the very top edge (it covered "YOU WIN!").
- Dungeon: the backpack sits below the hearts (it overlapped hearts 2 and 3); a faint joystick rests in the lower left when no finger is down (the stick was invisible until touched: "no keys"); a top-down hero now shows its walking pictures when walking up or down, and keeps them 0.12 s after each step (it flipped between standing and walking pictures every frame, which looked like blinking).
- No glow on start screens (it washed out "Tap play to start" on bright skies). Rescue: limb physics no longer names a ground group a scene does not have (18 warnings in the game check). Game check: a prefab fired by `shoot` counts as made (the boss orb warning).

### 2026-11-24 — Claude, level maker that understands the parts

- Owner feedback: levels "did not change at all" (true for platform, shooter, puzzle, physics, rescue: only a speed or the sky changed). New `src/editor/levelremix.ts`:
  - `findElements(scene)` reads roles from the rules, not names: touching it costs a life (a `send` to a message that subtracts lives, `damage first`, `respawn first`) → hazard, or enemy if it moves; `checkpoint` → checkpoint; `goToScene`/win sound → goal; destroy second/add → prize; `noneLeft`/`hit` → target; `line` → piece; the player's `solidTag` → ground; untagged images → decor. The dialog shows «در این مرحله پیدا شد: …» (`data-levels-found`).
  - `remixKind` from those roles: platformer (gravity, jumper, wide tile map), tower (tall, climb tag), dungeon (no gravity, steer, tile walls), physics (`thrown` + targets), puzzle (`line`), shooter (followFinger + spawner), rescue (`cut`).
  - `remix`: platformer rebuilds the tile map from pieces counted from the original (walkers, spikes, gaps with pits, the lift, steps; floating platforms, gems on higher ones, coins at least as many; checkpoints at thirds, goal at the end); tower moves each floor's opening and its ladder (zigzag), re-lays coins, adds floor enemies; dungeon moves pillars (2-cell clearance), coins, key, enemies within their own room and adds enemies outside the start room; physics builds 2–3 new towers, targets on top/inside, beam + barrel; puzzle shuffles with fewest starting lines; shooter adds tougher spawns and health; rescue narrows the mat.
  - `generateLevels` returns `changes` (per level, in Persian) shown in the note after making. Curve steps are now 0.15 / 0.3 / 0.5.
- Bots: `platform-levels`, `tower-levels`, `adventure-levels` added; tower bot reads each level's ladders, platform bot resets per level.
- Editor checks (level block alone): 21 PASS — platform new ground/longer/more spikes, tower ladders move, dungeon pillars/enemies, physics towers and targets, puzzle board shuffled.

### 2026-11-23 — Claude, making a game's next levels

- `src/editor/levelgen.ts` + `LevelMaker.tsx` (button «🪄 ساختن مرحله‌های بعدی» under the scene buttons). No AI: copies of the level (`duplicateScene`), each harder by `hardness(curve, n)`. For every game: enemies and spawners faster (never the player), more patrol enemies, prizes swapped between their spots, fewer moves/shots/time and a higher score goal, a new theme (sky, weather, natural tile material; dark scenes untouched). New layouts for runner (rooftops, widening gaps up to 250), hopper (gap heights, narrower) and bricks (wall shapes). Levels are chained by redirecting the level's win `goToScene`; a points goal resets score at each level; a «Level N» label pops at the start.
- Tests: editor checks (runner levels, chaining, undo; Sky Quest enemies faster and more, coins moved, theme). `npm run bots -- bricks,runner-levels` plays only the named bots (names listed if one is wrong). `npm run bots` now also exports runner, hopper and bricks with two made levels (`export.mjs genre:2`, `BOT_GAME`) and plays them through. Bots reset their own timers when the scene changes.
- Not done: new layouts for the other kinds (platformer chunks, dungeon rooms, tower floors); for games made from scratch only the general changes apply.
- Found by the level bots and fixed: (1) runner layout's last rooftop could be short, so a runner landing from a wide gap flew over the flag; the last roof is now always 680 wide with the flag 200 from its end. (2) The runtime forgot a finger held on the screen when a new scene began, so a follow-finger paddle froze at "Level 2"; held fingers now carry into the next scene for followFinger only (`heldOver` in Game.ts; Lab 27). (3) A launched ball now speeds up by √hardness, not hardness. The bricks bot predicts where the ball comes down (wall bounces) and reports a page crash plainly.
- Open: on the owner's 8 GB laptop, headless Chrome's page crashed during Brick Blitz (both the plain game and the levels) around 75–90 s of game time, three times in a row, also once before these changes. The JS heap stays at 11–17 MB, text textures are released (~20 live), and the level idles 120 s with its music without crashing, so it is likely the machine (swiftshader under memory pressure, game running 3–7× slower than real time). Run the bricks bots on a roomier machine to confirm.

### 2026-11-22 — Claude, the rest of the plan

- Cut-out animation: `animate.pivot` (shares of the box) turns and scales about a joint; the timeline dialog has pivot sliders and the preview uses transform-origin. The `cutout` part builds a walking paper doll (body with patrol and bob, head, arms and legs attached by `attach`, each swinging about shoulder or hip).
- Music maker: `musicWav(piece)` exported from `src/runtime/music.ts`; `MusicMaker.tsx` (mood, chords, tempo, pitch, lead, drums, bed, new melody seed) adds a WAV sound asset and makes it the scene's music.
- Animated tiles: styles `water` and `lava` (`ANIMATED_TILE_STYLES`), four frames swapped every 0.18 s in play (`stepLiquids`).
- Layered maps: the tile panel's «+ لایه‌ی پشت» inserts an empty map of the same grid behind, parallax 0.7, faded, no tags. Any object already had parallax.
- Art pack: oak-tree, flower-bush, boulder, mushroom, signpost, fence, lamp-post, crystal; used on Rescue Relay's trail and Rooftop Run's roofs.
- Not done: autotile transitions between two materials (each material already draws its own open edges and caps), a full equipment system (crafting works with rules), bone rigs with nested joints (limbs attach to one body; a forearm on an upper arm would need attach to follow the parent's angle).

### 2026-11-22 — Claude, animation timeline

- New behavior `animate` (keys with t, x, y, angle in degrees, scale, opacity; repeat loop, bounce or once; ease smooth or linear). `src/runtime/animate.ts` holds the interpolation and eight presets, shared by the game and the editor. In the game it is added on top of the object's own movement (taken back each step like `wave`), multiplies a pulse's size, and is skipped for real-physics bodies. `src/editor/AnimationEditor.tsx` is the timeline dialog: presets, a live DOM preview (no second WebGL context), a scrub slider with key markers, per-key sliders, add and remove keys, Apply or Cancel as one undo step. Tower Climb's bell and every win-screen trophy swing. Lab 25 and editor checks.
- Still open from the plan: bone (cut-out) animation, a music maker, layered maps, animated tiles, autotile transitions, more art packs.

### 2026-11-22 — Claude, live editing on a phone

- Trying on a phone already reloaded on every change; now it checks every 0.7 s, starts on the scene open in the editor (a checkbox in the phone dialog turns that off), and each phone reports every 2 s (GET `/report` on the phone server, which still takes no posts): model from the user agent, frames a second measured with requestAnimationFrame, scene, whether it lightened, the last three errors. `GET /api/phone/status` lists phones heard from in the last 10 s; the dialog shows them (green 50+, yellow 30+, red below, with advice) and the top button shows the slowest phone's FPS. Server checks include a real browser opening the phone page and reporting.
- Next: the owner tries a game on a real phone with this; then the keyframe animation timeline.

### 2026-11-22 — Claude, review of Codex and the rest of the plan

- Reviewed and accepted e455345 (particle workshop, dialogue-aware bot tick).
- Added: the `dissolve` effect, the `focus` action (camera visits an object, then returns; a cutscene with `say`), `moves.crouch` (60% height, feet kept, slow, stays down under a ceiling), the parts `boss` (health bar, ring and aimed-fan attack pattern, dissolves on death) and `waves` (two hidden gates, wave counter, faster spawns each 15 s), and drag-and-drop of actions within a rule (handle ⠿, same list only). Tower Climb uses dissolve, focus and crouch. Lab 24 and editor checks cover them.
- Still not done from the plan: keyframe animation timeline and bone animation, a music maker, live editing on a phone (the "test on phone" button exists), layered maps, animated tiles, autotile transitions, equipment as a system (crafting works with existing rules, see the guide), more art packs. Rock Smash and Brick Blitz bots sometimes need their second try.

### 2026-11-22 — Codex, Dungeon Escape bot and particle workshop

- Reproduced the Dungeon Escape timeout in Chrome. The Knight spoke at about 0.81 s and game time correctly stopped for input. A bot already waiting for two seconds of game time could never get back to its dialogue handler. The bot now ends a timed wait when a dialogue opens. Lab 23 covers dialogue opening during a wait and continuing after player input.
- Added a Persian particle workshop with a live preview using the game's particle motion and drawing code. Draft edits can be cancelled or applied together. The optional grounded-motion switch gives the Mountain trail motorcycle rear-wheel dust. Runtime checks exercise parked and moving conditions. The editor check covers preview colour, cancel, apply, undo, redo and reopening the saved project. Rescue's bot takes the riding screenshot after particles appear.
- Closing the workshop originally cleared Pixi's shared render resources while the editor canvas still needed them. Confirmed the stack in Chrome, switched to per-renderer cleanup and repeated the open, cancel, apply and reopen sequence without page errors. The versions test now waits for its restore button when the game tab reloads its list from IndexedDB.
- Final build passed. `npm test` passed 597 checks (315 runtime, 258 editor, 24 server), zero failures. All ten bots passed. Dungeon Escape won on its first try with 62 points and two lives. Shooter reached the boss and survived 35 s with all three lives. Rescue won with 600. Rock Smash and Brick Blitz won on their second attempts. Inspected `test-output/editor-particle-workshop.png` and `scripts/bots/out/rescue-03-bike.png`. Verified in Chrome on Windows. Real-phone testing remains open.

### 2026-11-21 — Claude, review of Codex's work, end of Phase 1, start of Phase 2

- Reviewed Codex's commit 5130ebd and accepted it. Small fixes: the guide's genre table gained the Rescue Relay row, its section moved next to the physics section, the library card is now «نجات: Rescue Relay».
- Phase 1 finished: collision shapes, gear joints (with racks) and gravity zones (see the plan). A joint behavior is no longer made twice when another joint of the same object is still waiting for its target (that used to happen every step). Gear joints are destroyed before the hinges they couple (cut, snap, removal).
- Rescue Relay has a sixth leg, "Clockwork lift": hold right, the crank turns the big gear, the rack lifts a capsule pod into an upward gravity zone and it falls up to the star. The rescue bot plays it (600 points). Rock Smash's TNT barrel uses the outline shape.
- Phase 2 started: wall shadows, weather, floating words, 12 particle presets (see the plan). New labs 19 (shapes, gears, zones) and 20 (shadows, weather, floats, particles) in `scripts/smoke.mjs`, and a gears-part check in `scripts/editor.smoke.mjs`.

### 2026-11-21 — Codex, professional engine Phase 1 (started November 20)

- Re-ran the low-memory baseline with one Chrome at a time. The shooter survived with its existing settings. Reviewed 6ab021b (physics, examples, tests and bots) and 0682542 (editor descriptions).
- Fixed the second body's wall check in bump separation, material sounds bypassing mute, the position and source crop of rotated fragments, the real-time duration of slow motion, and pursuit's two-second timer at the last sighting. Motor input and pass groups retain their existing controls.
- Added editable line terrain for both body systems, an articulated rescue rig, radial gravity with a finite central acceleration, wheeled assemblies and submerged propeller thrust. In Rescue Relay the player drops the figure onto a mattress, launches a probe into orbit and drives three vehicles across checkpoints. Each scene has a retry button.
- Rescue score regression: the boot could bounce on the pad during the transition and award 200 instead of 100. The editable checkpoint rule now checks and sets a per-goal `claimed` value. The bot checks the score after every stage.
- Crawler diagnosis: its rectangular nose hit the first ascent before the front wheel could climb. The body now has 8 px of clearance. Tested the solver at 60, 90 and 120 steps per second.
- On a later run the former shooter pilot lost at 22.2 s and 15.6 s. The red bolts in the life-loss photos were invisible to its threat filter: the snapshot has the shot tag but no `round` property. Falling enemies also move through `mover`, which changes position directly and leaves body velocity at zero. The pilot now reads shot tags and prefab movement, predicts waves and checks the entire path to a firing lane. Three deterministic steering regressions run before the bot suite. The corrected pilot passed its first full run, surviving 35.001 game seconds with 125 points and one life.
- Final verification on November 21: build succeeded; 249 runtime + 239 editor + 24 server = 512 PASS, 0 FAIL. The six-bot suite passed, and the shooter steering regressions were 3/3.
- The shooter report records elapsed game time. Bot results require a successful process exit. Polling clears its watchdog timer and bots run the same adaptive visual settings as the shipped player. See `scripts/bots/out/rescue-*.png` and `test-output/editor-drawn-terrain.png` for the photographs.

### 2026-11-20 — Claude (professional-engine plan, phase 0 and the start of phase 1)

- The owner turned down the AI plan; the plan above replaces it.
- Added `scripts/bots/`: `export.mjs` builds the genre games in the editor and
  saves them; `platform`, `adventure`, `shooter`, `puzzle` and `physics` bots
  play them like a person (keys, finger, sword button, slingshot), report every
  life lost with what was near and a photograph, and stop with a stack trace
  if the game freezes; `all.mjs` (`npm run bots`) runs them all.
- New engine feature `BodyBehavior.bumpTag`: after everything moves, bodies
  that bump into a group are pushed out of it along the shorter way (half each
  when both have bodies), never into a wall of their solid group, measured on
  hitbox insets so rules still see them touching. Editor field, sentence,
  issue-check exemption and runtime tests (lab 11) added.
- Physics phase 1, first part: materials, breaking, pass-through, slow motion
  and four new pictures (see the plan). Rock Smash is now a fortress with a
  barrel on the beam and two hidden aliens; 5 stones. The physics bot computes
  a lob through the target from where the stone was pulled to, shoots the
  barrel first and topples a tower onto a hidden alien.
- Also: player-driven motors (`joint.drive`), line of sight (`chase.sight`).
  Shooter: no knock-back on hurt (`lifeRules(over, 0)`), enemy shots 260,
  boss fires every 0.9 s. The shooter bot runs the game at half speed
  (`setDebug({ speed: 0.5 })`): it only looks every 0.1–0.4 game seconds,
  which on a busy computer is slower than a person.
- Tests: after the last engine change the three suites passed: 243 + 233 + 24
  = **500 PASS, 0 FAIL**. Bots: platform, adventure, puzzle and physics won;
  the shooter bot lost at full speed. The last changes (shooter knock-back,
  shot speed, bot at half speed) were type-checked and built, but the full
  suite and the half-speed shooter bot were stopped twice by low memory on the
  owner's computer and were **not re-run**. Do that first next session.
- Games: hurt now knocks back (`damage` with push 650) and the player blinks
  for 1.3 s (`invincible`); the trophy sits on a podium at the end; skeletons
  and the knight bump; the ship has `hitboxInset: 26`; alien fire every 2.4 s
  at 310; the puzzle goal is 90.

### 2026-11-20 — Claude (whole games)
- Reviewed Codex's work: the overlap fix, Phase E and text variables. All accepted.
- Owner asked for "10x better" prepared games. The genre helper now builds five whole games; see "Owner decision" above.
- Engine: the touch trigger has `from: 'above' | 'side'`, for stomping enemies. It is judged by how each object moved this frame, not its speed: a bounce rule changes the speed during the same frame.
- Fixed a flaky lab-2 test (burst and shake) by waiting for the frame.
- Tests:
  - editor checks for the platformer (structure and stomp) and the dungeon (structure and chase state)
  - Codex's shooter check still passes with the new shooter
  - 488 PASS before the last visual tweaks (wave density, banner size, badge positions, puzzle badge order)
- Not yet done:
  - sound by ear
  - a real phone
  - a second level per game
  - difficulty tuning by real players

### 2026-11-20 — Codex (quest text)
- Added named text variables, exact-match triggers and text assignment across the format, validation, runtime, Persian editor, live debugger and guides. Existing v2 projects can omit the text list.
- Extended lab 18 for save/continue and matching. The editor smoke creates a quest, shows its starting text, taps to advance it and captures `test-output/editor-quest.png`. Focused browser checks passed, then the full suite passed in one run (232 runtime, 227 editor, 24 server). Phone testing remains open.
- Next Phase D item is the once-per-object timer.

### 2026-11-20 — Codex
- Traced the apparent try-out freeze to repeated scene restarts on initial player–patrol overlap. Fixed sized placement in `state.ts`, `Library.tsx` and `ObjectList.tsx`. The editor test checks clock progress and damage from one real button press.
- Implemented Phase E in editor art, sprites, library, recipes, inspector and sound fields, project types and validation, runtime animation, sound and music. Updated the Persian guide and README.
- Verification: `npm run build` exited 0, then `npm test` exited 0 with 479 PASS and 0 FAIL across runtime, editor and server.
- Added lab and editor checks and photographed all five genre choices in Chrome. The quarter-speed lab compares equal frame inputs. The gesture lab exercises holding and a fast swipe separately, so observation time cannot turn the swipe into a long drag. Sound quality by ear and real-phone behavior remain unverified.

### 2026-11-20 — Claude (end of session, owner switching to Codex)
- Did the "complex games" roadmap, Phases A to D. Each phase was committed and pushed separately; see the ticks above.
  - A1: checkpoint/respawn actions, part `checkpoints`
  - A2: `goToScene.arriveAt`/`bring`, i.e. doors with an arrival point
  - A3: `saveGame`/`loadGame`, Continue on the start screen
  - A5: `camera.roomTag`
  - B1: invincibility, health bars, knockback
  - B2: roles `patrol-enemy`, `shooter-enemy`, `boss`
  - B3: `spawn.ahead`, part `sword`
  - C: templates with live copies (`syncTemplates`)
  - D: behavior `onlyIn` states
- Tests: lab 17 and lab 18 grew; the editor suite has checks for parts, roles, templates and the sword.
- **Open: one failing editor test (the sword).** See FIRST above. Everything else passes.
- Left for Codex:
  1. Fix the sword test.
  2. Phase E: art packs and character sets, a sound preview button, more music, the genre helper.
  3. The remaining small items: a jumping enemy, an edge-turning walker, text variables, a once-per-object timer, autotile.
- `npm test` takes over 10 minutes now; run it in the background.

### 2026-11-19 (night) — Claude
- Asked: do next steps 1, 2 and 3 (weekly budget was at 86%).
- Done, with a commit and push after each:
  1. Trigger `useItemOn`: drag a thing out of the bag and let go of it over an
     object; let go elsewhere, it flies back. Tested in lab 17.
  2. Parts `hearts` (lives shown as 3 hearts), `dialogue` (tap to advance,
     with a speaker picture) and `shop` (buy Heart and Shield for score; they
     fly into the bag; opener toggles via "otherwise"). Covered by the editor
     suite.
  3. Built-in sounds rebuilt as layered synths in `src/runtime/sound.ts`
     (notes, sweeps, filtered noise, through a compressor).
- Not verified by ear: the agent cannot listen. The owner should try each
  sound.
- Tests: 449 PASS, 0 FAIL.
- Next ideas: the owner's phone test; a sound preview button in the rule
  editor; an AI helper (needs hosting).

### 2026-11-19 (late) — Claude
- The owner had little token budget left, so this was a small step: an
  automatic light mode for slow phones (see "Current state").
- Changed `src/runtime/Game.ts`, `src/player/main.ts`, `scripts/lib.mjs`,
  `scripts/smoke.mjs` (lab 16 check) and `GUIDE-fa.md`.
- Also set up git and the private GitHub repository.
- Tests: 443 PASS, 0 FAIL.
- Suggested next step: use a thing from the bag *on* something (drag the
  key onto the door), then more parts (shop, dialogue box, hearts health
  bar).

### 2026-11-19 — Claude
- Asked: make all graphics "premium, attractive, gaming"; then the bag
  (inventory) and the editor's look; then this handoff file.
- Changed:
  - `src/editor/art.ts` (new: all pictures), `sprites.ts`, `recipes.ts`,
    `Library.tsx`, `GamePanel.tsx`, `Inspector.tsx`, `Fields.tsx`,
    `labels.ts`, `sentences.ts`, `state.ts`, `ObjectList.tsx`, `editor.css`
    (rewritten)
  - `src/runtime/bag.ts` (new), `Game.ts` (bag; rope and sling drawing),
    `src/format/types.ts`, `validate.ts`
  - Tests: lab 17, the editor suite's bag checks, two timing fixes
  - `GUIDE-fa.md`, `README.md`
  - Added `scripts/look/`, `HANDOFF.md`, `AGENTS.md`
- Tests: 442 PASS, 0 FAIL.
- Left open: phone testing (owner), AI helper (hosting).
