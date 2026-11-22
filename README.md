# Bazisaz: a no-code 2D game maker

A Persian editor in the browser, a general 2D runtime, and a local server
that turns a game into Android files (APK and signed AAB).

The editor's interface is Persian. The games it makes are English, for
Google Play. A full user guide in Persian is in `GUIDE-fa.md`.

## Run it

```bash
npm install
npm start          # builds, then serves the editor at http://localhost:5180
```

Exporting needs Android Studio (2025.2.1 or newer, with Android SDK 36) on the
same computer; the server uses its bundled Java and SDK.

Other commands:

```bash
npm run dev        # editor with live reload at http://localhost:5173/editor.html (no export)
npm run build      # dist/index.html (the player) and dist-editor/editor.html (the editor)
npm test           # browser tests of the games and editor, and a server test with Gradle replaced
npm run bots       # bots play six genre-helper games (five wins and 35 seconds of shooter waves) (after npm run build)
npm run check      # all of it in one go: build, then the tests, then the bots (one after another, to spare memory)
```

`npm test` needs Chrome; set `CHROME_PATH` if it isn't at `/usr/bin/google-chrome`.

## How a game is described

The editor opens on an empty game. There are no templates to pick from: the
product is a tool for building any game from nothing.

A game is one JSON document (`src/format/types.ts`):

- **Scenes** hold objects; a game moves between scenes (start, play, game over).
  A scene's world can be larger than the screen, with a camera following an object.
- **Objects** are shapes, images (with separate animations for resting, moving
  and being in the air), text (optionally outlined), bars bound to a
  variable, or **tile maps** (a level painted on a grid in the editor; in
  play each run of same-kind cells in a row becomes one solid block, and a
  kind can be kept cell-by-cell for coins or bricks). An object can have
  health, a round collision shape, and be a **ramp** (`slope`: a right
  triangle bodies walk up and down). Each can belong to **groups**, and can
  be fixed to the screen (score, buttons) while the camera moves.
- **Behaviors** (21) are ready-made abilities: steer (four directions, by an
  on-screen stick, buttons or swipes), route (along marker objects), body (with one-way platforms,
  wrap-around edges, ramps, friction, being pushed like a crate, and rolling), jumper (optionally cut short by letting go), walker
  (optionally easing in and out), follow finger, mover, launch (fixed, toward
  the last touch, or toward the nearest of a group), patrol, wave, chase
  (optionally only within a range, fleeing instead, or finding a way around
  a group of walls by a breadth-first search on a grid),
  attach, rotate, blink, pulse, trail, draggable, lifetime, spawner (by time or
  by camera travel, for endless levels), camera (optionally one-way and
  smoothed), scrolling image.
- **Rules** read "when *trigger* (if *condition*) then *actions*". Triggers
  (14): scene start, tap, holding, swipe, tap on object, two objects touch, a
  body lands, every N seconds, after N seconds, object leaves the screen, a
  variable reaches a value, none of a group left, an object's health runs out,
  a rewarded ad was watched. The condition compares a variable with a number,
  another variable, a random number or the count of a group. Actions (27,
  including changing gravity and creating an object where the screen was
  touched) change variables, create
  and remove objects, move them (instantly or smoothly), run short effects,
  damage objects, pause and resume, wait, change scene, play sounds, switch
  sound on and off, vibrate, throw particle bursts, shake the screen, show ads.
