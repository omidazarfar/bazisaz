# Flagship Phase C report: how characters move (Spine, DragonBones, or our own bones)

Bazisaz animates characters two ways today: **frames** (pictures in turn: rest, run, jump, hurt, as Kenney's and
Aseprite's sheets give them) and **cut-out parts** (`attach` to a body, each part swinging with the `animate`
behavior's timeline about a pivot). What the cut-out way lacks is **nested bones**: a forearm attached to an upper
arm does not turn when the upper arm turns. And changing from one animation to another is a hard cut.

## The three choices

1. **Spine** (Esoteric Software). The industry standard for 2D skeletal animation: meshes, skins, IK, smooth
   mixing. Its runtimes are free to read, but the licence says that *anyone who uses a Spine runtime in a product
   must have a Spine Editor licence* (Essential about $69, Professional about $329 per user). Bazisaz is a tool
   other people make games with: every Bazisaz user who exports a game with Spine animation would need their own
   licence. That cannot be enforced from inside a no-code editor, and asking it of every user is against what
   Bazisaz is for. Spine files (.json/.skel + atlas) could still be *played* if a user owns Spine, but the editor
   could not make or change them.
2. **DragonBones** (Egret). Free and open (MIT), with its own editor. But the DragonBones editor has not been
   updated for years, its site is often down, its runtimes for PixiJS v8 are community forks, and few artists
   use it today. Building the flagship on it means building on something abandoned.
3. **Our own bones** (recommended). We already have attach + animate + pivots, the editor's timeline, and the
   "paper doll" part. What is missing is small and fully in our hands: (a) an attached part follows its parent's
   angle, so bones nest to any depth (shoulder → elbow → hand), each turning about its own joint on top of its
   parent's turn; (b) parts are moved after their parents, deepest last, so nothing trails a step behind; (c)
   smooth changes between frame animations (rest → run → jump) instead of a hard cut. No licence, works in the
   editor and the player, no new file format.

## The choice

The owner was asleep and asked the agent to decide what it thinks is right: **our own bones** (3). Spine stays
possible later as an *import* for users who own Spine, if the owner asks for it; nothing here prevents that.
Built in this phase: `attach.followAngle` (nested bones), parents before children however deep, and a short
cross-fade between a character's animations (`ImageVisual.blend`, seconds).
