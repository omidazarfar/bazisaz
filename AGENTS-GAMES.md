# Making a game for Bazisaz — a guide for AI agents

You are asked to make a mobile game. Bazisaz plays games written as **one JSON file**: no code, just
data — scenes, objects with ready-made behaviors, and rules of the form "when this happens, do that".
You write (or start from) that file, check it, play it headlessly, look at pictures of it, and hand it
to the owner, who opens it in the Bazisaz editor, tries it on a phone and exports an Android app.

Everything here is driven by one tool, `scripts/game.mjs`. The complete, commented reference of the file
format is **`src/format/types.ts`** — read it when this guide does not say enough; it is the source of truth.

## 1. Setup (once)

```sh
cd engine            # this repository's engine folder
npm install
npm run build        # builds dist/ (the player) and dist-editor/ (the editor); the tool uses both
```

Run `npm run build` again after pulling new engine code. The tool drives headless Chrome (Puppeteer).

## 2. The loop

```sh
node scripts/game.mjs new platform my-game.json      # a finished game of a genre to change, or: new blank my-game.json
node scripts/game.mjs library                        # pictures (characters, enemies, items, ground, buttons) and ready-made parts
node scripts/game.mjs picture my-game.json knight    # store a library picture; prints the "visual" to give an object
node scripts/game.mjs part my-game.json "Level 1" score        # add a ready-made part to a scene (score, pause-menu, controls...)
# ... edit my-game.json: objects, behaviors, rules, scenes ...
node scripts/game.mjs check my-game.json             # must say "It runs"; read the warnings too
node scripts/game.mjs run my-game.json --seconds 20 --hold ArrowRight --tap-every 0.6
node scripts/game.mjs shots my-game.json --out shots # a picture of every scene; LOOK at every one
node scripts/game.mjs levels my-game.json "Level 1" 2    # two more, harder levels after a scene, chained
```

Genres for `new`: `platform` (Sky Quest), `adventure` (Dungeon Escape, top-down rooms, key and door),
`shooter` (Star Raiders), `puzzle` (Gem Crush, match three), `physics` (Rock Smash, slingshot),
`rescue` (Rescue Relay, physics puzzles), `tower` (Tower Climb, ladders), `bricks` (Brick Blitz),
`runner` (Rooftop Run), `hopper` (Sky Hopper, tap to flap). Each comes with a start screen, a win and a
game-over screen, music, a pause menu and on-screen controls, already tuned and tested by bots.
**Starting from the nearest genre and changing it is much faster than starting blank.**

A small game written from blank with this tool is in `examples/star-catch.json` (catch the stars, dodge
the bombs, five lives, win at 20). Read it before writing your own.

## 3. The model

```
project
├─ meta        name, orientation, design size (720×1280 portrait is the norm), background, font
├─ app, ads    Android package id and versions; AdMob (leave ads off unless asked)
├─ assets      pictures and sounds by id (library pictures are stored here by `picture`)
├─ variables   numbers the game keeps: score, lives… ({name} in any text shows it; saved: kept on the phone);
│              a name may have parts joined by dots, player.stats.hp, for values that belong together
├─ scenes[]    levels and screens; startScene is the first one
│  ├─ objects[]   what is in the scene
│  ├─ prefabs[]   templates that spawners and the spawn action copy during play
│  └─ rules[]     when <trigger> [if <condition>] then <actions> [otherwise <actions>] [sub <rules without a trigger>]
```

**Sub-rules:** a rule may have `sub`, a list of rules without `when` (each `{ id, condition, also?, then,
otherwise?, sub? }`). They are looked at only when the rule's trigger happened and its conditions held, right
after its actions, about the same "first" and "second". Use them instead of several rules with the same trigger
that differ in one condition. Every id, sub-rules' too, is unique in the scene.

**Custom behaviors:** `project.customBehaviors` is a list of `{ id, name, about?, settings: [{ name, label?,
initial }], rules: [...] }`. An object gets one with the behavior `{ type: 'custom', behavior: <id>, settings?:
{ name: number } }`. Its rules run for each object that has it, on its own: `{ by: 'self' }` ("this object") is
that object, anywhere a ref or target goes; each setting is that object's own value of the same name (the
object's number, or `initial`). Name groups or `self` in them, never one object by `id`; no `called`/`asked`
rules there. "Scene starts" is, for each object, when it first takes part (made later: when made); "every N
seconds" counts per object. Use one for an ability many objects share with different numbers.

**Visual effects:** an object's `effects` and a scene's `effects` (`{ all?, sky?, world?, screen? }`) are lists of
`{ kind, settings?, off? }`, one of each kind; the kinds and their settings are in `src/format/effects.ts` (blur,
outline, pixelate, hue, film, glitch, rays, …). The action `setEffect` (`place`: object with `target`, or all, sky,
world, screen; `kind`; `setting` or "on"; `amount`, or `color`; `seconds`) changes one during play.

