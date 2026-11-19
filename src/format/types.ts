/**
 * The game data format, version 2.
 *
 * A game is plain data: the editor writes it, the runtime plays it, and the
 * export server packages it. Nothing in a project is code.
 *
 * Version 2 is a general engine rather than one kind of game. A game is a set
 * of scenes. A scene holds objects; objects get ready-made behaviors (fall,
 * jump, follow the finger, ...) and belong to groups; and rules of the form
 * "when this happens, do that" tie everything together. Numbers the game
 * keeps track of (score, lives) are variables.
 *
 * Units are design pixels; the runtime scales the design size to the screen.
 * The origin is the top-left corner and y grows downward.
 */

export const FORMAT_VERSION = 2;

export interface GameProject {
  formatVersion: typeof FORMAT_VERSION;
  meta: GameMeta;
  app: AppSettings;
  ads: AdSettings;
  /** Whether the built-in sound effects play. */
  sound: boolean;
  /** Images and sounds used by the game, keyed by asset id. */
  assets: Record<string, Asset>;
  variables: Variable[];
  scenes: Scene[];
  /** Id of the scene the game opens with. */
  startScene: string;
}

export interface GameMeta {
  /** Name shown to the player and used as the app name on export. */
  name: string;
  orientation: 'portrait' | 'landscape';
  /** Design size. The runtime letterboxes this to fit any screen. */
  width: number;
  height: number;
  /** Background color, as a CSS hex string such as "#8fd3f4". */
  background: string;
  fontFamily: string;
  /** How one scene gives way to the next: a quick fade through black (the default) or an instant cut. */
  transition?: 'fade' | 'none';
}

/** What Android needs to know about the game as an app. */
export interface AppSettings {
  /** Unique package name, such as "com.example.mygame". Cannot change after publishing. */
  appId: string;
  /** Must go up by one for every upload to Google Play. */
  versionCode: number;
  versionName: string;
  /** A square PNG as a data: URL, or null to keep the default icon. */
  icon: string | null;
}

export interface AdSettings {
  enabled: boolean;
  /** Shows Google's sample ads. Must stay on until the game uses its own ids. */
  testMode: boolean;
  /** AdMob app id (ca-app-pub-...~...). */
  appId: string;
  /** Whether a banner strip is shown along the bottom of the screen. */
  banner: boolean;
  /** Ad unit id for the banner. */
  bannerId: string;
  /** Ad unit id for full-screen ads shown by the "show ad" action. */
  interstitialId: string;
  /** Ad unit id for ads the player chooses to watch for a reward. */
  rewardedId: string;
}

export type Asset = ImageAsset | SoundAsset;

export interface ImageAsset {
  type: 'image';
  /** A URL or a data: URL. */
  src: string;
  /** Drawn in the editor's pixel painter on a grid of this many cells a side; drawn with hard edges, and can be painted again. */
  pixel?: number;
}

/** A sound effect or a piece of music the user added. */
export interface SoundAsset {
  type: 'sound';
  src: string;
  /** The file's name, shown in the editor's pick lists. */
  name: string;
}

/** Fonts a game's texts can be drawn in. All are bundled with the player. */
export const FONTS = ['Fredoka', 'Bangers', 'Press Start 2P'] as const;

/** A number the game keeps track of. Texts show it by writing {name}. */
export interface Variable {
  name: string;
  initial: number;
  /** Kept on the device between sessions, like a best score. */
  saved: boolean;
  /**
   * Makes this number a thing the player carries, such as a key or a potion:
   * the number is how many of it they have, and a bag (visual `bag`) shows it
   * with this picture. Everything that works with numbers works with it too.
   */
  item?: ItemLook;
}

export interface ItemLook {
  /** Id of the image asset the thing is shown with. */
  asset: string;
}

export interface Scene {
  id: string;
  name: string;
  /**
   * Size of the scene's world. Equal to the screen for a game that fits on one
   * screen; larger for a world the camera travels through.
   */
  width: number;
  height: number;
  /** Background color of this scene, or null to use the game's. */
  background: string | null;
  /** Id of a sound asset that loops while this scene is on, or null. Carries on unbroken into a scene with the same music. */
  music: string | null;
  /** Downward pull on objects with a body, in pixels per second squared. */
  gravity: number;
  /** Side of one cell of the scene's grid, for board games; 0 or absent means no grid. */
  cell?: number;
  /** How dark the scene is, 0 (not at all) to 1 (black): only objects with the light behavior light it up. */
  darkness?: number;
  /** A colour treatment of the whole picture, like a photo filter. */
  look?: Look;
  /** Darkens the corners of the screen, drawing the eye to the middle. */
  vignette?: boolean;
  /** A painted backdrop behind the game, in layers that move with depth as the camera moves; 'none' or absent for the plain background colour. */
  sky?: Sky;
  /** Bright things (fire, lights, sparkles, the sun) give off a soft glow over what is around them. Costs a little speed on a weak phone. */
  bloom?: boolean;
  /** Objects placed in the scene. Later objects draw on top of earlier ones. */
  objects: GameObject[];
  /** Objects that are not placed but can be created during play, by a spawner or a rule. */
  prefabs: GameObject[];
  rules: Rule[];
}

/**
 * How a smooth move runs: smooth (slow at both ends), linear (steady), in
 * (starts slow), out (ends slow), bounce (lands and bounces), elastic
 * (overshoots and wobbles into place), back (pulls back a little first).
 */
