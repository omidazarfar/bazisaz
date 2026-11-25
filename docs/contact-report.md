# Phase 2 report: where `body` and `physics` decide contact differently

Bazisaz has two ways to move an object, and each has its own idea of when two objects meet:

- **`body`** ("جسم فیزیکی"), in `Game.moveBody`: an arcade mover. It moves one axis at a time and stops at the
  objects of its `solidTag` group, measured as plain, unturned boxes.
- **`physics`** ("فیزیک واقعی"), in `src/runtime/physics.ts`: real physics on planck.js (Box2D). Shapes, weight,
  rotation, joints. Objects of a `physics.solidTag` group that have no physics of their own become immovable
  "walls" that planck follows.

The rules ask a third thing, `overlaps()` (now `src/runtime/geometry.ts`), for "touch", plus planck's own contact
list when one of the two has real physics. Below is every place where these disagree, each with a scene that
shows it.

## The differences

1. **The hitbox inset.** `overlaps()` shrinks an object by its `hitboxInset` ("کوچک‌تر کردن جعبه‌ی برخورد");
   `moveBody` and planck ignore it.
   *Scene:* a hero with inset 10 and a body stands on the ground. The body says "standing", the `land` trigger
   fired, but a rule "when hero touches ground" never fires: the inset feet are 10 px above the ground.
2. **Round and turned objects.** `overlaps()` tests a `round` object as a circle and a turned object as a turned
   box; `moveBody` stops both as their unturned outer box.
   *Scene:* a ball (`round`, body, solid group "wall") rolls into the corner of a wall: it stops at the box corner,
   in mid-air beside the wall, and a rule "ball touches wall" says it does not touch.
3. **Fast objects.** `moveBody` moves the whole step, then looks for overlaps: anything faster than its own size
   plus the wall's thickness per step goes through. planck sweeps only slung objects (`bullet`).
   *Scene:* a body shot at 3000 px/s at a 10 px wall: at 120 steps a second it moves 25 px a step and comes out
   the other side.
4. **Who pushes whom.** A `body` object stops at its `solidTag` group; a `physics` object meets another physics
   object, or a group named in its own `solidTag`, which then becomes an immovable wall to it.
   *Scene:* a hero (body, solid "ground") walks into a physics crate. If the crate's solidTag names the hero's
   group, the crate is shoved by an immovable hero and the hero walks on; if the hero's solidTag names the crate's
   group, the hero stops at the crate's box even when the crate has rolled onto a corner.
5. **One-way platforms are set at opposite ends.** `body.oneWay` is on the *mover* (it passes up through all of
   its solids); `physics.oneWay` is on the *platform*.
   *Scene:* the same jump-through ledge needs its setting on the player for a body player and on the ledge for a
   physics ball.
6. **Hidden objects.** `overlaps()` says hidden objects (and a screen-fixed object against a world one) never
   touch; `moveBody` already skips hidden solids; planck keeps hidden bodies in the world, so `physics.touches()`
   can say yes for a hidden one.
   *Scene:* a hidden physics trap door still stops a physics ball and still fires "ball touches door".
7. **No broadphase.** Every "touch" and "near" rule tests every pair of its two groups every step; every body
   looks through all objects for its solid group every step; bump separation tests all bumpers against all
   objects. Fine for 30 objects, slow for 500 (Phase 5).

## Three directions

1. **Everything on planck.** `body` becomes a planck character controller. One model in the strictest sense, but
   every platformer, runner and top-down game in Bazisaz was tuned on the arcade mover (jump arcs, coyote time,
   ramps, ladders, wall jumps); they would all feel different, and planck's slop means a standing hero sinks a
   little. High risk, months of retuning.
2. **One contact question, two movers (recommended).** Keep both movers (arcade feel and real physics are both
   wanted), but give the engine one module, `contacts.ts`, that every contact question goes through, with one
   definition of an object's shape and space, a spatial hash grid for the broadphase, and these fixes:
   - an object resting on another or pressed against it counts as touching it, whatever the inset (fixes 1);
   - a body that moves more than half its size in a step is swept, so it cannot pass through (fixes 3);
   - hidden objects never touch, for planck too (fixes 6);
   - touch, near and the body's search for solids use the grid (7).
   2, 4 and 5 stay as they are and are written down in the guide: changing them would change existing games.
3. **Only the broadphase.** Fast, but the disagreements stay.

## The choice

The owner was asleep and asked the agent to choose: **direction 2**. It changes nothing for objects that move
slower than half their size per step and do not use an inset, which is nearly every object in the ten games, and
the contact lab (`scripts/contact.smoke.mjs`) measures the five cases the roadmap names, each with its allowed
sinking, jitter or pass-through. If the owner prefers direction 1 later, the lab is the yardstick for it too.