**Input:** a gamepad works like the keyboard with no setup (stick/cross = arrows, A = Space, B/X = dash); trigger
`padButton` (`button`: any, a, b, x, y, lb, rb, lt, rt, back, start, up, down, left, right). A text-input box is the
visual `{ kind: 'input', variable: <text value>, placeholder, size, color, background, maxLength? }`; trigger
`inputDone` (`target`) fires on Enter. Phone tilt: steer `control: 'tilt'`, and the amount `{ sensor: 'tiltX' | 'tiltY' }`
(-1 to 1).

**An object** has an `id` (unique in the whole project), a `name` (only the editor shows it), `x`, `y`,
`width`, `height`, a `visual`, `tags` (the groups it belongs to — rules and behaviors refer to groups
by name), `visible`, and `behaviors`. Optional: `fixed` (stays on the screen like a score or a button),
`health`, `invincible`, `round`, `rotation`, `opacity`, `glow`, `shadow`, `values` (its own numbers),
`parallax`, `hitboxInset`.

**Visuals**: `rect`, `ellipse` (a colour, optional `shade`, `outline`, `radius`), `image` (an asset id;
characters also get `frames`/`moveFrames`/`airFrames`/`hurtFrames`, `fps` and `flip` — use exactly what
`picture` prints), `text` (`text` with `{variable}`s, `color`, `size`, `weight`, `align`, `outline`,
`shadow`), `tiles` (a grid map), `terrain`, `bar`, `bag` (the carried things).

**Behaviors** (each is `{ "type": "...", ...fields }`; fields in `src/format/types.ts`, interface `XBehavior`):

| type | what it does |
|---|---|
| `body` | weight and gravity; stops at objects of `solidTag` (the ground group) |
| `jumper` | jumps (needs a body): on a tap, on a button group, or only by rules |
| `walker` | walks left/right: halves of the screen, two button groups, or always right |
| `moves` | a platform hero's extras: wall jump, dash, ground pound, climbing a ladder group, crouch |
| `steer` | moves in any direction, seen from above: a finger dragged anywhere (stick), buttons or swipes |
| `followFinger` | moves toward the finger (both axes, x only — a paddle — or y only) |
| `mover` | steady speed (bullets, falling things); `atEdge`: nothing, remove, wrap |
| `patrol` | back and forth around its place |
| `chase` | toward the nearest of a group (optionally only in sight, around walls) |
| `route` | from one marker object to the next |
| `homing` | turns toward the nearest of a group as it flies |
| `launch` | starts moving the moment it appears (a served ball, a shot) |
| `physics` | real physics (planck.js, a Box2D port): moving or still bodies, bounce, friction, weight, materials |
| `joint` | joins it to another physics object: hinge, rope, spring, slider, wheel, gear |
| `field` | an area that pushes: wind, water, magnet, planet, gravity |
| `spawner` | makes copies of prefabs at random times (or every N pixels the camera travels) |
| `camera` | the camera follows this object (free, only up, only right; can keep to rooms) |
| `draggable`, `lifetime`, `attach` | dragged by a finger; disappears after a while; sticks to another object |
| `rotate`, `pulse`, `wave`, `blink`, `animate`, `trail`, `scrollImage` | looks and motion |
| `particles`, `light` | fire, rain, sparkles…; light in a dark scene (`scene.darkness`) |

**Triggers** (`when`): start, tap, tapObject, touch (a with b; `from: above` for stomping), every, after,
eachEvery, offscreen, variable, value, textEquals, swipe, holding, noneLeft (a group is gone), dead
(health reached 0), land, near (and `leave`), line (match three), hit, message (from the `send` action),
thrown, snap, rest, useItem, useItemOn, reward (a rewarded ad was watched).

**Actions** (`then`): setVariable (set/add/subtract/max/multiply/divide), destroy, spawn, show, hide,
moveTo, moveBy, push, kick, jump, damage, goToScene, nextScene, restartScene, resetVariables, wait,
playSound, playMusic, burst, floatText, shake, flash, effect (pop, fadeOut…), say (a character speaks;
the game pauses while it is read), send (a message to a message rule), give/take (carried things),
checkpoint/respawn, achieve, recordScore, saveGame/loadGame, slowMotion, zoom, focus, setText,
setImage, setColor, setOpacity, setValue, setGravity, setLook, setDarkness, vibrate, showAd, and more
(see `Action` in `src/format/types.ts`).