export const EASES = ['smooth', 'linear', 'in', 'out', 'bounce', 'elastic', 'back'] as const;
export type Ease = (typeof EASES)[number];

/** The painted backdrops a scene can have. */
export const SKIES = ['none', 'day', 'sunset', 'night', 'space', 'underwater', 'forest', 'desert', 'city', 'cave', 'snow'] as const;
export type Sky = (typeof SKIES)[number];

/** How the cells of a tile map are drawn: a plain colour, or a material with its own look (grass grows on cells with nothing above them). */
export const TILE_STYLES = ['flat', 'grass', 'dirt', 'stone', 'brick', 'wood', 'ice', 'metal', 'sand', 'snow'] as const;
export type TileStyle = (typeof TILE_STYLES)[number];

/** Colour treatments for a scene's whole picture. */
export const LOOKS = ['none', 'warm', 'cold', 'gray', 'old', 'night', 'dream', 'vivid'] as const;
export type Look = (typeof LOOKS)[number];

/** Music that comes with the engine, made by the player itself, so a game needs no music file. */
export const BUILTIN_MUSIC = ['music:happy', 'music:adventure', 'music:calm', 'music:tense', 'music:mystery'] as const;
export const isBuiltinMusic = (id: string | null | undefined): boolean => (BUILTIN_MUSIC as readonly string[]).includes(id ?? '');

export interface GameObject {
  id: string;
  /** Label shown in the editor's object list. Never shown to players. */
  name: string;
  /** Top-left corner for shapes and images; the anchor point for text. */
  x: number;
  y: number;
  /** Ignored for text, whose size comes from its content. */
  width: number;
  height: number;
  visual: Visual;
  /** Groups the object belongs to. Rules and behaviors refer to groups by name. */
  tags: string[];
  /** False for objects that start hidden until a rule shows them. Hidden objects touch nothing. */
  visible: boolean;
  /** Shrinks the collision box on every side, to make hits feel fair. */
  hitboxInset?: number;
  /**
   * Hits this object can take. Present only on objects that can be damaged;
   * the "damage" action lowers it and the "dead" trigger fires at zero.
   */
  health?: number;
  /**
   * A live copy of a template: the id of one of the scene's prefabs. Everything
   * but its place, size and name is the template's; the editor keeps them in
   * step, so changing one copy changes them all. The game itself ignores it.
   */
  template?: string;
  /** After losing health, this many seconds in which it cannot lose more; it blinks meanwhile. */
  invincible?: number;
  /** Shows a small health bar above it. */
  healthBar?: boolean;
  /** Treats the object as a circle when testing what it touches. Solid walls still stop it as a box. */
  round?: boolean;
  /** Turn, in degrees clockwise. What the object touches is tested against the turned shape; solid walls still stop it as an unturned box. */
  rotation?: number;
  /** Editor only: the object cannot be picked or moved by clicking in the scene, like a background that should stay put. */
  locked?: boolean;
  /** 1 is solid, 0 invisible. */
  opacity?: number;
  /**
   * Stays in place on the screen while the camera moves, like a score or an
   * on-screen button. Its x and y are screen positions, not world positions.
   */
  fixed?: boolean;
  /**
   * Scenery depth, for objects that are not fixed: 1 moves with the world, 0.5
   * drifts at half the camera's speed like distant hills. Looks only; what the
   * object touches is still judged from where it was placed.
   */
  parallax?: number;
  /** Numbers that belong to this object alone, by name: a card's kind, whether a switch is on. Rules read and change them. */
  values?: Record<string, number>;
  /**
   * Makes a solid object a ramp that bodies walk up and down: a right-angled
   * triangle filling the object's box. rise: low on the left, high on the right.
   * fall: high on the left, low on the right.
   */
  slope?: 'rise' | 'fall';
  /** A soft shadow under and behind the object, lifting it off the background. */
  shadow?: boolean;
  /** A glow of this colour around the object, for magic things, power-ups and lights; null or absent for none. */
  glow?: string | null;
  behaviors: Behavior[];
}

export type Visual = RectVisual | EllipseVisual | ImageVisual | TextVisual | BarVisual | TilesVisual | BagVisual;

/**
 * The player's bag: a row of places, each showing one thing they carry (a
 * variable with `item`) with its picture and, above one, how many. Things fill
 * the places in the order they were picked up. Laid out across the object if
 * it is wider than tall, otherwise down it. Tapping a thing fires `useItem`.
 */
export interface BagVisual {
  kind: 'bag';
  /** How many places it has; things beyond them wait until one is free. */
  slots: number;
}

/**
 * A level painted on a grid, like a tilemap. Each filled cell becomes a solid
 * block during play; side-by-side cells of one kind are joined into one long
 * block so that a big level stays light on a weak phone. The object's width
 * and height are the grid's: columns × cell and rows × cell.
 */
export interface TilesVisual {
  kind: 'tiles';
  /** Side of one cell, in pixels. */
  cell: number;
  /** One string per row, top to bottom. Each character is a key of `kinds`; "." is an empty cell. */
  rows: string[];
  /** What each character paints, keyed by that one character. */
  kinds: Record<string, TileKind>;
}

