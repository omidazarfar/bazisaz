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
| `npm test` | `scripts/smoke.mjs` (runtime labs 1–17), then `scripts/editor.smoke.mjs` (drives the real editor), then `scripts/server.smoke.mjs`; uses puppeteer-core and Chrome |
| `npx tsc --noEmit -p .` | type-check only |

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
| `src/editor/art.ts` | **All 81 library pictures**, drawn as SVG in a glossy mobile-game style with a small gradient and glow kit. `sprites.ts` turns one into a PNG asset (key `art-<id>`) |
| `src/editor/recipes.ts` | The 25 ready-made **parts**, such as sling-and-tower, car, bridge, key-and-door, pause menu, levels |
| `src/editor/presets.ts` | The ready-made **roles**, such as jump-player, ground, prize, danger |
| `src/editor/editor.css` | The editor's look: a dark "studio at night" theme |
| `scripts/` | Tests (`smoke.mjs`, `editor.smoke.mjs`, `server.smoke.mjs`, shared `lib.mjs`) |
| `scripts/look/` | Scripts that photograph things so you can **see** them (below) |
| `GUIDE-fa.md` | User guide (Persian). `README.md`: technical notes and "Where the project stands" |

### Seeing your work (important for this owner)

After `npm run build`, these write PNGs to `scripts/look/out/`. Open them and
look:

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

- Last updated: **2026-11-19 by Claude**.
- `npm run build` exits 0. `npm test` gives **449 PASS, 0 FAIL**, all three
  suites.
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
- [ ] **Checkpoints and respawning.**
  - New action `respawn { target }`: puts an object back at its last
    checkpoint, or its start, with its speed zeroed.
  - New behavior or role "checkpoint": a flag (sprite `flag`) that stores the
    position of the player who touches it, per entity. Runtime: `Entity.home`
    is updated.
  - A part "checkpoints": danger → lose a heart → respawn, instead of
    restarting the scene.
- [ ] **Doors between scenes with an arrival point.**
  - `goToScene` gets an optional `arriveAt: tag`. In the new scene, objects
    tagged as players are moved to the first object with that tag.
  - Makes multi-room worlds (houses, dungeons) possible.
- [ ] **Saving progress.** An action `saveGame` / trigger at start: remember
  the scene, plus every variable marked saved. A "Continue" button on the
  start screen part.
- [ ] **Autotile for tile maps.** Already partly there: `tiles.ts` knows which
  sides are open. Make sure corners and edges look right for every style, and
  that slopes join smoothly.
- [ ] **Camera zones and limits.** A "camera stops at" behavior: the camera
  stays inside an object's box. Useful for rooms and arenas.

**Phase B: combat and smarter enemies** (complex games)
- [ ] **Hurt properly.**
  - A short invincibility after a hit (`invincible` seconds on health
    objects; blink while it lasts).
  - Knockback (push away from what hit it).
  - A health bar that follows an object: `bar` visual + `attach`, or a
    built-in option on health objects.
- [ ] **Enemy brain role presets** (in `presets.ts`), built from the existing
  patrol, chase, near, eachEvery, spawn and launch blocks:
  - walker that turns at edges
  - shooter that fires every N seconds toward the player
  - jumper
  - boss with phases, using a value `phase` and value triggers
- [ ] **Melee attack:** a button or tap that briefly creates a hitbox prefab
  in front of the player (spawn + lifetime + facing). Needs `spawn` to respect
  facing; check `Entity.facing`.
- [ ] **Projectiles aimed at the player.** `launch.toward: 'group'` exists;
  give it a part.

**Phase C: templates (prefab instances), #8**
- [ ] `GameObject.template?: string`: the id of a prefab this placed object
  copies. The editor offers "make this a template" and "place another".
  Editing the template (its behaviors, look, tags) updates every copy;
  position and size stay per copy. Resolve in the editor state (`state.ts`)
  when the template changes, so the runtime needs no change. Show copies
  with a small badge in the object list.

**Phase D: logic for bigger games**
- [ ] **Text variables** (names, quest steps) or **lists of numbers**.
  Start with a value that can hold a short text, shown with `{name}`.
- [ ] **Object states.** A value `state` plus behaviors that are on only in
  some states (`Behavior.onlyIn?: number[]`). For example, an enemy has
  patrol in state 0 and chase in state 1. This one is very powerful and cheap
  in the runtime: skip behaviors whose `onlyIn` does not contain the value.
- [ ] **Timers per object** exist (`eachEvery`). Add an "after N seconds,
  once, for this object" trigger.

**Phase E: content: art packs (#6), sound (#9), genre helper (#7)**
- [ ] **Character sets** in `art.ts`: idle, run (2 frames), jump and hurt for
  hero, robot, cat and a knight. Themed packs: dungeon (stone, torches,
  skeleton, chest), space (ship, asteroid, alien), forest (mushroom, log,
  fox). Same glossy style: use the `draw(k => …)` kit.
- [ ] **Sound:** a ▶ preview button next to every sound pick list (editor
  `Fields.tsx`, kind `sound`). Volume per sound action. Three more built-in
  music pieces (`music.ts`).
- [ ] **Genre helper** (not a template game; it adds parts to the user's own
  scene):
  - "What are you making?" offers platformer, top-down adventure, shooter,
    puzzle, physics.
  - The answer adds the matching player role, controls, camera, hearts,
    score and a level part, and explains each.
  - Lives in `Library.tsx` as a first tab or in the welcome.

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