- **Board-game logic**: an object can carry named numbers of its own
  (`values`), which rules read and change; a picture can be chosen by one of
  them (`frameBy`) and a text can show them. A group reference can be narrowed
  to the members that pass a test on their values, or to one at random. A rule
  can have several conditions, on game variables or on an object's values.
  Triggers `value` and `line` (N alike side by side on the scene's grid) and
  actions `setValue`, `shuffle`, `swap`, `settle` (pieces drop down their
  columns and the gaps are refilled) and `step` (one cell, pushing what is in
  the way) are built on these. A group can also be narrowed by where its
  members are (`spot`: at home, away, on or off another group). Board moves
  take effect at once for the rules while the picture slides after them
  (`Entity.slide`). `swap` can be made conditional on forming a line, and
  `slideAll` is the move of 2048. Triggers now number 16 and actions 33.
- **Since then**: triggers `near` (within or beyond a distance, centre to
  centre) and `eachEvery` (a clock per object, from when it appeared);
  actions that change looks during play (`setColor`, `setImage`, `setText`,
  `resize`, `turn`, `setOpacity`, `flash`, `layer`), `playMusic` and a camera
  `zoom`; `setVariable` multiplies and divides. Triggers number 18 and actions 43.
- **Real physics** (`src/runtime/physics.ts`, on planck.js, a port of Box2D):
  behavior `physics` (moving or still; bounce, friction, weight, may turn,
  gravity, slowdown, world edges as walls, and a finger can grab it or pull it
  back like a sling) and behavior `joint` (hinge with an optional motor, rope,
  spring, weld, to the nearest object of a group); trigger `hit` (a crash at a
  given head-on speed or more) and action `blast`. Bodies stack, tumble and
  meet each other by their true, turned shapes. Behaviors number 23, triggers
  19 and actions 44.
- **More physics**: a sling (`drag: 'sling'`, `reload` by default) waits
  kinematic in the air where it was placed, is thrown as a bullet (CCD), and
  comes back once it has rested a second, left the world or flown ten
  seconds; a pull past the world's edge or into the ground still throws (the
  edges only hold what is wholly inside, and a released sling passes through
  whatever it overlapped). Still bodies can be conveyors (`surfaceSpeed`,
  the contact's tangent speed) or jump-through (`oneWay`, contacts disabled
  in pre-solve until the pair parts). Joints add `wheel` (suspension),
  `slider` (prismatic, with `axis`, `range`, and a motor that reverses at the
  ends), hinge `limit`, `at: 'between'` for chains, and `strength` (snaps when
  the reaction force passes that many times the object's weight). Behavior
  `field`: wind, water (buoyancy from how deep it sits and its `weight`, with
  drag) and magnet (pulls and holds). Rolling resistance, which Box2D lacks,
  slows anything touching something. Triggers `thrown`, `rest`, `snap`;
  actions `kick`, `spin`, `cut`, `setPhysics`. Physics events are kept until
  the rules have run (`Physics.endStep`), so a throw made between frames is
  heard. Behaviors 26, triggers 25, actions 58.
- **Graphics**: `Scene.sky` (`src/runtime/sky.ts`): ten painted backdrops
  drawn once on canvases from a fixed seed and shown as repeating strips with
  parallax by depth, some animated (drifting clouds, twinkling stars, rising
  bubbles, falling snow, shimmering light); new scenes start with `day`.
  `TileKind.style` (`src/runtime/tiles.ts`): materials drawn per cell,
  knowing which sides are open (grass and snow only on an open top), cached by
  material, size and open sides; new tile maps use grass and stone.
  Rect and ellipse `shade` (a local-space FillGradient and a shine) and
  `outline`; `GameObject.shadow` and `glow` (pixi-filters' DropShadowFilter
  and GlowFilter, kept in `Entity.fx` with a flash going on top);
  `TextVisual.shadow`; `Scene.bloom` (AdvancedBloomFilter over the scenery,
  with the look). Characters with a jumper stretch on a jump and squash with a
  puff of dust on a hard landing (`Entity.squash`). Library pictures are
  drawn in `src/editor/art.ts` (95, in a glossy mobile-game style: a small
  kit of gradients, glows and drop shadows declared per drawing, outlines in
  a deeper tone of each shape's own colour, shines, big eyes) and stored at
  three times their size under `art-<id>` (projects keep any older `lib-<id>`
  pictures). The ready-made parts are built from these pictures, not plain
  shapes: a slingshot and rock, a car body and tyres, planks, pegs, a belt,
  water, a basket, a menu panel, level buttons, and number badges (`hud`
  frame with a coin, clock or trophy). Menu scenes made by parts have a sky,
  a golden pulsing title and a vignette. Ropes, springs and the sling's bands
  are drawn as twisted rope, a metal coil and two rubber bands.
- **Bag** (inventory): a variable with `item: { asset }` is a thing the player
  carries; its value is how many. Visual `bag` (`src/runtime/bag.ts`) draws a
  row of places with each thing's picture and count, in the order things
  were picked up (`Game.carried`). Actions `give` (with `from`, the picture
  flies from that object into its place and pops) and `take` (never below
  zero); trigger `useItem` fires when a thing in the bag is tapped, and `useItemOn` when one is dragged out of the bag and let go over an object (`Game.startBagDrag`/`endBagDrag`; let go elsewhere, it flies back). Editor:
  "کوله‌پشتی" in the game tab, the bag in the library, the "key-door" part.
  Lab 17 and the editor suite cover it.
- **Logic**: trigger `message` and action `send` (a rule hands its first and
  second objects to the rules waiting for a named message; delivered on the
  next step, so messages cannot loop within one), `Rule.otherwise` (actions
  run when the trigger happened but a condition failed; `ruleActions(rule)`
  gives both lists), and action `nextScene` (the next scene in the list).
- **Looks**: behavior `particles` (fire, smoke, rain, snow, sparkle, bubbles,
  confetti; streams also run in edit mode), behavior `light` with
  `Scene.darkness` (a dark sheet rendered each frame into a texture, lights
  cut out of it with the erase blend, coloured glows added on top),
  `Scene.look` (a colour matrix over everything the player sees, the
  background included) and `Scene.vignette`; actions `setLook` and
  `setDarkness`; `glide` takes an `ease`. Anything a "tap on object" rule
  waits for gives a little when tapped.
- **Built-in music** (`src/runtime/music.ts`): eight pieces (`music:happy`,
  `adventure`, `calm`, `tense`, `mystery`, `dungeon`, `orbit`, `forest`) written out note by note from a
  fixed seed and turned into a looping 22 kHz WAV the first time they play;
  nothing is stored in the game. Usable wherever a sound asset is for music.
- **Pixel pictures**: `ImageAsset.pixel` marks a picture painted in the
  editor on a grid of that many cells (saved 8 pixels a cell); it is drawn
  with nearest-neighbour scaling and can be painted again. Behaviors number
  25, triggers 20 and actions 48.
- **Variables** are numbers such as score and lives; texts show them as
  `{score}`, as a clock with `{time:time}` (65 is `1:05`), or whole with `{score:int}`.
- **Sounds and music** the user uploads are stored in the project as assets;
  each scene can loop one as music.
- **Roles** (`src/editor/presets.ts`) are editor shortcuts that add a group,
  behaviors and rules in one step. They are not a separate kind of data.

How the runtime steps (`Game.advance`, `Game.update`):

- A frame is cut into steps of at most 1/120 s, so fast objects do not pass
  through thin ones. A frame never covers more than 1/30 s; below 30 fps the
  game slows down rather than skipping.
- In each step, self-moving objects go first, then bodies, then attached
  objects. A body standing on a solid is moved by however far that solid moved
  in the same step, which is what carries it on a moving platform.
- A jump from the ground still works for 0.1 s after walking off an edge, and
  a jump asked for up to 0.12 s before landing happens on landing.
- A touch on an on-screen control, or on any object a "tap on object" rule is
  waiting for, is not also a tap on the screen. A touch presses only what was
  visible when the step began.
- A ramp is met by its sloping surface, under the body's corner on the high
  side; a body that was standing keeps to the surface walking down it. The
  steep side is a wall, the flat bottom a ceiling.
- A body that walks into a `pushable` body moves it along if nothing in that
  body's solid group is in the way (so two crates in a row do not move).
- A body with `bumpTag` is pushed out of anything of that group it overlaps,
  after everything has moved, along the shorter way out (on hitbox insets, so
  touch rules still fire). Two bodies give way by half each; nothing is pushed
  into a wall of its own solid group; speed into the other is dropped.
- Objects outside the view are not drawn (Pixi's culler), for big levels.
- `physics.material` (wood, stone, metal, ice, rubber, glass) replaces the
  object's friction, bounce and weight with the material's (`MATERIALS` in
  `types.ts`, read through `feel()` in `physics.ts`), and a hit of 140 px/s or
  more plays the material's sound, as loud as the hit (at most three per
  step, and each object at most every 0.12 s).
- `physics.breaks` > 0: a hit at least that hard shatters the object into 2×2
  (3×2 if long) pieces showing their part of the picture (`ImageVisual.crop`),
  plain physics with no tags and a 2.5–3.5 s lifetime.
- `physics.passTag`: the pair never meets in the physics world.
- The `slowMotion` action scales time for a number of real seconds; 0 is a
  hit stop. It is counted in real time so a freeze always ends.
- Real physics steps once per step, after everything else has moved. The
  game's own picture of each object is the truth: before a step, an object
  moved, turned or sped up by anything else (a rule, a jump, a patrol) is put
  that way in the physics world; after it, moving bodies are written back.
  Still bodies, and objects without physics that a moving body is told to
  meet (`solidTag`) or that a joint holds, are kinematic bodies swept to where
  the game put them, so they shove what is in the way. 40 pixels are one
  metre. A scene with no physics creates no physics world. A slung object
  passes through the stand it rested on until it is past it.
- Scene changes fade through black unless `meta.transition` is `'none'`.
- The game and its music stop while the page is hidden.
- Uploaded sounds are decoded once into Web Audio buffers.

`src/templates/index.ts` holds the empty game and two example games. The
examples are not shown to users; the tests play them to show that complete
games can be built from these blocks alone.

## Layout

| Path | What it is |
|---|---|
| `src/format/` | The data format and its validation |
| `src/runtime/Game.ts` | The runtime: simulation, rules, input, and a frozen edit mode |
| `src/runtime/physics.ts` | Real physics: bodies, joints, sling and grab, crashes and blasts, on planck.js |
| `src/runtime/particles.ts`, `music.ts` | What each kind of particle stream does; the built-in music |
| `src/runtime/sky.ts`, `tiles.ts` | Painted backdrops; the materials of tile map cells |
| `src/runtime/ads.ts`, `sound.ts` | AdMob (inside the Android app only) and built-in sound effects |
| `src/templates/` | Starter games |
| `src/player/` | The page that plays one game; this is what goes into the APK |
| `src/editor/` | The editor. `labels.ts` describes every block and its fields in Persian; the panels are drawn from it |
| `server/index.mjs` | Local server: serves the editor, builds and signs exports |
| `android/` | Capacitor Android project. App id, version, orientation, AdMob id and signing come from Gradle properties |
| `scripts/` | Tests |

To add a behavior, trigger or action: add its type in `src/format/types.ts`,
handle it in `Game.ts`, describe it in `src/editor/labels.ts` (and put it in
one of the groups there), and give it a sentence in `src/editor/sentences.ts`.

The editor, file by file:

| File | What it is |
|---|---|
| `App.tsx` | Layout, keyboard shortcuts, the scene toolbar (tool, zoom, grid), try-out |
| `state.ts` | The project as immutable data: undo, selection, copy/paste, scene copy |
| `ObjectList.tsx`, `Inspector.tsx`, `Rules.tsx`, `GamePanel.tsx` | The panels |
| `Library.tsx`, `sprites.ts` | The "add" window and the 66 built-in pictures (SVG, stored in a game as PNG) |
| `presets.ts`, `recipes.ts` | Ready-made roles (one object) and parts (several objects and rules) |
| `TilesPanel.tsx` | A tile map's grid, its kinds of cell and the brush; painting itself happens in the runtime's edit mode |
| `Pick.tsx` | The window used for every grouped, searchable pick list |
| `sentences.ts`, `issues.ts` | Rules and objects ("what this does") as Persian sentences; notes on things that are probably mistakes |
| `Tutor.tsx` | The welcome on an empty game and the guided first game: nine steps, each checked against the project, with the button to press made to glow |
| `DebugPanel.tsx` | Replaces the settings during a try-out: live values, the rules that just ran (or were stopped by a condition), freeze, one frame on, slow motion, collision shapes. Reads `Game.getDebug()` and drives `Game.setDebug()` / `stepFrame()` |
| `PhoneDialog.tsx` | "Try on phone": sends the game to the server and shows a QR code of its address on the local network; while on, every edit is sent again |
| `PixelEditor.tsx`, `SheetCutter.tsx` | The pixel painter, and the cutter that turns a sprite sheet into an animated object |

In edit mode the runtime also handles zoom, sliding the view, selecting
several objects, snapping to other objects or a grid, and locked objects.

## Where the project stands (22 November 2026)

- The particle workshop previews all 30 streams live. Apply saves an editable object behavior in one undo step. Rescue Relay uses movement-triggered dust on the trail bike’s rear wheel.

- Games can store named text for player names and quest objectives. A text object displays `{quest}`; a rule can set it or react when it equals a particular string. Text follows the game across scenes and participates in save/continue.
- The library includes dungeon, space and forest art and four characters with
  idle, run, jump and hurt poses. The genre helper adds editable roles,
  controls and parts to the current scene in one undo step. Sound actions
  have a preview and independent volume. Three new pieces bring the built-in
  music library to eight.
- Placing roles now considers their bounds. A newly added patrol and player
  previously started overlapping and repeatedly restarted the try-out.

- The goal is a tool for building any simple 2D game, for players in Iran,
  with a Persian editor and English games aimed at Google Play. The editor
  runs on a desktop browser only. There is no template or starter game to
  choose from: ready-made roles and parts add ordinary objects and rules to
  the user's own game.
- Everything here was written and tested on Linux in headless Chrome
  (`npm test`, three suites). On Windows the tests look for Chrome at its
  usual place; set `CHROME_PATH` if it is elsewhere. Nothing has been run on
  a real phone since the first hand-built APK.
- Not yet verified on real hardware: the Android export button (real Gradle,
  signing), AdMob, audio latency, vibration, pausing when the app goes to the
  background, performance on a weak phone.
- 16 November 2026: added tile maps with a paint tool, ramps, pushing,
  friction and rolling, smarter chasing (range, fleeing, finding a way round
  walls), the `near` and `eachEvery` triggers, ten actions for looks, music
  and zoom, multiply and divide, clock-style text, and culling. Tested in
  headless Chrome on Windows (`npm test`, new labs 9 to 11 and a painting
  test in the editor suite); not yet tried on a phone.
- 17 November 2026: a pass for newcomers. An empty game offers a guided
  first game (the user builds it; it is not a template). Pick lists open on
  the most used blocks (`COMMON_*` in `labels.ts`), rarely needed fields are
  marked `advanced` and wait behind "more settings", the object panel says
  what the object does in plain sentences, a rule's conditions stay folded
  until asked for, and Help explains the eight words the editor uses. None of
  this has been tried with real newcomers yet; that is the next thing to do.
- 18 November 2026: real physics (planck.js): the `physics` and `joint`
  behaviors, the `hit` trigger and the `blast` action; roles for a crate, a
  ball and a sling stone; parts for a crate tower, a sling-and-tower game, a
  pendulum and a motor car; the editor draws a line from a joint to what it
  will hold. A pushed crate now stops flush against a wall. Tested in headless
  Chrome (lab 12 and the editor suite); not yet felt on a phone, where the
  sling and the frame rate of a big stack most need trying.
- 18 November 2026, later: the rest of the "next level" plan. Try-out tools
  (live values, rule log, freeze, frame step, slow motion, collision
  shapes); trying the game on a phone over Wi-Fi with a QR code and live
  reload; messages, "otherwise" and the next scene; a level-select part with
  levels unlocked one by one and remembered, and a full pause menu part; the
  pixel painter and sprite-sheet cutter; particle streams; lights and
  darkness, looks and vignette; easing for glides; tapped buttons giving;
  five pieces of built-in music. Tested in headless Chrome (labs 13 and 14,
  the editor and server suites). Not tried on a real phone or by real users;
  the phone link in particular depends on the Wi-Fi and Windows' firewall.
  Lists (an inventory) and an AI helper are not done: the first can be had
  with one variable per item for now, the second needs hosting.
- 18 November 2026, evening: the owner tried the sling and found the stone
  fell off its post, fell short and never reached the stars. Causes: a round
  stone balanced on a thin post, too little power, and (the main one) a pull
  past the left edge of the world, where the edge wall caught the stone as it
  came back in. Fixed as described under "More physics", with many more
  mechanics added (lab 15, three new editor checks, and four parts: rope
  bridge, conveyor, pool, a rope to cut). Played through in the editor: three
  throws of different strength all reach the tower.
- 19 November 2026: a graphics pass for games (see "Graphics"): backdrops,
  materials, shading, shadow and glow, bloom, squash and stretch, polished
  library pictures. Checked by eye on screenshots of every backdrop and by
  reading drawn pixels in lab 16. Not yet seen on a phone; bloom and many
  shadows or glows are the parts most likely to cost frames there. The
  editor's own look is the next thing the owner asked for.
- 19 November 2026, later: the owner found the art still not "premium,
  attractive, gaming". Every library picture was redrawn (`art.ts`), nine
  parts and the score, best and timer parts were rebuilt from pictures, and
  menu scenes got skies and golden titles. Checked by eye on large sheets of
  every picture and on each part played in the editor.
- 19 November 2026, evening: the owner chose the bag (inventory, see "Bag")
  and the editor's own look as the next two steps. The bag is done: lab 17,
  editor checks, and the key-door part played through in the editor. The
  editor was restyled (`editor.css`, rewritten with the same selectors): a
  dark indigo "studio at night", glassy panels without backdrop-filter (it
  would trap the fixed dialogs inside the panels), chunky glossy main
  buttons, a gold-lit selection, the phone on a lit stage, and library
  pictures on the cards of parts and roles (`PART_ICON`, `ROLE_ICON` in
  `Library.tsx`). Checked by eye on screenshots of the main states.
- Put aside for now by the owner: ads accounts, user sign-up, hosting.
- User-facing guide in Persian: `GUIDE-fa.md`. Replies to the owner are
  expected in Persian, simple and step by step.

## Export, and what is not yet verified

`POST /api/export` writes the game into the Android project, creates a
signing key per app id under `keys/` (back this folder up), runs
`gradlew assembleRelease bundleRelease`, and offers the two files.

The server is tested with a stand-in for Gradle. The real Gradle release
build, the signing configuration in `android/app/build.gradle`, and AdMob on
a device have **not** been run yet; expect to fix something on first use.

The server listens on 127.0.0.1 only. It is not ready to be put on the
internet: it has no accounts, and it builds one shared Android project.

"Try on phone" (`POST /api/phone`, and `/api/phone/stop`) starts a second,
show-only server on all interfaces (port 5181, `PHONE_PORT`). It answers only
`GET /` (the player with the last game sent, which reloads itself when
`GET /version` changes) and refuses everything else; nothing that builds or
writes files is reachable from the network. It starts only when asked.

## Not here yet

Turned walls for the simple `body` behavior (a solid turned by `rotation`
still stops it as an unturned box; real physics has no such limit), changing
a joint's motor during play, lists in variables, an AI helper, in-app
purchases, user accounts and hosting.