export interface TileKind {
  /** Shown in the editor only. */
  name: string;
  color: string;
  /** A picture drawn in each cell instead of the colour. */
  asset?: string;
  /** Groups every cell of this kind belongs to, on top of the map's own groups. */
  tags: string[];
  /** Each cell stays an object of its own, for coins or bricks that are taken away one at a time. */
  separate?: boolean;
  /** Each cell is a ramp. Ramps are always separate. */
  slope?: 'rise' | 'fall';
  /** What the cells are made of, drawn with texture and light; 'flat' or absent for the plain colour. */
  style?: TileStyle;
}

/** The character that marks an empty cell of a tile map. */
export const EMPTY_TILE = '.';

/** A bar that fills in proportion to a variable, such as health or progress. The object's size is the full bar. */
export interface BarVisual {
  kind: 'bar';
  variable: string;
  /** The value at which the bar is full. */
  max: number;
  color: string;
  /** Color of the empty part. */
  back: string;
}

export interface RectVisual {
  kind: 'rect';
  color: string;
  radius?: number;
  /** Lit from above: lighter at the top, darker at the bottom, with a soft shine, so it looks solid instead of flat. */
  shade?: boolean;
  /** A line around it in this colour; null or absent for none. */
  outline?: string | null;
}

export interface EllipseVisual {
  kind: 'ellipse';
  color: string;
  shade?: boolean;
  outline?: string | null;
}

export interface ImageVisual {
  kind: 'image';
  /** Key into GameProject.assets. */
  asset: string;
  /** More images shown in turn after `asset`, making an animation. All should be the same size. */
  frames?: string[];
  /** Animation speed, in images per second. */
  fps?: number;
  /** Pictures shown instead while the object is moving sideways, such as a run cycle. */
  moveFrames?: string[];
  /** Pictures shown instead while an object with a body is off the ground, such as a jump pose. */
  airFrames?: string[];
  /** Mirrors the picture when the object moves left, so a character drawn facing right always faces where it is going. */
  flip?: boolean;
  /** Instead of animating, shows the picture whose number is this value of the object: 0 the first, 1 the next. A card shows its back at 0 and its face at 1. */
  frameBy?: string;
  /** Plays the animation through once and holds its last picture, like an explosion. */
  once?: boolean;
  /** Repeats the picture to fill the object instead of stretching it: sideways (fitted to the height) or downward (fitted to the width). */
  repeat?: 'x' | 'y';
}

export interface TextVisual {
  kind: 'text';
  /** May contain {variable} names, replaced with their values while the game runs. */
  text: string;
  color: string;
  size: number;
  weight?: 'normal' | 'bold';
  /** Which point of the text sits at the object's x: its start, middle or end. */
  align?: 'left' | 'center' | 'right';
  /** Color of a line drawn around the letters, so text stays readable over any background; null for none. */
  outline?: string | null;
  /** A soft shadow under the letters. */
  shadow?: boolean;
}

// ── Behaviors ──────────────────────────────────────────────────────────────

export type Behavior =
  | BodyBehavior
  | JumperBehavior
  | WalkerBehavior
  | FollowFingerBehavior
  | MoverBehavior
  | PatrolBehavior
  | ChaseBehavior
  | RotateBehavior
  | DraggableBehavior
  | LifetimeBehavior
  | SpawnerBehavior
  | CameraBehavior
  | LaunchBehavior
  | WaveBehavior
  | AttachBehavior
  | BlinkBehavior
  | ScrollImageBehavior
  | PulseBehavior
  | TrailBehavior
  | SteerBehavior
  | RouteBehavior
  | PhysicsBehavior
  | JointBehavior
  | ParticlesBehavior
  | LightBehavior
  | FieldBehavior;

/**
 * A steady stream of small particles coming from the object: fire and smoke
 * rise from it, rain and snow fall from across its whole width, sparkles
 * twinkle over it, bubbles drift up, confetti bursts out. Looks only: nothing
 * can touch them.
 */
export interface ParticlesBehavior {
  type: 'particles';
  preset: 'fire' | 'smoke' | 'rain' | 'snow' | 'sparkle' | 'bubbles' | 'confetti';
  color: string;
  /** Particles per second. */
  rate: number;
  /** Size of one particle, in pixels. */
  size: number;
  /** 1 is the stream's own speed, 2 twice as fast. */
  speed: number;
}

/** Lights up a circle around the object when the scene is dark (`Scene.darkness`), optionally in a colour and flickering like a flame. */
export interface LightBehavior {
  type: 'light';
  /** How far the light reaches, in pixels. */
  radius: number;
  color: string;
  flicker: boolean;
}

/**
 * Real physics, worked out by a rigid-body engine: the object falls, tumbles,
 * rolls, stacks on others and knocks them over, and is met by its true shape
 * (a box, a circle, a ramp's triangle, turned however it is turned). Every
 * object with physics meets every other; objects without it are met only if
 * they are in `solidTag`, and then they stand firm like walls.
 */