**Targets**: in actions `"first"` and `"second"` are the objects the trigger was about (the two that
touched; the one tapped). Otherwise `{ "by": "id", "id": "..." }` or `{ "by": "tag", "tag": "..." }`.
**Amounts** are a number, `{ "variable": "score" }`, `{ "random": [1, 6] }` or `{ "count": "group" }`.
**Conditions**: `{ "name": "lives", "op": ">", "value": 0 }` (a variable, or an object's value with `of`).

## 4. Coordinates and the screen

- Units are design pixels; the origin is the top left; **y grows downward**.
- Shapes and pictures: `x`, `y` is the **top-left corner**. Text: `width`/`height` are 0; `y` is the
  **top** of the letters and `x` is their start, middle or end by `align`.
- A scene's `width`/`height` is its world; bigger than the screen, it needs a `camera` behavior.
- `fixed` objects use **screen** coordinates (0…720, 0…1280) and do not move with the camera.
- **Tall phones.** On a phone taller than 9:16 the player shows more: a world with gravity stands on the
  bottom edge with more sky above (so anything that should reach the top of the screen, like a pipe,
  must go on above y = 0); a world without gravity is centred. Fixed things keep to their edge by
  thirds of the design: top third stays at the top, bottom third goes to the bottom, middle stays in the
  middle. A fixed thing inside another fixed thing (a word on a button on a menu) moves with the
  **outermost** one. A fixed thing at least 90% of the screen (a dark curtain) is stretched.
- Keep what the player must see or reach (the player at the start, coins, keys, the goal) **out of the
  screen areas the HUD covers**: the top ~200 px (score, hearts) and the bottom ~300 px (buttons, the
  joystick in the lower left). The genre games keep their ground thick for this reason.

## 5. Groups the ready-made parts expect

The parts (`library parts`) and genre games find each other by these group (tag) names — use them for
the same roles, and your objects work with the parts:

| group | role |
|---|---|
| `بازیکن` | the player |
| `زمین` | ground and walls (what bodies stand on) |
| `جایزه` | a prize to collect |
| `خطر` | hurts the player |
| `دشمن` | an enemy |
| `سکه`, `الماس` | coin, gem |
| `پایان` | the goal (reaching it wins) |
| `جعبه` | a crate (physics games) |

Variable names are ASCII identifiers (`score`, `lives`, `best`, `hurt`). Texts the player reads may be
English or Persian. Parts print a note in Persian; it is for the owner and safe to ignore.

Useful parts: `score`, `best`, `hearts`, `timer`, `pause-menu`, `controls` (left/right/jump buttons),
`startscreen`, `gameover`, `falling`, `obstacles`, `sword`, `key-door`, `checkpoints`, `dialogue`,
`shop`, `levels`, and whole mini-games (`match3`, `g2048`, `memory`, `tictactoe`).

## 6. Things that went wrong before (avoid them)

- **`mover` with `atEdge: "remove"` never fires `offscreen`**: the object is gone before it is seen to
  leave. To count a miss, use `atEdge: "nothing"` and destroy it in the `offscreen` rule (see the example).
- Every `id` must be unique across the whole project (objects, prefabs, rules, scenes).
- Spawners and `spawn` refer to **prefab** ids; `goToScene` refers to **scene** ids. `check` finds dangling ones.
- Put the player's start and every prize where nothing covers them; don't start the player on a coin
  (it is picked up before the player does anything).
- Lives: subtract in one rule, and lose in a separate `variable lives <= 0` rule that goes to the
  game-over scene. A hurt rule usually needs a short safety time (see `lifeRules` in `src/editor/games.ts`,
  or the `hearts` part) or one touch takes every life.
- `say` pauses the game until tapped through; `run` and `shots` tap through it for you.
- End screens: a tap rule with `resetVariables` then `goToScene` back to the level.
- Characters: give exactly the visual `picture` prints; `flip: true` mirrors them when walking left.
- Long words: text that is too wide for the screen is drawn smaller automatically, but keep titles short.

## 7. Before you hand it over

1. `check` says **It runs**. Read every warning; fix the ones that are true.
2. `run` it, scripted roughly the way a player would play (hold arrows, tap). The log shows every
   variable change and scene change: the score goes up, lives go down when they should, you reach the
   win scene and the game-over scene. Errors in the page fail the run.
3. `shots`, and **look at every picture**, design shape and tall phone: nothing important under the
   score, hearts or buttons; no text cut off; nothing floating where it should reach an edge.
4. Optionally `levels` for more levels; `run` and `shots` the new ones too.
5. Tell the owner the file's path and what the game is.

The owner then, in the editor (`npm start`, http://localhost:5180): **باز کردن فایل** (open file) → the
file; **امتحان کن** (try it); **امتحان روی گوشی** (play it on a phone on the same Wi-Fi); **خروجی
اندروید** (the Android app).
