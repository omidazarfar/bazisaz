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
- It is pushed to a **private** GitHub repository:
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

## THE PLAN NOW: a professional engine (agreed by the owner 2026-11-20)

The owner said no to an AI game maker: there is **no money and no API key**.
They want a **professional, complete game engine**, good enough to show investors:
"something that has everything, physics, powerful graphics", games **without
problems**, and **"better contact between objects"** (nothing sinks into, sticks
to, jitters on or passes through anything it should meet). Also "make it easier
to work with". Usage is not a concern for now.

Rule for every phase: a feature is done only when a real game uses it, a bot
plays it through, it has been checked by eye in screenshots, and it has tests
and a Persian guide entry.

0. **Fix the games (DONE 2026-11-20).** Bots play all five games (`npm run bots`).
   Fixed: the trophy could be jumped over; spikes under a block; the knight and
   ship were hurt over and over with no knock-back or blink; skeletons walked
   through the knight; the ship's hitbox was its whole picture; the shooter's
   enemy fire was too fast; the puzzle goal was too easy (now 90 points).
1. **Physics and contact.** Done: `body.bumpTag` (bodies push each other apart
   instead of overlapping); `physics.material` (wood, stone, metal, ice,
   rubber, glass, each with its own hit sound); `physics.breaks` (shatters
   into picture pieces); `physics.passTag`; the `slowMotion` action (0 = hit
   stop); new art: glass-block, stone-block, steel-beam, tnt. Rock Smash was
   rebuilt with all of them. Also done: `joint.drive: 'player'` (a motor the
   player drives like a pedal: right half of the screen or the right arrow is
   forward, left is back; the "car" part uses it) and `chase.sight` (a chaser
   only notices what it can see; out of sight it goes to where it last saw
   it, looks for two seconds and gives up; Dungeon Escape's skeletons use it).
   Next: polygon/capsule/drawn-terrain shapes; chains/ragdolls/gears; planet
   gravity and gravity zones; more vehicles (bike, tank, boat).
2. **Graphics.** Real lights and shadows cast by walls, flickering torches,
   day/night; rain, snow, fog, wind; a particle editor with 30+ presets;
   hit-stop, directional shake, impact zoom, flash, floating damage numbers;
   dissolve, ripple, outline glow, retro/pixel filters; layered maps,
   animated tiles, autotile edges.
3. **Character and combat kits.** Wall jump/slide, dash, ladders, crouch,
   ground pound; top-down 8-way with dodge roll; weapons (gun, spread, bow,
   homing); ready smart enemies and bosses with attack patterns; a wave maker.
4. **Professional editor.** Drag-and-drop rule blocks, keyframe animation
   timeline and cut-out (bone) animation, layers panel, level map, asset
   manager, sound-effect maker, simple music maker, live edit on phone,
   version history.
5. **Game systems.** Branching dialogue, quests, achievements, cutscenes,
   settings menu, save slots, leaderboard, equipment and crafting.
6. **Speed and reliability.** 60 fps on mid-range phones; bots in every test run.
7. **Showcase.** 10 multi-level games and large art packs.

Persian text inside games: asked, not answered yet; games stay English for now.

## Owner decision, 2026-11-20: whole games in the genre helper

The owner asked to "go through the prepared games, make them 10x better, like really cool games with better features and better graphics". So the genre helper ("راهنمای سبک") now builds **whole, playable games**. This is the owner's own update to the old "no templates or starter games" rule.

The games are in `src/editor/games.ts`:
- `buildPlatformer` — Sky Quest
- `buildAdventure` — Dungeon Escape
- `buildShooter` — Star Raiders
- `buildPuzzle` — Gem Crush
- `buildPhysics` — Rock Smash

Each builds into the user's current scene, in one undo step. Each adds three scenes: Start (the game opens there), You win and Game over. They are made only of ordinary editable objects, rules and parts. Keep it that way: no hidden logic, everything visible and changeable.

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
| `npm run bots` | builds the five genre-helper games fresh in the editor, then a bot plays each one in the real player from the start screen to "You win" (the shooter: 35 s of waves without dying). Needs `npm run build` first; takes about 10 minutes. Each bot can also run alone: `node scripts/bots/<genre>.mjs [seconds]`; photographs of every life lost go to `scripts/bots/out/` |

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

- `node scripts/look/genres.mjs`: the genre helper and all five choices in fresh editor try-outs.
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

- Last updated **2026-11-20 by Claude** (see the plan above; phase 0 done). Before that, by Codex: Phase D now includes text variables for quest steps and names. Phase E is implemented. The editor
  library has five genre choices, four animated character sets, three art
  packs, sound preview and volume, and eight built-in music pieces.
- The sword try-out advances and one swing damages the patrol. A scene-load
  trace established that the loss rule kept restarting the test scene.
- `npm run build` passed. The complete `npm test` run passed all three suites with **483 PASS, 0 FAIL**.
- The player (`src/player/main.ts`, i.e. the game on a phone) passes
  `lighten: true`.
  - After 3 s below 28 fps it calls `Game.lighten()`, which drops bloom,
    shadow and glow filters for the session.
  - The editor's try-out does not do this.
  - The tests set `window.__LIGHTEN__ = false` (in `scripts/lib.mjs`),
    because headless Chrome is slow enough to trigger it.
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

### Remaining roadmap work

Owner phone feedback comes first when available. The remaining scoped items
are one-shot per-object timers (D), edge-turning and
jumping enemies and an aimed-projectile part (B), then deferred autotiling
(A). The AI helper still waits for the hosting decision.

### THE CURRENT PLAN: "complex games" roadmap (agreed by the owner 2026-11-19)

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
- A new block (trigger or action):
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