export interface PhysicsBehavior {
  type: 'physics';
  /** moving: gravity and knocks move it. still: it never moves by itself (a floor, a wall, a spinning bar); rules and other behaviors may still move it, and it shoves what it meets. */
  kind: 'moving' | 'still';
  /** Also meets the objects of this group that have no physics of their own, such as the ground or a tile map. Empty for none. */
  solidTag: string;
  /** 0 lands dead, 1 bounces back as high as it came from. */
  bounce: number;
  /** 0 slides like ice, 1 grips like rubber. */
  friction: number;
  /** How heavy it is for its size: 1 is ordinary, more pushes others harder and is harder to push. */
  weight: number;
  /** Whether it may tip over and turn. Off keeps it upright, for a character. */
  rotates: boolean;
  /** Whether the scene's gravity pulls on it. Off is space, or a table seen from above. */
  gravity?: boolean;
  /** How quickly it slows down by itself in the air (or on a table seen from above), 0 to 1. */
  slowdown?: number;
  /** The edges of the world are walls to it. */
  edges?: boolean;
  /**
   * What a finger can do to it. grab: pick it up and carry it, as if on a
   * string. sling: pull it back and let go to throw it, the further the
   * pull the harder the throw; it can be thrown again once it has stopped.
   */
  drag?: 'none' | 'grab' | 'sling';
  /** With `sling`: how hard a full pull throws it. */
  power?: number;
  /**
   * With `sling`: it waits in the air where it was placed until thrown, and
   * comes back there to be thrown again once it has stopped or left the world.
   * Off, it falls where it was put and can be pulled again wherever it stops.
   */
  reload?: boolean;
  /** A still object only: what rests on it is carried along its top at this speed, like a conveyor belt; negative is to the left. Pixels per second. */
  surfaceSpeed?: number;
  /** A still object only: moving things pass up through it from below and land on it from above, like a jump-through platform. */
  oneWay?: boolean;
}

/**
 * Pushes objects with real physics while they are inside this object's area.
 * wind: in one direction, like wind or a fan. water: holds them up, so light
 * things float and heavy ones sink, and slows them down. magnet: pulls them
 * toward its middle (a negative strength pushes them away).
 */
export interface FieldBehavior {
  type: 'field';
  kind: 'wind' | 'water' | 'magnet';
  /** Wind: the way it blows, in degrees: 0 right, 90 down, -90 up, 180 left. */
  direction: number;
  /** Wind and magnet: how hard, in pixels per second squared. Water: how strongly it holds things up; 1 floats things of ordinary weight. */
  strength: number;
}

/**
 * Joins an object with physics to the nearest object of a group, which is
 * given physics of its own (as a still one) if it has none.
 * hinge: they share one point and each can turn about it, like a wheel or a door.
 * rope: they can come together but never get further apart than they started.
 * spring: they are pulled back to the distance they started at, with a bounce.
 * weld: they stay stuck together as one.
 */
export interface JointBehavior {
  type: 'joint';
  /**
   * Besides the four above: slider: it slides along a straight line through
   * its middle and nothing else, like a lift or a piston. wheel: a wheel on a
   * springy axle, which turns freely and gives a little over bumps.
   */
  kind: 'hinge' | 'rope' | 'spring' | 'weld' | 'slider' | 'wheel';
  targetTag: string;
  /** Where a hinge's or weld's pin is: the middle of this object (a wheel), of the other (a pendulum on a nail), or halfway between (the links of a chain or a bridge). */
  at: 'self' | 'other' | 'between';
  /** Hinge and wheel: turns this object by itself, in degrees per second. Slider: moves it along its line, in pixels per second. 0 for none. */
  motor?: number;
  /** Hinge only: how far it may turn each way from where it started, in degrees, like a door that opens only so far. 0 for no limit. */
  limit?: number;
  /** Slider only: the direction of its line, in degrees: 0 left and right, 90 up and down. */
  axis?: number;
  /** Slider only: how far it may go each way, in pixels; with a motor it goes back and forth between the two ends. 0 for no limit. */
  range?: number;
  /** How much it can hold before it snaps, in times this object's own weight; 0 never snaps. */
  strength?: number;
}

/** Gives the object weight and makes it stop at objects of one group. */
export interface BodyBehavior {
  type: 'body';
  /** Whether the scene's gravity pulls it down. */
  gravity: boolean;
  /** The group it cannot pass through; empty for none. */
  solidTag: string;
  /** 0 stops dead on impact, 1 bounces back at full speed. */
  bounce: number;
  /** What the edges of the world do: nothing, act as walls, bounce it back like a ball, or let it out one side and in the other. */
  edges: 'none' | 'stop' | 'bounce' | 'wrap';
  /** Passes up through its solid group from below and only lands on it from above, like a jump-through platform. */
  oneWay: boolean;
  /**
   * How quickly it slows down by itself, 0 to 1: on the ground for an object
   * with gravity, always for one without (seen from above). Not felt while the
   * player is steering it.
   */
  friction?: number;
  /** Others with a body that cannot pass through it push it along, like a crate, if there is room behind it. */
  pushable?: boolean;
  /** Turns as it moves sideways, like a rolling ball. Best with "round". */
  roll?: boolean;
}

/** Jumps. Needs a body, or it would never come down. */
export interface JumperBehavior {
  type: 'jumper';
  jumpSpeed: number;
  /** 1 for a single jump, 2 to allow a double jump. */
  maxJumps: number;
  /** tap: any touch on the screen. button: a touch on an object of `buttonTag`. none: only a rule makes it jump. */
  on: 'tap' | 'button' | 'none';
  buttonTag: string;
  /** Letting go early cuts the jump short, so a quick touch is a hop and a held one a full jump. */
  variable?: boolean;
}

/** Moves left and right. */
export interface WalkerBehavior {
  type: 'walker';
  speed: number;
  /** halves: hold the left or right half of the screen. buttons: hold objects of the two groups. auto: always moves right. */
  control: 'halves' | 'buttons' | 'auto';
  leftTag: string;
  rightTag: string;
  /** Seconds to reach full speed and to stop; 0 or absent is instant. */
  ease?: number;
}

/** Moves toward wherever the player's finger is. */
export interface FollowFingerBehavior {
  type: 'followFinger';
  speed: number;
  axis: 'both' | 'x' | 'y';
}

/** Moves at a steady speed, like a bullet, a falling item or scrolling scenery. */
export interface MoverBehavior {
  type: 'mover';
  /** Pixels per second; negative is left or up. */
  vx: number;
  vy: number;
  /** Name of a variable to multiply the speed by, or empty. Lets a whole game speed up together. */
  speedVariable: string;
  /** What happens when it has left the screen. */
  atEdge: 'nothing' | 'remove' | 'wrap';
}

/** Moves back and forth around where it was placed. */
export interface PatrolBehavior {
  type: 'patrol';
  axis: 'x' | 'y';
  distance: number;
  speed: number;
}

/** Moves toward the nearest object of a group. */
export interface ChaseBehavior {
  type: 'chase';
  targetTag: string;
  speed: number;
  /** Follows in both directions, or only sideways, or only up and down (like the other bat in a tennis game). */
  axis?: 'both' | 'x' | 'y';
  /** Only notices the target within this distance, in pixels; 0 or absent is any distance. */
  range?: number;
  /** Runs away from the target instead of toward it. */
  away?: boolean;
  /** Finds a way around the objects of this group (walls) instead of heading straight at the target; empty for straight. */
  avoidTag?: string;
}

/** Moves in any direction under the player's control, for games seen from above. With a body, walls stop it. */
export interface SteerBehavior {
  type: 'steer';
  speed: number;
  /**
   * stick: a finger dragged anywhere steers, like a joystick that appears where it lands.
   * buttons: holding objects of the four groups. swipe: a swipe sets the way, and it keeps going that way.
   */
  control: 'stick' | 'buttons' | 'swipe';
  upTag: string;
  downTag: string;
  leftTag: string;
  rightTag: string;
  /** Turns the object to point the way it is going. */
  face: boolean;
}

/** Travels from one marker object to the next: every object of a group, in the order of their names. */
export interface RouteBehavior {
  type: 'route';
  tag: string;
  speed: number;
  /** At the last marker: start again from the first, go back the way it came, or stay there. */
  end: 'loop' | 'back' | 'stop';
}

/** Spins around its center. Looks only; the collision box does not turn. */
export interface RotateBehavior {
  type: 'rotate';
  /** Degrees per second. */
  speed: number;
}

/** Can be dragged around with a finger. */
export interface DraggableBehavior {
  type: 'draggable';
}

/** Disappears on its own after a while. */
export interface LifetimeBehavior {
  type: 'lifetime';
  seconds: number;
}

/**
 * Creates prefabs at random intervals. A new object's left edge is at the
 * spawner's x and its bottom edge at the spawner's y, each shifted by a
 * random amount up to `spreadX` and `spreadY`.
 */
export interface SpawnerBehavior {
  type: 'spawner';
  /** Ids of prefabs to pick from at random. */
  prefabs: string[];
  minInterval: number;
  maxInterval: number;
  spreadX: number;
  spreadY: number;
  /**
   * If above zero, a new object is created each time the camera has travelled
   * this many pixels, instead of on a timer. With the spawner fixed to the
   * screen, this fills a world endlessly as the player moves through it.
   */
  everyDistance: number;
}

/** The camera keeps this object in the middle of the screen, within the scene's world. */
export interface CameraBehavior {
  type: 'camera';
  /** up: the view only ever climbs, so falling behind it means falling out of the game. right: likewise, sideways. */
  lock: 'free' | 'up' | 'right';
  /** 0 or absent keeps the object dead centre; up to 1 lets the view trail behind and catch up softly. */
  smooth?: number;
  /**
   * Rooms: the view stays inside the object of this group that the followed
   * object is in (usually hidden boxes, one per room), and moves on to the
   * next room when it goes there. Empty or absent: the whole world.
   */
  roomTag?: string;
}

/** Grows and shrinks gently, to draw the eye to a button or a prize. */
export interface PulseBehavior {
  type: 'pulse';
  /** How much bigger it gets: 0.2 is a fifth larger. */
  amount: number;
  seconds: number;
}

/** Starts moving the moment it appears, like a ball being served. Works with a body. */
export interface LaunchBehavior {
  type: 'launch';
  vx: number;
  vy: number;
  /** fixed: the speeds above. tap: toward where the screen was last touched. group: toward the nearest object of `targetTag`. */
  toward?: 'fixed' | 'tap' | 'group';
  targetTag?: string;
  /** Speed used when aiming at a touch or a group. */
  speed?: number;
  /** Turns the object to point the way it is going, like an arrow. */
  face?: boolean;
}

/** Leaves a fading trail of dots behind it, like rocket smoke. Looks only. */
export interface TrailBehavior {
  type: 'trail';
  color: string;
  /** Diameter of each dot. */
  size: number;
  /** Dots per second. */
  rate: number;
}

/** Sways smoothly from side to side (or up and down) on top of any other movement. */
export interface WaveBehavior {
  type: 'wave';
  axis: 'x' | 'y';
  /** How far it sways to each side. */
  distance: number;
  /** Time for one full sway. */
  seconds: number;
}

/** Stays stuck to the nearest object of a group, at a fixed offset: a health bar, a hat, a weapon. */
export interface AttachBehavior {
  type: 'attach';
  targetTag: string;
  offsetX: number;
  offsetY: number;
}

/** Fades in and out. */
export interface BlinkBehavior {
  type: 'blink';
  /** Time for one fade out and back. */
  seconds: number;
}

/** The object's picture repeats to fill it and slides steadily, for moving ground or sky. Needs an image. */
export interface ScrollImageBehavior {
  type: 'scrollImage';
  vx: number;
  vy: number;
}

// ── Rules ──────────────────────────────────────────────────────────────────

/** Every action a rule can do, whether its conditions hold or not. */
export const ruleActions = (rule: Rule): Action[] => (rule.otherwise ? [...rule.then, ...rule.otherwise] : rule.then);

/** "When `when` happens (and `condition` holds), do every action in `then`." */
export interface Rule {
  id: string;
  when: Trigger;
  condition: Condition | null;
  /** Further conditions; the rule runs only if every one holds. */
  also?: Condition[];
  then: Action[];
  /** Done instead of `then` when the trigger happened but a condition did not hold. */
  otherwise?: Action[];
}

/** One object by id, or every object of a group. */
export type Comparison = '>=' | '<=' | '==' | '!=' | '>' | '<';

/** A test on one of an object's own values, e.g. "open is 1". A value the object does not have counts as 0. */
export interface ValueCheck {
  name: string;
  op: Comparison;
  value: number;
}

/**
 * One object by id, or the objects of a group. A group can be narrowed to the
 * members that pass a test on their own values, and to one member picked at random.
 */
export type Ref = { by: 'id'; id: string } | { by: 'tag'; tag: string; where?: ValueCheck; spot?: Spot; pick?: 'random' };

/**
 * A test on where an object is: still (or no longer) where the scene placed
 * it, or overlapping (or not) some object of the group `tag`.
 */
export interface Spot {
  is: 'home' | 'away' | 'on' | 'off';
  tag?: string;
}

export type Trigger =
  | { type: 'start' }
  | { type: 'tap' }
  | { type: 'tapObject'; target: Ref }
  /** Fires once when an object of `a` starts touching an object of `b`. */
  | { type: 'touch'; a: Ref; b: Ref }
  | { type: 'every'; seconds: number }
  /** Fires once, `seconds` after the scene starts. */
  | { type: 'after'; seconds: number }
  /** Fires when an object that was on screen has completely left it. */
  | { type: 'offscreen'; target: Ref }
  /** Fires at the moment the comparison becomes true. */
  | { type: 'variable'; name: string; op: Comparison; value: number }
  /** Fires when a finger slides across the screen in a direction. */
  | { type: 'swipe'; direction: 'left' | 'right' | 'up' | 'down' }
  /** Fires on every frame while the screen is being touched. */
  | { type: 'holding' }
  /** Fires at the moment the last object of a group is gone. */
  | { type: 'noneLeft'; target: Ref }
  /** Fires when an object's health has been brought to zero. That object is "first". */
  | { type: 'dead'; target: Ref }
  /** Fires when the player has finished watching a rewarded ad. */
  | { type: 'reward' }
  /** Fires when an object with a body comes down onto something. It is "first"; what it landed on, if that was an object, is "second". */
  | { type: 'land'; target: Ref }
  /** Fires for an object when one of its own values comes to pass the test. That object is "first". */
  | { type: 'value'; target: Ref; name: string; op: Comparison; value: number }
  /**
   * Fires when `length` or more objects of a group stand side by side in a
   * straight line with the same value of `name` (other than 0), once for each
   * object in the line; that object is "first". With an empty `name`, being
   * side by side is enough.
   */
  | { type: 'line'; target: Ref; name: string; length: number; diagonal: boolean }
  /**
   * Fires once when an object of `a` comes within `distance` of an object of
   * `b`, centre to centre; with `leave`, when it goes farther away than that
   * instead. `a`'s object is "first", `b`'s "second".
   */
  | { type: 'near'; a: Ref; b: Ref; distance: number; leave?: boolean }
  /** Every `seconds`, for each object of a group on its own clock, counted from when that object appeared. That object is "first". */
  | { type: 'eachEvery'; target: Ref; seconds: number }
  /**
   * Fires when an object with physics crashes into another at `speed` pixels
   * per second or more, measured head-on. A gentle touch, or resting on it,
   * does not count. `a`'s object is "first", `b`'s "second".
   */
  | { type: 'hit'; a: Ref; b: Ref; speed: number }
  /**
   * Fires when a rule of the scene sends this message (action `send`), a
   * moment after it was sent. "first" and "second" are those of the rule that
   * sent it. Lets one set of actions be written once and used from many rules.
   */
  | { type: 'message'; name: string }
  /** Fires when an object is let go from a sling with some speed. That object is "first". */
  | { type: 'thrown'; target: Ref }
  /** Fires when a joint of an object snaps under too much pull, or is cut. The object with the joint is "first", what it was joined to "second". */
  | { type: 'snap'; target: Ref }
  /** Fires when an object with real physics that was moving has come to a stop. That object is "first". */
  | { type: 'rest'; target: Ref }
  /** Fires when the player taps a thing they carry in a bag, to use it. The bag is "first". */
  | { type: 'useItem'; item: string }
  /**
   * Fires when the player drags a thing out of the bag and lets go of it over
   * an object of `target`, like a key onto a door. That object is "first".
   * Let go anywhere else, the thing flies back into the bag.
   */
  | { type: 'useItemOn'; item: string; target: Ref };

export interface Condition {
  name: string;
  op: Comparison;
  /** A number, another variable, or a random number rolled each time. */
  value: Amount;
  /** Whose value `name` is. Absent: `name` is one of the game's variables. */
  of?: Target;
}

/**
 * Which object an action applies to. "first" and "second" are the objects
 * the trigger was about: the two that touched, or the one that was tapped or
 * left the screen (first).
 */
export type Target = 'first' | 'second' | Ref;

/** A fixed number, the current value of a variable, or a whole number picked at random between two limits. */
/** A number, a variable's value, a random whole number in a range, or how many objects of a group there are right now. */
export type Amount =
  | number
  | { variable: string }
  | { random: [number, number] }
  | { count: string; where?: ValueCheck }
  /** One of an object's own values. */
  | { value: string; of: Target };

/** Where something is created: on an object, or where the screen was last touched. */
export type Place = Target | 'tap';

export type Action =
  /** set, add, subtract, multiply or divide; "max" keeps the larger of the old value and the amount (a best score). Dividing by zero changes nothing. */
  | { type: 'setVariable'; name: string; op: 'set' | 'add' | 'subtract' | 'max' | 'multiply' | 'divide'; amount: Amount }
  /** Paints a shape or text in another colour, or tints a picture. */
  | { type: 'setColor'; target: Target; color: string }
  /** Shows another picture: the id of an image asset. Any animation stops. */
  | { type: 'setImage'; target: Target; asset: string }
  /** Changes what a text says; {variable} names work as in the editor. */
  | { type: 'setText'; target: Target; text: string }
  /** Changes an object's size, and so the room it takes up, keeping its middle where it is. */
  | { type: 'resize'; target: Target; width: number; height: number }
  /** Turns an object to an angle, or by an angle, in degrees clockwise. */
  | { type: 'turn'; target: Target; op: 'set' | 'add'; degrees: number }
  /** 1 is solid, 0 invisible (but still there). */
  | { type: 'setOpacity'; target: Target; opacity: number }
  /** The object glows in a colour for a moment and fades back, as when it is hit. */
  | { type: 'flash'; target: Target; color: string; seconds: number }
  /** Draws an object in front of, or behind, everything else in its layer. */
  | { type: 'layer'; target: Target; to: 'front' | 'back' }
  /** Starts a sound asset looping as music in place of the scene's own; an empty `music` stops the music. */
  | { type: 'playMusic'; music: string }
  /** Zooms the camera smoothly: 2 shows everything twice as big, 0.5 shows twice as much of the world. */
  | { type: 'zoom'; amount: number; seconds: number }
  /** Puts every variable that is not saved back to its starting value. */
  | { type: 'resetVariables' }
  | { type: 'destroy'; target: Target }
  /** Creates a prefab at the position of another object. */
  /** With `ahead`, it appears just in front of the object, on the side it faces, and faces the same way: a sword's swing, a shot. */
  | { type: 'spawn'; prefab: string; at: Place; ahead?: boolean }
  | { type: 'show'; target: Target }
  | { type: 'hide'; target: Target }
  | { type: 'moveTo'; target: Target; x: number; y: number }
  /** Moves an object by a distance from where it is now. */
  | { type: 'moveBy'; target: Target; dx: number; dy: number }
  /** Moves an object to a random place on the screen. */
  | { type: 'moveRandom'; target: Target }
  /** Pauses this rule: the actions after it run `seconds` later. */
  | { type: 'wait'; seconds: number }
  /** Gives a push: sets the speed of an object with a body, in pixels per second. */
  | { type: 'push'; target: Target; vx: number; vy: number }
  /** Adds to an object's speed (where "push" replaces it), in pixels per second: a kick, a gust, a shove. */
  | { type: 'kick'; target: Target; vx: number; vy: number }
  /** Sets how fast an object with real physics turns, in degrees per second; negative turns the other way. */
  | { type: 'spin'; target: Target; speed: number }
  /** Cuts every joint of an object, as if the rope were cut or the bolt came out. */
  | { type: 'cut'; target: Target }
  /** Makes an object with real physics fall and tumble (moving) or hold firm where it is (still): a bridge giving way, a crate frozen in place. */
  | { type: 'setPhysics'; target: Target; kind: 'moving' | 'still' }
  /** Throws every object with physics within `radius` of a place away from it, harder the closer it is, like a bomb. */
  | { type: 'blast'; at: Target; strength: number; radius: number }
  | { type: 'jump'; target: Target }
  /**
   * With `arriveAt`, a door into a room: in the new scene, the objects of group
   * `bring` (the player, "بازیکن", if empty) are put at the first object of
   * group `arriveAt`, standing on its bottom edge.
   */
  | { type: 'goToScene'; scene: string; arriveAt?: string; bring?: string }
  /** Goes to the scene after this one in the game's list of scenes; after the last, to the first. */
  | { type: 'nextScene' }
  /** Sends a message to the rules of the scene that wait for it (trigger `message`). */
  | { type: 'send'; name: string }
  | { type: 'restartScene' }
  /** `sound` is one of the built-in SOUND_NAMES or the id of a sound asset. */
  | { type: 'playSound'; sound: string }
  /** A puff of small pieces flying out from an object and fading. */
  | { type: 'burst'; target: Target; color: string; count: number }
  /** Shakes the whole screen for a moment. */
  | { type: 'shake'; strength: number }
  /**
   * A short, smooth change of looks. pop: swells and settles. grow: appears
   * from nothing. shrink: dwindles away and is removed. fadeIn / fadeOut:
   * appears or disappears gradually.
   */
  | { type: 'effect'; target: Target; kind: 'pop' | 'grow' | 'shrink' | 'fadeIn' | 'fadeOut'; seconds: number }
  /** Moves an object smoothly to a point; `ease` is how it speeds up and slows down (smooth if absent). */
  | { type: 'glide'; target: Target; x: number; y: number; seconds: number; ease?: Ease }
  /** Changes the colour treatment of the whole picture for the rest of the scene. */
  | { type: 'setLook'; look: Look }
  /** Makes the scene darker or lighter over `seconds`, for nightfall or a light switch. */
  | { type: 'setDarkness'; amount: number; seconds: number }
  /** Takes hits off an object that has health. */
  /** With `push`, the object is also knocked away from the other object of the rule at that speed. */
  | { type: 'damage'; target: Target; amount: number; push?: number }
  /** Freezes the game. Only taps still act, so a rule can resume it. */
  | { type: 'pause' }
  | { type: 'resume' }
  /** Offers a rewarded ad; the "reward" trigger fires if the player watches it through. */
  | { type: 'showRewardedAd' }
  /** Turns all sound and music on or off for the rest of the session. */
  | { type: 'setSound'; on: boolean }
  /** Buzzes the phone briefly. Does nothing where there is no vibration motor. */
  | { type: 'vibrate'; ms: number }
  /** Changes the pull of gravity for the rest of the scene; a negative number makes things fall upward. */
  | { type: 'setGravity'; amount: number }
  /** Changes one of an object's own values. */
  | { type: 'setValue'; target: Target; name: string; op: 'set' | 'add' | 'subtract' | 'multiply'; amount: Amount }
  /** Makes the objects swap places among themselves at random, like shuffling cards on a table. */
  | { type: 'shuffle'; target: Ref }
  /** Makes two objects change places. With `near`, only if they are side by side on the grid. */
  /**
   * With `match` of 2 or more, the swap happens only if it puts one of the two
   * into a line of that many objects of its group sharing the value `matchBy`;
   * otherwise both stay where they were.
   */
  | { type: 'swap'; target: Target; other: Target; near: boolean; match?: number; matchBy?: string }
  /**
   * For a board of pieces that lost some: the pieces of the group drop down
   * their columns to close the gaps, and each column is topped up with new
   * pieces made from `prefabs`, picked at random. The board is the area the
   * group's objects cover in the scene as it was built.
   */
  | { type: 'settle'; target: Ref; prefabs: string[] }
  /**
   * Every piece of a group slides as far as it can in one direction across the
   * board (the cells covered by the objects of `boardTag`). Two pieces that
   * meet with the same value of `mergeBy` become one, whose value goes up by
   * one. If anything moved, a new piece made from `prefab` appears on a free
   * cell. This is the move of the game 2048.
   */
  | { type: 'slideAll'; target: Ref; direction: 'left' | 'right' | 'up' | 'down'; boardTag: string; mergeBy: string; prefab: string }
  /**
   * Moves an object one cell over, unless an object of `blockTag` is in the way
   * or the cell is outside the world. An object of `pushTag` in the way is
   * pushed one cell on, if the cell beyond it is free.
   */
  | { type: 'step'; target: Target; direction: 'left' | 'right' | 'up' | 'down'; blockTag: string; pushTag: string }
  /** Shows a full-screen ad, if ads are on. */
  | { type: 'showAd' }
  /**
   * Puts things into the player's bag (adds to the item's count). With `from`,
   * their picture flies from that object into its place in the bag.
   */
  | { type: 'give'; item: string; amount: number; from?: Target }
  /** Takes things out of the player's bag; never fewer than none are left. */
  | { type: 'take'; item: string; amount: number }
  /** Remembers where an object is now as the place it comes back to, like touching a checkpoint flag. */
  | { type: 'checkpoint'; target: Target }
  /** Puts an object back at its last checkpoint (or where the scene placed it), standing still. */
  | { type: 'respawn'; target: Target }
  /** Keeps the player's progress on the device: the scene they are in and every value. */
  | { type: 'saveGame' }
  /** Goes back to the saved progress, if there is any; otherwise goes to `scene`, as for a new game. */
  | { type: 'loadGame'; scene: string };

export const SOUND_NAMES = ['jump', 'coin', 'hit', 'win', 'lose', 'click', 'pop', 'laser', 'boom', 'powerup', 'bounce', 'tick'] as const;
export type SoundName = (typeof SOUND_NAMES)[number];
