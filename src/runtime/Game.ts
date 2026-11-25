import { Application, ColorMatrixFilter, Container, CullerPlugin, extensions, FillGradient, Graphics, Matrix, Rectangle, RenderTexture, Sprite, Text, Texture, TilingSprite, type Filter } from 'pixi.js';
import { AdvancedBloomFilter, CRTFilter, DropShadowFilter, GlowFilter, OldFilmFilter, PixelateFilter, ShockwaveFilter } from 'pixi-filters';
import type {
  Action,
  Amount,
  BodyBehavior,
  ChaseBehavior,
  Comparison,
  Condition,
  Ease,
  GameObject,
  GameProject,
  AnimateBehavior,
  HomingBehavior,
  JointBehavior,
  JumperBehavior,
  Look,
  MoverBehavior,
  MovesBehavior,
  SteerBehavior,
  WalkerBehavior,
  ParticlesBehavior,
  PhysicsBehavior,
  Ref,
  Rule,
  Scene,
  Target,
  TilesVisual,
  TileStyle,
} from '../format/types';
import { ANIMATED_TILE_STYLES, EMPTY_TILE, isBuiltinMusic, MATERIALS } from '../format/types';
import { bagSlots, drawBag, slotAt } from './bag';
import { builtinMusic } from './music';
import { advanceParticle, spawnParticle, type Particle } from './particleView';
import { shadeOf } from './color';
import { SkyView } from './sky';
import { tileTexture, type OpenSides } from './tiles';
import { validateProject } from '../format/validate';
import { FALLBACK_FONT } from './fonts';
import { feel, Physics } from './physics';
import { traceOutline } from './outline';
import { lightPolygon } from './shadows';
import { localTime, poseAt, type Pose } from './animate';
import { WeatherView } from './weather';
import { pauseMusic, playEffect, preloadClip, resumeMusic, setMusic } from './sound';
import { applyDirection, fillTemplate } from './text';
import { clamp } from './math';
import { contains, cornersOf, terrainTop, test } from './geometry';
import { Contacts } from './contacts';
import { SHAKE_SECONDS, STICK_REACH, TAP_GRACE } from './constants';
import { actionBlocks, behaviorBlocks, triggerBlocks } from '../blocks/registry';
import type { BehaviorStep, TriggerStep } from '../blocks/types';

// Objects far outside the view are not drawn at all, which keeps a big level light on a weak phone.
extensions.add(CullerPlugin);

/**
 * play: the real game.
 * edit: a frozen picture of one scene, for the editor. Nothing moves; a click
 * selects an object, a drag moves it, its corner handles resize it, and a
 * drag over empty space selects everything it covers. The view can be zoomed
 * out to see a whole world and slid around with the wheel or the hand tool.
 */
export type GameMode = { kind: 'play'; scene?: string } | { kind: 'edit'; scene: string };

/** How the frozen scene is being looked at and handled in edit mode. */
export interface EditView {
  /** 1 shows the scene at the size the player sees it; less shows more of the world. */
  zoom: number;
  /** What a drag on empty space does: select what it covers, or slide the view. paint: paints the cells of the selected tile map. */
  tool: 'select' | 'hand' | 'paint';
  /** Objects snap to multiples of this many pixels; 0 snaps to other objects instead. */
  grid: number;
  /** With the paint tool, the kind of cell painted: a key of the map's kinds, or "." to rub cells out. */
  brush?: string;
}

export interface GameOptions {
  mode?: GameMode;
  /** Edit mode: called with the id of the clicked object, or null for empty space. `add` means Shift was held: add it to, or take it out of, the selection. */
  onPick?: (id: string | null, add: boolean) => void;
  /** Edit mode: called when a drag over empty space ends, with everything it covered. */
  onPickMany?: (ids: string[], add: boolean) => void;
  /** Edit mode: called when a drag or resize ends, with each moved object's new place and size. */
  onChange?: (changes: { id: string; box: Box }[]) => void;
  /** Edit mode: called when the zoom changes from inside the game (the mouse wheel). */
  onView?: (view: EditView) => void;
  /** Edit mode: called when a stroke of the paint tool ends, with the tile map's new rows. */
  onTiles?: (id: string, rows: string[]) => void;
  /**
   * On a phone too slow for them, drop the costly effects (bloom, soft shadows,
   * glows) once the game has run below 28 frames a second for three seconds.
   * For the player on a phone; the editor's try-out always shows everything.
   */
  lighten?: boolean;
  /**
   * Fill the whole screen of a phone taller (or wider) than the game: the view grows along that side,
   * showing more of the world, and what is fixed to the screen keeps to its edge (top things at the top,
   * the buttons at the bottom, menus in the middle). For the player; the editor shows the design's shape.
   */
  fill?: boolean;
  /** Called by the "show ad" action. */
  onShowAd?: () => void;
  /** Called by the "show rewarded ad" action. Resolves true if the player watched it through. */
  onShowRewardedAd?: () => Promise<boolean>;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the editor's try-out tools can see of a running game. */
export interface DebugInfo {
  variables: Record<string, number | string>;
  /** Rules whose trigger happened lately, newest last: whether their conditions let the actions run, and how many times in a row. */
  log: { scene: string; rule: string; time: number; ran: boolean; count: number }[];
  time: number;
  fps: number;
  objects: number;
  paused: boolean;
  speed: number;
  shapes: boolean;
}

/** How the editor's try-out tools are set: frozen, slowed down, the shapes that touch drawn over the game. */
export interface DebugSettings {
  paused: boolean;
  speed: number;
  shapes: boolean;
}

export interface Point {
  x: number;
  y: number;
}

/** A live object in the running scene. Several entities can share one definition when it is spawned repeatedly. */
/** A live object in a running scene (exported for the blocks, src/blocks/). */
export interface Entity extends Box {
  def: GameObject;
  view: Container;
  /** Speed in pixels per second, set by walking, following, chasing, jumping or a push. */
  vx: number;
  vy: number;
  jumpsLeft: number;
  visible: boolean;
  alive: boolean;
  /** Has been on screen since it last left; "left the screen" only fires for objects that were seen. */
  seen: boolean;
  /** Where it was placed, the line a patrol moves along. */
  homeX: number;
  homeY: number;
  /** Where "respawn" puts it back: the place of its last checkpoint, if it reached one. */
  checkpoint?: Point;
  /** Until when (game time) it cannot lose health after a hit. */
  hurtUntil?: number;
  /** For an object with states: its full definition, and the state its `def` was last cut down for. */
  base?: GameObject;
  stateShown?: number;
  /** Seconds since it was created. */
  age: number;
  spawnIn: number;
  /** Turn in radians. */
  angle: number;
  /** How far the wave behavior has currently pushed it, so the push can be undone next frame. */
  sway: number;
  /** 0 to 1, from the blink behavior. */
  fade: number;
  /** The images of an animated object at rest, in order; null for anything that is not animated. */
  frames: Texture[] | null;
  /** Images shown instead while moving sideways, and while off the ground. */
  moveFrames: Texture[] | null;
  airFrames: Texture[] | null;
  hurtFrames: Texture[] | null;
  hurtPoseUntil?: number;
  /** Which set is showing, for tests. */
  anim: 'idle' | 'move' | 'air' | 'hurt';
  /** Standing on something, as of the last step of its body. */
  grounded: boolean;
  /** Size multiplier from pulse and the pop, grow and shrink effects. */
  scale: number;
  /** Hits left, for objects that have health. */
  health: number;
  /** Created during play rather than placed; these are tidied away once far out of view. */
  spawned: boolean;
  /** Which of `frames` is showing. */
  frame: number;
  /** -1 while a picture that flips with its direction is facing left. */
  facing: 1 | -1;
  /** Where it was on the previous frame, to tell which way it is moving. */
  lastX: number;
  lastY: number;
  /** When it last moved: the walking pictures go on a moment longer, so a stop-and-go step does not flicker. */
  movedAt?: number;
  /** When it last turned round: a picture turned at every wobble of a finger flickers. */
  turnedAt?: number;
  /** Seen from above, the way it last went (one of eight): what it makes "ahead" of it goes that way. */
  went?: Point;
  /** Where it was at the end of the previous step, so that what stands on it can be carried along. */
  prevX: number;
  prevY: number;
  /** The solid object it is standing on, if any. */
  ground: Entity | null;
  /** The solid object it walked into this step, if any (it counts as touching it, Phase 2). */
  against: Entity | null;
  /** Marks it as already given in a contact question (src/runtime/contacts.ts). */
  contactStamp: number;
  /** Seconds since it last stood on something. */
  airTime: number;
  /** A jump was asked for this long ago and has not happened yet; it still happens if the ground arrives in time. */
  jumpAsked: number;
  /** Going up from a jump that letting go can still cut short. */
  rising: boolean;
  /** Special moves: the side of a wall it pressed against last step (1 right, -1 left, 0 none); a kick off a wall; a dash; climbing; a ground pound. */
  wallSide?: number;
  /** The pose an animation added last step, taken back before anything else moves it. */
  animApplied?: Pose | null;
  /** Crouching: its standing height, to stand up to again (0 when standing). */
  crouchFrom?: number;
  kick?: { vx: number; left: number } | null;
  dashLeft?: number;
  dashCool?: number;
  dashDir?: number;
  climbing?: boolean;
  pounding?: boolean;
  /** A dodge roll under way, its way, the wait before the next, and until when nothing can hurt it. */
  rollLeft?: number;
  rollCool?: number;
  rollDir?: Point;
  safeUntil?: number;
  /** A homing object has taken over its own speed. */
  homing?: boolean;
  /** Seconds until the trail behavior drops its next dot. */
  trailIn: number;
  /**
   * Could be seen when the current step began. A touch counts only on what was
   * on show when it landed, so a rule that swaps one button for another does not
   * also press the button it has just revealed.
   */
  tappable: boolean;
  /** The way a swipe last sent it, for the steer behavior's "keeps going" control. */
  heading: Point | null;
  /** Which marker of its route it is making for, and whether it is going forward (1) or back (-1). */
  routeAt: number;
  routeWay: 1 | -1;
  /** Its own values, by name. */
  values: Map<string, number>;
  /**
   * A move on the board happens at once as far as the rules are concerned; the
   * picture catches up over a moment. This is how far behind it still is.
   */
  slide: { x: number; y: number; left: number; span: number } | null;
  /** Looks a rule has given it in place of its definition's: a colour, a picture, a text. Null keeps the definition's. */
  color: string | null;
  image: string | null;
  text: string | null;
  /** 1 is solid; starts as the definition's opacity. */
  opacity: number;
  /** A glow from the "flash" action, fading over `span` seconds. */
  flash: { color: string; left: number; span: number; filter: ColorMatrixFilter } | null;
  /** The way around walls a chaser is following, as points to pass in turn, and when it next looks again. */
  path: Point[];
  pathIn: number;
  /** A chaser that needs to see: where it last saw its target, and when. */
  lastSeen?: { x: number; y: number; at: number; arrivedAt?: number } | null;
  /** Seconds until the particles behavior lets out its next particle. */
  emitIn: number;
  /** Its own lasting effects: a soft shadow, a glow. A flash goes on top of these while it lasts. */
  fx: Filter[];
  /** A character's squash or stretch, from a jump or a landing, springing back to normal over `span` seconds. */
  squash: { x: number; y: number; left: number; span: number } | null;
}

/** What a body needs to know about a ramp: how high its surface is at any point across it. */
function surfaceAt(r: Box & { def: GameObject }, x: number): number | null {
  if (x < r.x || x > r.x + r.width) return null;
  const along = (x - r.x) / r.width;
  return r.def.slope === 'rise' ? r.y + r.height * (1 - along) : r.y + r.height * along;
}

/** A short change in progress on one object: an effect or a glide. */
interface Tween {
  entity: Entity;
  /** press: the quick squeeze of something tapped, like a button giving under a finger. */
  kind: 'pop' | 'grow' | 'shrink' | 'fadeIn' | 'fadeOut' | 'dissolve' | 'glide' | 'press';
  elapsed: number;
  seconds: number;
  from: Point;
  to: Point;
  ease?: Ease;
}

/** How far along a smooth move is, for a share `t` of its time, by the chosen kind of easing. */
function eased(kind: Ease | undefined, t: number): number {
  switch (kind ?? 'smooth') {
    case 'linear': return t;
    case 'in': return t * t * t;
    case 'out': return 1 - (1 - t) ** 3;
    case 'back': return 2.70158 * t * t * t - 1.70158 * t * t;
    case 'elastic': return t <= 0 || t >= 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    case 'bounce': {
      const n = 7.5625;
      const d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    }
    default: return t * t * (3 - 2 * t);
  }
}

/** The colour matrix of each look, applied to the whole picture. */
function lookMatrix(look: Look): number[] | null {
  const m = (r: number[], g: number[], b: number[]) => [...r, ...g, ...b, 0, 0, 0, 1, 0];
  switch (look) {
    case 'warm': return m([1.12, 0, 0, 0, 0.03], [0, 1.03, 0, 0, 0.01], [0, 0, 0.85, 0, 0]);
    case 'cold': return m([0.88, 0, 0, 0, 0], [0, 1, 0, 0, 0.01], [0, 0, 1.15, 0, 0.04]);
    case 'gray': return m([0.3, 0.59, 0.11, 0, 0], [0.3, 0.59, 0.11, 0, 0], [0.3, 0.59, 0.11, 0, 0]);
    case 'old': return m([0.39, 0.77, 0.19, 0, 0.02], [0.35, 0.69, 0.17, 0, 0.01], [0.27, 0.53, 0.13, 0, -0.02]);
    case 'night': return m([0.45, 0.1, 0.05, 0, 0], [0.08, 0.55, 0.1, 0, 0], [0.1, 0.15, 0.85, 0, 0.06]);
    case 'dream': return m([0.82, 0.06, 0.06, 0, 0.12], [0.06, 0.8, 0.06, 0, 0.1], [0.08, 0.06, 0.88, 0, 0.14]);
    case 'vivid': return m([1.45, -0.35, -0.1, 0, 0], [-0.15, 1.35, -0.2, 0, 0], [-0.1, -0.35, 1.45, 0, 0]);
    default: return null;
  }
}

/** A soft round spot, white in the middle and clear at the edge: the shape of a light, and of the vignette's inside. */
function softSpot(size: number, inner: string, outer: string, from = 0): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(size / 2, size / 2, (size / 2) * from, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

interface Pointer extends Point {
  startX: number;
  startY: number;
  startedAt: number;
  /** The draggable object this finger picked up, with where on it the finger landed. `held`: an object with physics, grabbed or pulled back in a sling; the physics moves it. */
  drag: { entity: Entity; dx: number; dy: number; held?: boolean } | null;
}

/** The objects a trigger was about, which "first" and "second" in an action refer to. */
export interface Context {
  first?: Entity;
  second?: Entity;
}

type EditDrag =
  /** The first item is the one under the pointer; it snaps, and the rest keep their distance from it. `single` is set when the press was on one of several selected objects: without a move, only that one stays selected. */
  | { kind: 'move'; items: { entity: Entity; dx: number; dy: number }[]; moved: boolean; single: string | null }
  /** `anchor` is the corner opposite the handle being dragged; it stays put. `ratio` is the width over the height when the drag began. */
  | { kind: 'resize'; entity: Entity; anchor: Point; ratio: number; moved: boolean }
  | { kind: 'pan'; from: Point; camera: Point }
  /** A box being drawn over empty space, in screen pixels. */
  | { kind: 'marquee'; from: Point; to: Point; add: boolean }
  /** Cells of a tile map being painted; the map's rows as they are now, sent to the editor when the stroke ends. */
  | { kind: 'paint'; entity: Entity; rows: string[]; changed: boolean };

/** What the performance budget measures (Game.startProfile / readProfile). */
export interface Profile {
  steps: number;
  frames: number;
  /** All the steps' time together, and the slowest one, in milliseconds. */
  stepMs: number;
  worst: number;
  /** Milliseconds per part, summed over the steps (or frames, for "frame: …"). */
  ms: Record<string, number>;
}

export interface GameState {
  mode: GameMode['kind'];
  scene: string;
  /** Seconds since the current scene started. */
  time: number;
  variables: Record<string, number | string>;
  /** The game's lists, item by item (Phase 4). */
  lists: Record<string, (number | string)[]>;
  selection: string | null;
  /** Everything selected in edit mode; `selection` is the last of these. */
  selected: string[];
  zoom: number;
  /** How close the camera is in play: 1 normally, more after a "zoom" in. */
  playZoom: number;
  /** The music playing now: a sound asset id, or null. */
  music: string | null;
  camera: Point;
  /** How many burst pieces are in the air, and whether the screen is shaking. */
  particles: number;
  /** The colour treatment of the picture now, and how dark the scene is. */
  look: Look;
  darkness: number;
  /** The painted backdrop on show, if any. */
  sky: string | null;
  shaking: boolean;
  paused: boolean;
  soundOn: boolean;
  /** A scene change is fading through black. */
  fading: boolean;
  /** The costly effects were dropped for a slow phone. */
  light: boolean;
  /** The things in the player's bag, in the order of their places; and how many are flying into it. */
  bag: string[];
  flights: number;
  /** The old-screen look in use ('none' when a slow phone dropped it), ripples running, and how far the view is punched in (1 for not). */
  retro: string;
  waves: number;
  /** The frame water and lava cells show now; -1 when there are none. */
  liquidFrame: number;
  /** What the camera is visiting for a while, if anything. */
  focus: string | null;
  /** A character speaking, and how many letters show so far. */
  dialogue: { speaker: string; text: string; shown: number } | null;
  /** Achievements unlocked on this device, the banner showing now, and the best scores. */
  achievements: string[];
  toast: string | null;
  top: number[];
  punch: number;
  /** Where the shake has moved the screen to right now. */
  shakeAt: { x: number; y: number };
  /** The scene's weather: what is falling, and lightning. */
  weather: ReturnType<WeatherView['state']>;
  /** Lights that walls are in the way of: the outline of where each reaches, in world points (x, y, x, y, …). */
  lit: { id: string; points: number[] }[];
  /** Words floating up from objects ("+30"). */
  floats: { text: string; x: number; y: number; alpha: number }[];
  entities: ({
    id: string; tags: string[]; visible: boolean; opacity: number; frame: number; flipped: boolean;
    anim: Entity['anim']; scale: number; health: number; grounded: boolean; vx: number; vy: number; angle: number;
    values: Record<string, number>;
    /** What a text object is showing right now. */
    text?: string;
    /** A colour or picture a rule gave it, if any; and whether it is glowing from a flash. */
    color: string | null;
    image: string | null;
    flashing: boolean;
    /** How many points are left on its way around walls. */
    path: number;
    /** How tall it is drawn now for a jump's stretch or a landing's squash: 1 is its own shape. */
    stretch: number;
    /** How many lasting effects (shadow, glow) it is drawn with. */
    effects: number;
  } & Box)[];
}

/**
 * Longest step the simulation will take. A frame is cut into steps no longer
 * than this, so fast things cannot pass through thin ones between two frames
 * and the game behaves the same on a slow phone as on a fast one.
 */
const MAX_STEP = 1 / 120;
/** Longest stretch of time one frame may cover; below 30 frames a second the game slows down rather than skipping ahead. */
const MAX_FRAME = 1 / 30;
/** A jump still works this long after walking off an edge, and a press this long before landing still jumps. */
const COYOTE = 0.1;
const FADE_OUT = 0.14;
const FADE_IN = 0.2;
const MAX_PARTICLES = 400;
/** An object that wandered this far beyond the view without ever being seen is removed. */
const LOST_DISTANCE = 2000;
const HIDDEN_ALPHA_IN_EDITOR = 0.35;
/** A finger must travel this far, this quickly, to count as a swipe rather than a tap. */
const SWIPE_DISTANCE = 60;
const SWIPE_SECONDS = 0.6;
/** Half the side of a resize handle, in design pixels. */
const HANDLE = 14;
const MIN_SIZE = 10;
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 4;
/** Edit mode: how far past the world's edge the view may slide, to reach things placed just outside it. */
const EDIT_MARGIN = 300;
/** Edit mode: a dragged object's edge or middle jumps to a line this close, in screen pixels. */
const SNAP = 10;
/** More pieces than this in one burst adds nothing to see and costs frames on a slow phone. */
const MAX_BURST = 60;

export class Game {
  readonly app: Application;
  private readonly mount: HTMLElement;
  readonly options: GameOptions;
  /** The screen in game pixels: the design's size, or taller or wider when filling a phone's screen. */
  view = { width: 0, height: 0 };
  /** Where each screen-fixed object was designed to be, before keeping it to its edge of a larger screen. */
  private readonly hudBase = new WeakMap<Entity, { x: number; y: number; width: number; height: number }>();
  /** Objects in the world, shifted as the camera moves. */
  private readonly world = new Container();
  /** Objects fixed to the screen, drawn over the world. */
  private readonly hud = new Container();
  /** A black sheet over the game, clear except while one scene fades into the next. */
  private readonly curtain = new Graphics();
  /** The joystick drawn under a finger that is steering. */
  private readonly stick = new Graphics();
  private hasStick = false;
  // Text views already fitted to the screen for the words they show.
  private readonly fitted = new WeakSet<Text>();
  /** Real physics for the scene being played, if any of its objects asks for it. */
  physics: Physics<Entity> | null = null;
  /** Where objects are, for the questions rules ask about contact (src/runtime/contacts.ts). */
  readonly contacts = new Contacts();
  /** Ropes, springs and a sling's band and aim, drawn over the world. */
  private readonly physicsView = new Graphics();
  private physicsDrawn = false;
  /** The editor's try-out tools. */
  private debug: DebugSettings = { paused: false, speed: 1, shapes: false };
  /** Frames still to be played one at a time while frozen. */
  private debugSteps = 0;
  private readonly debugView = new Graphics();
  private ruleLog: DebugInfo['log'] = [];
  private fps = 60;
  /** The costly effects were dropped for a slow phone; and how long the game has been slow so far. */
  light = false;
  private slowFor = 0;
  /** Everything the player sees of the scene, under one roof so a look (a colour treatment) can be laid over all of it. */
  private readonly scenery = new Container();
  /** The scene's background colour as a sheet inside the scenery, so a look tints it along with everything else. */
  private readonly backdrop = new Graphics();
  private readonly lookFilter = new ColorMatrixFilter();
  look: Look = 'none';
  /** How dark the scene is now, and a change of it under way. */
  darkness = 0;
  darknessGlide: { from: number; to: number; elapsed: number; seconds: number } | null = null;
  /** The dark sheet with the lights cut out of it, drawn once a frame into a texture of its own. */
  private readonly shade = new Sprite();
  private readonly shadeLayer = new Container();
  private shadeTexture: RenderTexture | null = null;
  /** The coloured glow of lights that have a colour, over the dark sheet. */
  private readonly glow = new Container();
  private readonly vignette = new Sprite();
  private lightTexture: Texture | null = null;
  /** Edit mode: whether anything gives off particles, which then stream even while editing. */
  private emitters = false;
  /** The scene's painted backdrop, if it has one, and the bloom over everything when asked for. */
  private skyView: SkyView | null = null;
  private bloomFilter: AdvancedBloomFilter | null = null;
  /** The blocks of tile maps made of a material, with how each of their cells is drawn. */
  private readonly tileLooks = new WeakMap<GameObject, { style: Exclude<TileStyle, 'flat'>; cell: number; cells: OpenSides[]; variant: number }>();
  /** The scene's gravity, which a rule can change while the scene runs. */
  gravity = 0;
  /** Route markers by group, found once per step. */
  readonly marks = new Map<string, Entity[]>();
  private readonly overlay = new Graphics();
  /** Loaded images by asset id, with the src they came from so a changed image is reloaded. */
  private readonly textures = new Map<string, { src: string; texture: Texture }>();
  private readonly cleanup: (() => void)[] = [];

  project: GameProject;
  scene: Scene;
  private mode: GameMode;
  private selection: string | null = null;
  private selected: string[] = [];
  private zoom = 1;
  private tool: EditView['tool'] = 'select';
  private grid = 0;
  private brush = EMPTY_TILE;
  /** Play: how close the camera is, and a smooth change of it under way. */
  playZoom = 1;
  zoomGlide: { from: number; to: number; elapsed: number; seconds: number } | null = null;
  /** Music a rule started in place of the scene's: an asset id, "" for silence, or null for the scene's own. */
  musicOverride: string | null = null;
  /** For chasers that go around walls: which cells of the world are blocked, by wall group and cell size, found once per step. */
  private readonly blockedCells = new Map<string, { cols: number; rows: number; cell: number; blocked: Uint8Array }>();
  /** Lines a dragged object is currently snapped to, in the space of that object. */
  private guides: { fixed: boolean; x: number[]; y: number[] } | null = null;
  private spaceHeld = false;
  /** Where the view was when editing was last left, to come back to the same place. */
  private editView: { scene: string; x: number; y: number } | null = null;

  entities: Entity[] = [];
  readonly textVariables = new Map<string, string>();
  /** The game's lists of numbers or text (Phase 4); they start again with the game, never kept on the device. */
  readonly lists = new Map<string, (number | string)[]>();
  /** What is being measured, when the performance budget asks (Phase 5). */
  private profile: Profile | null = null;
  /** How deep functions and questions are calling each other now; a call past 32 deep is not made. */
  private callDepth = 0;
  readonly variables = new Map<string, number>();
  readonly camera: Point = { x: 0, y: 0 };
  time = 0;
  started = false;
  nextScene: string | null = null;
  private shownValues = '';
  private particles: Particle[] = [];
  /** Words floating up from objects, and how long each has left. */
  private floats: { view: Text; life: number; span: number; from: number }[] = [];
  /** The weather over the screen. */
  private readonly weather = new WeatherView(() => (this.lightTexture ??= softSpot(256, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)', 0.25)));
  /** The scene's old-screen look, and the ripples of explosions running over the picture. */
  private retroFilter: PixelateFilter | CRTFilter | OldFilmFilter | null = null;
  waves: { filter: ShockwaveFilter; left: number }[] = [];
  /** A quick jump of the view closer and back: how far, and how long it has left of how long. */
  punch: { amount: number; left: number; span: number } | null = null;
  /** Which way the screen shakes now. */
  shakeAxis: 'both' | 'side' | 'up' = 'both';
  /** A character speaking: the words, who says them, when they began, and what to do once the player has read them. */
  private dialogue: { speaker: string; text: string; color: string; since: number; rest: Action[]; context: Context; view: Container } | null = null;
  /** Achievement banners waiting to be shown, and the one showing. */
  private toasts: string[] = [];
  private toast: { view: Container; left: number } | null = null;
  /** The outline of each light that walls block, as last drawn. */
  private lit: { id: string; points: number[] }[] = [];
  tweens: Tween[] = [];
  paused = false;
  soundOn = true;
  private fade: { phase: 'out' | 'in'; left: number } | null = null;
  /** Bodies that came down onto something during this step, for the "land" trigger. */
  landings: { entity: Entity; on: Entity | null }[] = [];
  /** Where the screen was last touched, for things launched toward the touch. */
  lastTap: Point | null = null;
  /** Objects whose health reached zero since the rules last ran, and rewarded ads watched through. */
  died: Entity[] = [];
  diedLastFrame: Entity[] = [];
  rewards = 0;
  /** How far the camera moved during the last frame, for spawners that work by distance. */
  cameraTravel = 0;
  shakeLeft = 0;
  shakeStrength = 0;
  /** Slow motion: how fast time runs, and for how many more real seconds. */
  slowScale = 1;
  slowLeft = 0;
  /** When each object last made its material's sound, so a rattling pile does not buzz. */
  private lastKnock = new WeakMap<Entity, number>();
  private knocksThisStep = 0;
  /** Actions held back by a "wait", with the moment they are due. */
  waiting: { at: number; actions: Action[]; context: Context }[] = [];
  /** Messages sent by rules: those on their way, and those the rules are reading this step. */
  outbox: { name: string; context: Context }[] = [];
  inbox: { name: string; context: Context }[] = [];
  /** The player's bag: when each thing they carry was picked up (by order), so things keep their places. */
  private readonly bagGot = new Map<string, number>();
  private bagSeq = 0;
  /** The pictures drawn in each bag, by thing; when each last popped; and things still flying into the bag. */
  private readonly bagIcons = new WeakMap<Entity, Map<string, Container>>();
  readonly bagPops = new Map<string, number>();
  private flights: { view: Sprite; item: string; from: Point; to: Point; fromSize: number; toSize: number; t: number; hides: boolean }[] = [];
  /** A thing being dragged out of the bag by a finger, and things let go of since the last step, with where. */
  private bagDrag: { pointer: number; item: string; view: Sprite; start: Point; slot: Point; size: number } | null = null;
  drops: { item: string; at: Point }[] = [];
  /** Health bars over objects, made anew with each scene's world. */
  private healthBars: Graphics | null = null;
  /** Set by going through a door: in the next scene, the objects of group `bring` appear at the first object of group `at`. */
  arrival: { at: string; bring: string } | null = null;

  // Input since the last frame, and what is being held right now. All in screen coordinates.
  readonly pointers = new Map<number, Pointer>();
  // Fingers already on the screen when a new scene began: a paddle or a ship that follows the finger
  // keeps following them into the next level. Nothing else sees them (no taps, no jumps, no buttons).
  readonly heldOver = new Map<number, Point>();
  taps: Point[] = [];
  swipes: string[] = [];
  keyTap = false;
  /** Keys pressed down since the last step (not held from before). */
  private readonly pressed = new Set<string>();
  readonly keys = new Set<string>();
  /** Groups used as on-screen buttons; a touch on one of them is not a tap on the screen. */
  private controlTags = new Set<string>();

  // What each rule remembers between frames.
  readonly ruleClock = new Map<string, number>();
  readonly ruleDone = new Set<string>();
  private readonly ruleTruth = new Map<string, boolean>();
  /** For rules that fire once per object: the objects the rule's test held for when it was last looked at. */
  private readonly ruleHeld = new Map<string, Set<Entity>>();
  /** An object's own value changed, so texts that show one must be written again. */
  valuesChanged = false;
  readonly touching = new Map<string, Set<string>>();
  readonly uids = new WeakMap<Entity, number>();
  private uidCounter = 0;

  private editDrag: EditDrag | null = null;

  private constructor(project: GameProject, mount: HTMLElement, options: GameOptions) {
    this.app = new Application();
    this.project = project;
    this.mount = mount;
    this.options = options;
    this.mode = options.mode ?? { kind: 'play' };
    this.scene = this.sceneFor(this.mode);
  }

  /** Validates the project, loads its images and starts it inside `mount`. */
  static async create(project: GameProject, mount: HTMLElement, options: GameOptions = {}): Promise<Game> {
    assertPlayable(project);
    const game = new Game(project, mount, options);
    await game.start();
    return game;
  }

  private async start(): Promise<void> {
    const { meta } = this.project;
    this.view = { width: meta.width, height: meta.height };
    await this.app.init({
      width: meta.width,
      height: meta.height,
      background: meta.background,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    await this.loadImages(this.project);

    this.mount.appendChild(this.app.canvas);
    this.scenery.addChild(this.backdrop, this.world, this.physicsView, this.weather.view, this.shade, this.glow, this.weather.flash, this.vignette, this.hud);
    this.weather.onThunder = () => this.sound('boom', 30);
    this.app.stage.addChild(this.scenery, this.stick, this.debugView, this.curtain, this.overlay);
    this.vignette.texture = softSpot(512, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.65)', 0.45);
    this.resetVariables(true);
    this.fitToMount(false);
    this.loadScene(this.scene.id);
    this.listen();
    this.app.ticker.add((ticker) => this.advance(ticker.deltaMS / 1000));
  }

  /** Moves the game on by the time one frame took, in as many short steps as that needs. */
  private advance(elapsed: number): void {
    if (this.mode.kind !== 'play') {
      // While editing nothing moves, but particles stream and lights glow, so they can be judged as they are made.
      if (this.emitters) this.animateParticles(Math.min(elapsed, MAX_FRAME));
      this.skyView?.update(this.camera, this.z, this.scene.height, Math.min(elapsed, MAX_FRAME));
      this.weather.update(Math.min(elapsed, MAX_FRAME), this.camera, this.z);
      this.animateRetro(Math.min(elapsed, MAX_FRAME));
      this.drawShade();
      return;
    }
    if (elapsed > 0) this.fps += (Math.min(240, 1 / elapsed) - this.fps) * 0.1;
    if (this.options.lighten && !this.light && !this.debug.paused) {
      this.slowFor = this.fps < 28 ? this.slowFor + elapsed : 0;
      if (this.slowFor > 3) this.lighten();
    }
    let total = Math.min(elapsed, MAX_FRAME) * this.debug.speed;
    if (this.debug.paused) {
      // Frozen by the try-out tools: nothing moves, except one frame at a time when asked.
      if (this.debugSteps <= 0) {
        this.skyView?.update(this.camera, this.z, this.scene.height, 0);
        return this.drawDebug();
      }
      this.debugSteps -= 1;
      total = 1 / 60;
    }
    if (this.fade) this.stepFade(total);
    if (this.slowLeft > 0 && !this.paused) {
      // Counted in real time, so a freeze (0) still ends.
      const slowed = Math.min(elapsed, this.slowLeft);
      this.slowLeft -= slowed;
      if (elapsed > 0) total *= 1 - (1 - this.slowScale) * slowed / elapsed;
      if (this.slowLeft <= 0) this.slowScale = 1;
      if (total <= 0) {
        this.drawShade();
        return this.drawDebug();
      }
    }
    const steps = Math.max(1, Math.ceil(total / MAX_STEP));
    const profile = this.profile;
    for (let i = 0; i < steps; i++) {
      if (!profile) {
        this.update(total / steps);
        continue;
      }
      const start = performance.now();
      this.update(total / steps);
      const took = performance.now() - start;
      profile.steps += 1;
      profile.stepMs += took;
      profile.worst = Math.max(profile.worst, took);
    }
    let t = profile ? performance.now() : 0;
    if (this.physics) this.drawPhysics();
    this.drawHealthBars();
    if (profile) t = this.lap('frame: joints and health bars', t);
    this.skyView?.update(this.camera, this.z, this.scene.height, this.paused ? 0 : total);
    this.weather.update(this.paused ? 0 : total, this.camera, this.z);
    if (profile) t = this.lap('frame: sky and weather', t);
    this.drawShade();
    if (profile) t = this.lap('frame: darkness and lights', t);
    this.drawDebug();
    if (profile) profile.frames += 1;
  }

  /**
   * Starts measuring how long each part of a step takes (the performance budget, Phase 5; scripts/stress.smoke.mjs).
   * Measuring costs a little time itself, so it is off unless asked for.
   */
  startProfile(): void {
    this.profile = { steps: 0, frames: 0, stepMs: 0, worst: 0, ms: {} };
  }

  /** What was measured since startProfile: milliseconds per part (summed), and per step on average and at worst. */
  readProfile(): Profile | null {
    return this.profile && { ...this.profile, ms: { ...this.profile.ms } };
  }

  private lap(part: string, since: number): number {
    const now = performance.now();
    this.profile!.ms[part] = (this.profile!.ms[part] ?? 0) + (now - since);
    return now;
  }

  /** Edit mode: lets every particle stream run, and moves the particles along. */
  private animateParticles(dt: number): void {
    for (const e of this.entities) {
      for (const b of e.def.behaviors) if (b.type === 'particles') this.stream(e, b, dt);
    }
    this.stepParticles(dt);
  }

  /** Lets out as many particles as a stream has due. */
  stream(e: Entity, b: ParticlesBehavior, dt: number): void {
    e.emitIn -= dt;
    for (let n = 0; e.emitIn <= 0 && n < 8; n++) {
      e.emitIn += 1 / Math.max(0.2, b.rate);
      this.emit(e, b);
    }
    if (e.emitIn < 0) e.emitIn = 0;
  }

  /** One particle of a stream, drawn as its kind looks. */
  private emit(e: Entity, b: ParticlesBehavior): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const p = spawnParticle(b, this.boxOf(e));
    const layer = this.layerOf(e);
    if (p.behind && e.view.parent === layer) layer.addChildAt(p.view, layer.getChildIndex(e.view));
    else layer.addChild(p.view);
    this.particles.push(p);
  }

  /** Moves particles along: they fly, fall or rise, drift, turn, change size and fade away. */
  private stepParticles(dt: number): void {
    for (const p of this.particles) advanceParticle(p, dt);
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) {
      f.life -= dt;
      const age = f.span - f.life;
      // Pops up bigger than its size and settles, rises fast then slower, and fades at the end.
      f.view.scale.set(age < 0.12 ? 0.4 + (age / 0.12) * 0.9 : age < 0.24 ? 1.3 - ((age - 0.12) / 0.12) * 0.3 : 1);
      f.view.y = f.from - 110 * (1 - (1 - Math.min(1, age / f.span)) ** 2);
      f.view.alpha = Math.min(1, (f.life / f.span) * 2.5);
      if (f.life <= 0) f.view.destroy();
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  /** Words that pop up over an object and float away. */
  floatText(e: Entity, text: string, color: string, size: number): void {
    const view = new Text({
      text,
      style: {
        fontFamily: [this.project.meta.fontFamily, FALLBACK_FONT, 'sans-serif'],
        fontSize: size,
        fontWeight: 'bold',
        fill: color,
        stroke: { color: shadeOf(color, -0.6), width: Math.max(3, Math.round(size / 8)), join: 'round' },
        dropShadow: { color: '#000000', alpha: 0.4, blur: 2, distance: Math.max(2, size / 16), angle: Math.PI / 2 },
        padding: Math.ceil(size * 0.4),
      },
    });
    view.anchor.set(0.5, 1);
    const box = this.boxOf(e);
    view.position.set(box.x + box.width / 2, box.y);
    view.scale.set(0.4);
    this.layerOf(e).addChild(view);
    this.floats.push({ view, life: 1, span: 1, from: box.y });
  }

  /** Puts the scene's colour treatment and vignette in place. */
  applyLook(): void {
    const matrix = lookMatrix(this.look);
    const filters: Filter[] = [];
    if (matrix) {
      this.lookFilter.matrix = matrix as typeof this.lookFilter.matrix;
      filters.push(this.lookFilter);
    }
    // Bloom: bright parts spill a soft glow over their surroundings.
    if (this.scene.bloom && !this.light) {
      // Only the brightest parts glow, and gently, so a bright sky is not washed out.
      this.bloomFilter ??= new AdvancedBloomFilter({ threshold: 0.84, bloomScale: 0.55, brightness: 1, blur: 5, quality: 5 });
      filters.push(this.bloomFilter);
    }
    // An old screen: big pixels always (they cost nothing); the arcade screen and old film not on a slow phone.
    const retro = this.scene.retro ?? 'none';
    const wanted = retro === 'pixel' ? PixelateFilter : retro === 'crt' && !this.light ? CRTFilter : retro === 'film' && !this.light ? OldFilmFilter : null;
    if (!wanted) this.retroFilter = null;
    else if (!(this.retroFilter instanceof wanted)) {
      this.retroFilter = retro === 'pixel' ? new PixelateFilter(6)
        : retro === 'crt' ? new CRTFilter({ curvature: 1, lineWidth: 2, lineContrast: 0.2, noise: 0.06, vignetting: 0 })
        : new OldFilmFilter({ sepia: 0.45, noise: 0.18, scratch: 0.4, scratchDensity: 0.3, vignetting: 0.3 });
    }
    if (this.retroFilter) filters.push(this.retroFilter);
    filters.push(...this.waves.map((w) => w.filter));
    this.scenery.filters = filters;
    const { width, height } = this.view;
    this.vignette.visible = Boolean(this.scene.vignette);
    this.vignette.width = width;
    this.vignette.height = height;
  }

  /**
   * Draws the scene's darkness: a dark sheet over the world with a soft hole
   * cut out around every object that gives light, and a glow in the light's
   * colour. While editing it is shown at half strength, so the scene can still be worked on.
   */
  private drawShade(): void {
    const dark = this.mode.kind === 'edit' ? this.darkness * 0.5 : this.darkness;
    this.glow.removeChildren().forEach((c) => c.destroy());
    if (dark <= 0.001) {
      this.shade.visible = false;
      return;
    }
    const { width: W, height: H } = this.view;
    if (!this.shadeTexture || this.shadeTexture.width !== W || this.shadeTexture.height !== H) {
      this.shadeTexture?.destroy(true);
      this.shadeTexture = RenderTexture.create({ width: W, height: H });
    }
    this.lightTexture ??= softSpot(256, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)', 0.25);
    const layer = this.shadeLayer;
    // The dark sheet stays; the lights cut into it are made afresh each frame.
    if (layer.children.length > 1) layer.removeChildren(1).forEach((c) => c.destroy());
    if (layer.children.length === 0) layer.addChild(new Graphics());
    (layer.children[0] as Graphics).clear().rect(0, 0, W, H).fill({ color: '#05081a', alpha: dark });
    const z = this.z;
    const origin = this.hudOrigin();
    this.lit = [];
    for (const e of this.entities) {
      if (!e.alive || (!e.visible && this.mode.kind === 'play')) continue;
      for (const b of e.def.behaviors) {
        if (b.type !== 'light') continue;
        const fixed = Boolean(e.def.fixed);
        const centre = { x: e.x + e.width / 2, y: e.y + e.height / 2 };
        const at = fixed ? { x: origin.x + centre.x * this.hudZ, y: origin.y + centre.y * this.hudZ } : { x: (centre.x - this.camera.x) * z, y: (centre.y - this.camera.y) * z };
        const flicker = b.flicker ? 1 + 0.07 * Math.sin(this.time * 13 + e.homeX) + 0.04 * Math.sin(this.time * 7.3 + e.homeY) : 1;
        const size = b.radius * 2 * (fixed ? this.hudZ : z) * flicker;
        // Walls in the way: the light reaches only as far as it can see, and what is behind them stays dark.
        const walls = b.shadowTag && !fixed && !this.light
          ? this.entities.filter((o) => o !== e && o.alive && o.visible && !o.def.fixed && o.def.tags.includes(b.shadowTag!))
          : [];
        const points = walls.length ? lightPolygon(centre.x, centre.y, b.radius * flicker, walls) : null;
        if (points) this.lit.push({ id: e.def.id, points });
        const spot = (scale: number) => {
          if (!points) {
            const s = new Sprite(this.lightTexture!);
            s.anchor.set(0.5);
            s.position.set(at.x, at.y);
            s.width = s.height = size * scale;
            return s;
          }
          // The light's soft circle, painted only inside what it can see.
          const side = size * scale;
          const texture = this.lightTexture!;
          const onScreen = points.map((v, i) => (i % 2 === 0 ? (v - this.camera.x) * z : (v - this.camera.y) * z));
          return new Graphics().poly(onScreen).fill({
            texture,
            textureSpace: 'global',
            matrix: new Matrix().scale(side / texture.width, side / texture.height).translate(at.x - side / 2, at.y - side / 2),
          });
        };
        const hole = spot(1);
        hole.blendMode = 'erase';
        layer.addChild(hole);
        if (b.color.toLowerCase() !== '#ffffff') {
          const tint = spot(0.8);
          tint.tint = b.color;
          tint.alpha = 0.2 * dark;
          tint.blendMode = 'add';
          this.glow.addChild(tint);
        }
      }
    }
    this.app.renderer.render({ container: layer, target: this.shadeTexture, clear: true });
    this.shade.texture = this.shadeTexture;
    this.shade.position.set(0, 0);
    this.shade.visible = true;
  }

  /** The editor's try-out tools: freeze, slow down, show the shapes that touch. */
  setDebug(settings: Partial<DebugSettings>): void {
    this.debug = { ...this.debug, ...settings };
    if (this.debug.speed <= 0) this.debug.speed = 1;
    this.drawDebug();
  }

  /** While frozen, plays exactly one frame (a sixtieth of a second). */
  stepFrame(): void {
    if (this.debug.paused) this.debugSteps += 1;
  }

  getDebug(): DebugInfo {
    return {
      variables: Object.fromEntries([...this.variables, ...this.textVariables]),
      log: this.ruleLog.map((entry) => ({ ...entry })),
      time: this.time,
      fps: Math.round(this.fps),
      objects: this.entities.filter((e) => e.alive).length,
      ...this.debug,
    };
  }

  /** Outlines the shape of every object as it counts for touching: green for real physics, orange for what it stands on, blue for simple bodies. */
  private drawDebug(): void {
    const g = this.debugView.clear();
    if (!this.debug.shapes || this.mode.kind !== 'play') return;
    const z = this.z;
    const origin = this.hudOrigin();
    for (const e of this.entities) {
      if (!e.alive || !e.visible) continue;
      const fixed = Boolean(e.def.fixed);
      const at = (p: Point) => (fixed ? { x: origin.x + p.x * this.hudZ, y: origin.y + p.y * this.hudZ } : { x: (p.x - this.camera.x) * z, y: (p.y - this.camera.y) * z });
      const scale = fixed ? this.hudZ : z;
      const kinds = e.def.behaviors.map((b) => b.type);
      const color = this.physics?.moves(e) ? '#00e676' : kinds.includes('physics') || this.physics?.firm(e) ? '#ff9100' : kinds.includes('body') ? '#40c4ff' : '#ffffff';
      const box = this.boxOf(e);
      const inset = e.def.hitboxInset ?? 0;
      if (e.def.round) {
        const c = at({ x: e.x + e.width / 2, y: e.y + e.height / 2 });
        g.circle(c.x, c.y, Math.max(1, (Math.min(e.width, e.height) / 2 - inset) * scale));
      } else if (e.def.visual.kind !== 'text' && Math.abs(Math.sin(e.angle)) > 0.001) {
        const corners = cornersOf(e, inset).map(at);
        g.poly(corners.flatMap((p) => [p.x, p.y]));
      } else {
        const p = at({ x: box.x + inset, y: box.y + inset });
        g.rect(p.x, p.y, Math.max(1, (box.width - inset * 2) * scale), Math.max(1, (box.height - inset * 2) * scale));
      }
      g.stroke({ width: 2, color, alpha: color === '#ffffff' ? 0.5 : 0.95 });
    }
  }

  /** One scene fades out, the next is loaded behind the black, and it fades in. */
  private stepFade(dt: number): void {
    const fade = this.fade!;
    fade.left -= dt;
    if (fade.phase === 'out') {
      this.curtain.alpha = 1 - Math.max(0, fade.left) / FADE_OUT;
      if (fade.left > 0) return;
      if (this.nextScene !== null) this.loadScene(this.nextScene);
      this.fade = { phase: 'in', left: FADE_IN };
    } else {
      this.curtain.alpha = Math.max(0, fade.left) / FADE_IN;
      if (fade.left <= 0) this.fade = null;
    }
  }

  /** Goes to the scene a rule asked for, if one did: at once, or by starting the fade. */
  private changeScene(): void {
    if (this.nextScene === null) return;
    if (this.project.meta.transition === 'none') this.loadScene(this.nextScene);
    else if (!this.fade) this.fade = { phase: 'out', left: FADE_OUT };
  }

  private endFade(): void {
    this.fade = null;
    this.curtain.alpha = 0;
  }

  /** Stops the game and removes it from the page. */
  destroy(): void {
    setMusic(null);
    this.cleanup.forEach((fn) => fn());
    this.app.destroy({ removeView: true }, { children: true });
  }

  /**
   * Replaces the game being shown, keeping the same canvas. The editor calls
   * this after every change. Throws, and keeps the previous game, if the new
   * project is not playable.
   */
  async setProject(project: GameProject): Promise<void> {
    assertPlayable(project);
    await this.loadImages(project);

    const sizeChanged =
      project.meta.width !== this.project.meta.width || project.meta.height !== this.project.meta.height;
    this.project = project;
    this.endFade();
    if (sizeChanged) {
      this.view = { width: project.meta.width, height: project.meta.height };
      this.app.renderer.resize(project.meta.width, project.meta.height);
      this.fitToMount(false);
    }
    this.resetVariables(true);
    // While editing, the view stays where the user left it instead of jumping back.
    this.loadScene(this.sceneFor(this.mode).id, this.mode.kind === 'edit');
  }

  setMode(mode: GameMode): void {
    const was = this.mode;
    if (was.kind === 'edit') this.editView = { scene: this.scene.id, x: this.camera.x, y: this.camera.y };
    const sameScene = mode.kind === 'edit' && was.kind === 'edit' && mode.scene === was.scene;
    this.mode = mode;
    // Every try-out starts running at normal speed, with a fresh list of the rules that ran.
    this.debug = { paused: false, speed: 1, shapes: false };
    this.debugSteps = 0;
    this.ruleLog = [];
    this.debugView.clear();
    this.endFade();
    this.soundOn = true;
    this.resetVariables(true);
    this.loadScene(this.sceneFor(mode).id, sameScene);
    // Back from a try-out: show the place that was being worked on, not the start of the scene.
    if (mode.kind === 'edit' && was.kind === 'play' && this.editView?.scene === this.scene.id) {
      this.setCamera(this.editView.x, this.editView.y);
      this.drawOverlay();
    }
  }

  /** Outlines objects in edit mode. Pass null to clear the outline. */
  setSelection(selection: string | string[] | null): void {
    const ids = selection === null ? [] : typeof selection === 'string' ? [selection] : selection;
    if (ids.length === this.selected.length && ids.every((id, i) => id === this.selected[i])) return;
    const id = ids.at(-1) ?? null;
    const isPrefab = (x: string | null) => this.scene.prefabs.some((p) => p.id === x);
    // A selected prefab is not in the scene, so a sample of it is shown; that needs a rebuild.
    const rebuild = this.mode.kind === 'edit' && (isPrefab(this.selection) || isPrefab(id));
    this.selected = ids;
    this.selection = id;
    if (rebuild) {
      // A drag may have begun with the same click that changed the selection; carry it over.
      const drag = this.editDrag;
      this.loadScene(this.scene.id, true);
      const again = (old: Entity) => this.entities.find((e) => e.def === old.def);
      if (drag?.kind === 'move') {
        const items = drag.items.flatMap((item) => {
          const entity = again(item.entity);
          return entity ? [{ ...item, entity }] : [];
        });
        this.editDrag = items.length > 0 ? { ...drag, items } : null;
      } else if (drag?.kind === 'resize') {
        const entity = again(drag.entity);
        this.editDrag = entity ? { ...drag, entity } : null;
      } else {
        this.editDrag = drag;
      }
    }
    if (this.mode.kind === 'edit' && !this.editDrag && ids.length === 1) this.bringSelectionIntoView();
    this.drawOverlay();
  }

  getView(): EditView {
    return { zoom: this.zoom, tool: this.tool, grid: this.grid, brush: this.brush };
  }

  /** Edit mode: changes the zoom, the tool or the grid. Zooming keeps the middle of the view where it is. */
  setView(view: Partial<EditView>): void {
    if (view.tool) this.tool = view.tool;
    if (view.grid !== undefined) this.grid = view.grid;
    if (view.brush !== undefined) this.brush = view.brush;
    if (view.zoom !== undefined && view.zoom !== this.zoom) this.zoomTo(view.zoom);
    else this.drawOverlay();
  }

  /** Edit mode: zooms out until the whole world, and a little around it, can be seen. */
  fitWorld(): void {
    const { width, height } = this.view;
    this.zoom = clamp(Math.min(width / (this.scene.width * 1.12), height / (this.scene.height * 1.12)), MIN_ZOOM, MAX_ZOOM);
    this.setCamera((this.scene.width - width / this.zoom) / 2, (this.scene.height - height / this.zoom) / 2);
    this.drawOverlay();
    this.options.onView?.(this.getView());
  }

  /** The middle of what is on view, in world pixels: where a newly added object should appear. */
  viewCentre(): Point {
    const { width, height } = this.view;
    return { x: Math.round(this.camera.x + width / this.z / 2), y: Math.round(this.camera.y + height / this.z / 2) };
  }

  /** The zoom of the world in force: the editor's while editing, the camera's while playing. */
  get z(): number {
    return this.mode.kind === 'edit' ? this.zoom : this.playZoom;
  }

  /** The zoom of things fixed to the screen: the editor's while editing; while playing they never zoom. */
  private get hudZ(): number {
    return this.mode.kind === 'edit' ? this.zoom : 1;
  }

  /** Changes the zoom, keeping the world point under `anchor` (a point on the screen) where it is. */
  private zoomTo(zoom: number, anchor?: Point): void {
    const { width, height } = this.view;
    const at = anchor ?? { x: width / 2, y: height / 2 };
    const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    const world = { x: at.x / this.zoom + this.camera.x, y: at.y / this.zoom + this.camera.y };
    this.zoom = next;
    this.setCamera(world.x - at.x / next, world.y - at.y / next);
    this.drawOverlay();
    this.options.onView?.(this.getView());
  }

  /** Edit mode: where the phone-sized frame that holds screen-fixed objects sits on the canvas. At zoom 1 it is the canvas. */
  private hudOrigin(): Point {
    const { width, height } = this.view;
    return { x: (width - width * this.hudZ) / 2, y: (height - height * this.hudZ) / 2 };
  }

  getState(): GameState {
    return {
      mode: this.mode.kind,
      scene: this.scene.id,
      time: this.time,
      variables: Object.fromEntries([...this.variables, ...this.textVariables]),
      lists: Object.fromEntries([...this.lists].map(([name, items]) => [name, [...items]])),
      selection: this.selection,
      selected: [...this.selected],
      zoom: this.zoom,
      playZoom: this.playZoom,
      music: this.musicNow(),
      camera: { ...this.camera },
      particles: this.particles.length,
      look: this.look,
      darkness: this.darkness,
      sky: this.skyView ? (this.scene.sky ?? null) : null,
      shaking: this.shakeLeft > 0,
      paused: this.paused,
      soundOn: this.soundOn,
      fading: this.fade !== null,
      light: this.light,
      bag: this.carried(),
      flights: this.flights.length,
      weather: this.weather.state(),
      retro: this.retroFilter ? (this.scene.retro ?? 'none') : 'none',
      waves: this.waves.length,
      liquidFrame: this.liquidTiles.length ? this.liquidFrame : -1,
      focus: this.focus ? this.focus.entity.def.id : null,
      dialogue: this.dialogue ? { speaker: this.dialogue.speaker, text: this.dialogue.text, shown: this.dialogueShown() } : null,
      achievements: this.achievements(),
      toast: this.toast ? (this.toast.view.getChildAt(1) as Text).text : null,
      top: this.topScores(),
      punch: this.scenery.scale.x,
      shakeAt: { x: this.app.stage.position.x, y: this.app.stage.position.y },
      lit: this.lit.map((l) => ({ id: l.id, points: [...l.points] })),
      floats: this.floats.map((f) => ({ text: f.view.text, x: f.view.x, y: f.view.y, alpha: f.view.alpha })),
      entities: this.entities.map((e) => ({
        id: e.def.id,
        tags: e.def.tags,
        visible: e.visible,
        opacity: e.opacity * e.fade,
        frame: e.frame,
        flipped: e.facing < 0,
        anim: e.anim,
        scale: e.scale,
        health: e.health,
        grounded: e.grounded,
        vx: e.vx,
        vy: e.vy,
        angle: e.angle,
        values: Object.fromEntries(e.values),
        ...(e.def.visual.kind === 'text' ? { text: (e.view as Text).text } : {}),
        color: e.color,
        image: e.image,
        flashing: e.flash !== null,
        path: e.path.length,
        stretch: e.squash ? 1 + (e.squash.y - 1) * (e.squash.left / e.squash.span) : 1,
        effects: e.fx.length,
        ...this.boxOf(e),
      })),
    };
  }

  /** A touch at a point on the screen, in design pixels (the middle if omitted). For tests and keyboards. */
  tap(x = this.view.width / 2, y = this.view.height / 2): void {
    if (this.mode.kind !== 'play') return;
    this.taps.push({ x, y });
    this.lastTap = { x, y };
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  private sceneFor(mode: GameMode): Scene {
    const id = mode.scene ?? this.project.startScene;
    return this.project.scenes.find((s) => s.id === id) ?? this.project.scenes[0];
  }

  /** The outline of an object's picture (or the part of it a crop shows), worked out once per picture. */
  private readonly outlines = new Map<string, { x: number; y: number }[] | null>();
  private outlineOf(e: Entity): { x: number; y: number }[] | null {
    const v = e.def.visual;
    if (v.kind !== 'image') return null;
    const asset = e.image ?? v.asset;
    const crop = v.crop;
    const key = crop ? `${asset}:${crop.x}:${crop.y}:${crop.w}:${crop.h}` : asset;
    if (!this.outlines.has(key)) {
      const resource = this.textures.get(asset)?.texture.source.resource as CanvasImageSource | undefined;
      this.outlines.set(key, resource ? traceOutline(resource, crop) : null);
    }
    return this.outlines.get(key)!;
  }

  private async loadImages(project: GameProject): Promise<void> {
    await Promise.all(
      Object.entries(project.assets).map(async ([id, asset]) => {
        if (asset.type === 'sound') return preloadClip(asset.src);
        if (asset.type !== 'image' || this.textures.get(id)?.src === asset.src) return;
        const img = new Image();
        img.src = asset.src;
        await img.decode();
        const texture = Texture.from(img);
        // Pixel art keeps its hard edges however much it is scaled.
        if (asset.pixel) texture.source.scaleMode = 'nearest';
        this.textures.set(id, { src: asset.src, texture });
      }),
    );
  }

  /** Puts variables back to their starting values. Saved ones keep what is stored on the device unless `includeSaved`. */
  resetVariables(includeSaved: boolean): void {
    if (includeSaved) {
      this.variables.clear();
      this.textVariables.clear();
    }
    for (const l of this.project.lists ?? []) this.lists.set(l.name, [...l.initial]);
    for (const v of this.project.textVariables ?? []) {
      if (v.saved && !includeSaved) continue;
      let text = v.initial;
      if (v.saved) {
        try { text = localStorage.getItem(this.savedKey('#text.' + v.name)) ?? text; } catch { /* Storage unavailable. */ }
      }
      this.textVariables.set(v.name, text);
    }
    this.valuesChanged = true;
    for (const v of this.project.variables) {
      if (v.saved && !includeSaved) continue;
      this.variables.set(v.name, v.saved ? this.readSaved(v.name, v.initial) : v.initial);
    }
  }

  private loadScene(id: string, keepView = false): void {
    this.scene = this.project.scenes.find((s) => s.id === id) ?? this.project.scenes[0];
    const backdrop = this.scene.background ?? this.project.meta.background;
    this.app.renderer.background.color = backdrop;
    // A little larger than the screen, so a shake never shows its edge.
    this.backdrop.clear().rect(-60, -60, this.view.width + 120, this.view.height + 120).fill(backdrop);
    // On a phone taller or wider than the game, the strips beside it take the scene's colour instead of standing out.
    this.mount.style.background = backdrop;
    for (const layer of [this.world, this.hud]) {
      layer.removeChildren().forEach((child) => child.destroy({ children: true }));
    }
    // While playing, a painted tile map turns into the blocks it is made of; while editing it stays one object.
    const play = this.mode.kind === 'play';
    this.entities = this.scene.objects.flatMap((def) =>
      play && def.visual.kind === 'tiles' ? this.tileEntities(def, def.visual) : [this.createEntity(def, def.x, def.y)],
    );
    this.listChanged();
    this.entities.forEach((e) => this.layerOf(e).addChild(e.view));
    this.placeOnScreen(this.entities);
    this.healthBars = new Graphics();
    this.world.addChild(this.healthBars);
    // Coming through a door: whoever came is put at the door they arrive by, standing on its bottom edge.
    const arrival = this.arrival;
    this.arrival = null;
    const door = arrival && play ? this.entities.find((e) => e.def.tags.includes(arrival.at)) : undefined;
    if (arrival && door) {
      for (const e of this.entities) {
        if (e !== door && e.def.tags.includes(arrival.bring)) this.place(e, door.x + (door.width - e.width) / 2, door.y + door.height - e.height);
      }
    }
    this.playZoom = 1;
    this.zoomGlide = null;
    this.musicOverride = null;
    this.curtain.clear().rect(0, 0, this.view.width, this.view.height).fill('#000000');
    if (!this.fade) this.curtain.alpha = 0;
    this.landings = [];
    this.gravity = this.scene.gravity;
    // A scene with no physics in it pays nothing for the physics engine.
    const physical = [...this.scene.objects, ...this.scene.prefabs].flatMap((o) =>
      o.behaviors.filter((b): b is PhysicsBehavior | JointBehavior => b.type === 'physics' || b.type === 'joint'),
    );
    this.physics = play && physical.length > 0 ? new Physics<Entity>(this.scene.width, this.scene.height, physical) : null;
    if (this.physics) this.physics.outlineOf = (e) => this.outlineOf(e);
    this.physicsView.clear();
    this.physicsDrawn = false;
    // The painted backdrop goes behind the world, over the plain background colour.
    this.skyView?.destroy();
    this.skyView = null;
    if (this.scene.sky && this.scene.sky !== 'none') {
      this.skyView = new SkyView(this.scene.sky, this.view.width, this.view.height);
      this.scenery.addChildAt(this.skyView.container, 1);
    }
    this.darkness = clamp(this.scene.darkness ?? 0, 0, 1);
    this.weather.set(this.scene.weather ?? 'none', this.view.width, this.view.height);
    for (const f of this.floats.splice(0)) f.view.destroy();
    this.darknessGlide = null;
    this.look = this.scene.look ?? 'none';
    this.applyLook();
    this.emitters = [...this.scene.objects, ...this.scene.prefabs].some((o) => o.behaviors.some((b) => b.type === 'particles'));
    this.stick.clear();
    this.hasStick = [...this.scene.objects, ...this.scene.prefabs].some((o) => o.behaviors.some((b) => b.type === 'steer' && b.control === 'stick'));

    // Burst pieces, and things flying into the bag, were children of the layers and went with them.
    this.particles = [];
    this.flights = [];
    this.bagDrag = null;
    this.tweens = [];
    this.died = [];
    this.rewards = 0;
    this.paused = false;
    this.cameraTravel = 0;
    this.shakeLeft = 0;
    this.slowLeft = 0;
    for (const w of this.waves.splice(0)) w.filter.destroy();
    this.dialogue?.view.destroy({ children: true });
    this.dialogue = null;
    this.showTop(this.topScores());
    this.punch = null;
    this.focus = null;
    this.scenery.scale.set(1);
    this.slowScale = 1;
    this.app.stage.position.set(0, 0);
    // Music belongs to the game being played, never to the frozen picture in the editor.
    this.playMusic();

    this.time = 0;
    this.started = false;
    this.nextScene = null;
    this.waiting = [];
    this.outbox = [];
    this.inbox = [];
    this.taps = [];
    this.drops = [];
    this.swipes = [];
    this.keyTap = false;
    this.pressed.clear();
    this.heldOver.clear();
    for (const [id, p] of this.pointers) this.heldOver.set(id, { x: p.x, y: p.y });
    this.pointers.clear();
    this.ruleClock.clear();
    this.ruleDone.clear();
    this.ruleTruth.clear();
    this.ruleHeld.clear();
    this.touching.clear();
    this.editDrag = null;

    this.controlTags = new Set();
    for (const def of [...this.scene.objects, ...this.scene.prefabs]) {
      for (const b of def.behaviors) {
        if (b.type === 'jumper' && b.on === 'button') this.controlTags.add(b.buttonTag);
        if (b.type === 'walker' && b.control === 'buttons') this.controlTags.add(b.leftTag).add(b.rightTag);
      }
    }

    if (this.mode.kind === 'edit') this.addSelectedPrefabSample();
    if (!keepView) {
      this.camera.x = this.camera.y = 0;
      this.followCameraTarget(true);
    }
    this.setCamera(this.camera.x, this.camera.y);
    this.entities.forEach((e) => this.syncView(e));
    this.refreshTexts(true);
    this.drawOverlay();
  }

  /** The music that should be playing: what a rule started, else the scene's own. */
  private musicNow(): string | null {
    const id = this.musicOverride ?? this.scene.music;
    return this.mode.kind === 'play' && id ? id : null;
  }

  /** Starts the music that belongs now, or stops whatever was playing if there is none or sound is off. */
  playMusic(): void {
    const on = this.mode.kind === 'play' && this.project.sound && this.soundOn;
    const id = this.musicNow();
    if (!on || !id) return setMusic(null);
    // Music that comes with the engine is made the first time it is wanted.
    const music = isBuiltinMusic(id) ? builtinMusic(id) : this.project.assets[id]?.type === 'sound' ? this.project.assets[id].src : null;
    setMusic(music);
  }

  /**
   * The blocks a tile map is made of. Side-by-side cells of one kind in a row
   * become one long block, unless the kind is kept separate. Each block is an
   * object of its own that shares the map's id, so a rule about the map is about all of them.
   */
  private tileEntities(def: GameObject, tiles: TilesVisual): Entity[] {
    const made: Entity[] = [];
    const cell = Math.max(1, tiles.cell);
    tiles.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; ) {
        const key = row[c];
        const kind = tiles.kinds[key];
        if (key === EMPTY_TILE || !kind) {
          c += 1;
          continue;
        }
        let run = 1;
        if (!kind.separate && !kind.slope) while (row[c + run] === key) run += 1;
        const block: GameObject = {
          id: def.id,
          name: def.name,
          x: def.x + c * cell,
          y: def.y + r * cell,
          width: run * cell,
          height: cell,
          visual: kind.asset && this.textures.has(kind.asset)
            ? { kind: 'image', asset: kind.asset, ...(run > 1 ? { repeat: 'x' as const } : {}) }
            : { kind: 'rect', color: kind.color },
          tags: [...new Set([...def.tags, ...kind.tags])],
          visible: def.visible,
          behaviors: [],
          ...(def.opacity !== undefined ? { opacity: def.opacity } : {}),
          ...(def.parallax !== undefined ? { parallax: def.parallax } : {}),
          ...(kind.slope ? { slope: kind.slope } : {}),
        };
        // A material (and no picture of the user's own) is drawn cell by cell, each knowing which of its sides are open.
        if (kind.style && kind.style !== 'flat' && !(kind.asset && this.textures.has(kind.asset)) && !kind.slope) {
          const cells = Array.from({ length: run }, (_, i) => tileSides(tiles, r, c + i));
          this.tileLooks.set(block, { style: kind.style, cell, cells, variant: c + r * 3 });
        }
        made.push(this.createEntity(block, block.x, block.y));
        c += run;
      }
    });
    return made;
  }

  /** Edit mode: a selected prefab is drawn in the middle of the view so it can be seen and styled. */
  private addSelectedPrefabSample(): void {
    const prefab = this.scene.prefabs.find((p) => p.id === this.selection);
    if (!prefab) return;
    const { width, height } = this.view;
    const centre = prefab.fixed ? { x: width / 2, y: height / 2 } : this.viewCentre();
    const entity = this.createEntity(prefab, centre.x - prefab.width / 2, centre.y - prefab.height / 2);
    this.entities.push(entity);
    this.listChanged();
    this.layerOf(entity).addChild(entity.view);
  }

  createEntity(def: GameObject, x: number, y: number): Entity {
    const jumper = def.behaviors.find((b): b is JumperBehavior => b.type === 'jumper');
    const spawner = def.behaviors.find((b) => b.type === 'spawner');
    const launch = def.behaviors.find((b) => b.type === 'launch');
    const v = def.visual;
    const textures = (ids?: string[]) =>
      ids?.length ? ids.map((id) => this.textures.get(id)?.texture ?? Texture.EMPTY) : null;
    const animated = v.kind === 'image' && Boolean(v.frames?.length || v.moveFrames?.length || v.airFrames?.length || v.hurtFrames?.length);
    const byValue = v.kind === 'image' ? v.frameBy : undefined;
    const view = this.createView(def);
    // A repeated picture cannot also be an animation.
    const frames = v.kind === 'image' && animated && !(view instanceof TilingSprite) ? textures([v.asset, ...(v.frames ?? [])]) : null;
    let [vx, vy] = launch?.type === 'launch' ? [launch.vx, launch.vy] : [0, 0];
    if (launch?.type === 'launch' && launch.toward && launch.toward !== 'fixed') {
      // Aimed: toward where the screen was last touched, or toward the nearest object of a group.
      const from = { x: x + def.width / 2, y: y + def.height / 2 };
      let to: Point | null = null;
      if (launch.toward === 'tap') to = this.lastTap && this.inSpace(Boolean(def.fixed), this.lastTap);
      else {
        let best = Infinity;
        for (const other of this.entities) {
          if (!other.alive || !other.def.tags.includes(launch.targetTag ?? '')) continue;
          const centre = { x: other.x + other.width / 2, y: other.y + other.height / 2 };
          const distance = Math.hypot(centre.x - from.x, centre.y - from.y);
          if (distance < best) [best, to] = [distance, centre];
        }
      }
      const speed = launch.speed ?? 600;
      const distance = to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
      // With nothing to aim at it flies straight up, rather than not at all.
      [vx, vy] = to && distance > 0 ? [((to.x - from.x) / distance) * speed, ((to.y - from.y) / distance) * speed] : [0, -speed];
    }
    const facing = launch?.type === 'launch' && launch.face && (vx !== 0 || vy !== 0);
    const entity: Entity = {
      def,
      view,
      x,
      y,
      width: def.width,
      height: def.height,
      vx,
      vy,
      jumpsLeft: jumper?.maxJumps ?? 0,
      visible: def.visible,
      alive: true,
      seen: false,
      homeX: x,
      homeY: y,
      age: 0,
      spawnIn: spawner?.type !== 'spawner' ? 0 : spawner.everyDistance > 0 ? spawner.everyDistance : spawner.minInterval,
      angle: facing ? Math.atan2(vy, vx) : ((def.rotation ?? 0) * Math.PI) / 180,
      sway: 0,
      fade: 1,
      frames,
      moveFrames: frames && !byValue && v.kind === 'image' ? textures(v.moveFrames) : null,
      airFrames: frames && !byValue && v.kind === 'image' ? textures(v.airFrames) : null,
      hurtFrames: frames && !byValue && v.kind === 'image' ? textures(v.hurtFrames) : null,
      anim: 'idle',
      grounded: false,
      scale: 1,
      health: def.health ?? 0,
      spawned: false,
      frame: 0,
      facing: 1,
      lastX: x,
      lastY: y,
      prevX: x,
      prevY: y,
      ground: null,
      against: null,
      contactStamp: 0,
      airTime: 0,
      jumpAsked: 0,
      rising: false,
      trailIn: 0,
      tappable: false,
      heading: null,
      routeAt: 0,
      routeWay: 1,
      values: new Map(Object.entries(def.values ?? {})),
      slide: null,
      color: null,
      image: null,
      text: null,
      opacity: def.opacity ?? 1,
      flash: null,
      path: [],
      pathIn: 0,
      emitIn: 0,
      fx: this.effectsOf(def),
      squash: null,
    };
    this.applyFilters(entity);
    if (this.mode.kind === 'play' && !def.fixed) view.cullable = true;
    this.uids.set(entity, ++this.uidCounter);
    return entity;
  }

  /** The lasting effects an object asks for: a soft shadow behind it, a glow around it. */
  /**
   * Drops the costly effects for the rest of the session, so a slow phone
   * plays smoothly: no bloom, no soft shadows, no glows. The game is otherwise
   * the same. Public so that it can be tried.
   */
  lighten(): void {
    if (this.light) return;
    this.light = true;
    this.applyLook();
    // Half the rain and snow, and lights shine through walls again: both cost time every frame.
    this.weather.thin();
    for (const e of this.entities) {
      for (const f of e.fx) f.destroy();
      e.fx = [];
      this.applyFilters(e);
    }
  }

  private effectsOf(def: GameObject): Filter[] {
    const fx: Filter[] = [];
    if (this.light) return fx;
    if (def.shadow) fx.push(new DropShadowFilter({ offset: { x: 5, y: 9 }, blur: 4, alpha: 0.35, quality: 3 }));
    if (def.glow) fx.push(new GlowFilter({ color: def.glow, distance: 18, outerStrength: 2.4, innerStrength: 0, quality: 0.25 }));
    return fx;
  }

  /** Puts an object's effects on its picture: its own lasting ones, and a flash while it lasts. */
  applyFilters(e: Entity): void {
    const list = e.flash ? [e.flash.filter, ...e.fx] : e.fx;
    e.view.filters = list.length > 0 ? list : [];
  }

  /** Draws an object anew after a rule changed its colour or picture, in the same place among the others. */
  redraw(e: Entity): void {
    const old = e.view;
    const layer = old.parent;
    e.view = this.createView(e.def, e);
    if (e.image) {
      // A new picture replaces the animation, which was made of the old ones.
      e.frames = e.moveFrames = e.airFrames = e.hurtFrames = null;
    }
    if (this.mode.kind === 'play' && !e.def.fixed) e.view.cullable = true;
    if (layer) layer.addChildAt(e.view, layer.getChildIndex(old));
    old.destroy({ children: true });
    this.applyFilters(e);
    this.syncView(e);
    this.refreshTexts(true);
  }

  /** A shape, picture, text or bar as Pixi draws it. `look` carries a colour or picture a rule gave the object. */
  private createView(def: GameObject, look?: { color: string | null; image: string | null }): Container {
    const v = def.visual;
    const color = look?.color ?? ('color' in v ? v.color : '#888888');
    // A rule's picture shows on any shape; a text or a bar keeps its own kind of look.
    if (look?.image && v.kind !== 'text' && v.kind !== 'bar' && v.kind !== 'tiles') {
      const texture = this.textures.get(look.image)?.texture ?? Texture.EMPTY;
      const sprite = new Sprite(texture);
      sprite.pivot.set(texture.width / 2, texture.height / 2);
      if (look.color) sprite.tint = look.color;
      return sprite;
    }
    if (v.kind === 'terrain') {
      const ridge = v.heights.flatMap((y, i) => [i * def.width / (v.heights.length - 1), y * def.height]);
      const g = new Graphics().poly([...ridge, def.width, def.height, 0, def.height]).fill(look?.color ?? v.color);
      const reverse = v.heights.map((y, i) => [ridge[i * 2], Math.min(def.height, y * def.height + 9)]).reverse().flat();
      g.poly([...ridge, ...reverse]).fill({ color: 0xffffff, alpha: 0.28 });
      return centred(g, def);
    }
    if (def.slope && v.kind !== 'text' && v.kind !== 'tiles' && v.kind !== 'image') {
      // A ramp is drawn as the triangle it is.
      const points = def.slope === 'rise'
        ? [0, def.height, def.width, def.height, def.width, 0]
        : [0, 0, 0, def.height, def.width, def.height];
      return centred(new Graphics().poly(points).fill(color), def);
    }
    // A block of a tile map made of a material: its cells side by side, each drawn for the sides of it that are open.
    const material = this.tileLooks.get(def);
    if (material && !look?.color) {
      const box = new Container();
      material.cells.forEach((open, i) => {
        const sprite = new Sprite(tileTexture(material.style, material.cell, open, material.variant + i));
        if (ANIMATED_TILE_STYLES.includes(material.style)) this.liquidTiles.push({ sprite, style: material.style, cell: material.cell, open, variant: material.variant + i });
        sprite.position.set(i * material.cell, 0);
        sprite.width = sprite.height = material.cell;
        box.addChild(sprite);
      });
      return centred(box, def);
    }
    switch (v.kind) {
      case 'bar':
        // Drawn by refreshTexts, whenever the variable it shows changes.
        return centred(new Graphics(), def);
      case 'bag':
        // Drawn by refreshTexts too, whenever what the player carries changes.
        return centred(new Container(), def);
      case 'rect':
      case 'ellipse': {
        const g = new Graphics();
        const [w, h] = [def.width, def.height];
        const outline = v.outline ? { width: Math.max(3, Math.min(w, h) * 0.06), color: v.outline, alignment: 1 } : null;
        // A shape drawn as the shape its physics meets others with: a capsule, a triangle, a hexagon.
        const shape = v.kind === 'rect' ? def.behaviors.find((b): b is PhysicsBehavior => b.type === 'physics')?.shape : undefined;
        const hexagon = [0, 1, 2, 3, 4, 5].flatMap((i) => [w / 2 + (w / 2) * Math.cos((i * Math.PI) / 3), h / 2 + (h / 2) * Math.sin((i * Math.PI) / 3)]);
        const draw = () =>
          v.kind === 'ellipse' ? g.ellipse(w / 2, h / 2, w / 2, h / 2)
          : shape === 'capsule' ? g.roundRect(0, 0, w, h, Math.min(w, h) / 2)
          : shape === 'triangle' ? g.poly([0, h, w, h, w / 2, 0])
          : shape === 'hexagon' ? g.poly(hexagon)
          : g.roundRect(0, 0, w, h, v.radius ?? 0);
        if (v.shade) {
          // Lit from above: a lighter top, the colour itself, a deeper bottom; and a soft shine near the top.
          draw().fill(new FillGradient({
            type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, textureSpace: 'local',
            colorStops: [{ offset: 0, color: shadeOf(color, 0.32) }, { offset: 0.5, color }, { offset: 1, color: shadeOf(color, -0.28) }],
          }));
          const inset = Math.min(w, h) * 0.12;
          if (v.kind === 'rect' && shape !== 'triangle' && shape !== 'hexagon') g.roundRect(inset, inset * 0.6, w - inset * 2, Math.max(2, h * 0.22), Math.max(0, (shape === 'capsule' ? Math.min(w, h) / 2 : v.radius ?? 0) - inset)).fill({ color: '#ffffff', alpha: 0.28 });
          else g.ellipse(w / 2, h * 0.28, w * 0.3, h * 0.13).fill({ color: '#ffffff', alpha: 0.3 });
        } else draw().fill(color);
        if (outline) draw().stroke(outline);
        return centred(g, def);
      }
      case 'tiles':
        return centred(this.drawTiles(v), def);
      case 'image': {
        const texture = this.textures.get(v.asset)?.texture ?? Texture.EMPTY;
        // A scrolling picture repeats to fill the object instead of stretching over it.
        if (v.repeat || def.behaviors.some((b) => b.type === 'scrollImage')) {
          const tiling = centred(new TilingSprite({ texture, width: def.width, height: def.height }), def);
          if (look?.color) tiling.tint = look.color;
          return tiling;
        }
        const shown = v.crop && texture !== Texture.EMPTY ? cropped(texture, v.crop) : texture;
        const sprite = new Sprite(shown);
        // Pivot is in the texture's own pixels, before the sprite is scaled to the object's size.
        sprite.pivot.set(shown.width / 2, shown.height / 2);
        if (look?.color) sprite.tint = look.color;
        return sprite;
      }
      case 'text': {
        const text = new Text({
          text: '',
          style: {
            fontFamily: [this.project.meta.fontFamily, FALLBACK_FONT, 'sans-serif'],
            fontSize: v.size,
            fontWeight: v.weight ?? 'normal',
            fill: color,
            // A line thick enough to read white letters over a bright sky or a light.
            stroke: v.outline ? { color: v.outline, width: Math.max(3, Math.round(v.size / 7)), join: 'round' } : undefined,
            dropShadow: v.shadow ? { color: '#000000', alpha: 0.45, blur: Math.max(2, v.size / 14), distance: Math.max(2, v.size / 14), angle: Math.PI / 2 } : undefined,
            // Marks above and below the measured line box get clipped without padding.
            padding: Math.ceil(v.size * 0.4),
          },
        });
        text.anchor.set(v.align === 'left' ? 0 : v.align === 'right' ? 1 : 0.5, 0);
        return text;
      }
    }
  }

  /** Edit mode: a whole tile map as one picture. Coloured cells share one drawing; pictured cells are a picture each. */
  private drawTiles(v: TilesVisual): Container {
    const box = new Container();
    const shapes = new Graphics();
    box.addChild(shapes);
    const cell = Math.max(1, v.cell);
    v.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const kind = v.kinds[row[c]];
        if (row[c] === EMPTY_TILE || !kind) continue;
        const [x, y] = [c * cell, r * cell];
        const texture = kind.asset ? this.textures.get(kind.asset)?.texture : undefined;
        const material = kind.style && kind.style !== 'flat' && !kind.slope ? kind.style : null;
        if ((texture || material) && !kind.slope) {
          const sprite = new Sprite(texture ?? tileTexture(material!, cell, tileSides(v, r, c), Math.round(c + r * 3)));
          sprite.position.set(x, y);
          sprite.width = cell;
          sprite.height = cell;
          box.addChild(sprite);
        } else if (kind.slope === 'rise') shapes.poly([x, y + cell, x + cell, y + cell, x + cell, y]).fill(kind.color);
        else if (kind.slope === 'fall') shapes.poly([x, y, x, y + cell, x + cell, y + cell]).fill(kind.color);
        else shapes.rect(x, y, cell, cell).fill(kind.color);
      }
    });
    return box;
  }

  layerOf(e: Entity): Container {
    return e.def.fixed ? this.hud : this.world;
  }

  private syncView(e: Entity): void {
    const view = e.view;
    // Distant scenery lags behind the camera. While editing, everything is shown where it was placed.
    const depth = this.mode.kind === 'play' && !e.def.fixed ? 1 - (e.def.parallax ?? 1) : 0;
    const behind = e.slide ? e.slide.left / e.slide.span : 0;
    const x = e.x + this.camera.x * depth + (e.slide?.x ?? 0) * behind;
    const y = e.y + this.camera.y * depth + (e.slide?.y ?? 0) * behind;
    if (e.def.visual.kind === 'text') {
      view.position.set(x, y);
      view.scale.set(e.scale);
    } else {
      // Shapes and images turn around their centre, so their view sits at the centre.
      view.position.set(x + e.width / 2, y + e.height / 2);
      // The entity's size can differ from the definition's while a resize handle is being dragged.
      if (view instanceof TilingSprite) {
        view.width = e.width;
        view.height = e.height;
        view.pivot.set(e.width / 2, e.height / 2);
        const repeat = e.def.visual.kind === 'image' ? e.def.visual.repeat : undefined;
        // One copy of the picture is as tall as the object (or as wide, when it repeats downward).
        if (repeat) view.tileScale.set(repeat === 'x' ? e.height / view.texture.height : e.width / view.texture.width);
      } else if (view instanceof Sprite) {
        view.width = e.width;
        view.height = e.height;
        // Setting the width keeps the mirror the picture had, so the way it faces is set afresh, not turned
        // again: turned again each time, a hero facing left changed sides at every drawing (the blinking).
        view.scale.set(Math.abs(view.scale.x) * e.scale * e.facing, Math.abs(view.scale.y) * e.scale);
      } else {
        view.scale.set((e.width / e.def.width) * e.scale, (e.height / e.def.height) * e.scale);
      }
    }
    if (e.squash && e.def.visual.kind !== 'text') {
      // Squashed or stretched about its feet, easing back to its own shape.
      const k = e.squash.left / e.squash.span;
      const [sx, sy] = [1 + (e.squash.x - 1) * k, 1 + (e.squash.y - 1) * k];
      view.scale.set(view.scale.x * sx, view.scale.y * sy);
      view.position.y += (e.height * (1 - sy)) / 2;
    }
    view.rotation = e.angle;
    const opacity = e.opacity * e.fade;
    if (this.mode.kind === 'edit') {
      view.visible = true;
      view.alpha = e.visible ? opacity : HIDDEN_ALPHA_IN_EDITOR;
    } else {
      view.visible = e.visible;
      // Blinks while it cannot be hurt again.
      view.alpha = this.time < (e.hurtUntil ?? 0) && Math.floor(this.time * 14) % 2 ? opacity * 0.25 : opacity;
    }
  }

  /** Small health bars over the objects that show one, drawn in the world above everything in it. */
  private drawHealthBars(): void {
    const g = this.healthBars;
    if (!g || g.destroyed) return;
    g.clear();
    if (this.mode.kind !== 'play') return;
    for (const e of this.entities) {
      const full = e.def.health;
      if (!e.def.healthBar || !full || !e.alive || !e.visible || e.def.fixed) continue;
      const share = clamp(e.health / full, 0, 1);
      const w = Math.max(40, e.width);
      const [x, y] = [e.x + (e.width - w) / 2, e.y - 18];
      g.roundRect(x - 2, y - 2, w + 4, 14, 7).fill({ color: '#0d1330', alpha: 0.85 });
      if (share > 0) g.roundRect(x, y, Math.max(10, w * share), 10, 5).fill(share > 0.5 ? '#34d17e' : share > 0.25 ? '#ffd23f' : '#ff5a6e');
      g.roundRect(x + 2, y + 1, Math.max(6, (w - 4) * share), 3, 1.5).fill({ color: '#ffffff', alpha: 0.35 });
    }
  }

  // ── Camera ───────────────────────────────────────────────────────────────

  private setCamera(x: number, y: number): void {
    const { width, height } = this.view;
    const z = this.z;
    const margin = this.mode.kind === 'edit' ? EDIT_MARGIN / z : 0;
    // A world that fits in the view with room to spare sits in its middle; a larger one is slid over.
    const fit = (at: number, world: number, view: number, low = false) =>
      world + margin * 2 <= view ? (low ? world - view : (world - view) / 2) : clamp(at, -margin, world - view + margin);
    this.camera.x = fit(x, this.scene.width, width / z);
    this.camera.y = fit(y, this.scene.height, height / z, this.mode.kind === 'play' && this.scene.gravity > 0);
    this.world.scale.set(z);
    this.world.position.set(-this.camera.x * z, -this.camera.y * z);
    const origin = this.hudOrigin();
    this.hud.scale.set(this.hudZ);
    this.hud.position.set(origin.x, origin.y);
  }

  /** Puts the object with the camera behavior in the middle. `fresh` places the view anew, ignoring any one-way lock. */
  private followCameraTarget(fresh = false, dt = 0): void {
    // A "focus" holds the camera on something else for a while, gliding there and back.
    const focus = this.focus && this.focus.left > 0 && this.focus.entity.alive ? this.focus.entity : null;
    if (this.focus) {
      this.focus.left -= dt;
      if (!focus) this.focus = null;
    }
    const target = focus ?? this.entities.find((e) => e.alive && !e.def.fixed && e.def.behaviors.some((b) => b.type === 'camera'));
    if (!target) return;
    const { width, height } = this.view;
    const camera = focus ? undefined : target.def.behaviors.find((b) => b.type === 'camera');
    const lock = camera?.type === 'camera' && !fresh ? camera.lock : 'free';
    const smooth = focus ? 0.35 : camera?.type === 'camera' && !fresh ? (camera.smooth ?? 0) : 0;
    // A soft camera closes a share of the gap each moment instead of all of it.
    const share = smooth > 0 ? 1 - Math.exp(-dt / (smooth * 0.4)) : 1;
    const [vw, vh] = [width / this.z, height / this.z];
    let wantX = target.x + target.width / 2 - vw / 2;
    let wantY = target.y + target.height / 2 - vh / 2;
    // In a room, the view keeps within its walls; a room smaller than the view sits in its middle.
    const roomTag = camera?.type === 'camera' ? camera.roomTag : undefined;
    if (roomTag) {
      const middle = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
      const room = this.entities.find((e) => e.alive && e.def.tags.includes(roomTag) && contains({ x: e.x, y: e.y, width: e.width, height: e.height }, middle));
      if (room) {
        wantX = room.width <= vw ? room.x + (room.width - vw) / 2 : clamp(wantX, room.x, room.x + room.width - vw);
        wantY = room.height <= vh ? room.y + (room.height - vh) / 2 : clamp(wantY, room.y, room.y + room.height - vh);
      }
    }
    const x = this.camera.x + (wantX - this.camera.x) * share;
    const y = this.camera.y + (wantY - this.camera.y) * share;
    // A locked view never goes back: up means y only shrinks, right means x only grows.
    this.setCamera(lock === 'right' ? Math.max(this.camera.x, x) : x, lock === 'up' ? Math.min(this.camera.y, y) : y);
  }

  /** Edit mode: slides the view so that a newly selected object far away can be seen. */
  private bringSelectionIntoView(): void {
    const e = this.entities.find((x) => x.def.id === this.selection);
    if (!e || e.def.fixed) return;
    const [width, height] = [this.view.width / this.z, this.view.height / this.z];
    const box = this.boxOf(e);
    const inView =
      box.x + box.width > this.camera.x && box.x < this.camera.x + width &&
      box.y + box.height > this.camera.y && box.y < this.camera.y + height;
    if (!inView) this.setCamera(box.x + box.width / 2 - width / 2, box.y + box.height / 2 - height / 2);
  }

  /** A point on the screen, in the coordinates an object lives in: the screen for fixed objects, the world for the rest. */
  inSpaceOf(e: Entity, screen: Point): Point {
    return this.inSpace(Boolean(e.def.fixed), screen);
  }

  inSpace(fixed: boolean, screen: Point): Point {
    const z = this.z;
    if (!fixed) return { x: screen.x / z + this.camera.x, y: screen.y / z + this.camera.y };
    const origin = this.hudOrigin();
    return { x: (screen.x - origin.x) / this.hudZ, y: (screen.y - origin.y) / this.hudZ };
  }

  // ── Simulation ───────────────────────────────────────────────────────────

  private update(dt: number): void {
    if (this.mode.kind !== 'play') return;
    if (this.paused) return this.updatePaused();
    this.time += dt;
    this.listChanged();
    let t = this.profile ? performance.now() : 0;
    const { width: W, height: H } = this.view;
    const tapsOnScreen = this.time > TAP_GRACE ? this.taps.filter((t) => !this.onControl(t)) : [];
    const screenTapped = this.time > TAP_GRACE && (tapsOnScreen.length > 0 || this.keyTap);
    const spawned: { entity: Entity; above: Entity }[] = [];
    // What the behaviors of one object share during its step (src/blocks/behaviors/); the same each object, reset for it.
    const frame: BehaviorStep = { dt, W, H, screenTapped, spawned, body: null, steered: false, attached: false };
    this.landings = [];
    this.marks.clear();
    this.blockedCells.clear();

    // Things that move by themselves go first, then bodies (which may be standing on them),
    // then things attached to others, so nothing trails a step behind what it rides on.
    const turn = (e: Entity) => (e.def.behaviors.some((b) => b.type === 'attach') ? 2 : e.def.behaviors.some((b) => b.type === 'body') ? 1 : 0);
    const order = this.entities.map((e) => ({ e, turn: turn(e) })).sort((a, b) => a.turn - b.turn);
    for (const { e } of order) {
      if (!e.alive) continue;
      e.age += dt;
      this.applyState(e);
      frame.body = null;
      frame.steered = false;
      frame.attached = false;
      if (e.animApplied) {
        e.x -= e.animApplied.x;
        e.y -= e.animApplied.y;
        e.angle -= (e.animApplied.angle * Math.PI) / 180;
        e.animApplied = null;
      }
      // The wave's push from last frame is taken back before anything else moves the object.
      if (e.sway !== 0) {
        const wave = e.def.behaviors.find((b) => b.type === 'wave');
        if (wave?.type === 'wave' && wave.axis === 'x') e.x -= e.sway;
        else e.y -= e.sway;
        e.sway = 0;
      }

      // Every behavior is a block in its own file (src/blocks/behaviors/); some leave their work to the core below.
      for (const b of e.def.behaviors) behaviorBlocks.get(b.type)?.step?.(this, e, b as never, frame);
      // Read back what the behaviors left (as BehaviorStep: TypeScript would otherwise still see the reset values above).
      const { body, steered, attached } = frame as BehaviorStep;

      const dragging = [...this.pointers.values()].find((p) => p.drag?.entity === e && !p.drag.held);
      if (dragging?.drag) {
        const finger = this.inSpaceOf(e, dragging);
        e.x = finger.x - dragging.drag.dx;
        e.y = finger.y - dragging.drag.dy;
        e.vx = 0;
        e.vy = 0;
      } else if (attached) {
        e.vx = 0;
        e.vy = 0;
      } else if (body) {
        const moves = e.def.behaviors.find((m): m is MovesBehavior => m.type === 'moves');
        if (moves) this.stepMoves(e, moves, body, dt);
        this.moveBody(e, body, dt, steered);
        if (moves && e.pounding && e.grounded) this.poundLanded(e);
      } else if (this.physics?.moves(e)) {
        // The physics world moves it, after everything else has had its say.
      } else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }
      // Whatever the player steers stays inside the world.
      if (steered) {
        const limit = e.def.fixed ? { width: W, height: H } : this.scene;
        if (body?.edges !== 'wrap') e.x = clamp(e.x, 0, limit.width - e.width);
        if (!body?.gravity) e.y = clamp(e.y, 0, limit.height - e.height);
      }

      const wave = e.def.behaviors.find((b) => b.type === 'wave');
      if (wave?.type === 'wave') {
        e.sway = wave.distance * Math.sin((2 * Math.PI * e.age) / wave.seconds);
        if (wave.axis === 'x') e.x += e.sway;
        else e.y += e.sway;
      }
      // An animation on a timeline: added on top of wherever everything else has put it.
      const anim = e.def.behaviors.find((b): b is AnimateBehavior => b.type === 'animate');
      if (anim && !this.physics?.moves(e)) {
        const pose = { ...poseAt(anim, localTime(anim, e.age)) };
        if (anim.pivot) {
          // Turned about a joint, not its middle: its middle swings round the joint (a cut-out limb).
          const rad = (pose.angle * Math.PI) / 180;
          const cx = (0.5 - anim.pivot.x) * e.width;
          const cy = (0.5 - anim.pivot.y) * e.height;
          pose.x += cx * Math.cos(rad) - cy * Math.sin(rad) - cx;
          pose.y += cx * Math.sin(rad) + cy * Math.cos(rad) - cy;
        }
        e.x += pose.x;
        e.y += pose.y;
        e.angle += (pose.angle * Math.PI) / 180;
        // A pulse sets its own size each step; the animation's size goes on top of it.
        e.scale = (e.def.behaviors.some((b) => b.type === 'pulse') ? e.scale : 1) * pose.scale;
        e.opacity = (e.def.opacity ?? 1) * pose.opacity;
        e.animApplied = pose;
      }

      // Looks: which animation image is showing, and which way the picture faces.
      const visual = e.def.visual;
      if (e.frames) {
        // In the air beats moving, which beats standing still.
        // (Seen from above, with no gravity, walking up and down is moving too; a picture that only bobs is not walking.)
        const fromAbove = body ? !body.gravity : !this.physics?.moves(e) && e.def.behaviors.some((b) => b.type === 'steer' || b.type === 'chase');
        if (Math.abs(e.x - e.lastX) > 0.01 || (fromAbove && Math.abs(e.y - e.lastY) > 0.01)) e.movedAt = this.time;
        const moving = this.time - (e.movedAt ?? -1) < 0.12;
        e.anim = e.airFrames && (body?.gravity || this.physics?.moves(e)) && !e.grounded ? 'air' : e.moveFrames && moving ? 'move' : 'idle';
        if (e.hurtFrames && this.time < (e.hurtPoseUntil ?? 0)) e.anim = 'hurt';
        const set = e.anim === 'hurt' ? e.hurtFrames! : e.anim === 'air' ? e.airFrames! : e.anim === 'move' ? e.moveFrames! : e.frames;
        const shown = Math.floor(e.age * ((visual.kind === 'image' && visual.fps) || 8));
        // A picture chosen by one of the object's values does not animate: the value says which one shows.
        const chosen = visual.kind === 'image' && visual.frameBy ? clamp(Math.round(e.values.get(visual.frameBy) ?? 0), 0, set.length - 1) : null;
        e.frame = chosen ?? (visual.kind === 'image' && visual.once ? Math.min(shown, set.length - 1) : shown % set.length);
        const sprite = e.view as Sprite;
        if (sprite.texture !== set[e.frame]) {
          sprite.texture = set[e.frame];
          sprite.pivot.set(sprite.texture.width / 2, sprite.texture.height / 2);
        }
      }
      if (!(body?.gravity || this.physics?.moves(e)) && Math.hypot(e.x - e.lastX, e.y - e.lastY) >= 30 * dt) {
        const turn = Math.round(Math.atan2(e.y - e.lastY, e.x - e.lastX) / (Math.PI / 4)) * (Math.PI / 4);
        e.went = { x: Math.round(Math.cos(turn) * 1000) / 1000, y: Math.round(Math.sin(turn) * 1000) / 1000 };
      }
      if (visual.kind === 'image' && visual.flip) {
        // It turns to the way it goes sideways. Going (nearly) up or down without gravity keeps the way it faces:
        // a finger on the stick never goes quite straight, and turning round at every wobble looked like blinking.
        const [dx, dy] = [e.x - e.lastX, e.y - e.lastY];
        // (Nor does a creep along a wall it is pushed against, slower than 30 pixels a second.)
        const sideways = body?.gravity || this.physics?.moves(e) ? Math.abs(dx) > 0.01 : Math.abs(dx) >= Math.max(30 * dt, Math.abs(dy) * 0.35);
        const way = dx < 0 ? -1 : 1;
        if (sideways && way !== e.facing && this.time - (e.turnedAt ?? -1) > 0.15) {
          e.facing = way;
          e.turnedAt = this.time;
        }
      }
      e.lastX = e.x;
      e.lastY = e.y;
    }

    if (this.profile) t = this.lap('behaviors and bodies', t);
    this.separateBodies();
    // New objects draw just above the spawner that made them.
    for (const { entity, above } of spawned) this.insertAbove(entity, above);
    if (this.profile) t = this.lap('bump separation', t);
    if (this.physics) this.stepPhysics(dt);
    if (this.profile) t = this.lap('real physics', t);
    const cameraBefore = { ...this.camera };
    this.followCameraTarget(false, dt);
    this.cameraTravel = Math.hypot(this.camera.x - cameraBefore.x, this.camera.y - cameraBefore.y);

    // Which objects have just left the view.
    const left: Entity[] = [];
    for (const e of this.entities) {
      if (!e.alive) continue;
      const x = e.def.fixed ? e.x : e.x - this.camera.x;
      const y = e.def.fixed ? e.y : e.y - this.camera.y;
      // A zoomed camera sees less (or more) of the world than the screen's own size.
      const [viewW, viewH] = e.def.fixed ? [W, H] : [W / this.z, H / this.z];
      const inside = x < viewW && x + e.width > 0 && y < viewH && y + e.height > 0;
      if (inside) e.seen = true;
      else if (e.seen) {
        e.seen = false;
        left.push(e);
      } else if (e.spawned && (x < -LOST_DISTANCE || x > W + LOST_DISTANCE || y < -LOST_DISTANCE || y > H + LOST_DISTANCE)) {
        // Only things created during play are tidied away; what the user placed stays, however far off.
        e.alive = false;
      }
    }

    if (this.profile) t = this.lap('camera and leaving the view', t);
    this.runRules(dt, screenTapped, left);
    this.physics?.endStep();
    const due = this.waiting.filter((w) => w.at <= this.time);
    this.waiting = this.waiting.filter((w) => w.at > this.time);
    for (const w of due) this.runActions(w.actions, w.context);
    if (this.profile) t = this.lap('rules', t);
    this.stepEffects(dt);
    if (this.profile) t = this.lap('effects and particles', t);

    for (const e of left) {
      const mover = e.def.behaviors.find((b) => b.type === 'mover');
      if (mover?.type !== 'mover' || !e.alive) continue;
      if (mover.atEdge === 'remove') e.alive = false;
      else if (mover.atEdge === 'wrap') {
        const x = e.x - this.camera.x;
        const y = e.y - this.camera.y;
        if (x + e.width <= 0) e.x += W + e.width;
        else if (x >= W) e.x -= W + e.width;
        if (y + e.height <= 0) e.y += H + e.height;
        else if (y >= H) e.y -= H + e.height;
      }
    }

    for (const e of this.entities) {
      if (e.alive) {
        e.prevX = e.x;
        e.prevY = e.y;
        e.tappable = e.visible;
        if (e.slide && (e.slide.left -= dt) <= 0) e.slide = null;
        this.syncView(e);
      } else e.view.destroy({ children: true });
    }
    this.entities = this.entities.filter((e) => e.alive);
    this.listChanged();
    this.refreshTexts(spawned.length > 0 || this.valuesChanged);
    this.valuesChanged = false;
    if (this.profile) t = this.lap('pictures and texts', t);

    if (this.hasStick) {
      const finger = [...this.pointers.values()].find((p) => !p.drag && !this.onControl({ x: p.startX, y: p.startY }));
      this.stick.clear();
      if (finger) {
        const pull = Math.hypot(finger.x - finger.startX, finger.y - finger.startY);
        const reach = Math.min(pull, STICK_REACH) / (pull || 1);
        this.stick
          .circle(finger.startX, finger.startY, STICK_REACH).fill({ color: '#ffffff', alpha: 0.18 }).stroke({ width: 4, color: '#ffffff', alpha: 0.5 })
          .circle(finger.startX + (finger.x - finger.startX) * reach, finger.startY + (finger.y - finger.startY) * reach, 34).fill({ color: '#ffffff', alpha: 0.6 });
      } else if (this.mode.kind === 'play') {
        // No finger down: a faint stick resting in the lower left says how to move (a finger anywhere works).
        const { height: H } = this.view;
        const [x, y] = [40 + STICK_REACH, H - 60 - STICK_REACH];
        this.stick
          .circle(x, y, STICK_REACH).fill({ color: '#ffffff', alpha: 0.1 }).stroke({ width: 4, color: '#ffffff', alpha: 0.3 })
          .circle(x, y, 34).fill({ color: '#ffffff', alpha: 0.35 });
      }
    }

    this.taps = [];
    this.drops = [];
    this.swipes = [];
    this.keyTap = false;
    this.pressed.clear();
    this.started = true;
    this.changeScene();
  }

  /** While paused nothing moves and no clock runs; only rules about taps act, so that one of them can resume the game. */
  private updatePaused(): void {
    const tapped = this.taps.length > 0 || this.keyTap;
    if (this.dialogue) {
      this.stepDialogue(tapped);
      this.taps = [];
      this.drops = [];
      this.swipes = [];
      this.keyTap = false;
      this.pressed.clear();
      return;
    }
    for (const rule of this.scene.rules) {
      if (rule.when.type !== 'tap' && rule.when.type !== 'tapObject') continue;
      for (const context of this.fired(rule, { dt: 0, screenTapped: tapped, left: [] })) {
        const ran = [rule.condition, ...(rule.also ?? [])].every((c) => !c || this.holds(c, context));
        this.logRule(rule.id, ran);
        if (ran) this.runActions(rule.then, context);
        else if (rule.otherwise?.length) this.runActions(rule.otherwise, context);
      }
    }
    for (const e of this.entities) {
      e.tappable = e.visible;
      this.syncView(e);
    }
    this.taps = [];
    this.drops = [];
    this.swipes = [];
    this.keyTap = false;
    this.pressed.clear();
    this.changeScene();
  }

  /**
   * Bodies that bump into a group (`bumpTag`) are pushed out of whatever of that group they overlap,
   * along the shorter way out. When the other has a body too, each gives way by half; nothing is pushed
   * into a wall of its own solid group, so the other gives way by all of it instead. Speed into the other is
   * dropped, so neither keeps pressing and jittering. A few rounds settle a crowd.
   */
  private separateBodies(): void {
    const bumpers = this.entities.filter((e) => e.alive && e.visible && this.bodyOf(e)?.bumpTag);
    if (!bumpers.length) return;
    const free = (e: Entity, dx: number, dy: number) => {
      const solid = this.bodyOf(e)?.solidTag;
      if (!solid) return true;
      const [x, y] = [e.x + dx, e.y + dy];
      return !this.tagged(solid).some((s) => s !== e && s.alive && s.visible && !s.def.slope &&
        x < s.x + s.width - 0.01 && x + e.width > s.x + 0.01 && y < s.y + s.height - 0.01 && y + e.height > s.y + 0.01);
    };
    for (let round = 0; round < 3; round++) {
      let moved = false;
      for (const e of bumpers) {
        const tag = this.bodyOf(e)!.bumpTag!;
        for (const o of this.tagged(tag)) {
          if (o === e || !o.alive || !o.visible) continue;
          // Measured on the collision boxes (inside any hitbox inset), so that once apart they still just touch.
          const ie = e.def.hitboxInset ?? 0;
          const io = o.def.hitboxInset ?? 0;
          const overlapX = Math.min(e.x + e.width - ie, o.x + o.width - io) - Math.max(e.x + ie, o.x + io);
          const overlapY = Math.min(e.y + e.height - ie, o.y + o.height - io) - Math.max(e.y + ie, o.y + io);
          if (overlapX <= 0.01 || overlapY <= 0.01) continue;
          const alongX = overlapX < overlapY;
          const sign = alongX ? (e.x + e.width / 2 < o.x + o.width / 2 ? -1 : 1) : (e.y + e.height / 2 < o.y + o.height / 2 ? -1 : 1);
          const depth = alongX ? overlapX : overlapY;
          const otherMoves = !!this.bodyOf(o) && !o.def.fixed;
          let mine = otherMoves ? depth / 2 : depth;
          let theirs = depth - mine;
          const step = (n: number) => (alongX ? [sign * n, 0] : [0, sign * n]) as [number, number];
          if (!free(e, ...step(mine))) [mine, theirs] = [0, otherMoves ? depth : 0];
          else if (theirs && !free(o, ...step(-theirs))) [mine, theirs] = [depth, 0];
          if (mine && !free(e, ...step(mine))) mine = 0;
          if (theirs && !free(o, ...step(-theirs))) theirs = 0;
          if (!mine && !theirs) continue;
          const [ex, ey] = step(mine);
          const [ox, oy] = step(-theirs);
          e.x += ex; e.y += ey;
          o.x += ox; o.y += oy;
          // Stop pressing into each other.
          if (alongX) {
            if (Math.sign(e.vx) === -sign) e.vx = 0;
            if (otherMoves && Math.sign(o.vx) === sign) o.vx = 0;
          } else {
            if (Math.sign(e.vy) === -sign) e.vy = 0;
            if (otherMoves && Math.sign(o.vy) === sign) o.vy = 0;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  /** The objects of each group, in the game's order; gathered when first asked for in a step, and again after the list changes. */
  private byTag = new Map<string, Entity[]>();

  /** The objects of a group (alive or not, seen or not: callers check), without looking through every object. */
  tagged(tag: string): Entity[] {
    let list = this.byTag.get(tag);
    if (!list) {
      list = this.entities.filter((e) => e.def.tags.includes(tag));
      this.byTag.set(tag, list);
    }
    return list;
  }

  /** The list of objects changed: the groups are gathered again, and contact questions look again. */
  private listChanged(): void {
    this.byTag.clear();
    this.contacts.stale();
  }

  private bodyOf(e: Entity): BodyBehavior | undefined {
    return e.def.behaviors.find((b): b is BodyBehavior => b.type === 'body');
  }

  /** Moves an object with a body one step, stopping it at objects of its solid group and, if asked, at the world's edges. */
  private moveBody(e: Entity, body: BodyBehavior, dt: number, steered = false): void {
    // Whatever it stands on carries it along: a moving platform, a lift.
    if (e.ground?.alive) {
      e.x += e.ground.x - e.ground.prevX;
      e.y += e.ground.y - e.ground.prevY;
    }
    e.ground = null;
    e.against = null;
    const wasGrounded = e.grounded;
    e.wallSide = 0;
    if (body.gravity) e.vy += this.gravity * dt;
    const fallSpeed = e.vy;
    // Friction slows what is not being steered: on the ground when it has weight, all the time when seen from above.
    if (body.friction && body.friction > 0 && !steered && (!body.gravity || wasGrounded)) {
      const keep = Math.exp(-body.friction * 12 * dt);
      e.vx *= keep;
      if (!body.gravity) e.vy *= keep;
      if (Math.abs(e.vx) < 2) e.vx = 0;
      if (!body.gravity && Math.abs(e.vy) < 2) e.vy = 0;
    }
    const all = body.solidTag
      ? this.tagged(body.solidTag).filter((s) => s !== e && s.alive && s.visible)
      : [];
    // Ramps are met by their sloping surface, not as boxes.
    const solids = all.filter((s) => !s.def.slope && s.def.visual.kind !== 'terrain');
    const ramps = all.filter((s) => s.def.slope || s.def.visual.kind === 'terrain');
    const startX = e.x;
    const startBottom = e.y + e.height;
    const startTop = e.y;
    const blocked = (s: Entity) =>
      e.x < s.x + s.width && e.x + e.width > s.x && e.y < s.y + s.height && e.y + e.height > s.y;
    // A bounce too small to see is treated as stopping, or the object would jitter forever.
    const rebound = (speed: number, factor: number) => (Math.abs(speed * factor) < 40 ? 0 : -speed * factor);
    e.grounded = false;
    const jumper = e.def.behaviors.find((b): b is JumperBehavior => b.type === 'jumper');
    const land = (on: Entity | null) => {
      e.grounded = true;
      e.ground = on;
      if (jumper) e.jumpsLeft = jumper.maxJumps;
    };
    const limit = e.def.fixed ? this.project.meta : this.scene;
    const edgeFactor = body.edges === 'bounce' ? 1 : 0;

    // One axis at a time, so sliding along a wall or floor works.
    e.x += e.vx * dt;
    // Faster than half its own width in a step, it is swept: whatever lies between where it was and where it got
    // to stops it, so it cannot pass through a thin wall (Phase 2). Slower, it is tested where it got to.
    const sweptX = Math.abs(e.x - startX) > e.width / 2;
    const rightward = e.x > startX;
    const blockedX = (s: Entity) => sweptX
      ? Math.min(startX, e.x) < s.x + s.width && Math.max(startX, e.x) + e.width > s.x && e.y < s.y + s.height && e.y + e.height > s.y
      : blocked(s);
    // Jump-through platforms have no sides: only their tops stop anything.
    for (const s of body.oneWay ? [] : solids) {
      if (!blockedX(s)) continue;
      // Standing still and pushed by a moving wall, it gives way to the side it is already on.
      const fromLeft = sweptX ? rightward : e.vx !== 0 ? e.vx > 0 : e.x + e.width / 2 < s.x + s.width / 2;
      // Something that can be pushed goes ahead of it, if there is room.
      if (e.vx !== 0 && this.shove(s, fromLeft ? e.x + e.width - s.x : e.x - (s.x + s.width))) continue;
      e.x = fromLeft ? s.x - e.width : s.x + s.width;
      if (e.vx !== 0) {
        e.wallSide = fromLeft ? 1 : -1;
        e.against = s;
      }
      e.vx = rebound(e.vx, body.bounce);
    }
    // A ramp's steep side is a wall to whatever comes at it from beyond that side.
    for (const r of body.oneWay ? [] : ramps) {
      if (!blocked(r) || startBottom <= r.y + 1) continue;
      if (r.def.visual.kind === 'terrain') {
        const heights = r.def.visual.heights;
        if (startX >= r.x + r.width - 0.5 && startBottom > r.y + r.height * heights[heights.length - 1]) {
          e.x = r.x + r.width;
          e.vx = rebound(e.vx, body.bounce);
        } else if (startX + e.width <= r.x + 0.5 && startBottom > r.y + r.height * heights[0]) {
          e.x = r.x - e.width;
          e.vx = rebound(e.vx, body.bounce);
        }
      } else if (r.def.slope === 'rise' && startX >= r.x + r.width - 0.5) {
        e.x = r.x + r.width;
        e.vx = rebound(e.vx, body.bounce);
      } else if (r.def.slope === 'fall' && startX + e.width <= r.x + 0.5) {
        e.x = r.x - e.width;
        e.vx = rebound(e.vx, body.bounce);
      }
    }
    if (body.edges === 'wrap') {
      // Out one side, in the other. Top and bottom are left open.
      if (e.x + e.width < 0) e.x = limit.width;
      else if (e.x > limit.width) e.x = -e.width;
    } else if (body.edges !== 'none' && (e.x < 0 || e.x + e.width > limit.width)) {
      e.x = clamp(e.x, 0, limit.width - e.width);
      e.vx = rebound(e.vx, edgeFactor);
    }

    const bottomBefore = e.y + e.height;
    e.y += e.vy * dt;
    // Swept too when it falls or rises more than half its height in a step.
    const topBefore = bottomBefore - e.height;
    const sweptY = Math.abs(e.y - topBefore) > e.height / 2;
    const downward = e.y > topBefore;
    const blockedY = (s: Entity) => sweptY
      ? e.x < s.x + s.width && e.x + e.width > s.x && Math.min(topBefore, e.y) < s.y + s.height && Math.max(topBefore, e.y) + e.height > s.y
      : blocked(s);
    for (const s of solids) {
      if (!blockedY(s)) continue;
      const falling = sweptY ? downward : e.vy > 0;
      // From below or from inside, a jump-through platform is not there.
      if (body.oneWay && !(falling && bottomBefore <= s.y + 1)) continue;
      if (falling) {
        e.y = s.y - e.height;
        land(s);
      } else {
        e.y = s.y + s.height;
      }
      e.vy = rebound(e.vy, body.bounce);
    }
    // Ramps: whatever was on or above the surface stands on it, walking up as the surface rises.
    // Coming down a ramp it stays on the surface rather than hopping off it at every step.
    // A box stands on a slope by its corner on the high side: the highest point of the surface under it.
    const foot = (r: Entity, left: number) => clamp(r.def.slope === 'rise' ? Math.min(left + e.width, r.x + r.width) : Math.max(left, r.x), r.x, r.x + r.width);
    const travelled = Math.abs(e.x - startX);
    for (const r of ramps) {
      if (e.x >= r.x + r.width || e.x + e.width <= r.x) continue;
      const v = r.def.visual;
      const support = (x: number) => v.kind === 'terrain' ? terrainTop(r, v.heights, x, x + e.width) : surfaceAt(r, foot(r, x))!;
      const surface = support(e.x);
      const before = support(startX);
      const bottom = e.y + e.height;
      const steepness = r.height / Math.max(1, r.width);
      const reach = (v.kind === 'terrain' ? Math.abs(surface - before) : travelled * steepness) + 4;
      const wasOnOrAbove = startBottom <= before + reach;
      const sticks = wasGrounded && e.vy >= 0 && !e.rising && bottom < surface && surface - bottom <= reach;
      if ((bottom > surface && wasOnOrAbove && e.vy >= 0) || sticks) {
        e.y = surface - e.height;
        e.vy = 0;
        land(r);
      } else if (!body.oneWay && e.vy < 0 && blocked(r) && startTop >= r.y + r.height - 1) {
        e.y = r.y + r.height;
        e.vy = rebound(e.vy, body.bounce);
      }
    }

    if (body.edges !== 'none' && body.edges !== 'wrap' && (e.y < 0 || e.y + e.height > limit.height)) {
      if (e.y > 0) land(null);
      e.y = clamp(e.y, 0, limit.height - e.height);
      e.vy = rebound(e.vy, edgeFactor);
    }

    // A rolling ball turns by as much as it travelled around its edge.
    if (body.roll) e.angle += (e.x - startX) / Math.max(1, Math.min(e.width, e.height) / 2);

    if (e.grounded) {
      e.airTime = 0;
      if (!wasGrounded) {
        this.landings.push({ entity: e, on: e.ground });
        if (jumper) this.landingJuice(e, fallSpeed);
      }
    } else {
      e.airTime += dt;
      // Walking off an edge leaves a moment in which the jump from the ground still works; after that it is gone.
      if (jumper && e.airTime > COYOTE && e.jumpsLeft === jumper.maxJumps) e.jumpsLeft = jumper.maxJumps - 1;
    }
  }

  /**
   * Tries to push an object that can be pushed sideways by `dx`. It moves only
   * if nothing it cannot pass through is in the way, so a crate against a wall
   * (or against another crate) stays put. Says whether it moved.
   */
  private shove(s: Entity, dx: number): boolean {
    const body = s.def.behaviors.find((b): b is BodyBehavior => b.type === 'body');
    if (!body?.pushable || Math.abs(dx) < 1e-6) return false;
    // How far it can go that way: all of dx, or up to whatever is in the way, so it ends flush against a wall.
    let room = dx;
    const limit = s.def.fixed ? this.project.meta : this.scene;
    if (body.edges !== 'none' && body.edges !== 'wrap') room = dx > 0 ? Math.min(room, limit.width - (s.x + s.width)) : Math.max(room, -s.x);
    if (body.solidTag) {
      for (const o of this.tagged(body.solidTag)) {
        if (o === s || !o.alive || !o.visible || o.def.slope) continue;
        if (!(s.y < o.y + o.height && s.y + s.height > o.y)) continue;
        if (dx > 0 && o.x >= s.x + s.width - 0.5) room = Math.min(room, o.x - (s.x + s.width));
        else if (dx < 0 && o.x + o.width <= s.x + 0.5) room = Math.max(room, o.x + o.width - s.x);
      }
    }
    if (dx > 0 ? room <= 0 : room >= 0) return false;
    s.x += room;
    // Moved only part of the way: it is now against something, and whatever pushed it stops there too.
    return room === dx;
  }

  /**
   * One step of real physics. Fingers holding objects tell the physics where
   * they are; afterwards, what each moving object stands on is read back, for
   * jumping and the "land" trigger.
   */
  private stepPhysics(dt: number): void {
    const physics = this.physics!;
    for (const p of this.pointers.values()) {
      if (p.drag?.held) physics.aim(p.drag.entity, this.inSpaceOf(p.drag.entity, p));
    }
    // The pedal of anything the player drives: the right arrow or a touch on the right half of the screen is forward, the left backward.
    let pedal = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
    for (const p of this.pointers.values()) if (!p.drag && !this.onControl({ x: p.startX, y: p.startY })) pedal += p.x > this.view.width / 2 ? 1 : -1;
    physics.throttle = Math.sign(pedal);
    const falling = new Map(this.entities.map((e) => [e, e.vy]));
    physics.step(this.entities, dt, this.gravity);
    this.impacts(physics.hits);
    for (const e of this.entities) {
      const standing = physics.standing(e);
      if (standing === undefined) continue;
      const was = e.grounded;
      const jumper = e.def.behaviors.find((b): b is JumperBehavior => b.type === 'jumper');
      e.grounded = standing !== null;
      e.ground = standing?.on ?? null;
      if (e.grounded) {
        e.airTime = 0;
        if (jumper && e.vy >= -1) e.jumpsLeft = jumper.maxJumps;
        if (!was) {
          this.landings.push({ entity: e, on: e.ground });
          if (jumper) this.landingJuice(e, falling.get(e) ?? 0);
        }
      } else {
        e.airTime += dt;
        if (jumper && e.airTime > COYOTE && e.jumpsLeft === jumper.maxJumps) e.jumpsLeft = jumper.maxJumps - 1;
      }
    }
  }

  /**
   * What hits do by themselves: an object of a material makes its sound, as loud as the hit was hard,
   * and something breakable hit hard enough shatters.
   */
  private impacts(hits: { a: Entity; b: Entity; speed: number }[]): void {
    this.knocksThisStep = 0;
    for (const hit of hits) {
      for (const e of [hit.a, hit.b]) {
        const p = e.def.behaviors.find((b): b is PhysicsBehavior => b.type === 'physics');
        if (!p || !e.alive) continue;
        if (p.breaks && p.breaks > 0 && hit.speed >= p.breaks) {
          this.shatter(e, p);
          continue;
        }
        if (!p.material || p.material === 'custom' || hit.speed < 140 || this.knocksThisStep >= 3) continue;
        if (this.time - (this.lastKnock.get(e) ?? -1) < 0.12) continue;
        this.lastKnock.set(e, this.time);
        this.knocksThisStep += 1;
        this.sound(MATERIALS[p.material].sound, Math.min(100, 15 + hit.speed / 14));
      }
    }
  }

  /**
   * Breaks an object into four pieces (six if it is long), each showing its part of the picture, flying
   * apart with the speed it had. The pieces are plain physics, fade out and are gone in a few seconds;
   * they belong to no group, so they never count as the object.
   */
  private shatter(e: Entity, p: PhysicsBehavior): void {
    e.alive = false;
    const v = e.def.visual;
    const long = e.width > e.height * 1.6 ? [3, 2] : e.height > e.width * 1.6 ? [2, 3] : [2, 2];
    const [cols, rows] = long;
    const [w, h] = [e.width / cols, e.height / rows];
    const centre = { x: e.x + e.width / 2, y: e.y + e.height / 2 };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const crop = v.kind === 'image' && v.crop ? v.crop : { x: 0, y: 0, w: 1, h: 1 };
        const visual: GameObject['visual'] = v.kind === 'image'
          ? { kind: 'image', asset: e.image ?? v.asset, crop: { x: crop.x + c * crop.w / cols, y: crop.y + r * crop.h / rows, w: crop.w / cols, h: crop.h / rows } }
          : v.kind === 'rect' || v.kind === 'ellipse' ? { ...v, kind: 'rect', radius: 0 } : { kind: 'rect', color: '#9e9e9e' };
        const piece: GameObject = {
          ...e.def, id: `${e.def.id}~${r}${c}`, name: e.def.name, tags: [], width: w, height: h, rotation: 0, round: false,
          health: undefined, healthBar: false, glow: undefined, visual, rules: undefined,
          behaviors: [
            { ...p, kind: 'moving', breaks: 0, drag: 'none', rotates: true, weight: feel(p).weight * 0.6, material: p.material, passTag: '' },
            { type: 'lifetime', seconds: 2.5 + Math.random() },
          ],
        } as GameObject;
        const dx = (c + 0.5) * w - e.width / 2, dy = (r + 0.5) * h - e.height / 2;
        const away = { x: Math.cos(e.angle) * dx - Math.sin(e.angle) * dy, y: Math.sin(e.angle) * dx + Math.cos(e.angle) * dy };
        const piece_ = this.createEntity(piece, centre.x + away.x - w / 2, centre.y + away.y - h / 2);
        const reach = Math.hypot(away.x, away.y) || 1;
        piece_.vx = e.vx + (away.x / reach) * (120 + Math.random() * 160);
        piece_.vy = e.vy + (away.y / reach) * (120 + Math.random() * 160) - 120;
        piece_.angle = e.angle;
        piece_.spawned = true;
        this.insertAbove(piece_, e);
      }
    }
    const color = v.kind === 'rect' || v.kind === 'ellipse' ? v.color : '#d8c8a8';
    this.burst(e, color, 14);
    this.sound(p.material === 'glass' || p.material === 'ice' ? 'shatter' : p.material === 'metal' ? 'clang' : 'boom', p.material === 'glass' ? 80 : 45);
  }

  /**
   * A character coming down hard squashes for a moment and kicks up a little
   * dust at its feet, so a landing is felt.
   */
  private landingJuice(e: Entity, speed: number): void {
    if (speed < 350) return;
    const hard = Math.min(1, (speed - 350) / 1200);
    e.squash = { x: 1.12 + hard * 0.16, y: 0.88 - hard * 0.14, left: 0.2, span: 0.2 };
    const layer = this.layerOf(e);
    const feet = { x: e.x + e.width / 2, y: e.y + e.height };
    for (let i = 0; i < 6 && this.particles.length < MAX_PARTICLES; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const size = 8 + Math.random() * 10;
      const view = new Graphics().circle(0, 0, size / 2).fill('#f2ede4');
      view.position.set(feet.x + side * e.width * 0.25, feet.y - 4);
      layer.addChild(view);
      const span = 0.35 + Math.random() * 0.2;
      this.particles.push({ view, vx: side * (60 + Math.random() * 120), vy: -20 - Math.random() * 50, life: span, span, gravity: 0, grow: 2.2, alpha: 0.75 });
    }
  }

  /** Draws ropes and springs, and a sling being pulled: its band, and dots along where it would fly. */
  private drawPhysics(): void {
    const physics = this.physics!;
    const lines = physics.lines();
    const pulls = physics.pulls();
    if (lines.length === 0 && pulls.length === 0 && !this.physicsDrawn) return;
    const g = this.physicsView.clear();
    this.physicsDrawn = lines.length > 0 || pulls.length > 0;
    const z = this.z;
    const at = (p: Point) => ({ x: (p.x - this.camera.x) * z, y: (p.y - this.camera.y) * z });
    for (const line of lines) {
      const [from, to] = [at(line.from), at(line.to)];
      const [dx, dy] = [to.x - from.x, to.y - from.y];
      const length = Math.hypot(dx, dy) || 1;
      const [nx, ny] = [-dy / length, dx / length];
      if (line.kind === 'rope') {
        // A twisted rope: a dark edge, a lighter body, and slanted strands along it.
        const w = Math.max(3, 6 * z);
        g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: w + 2.5 * z, color: '#3e2415', cap: 'round' });
        g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: w, color: '#b98a52', cap: 'round' });
        const step = 9 * z;
        for (let d = step / 2; d < length; d += step) {
          const [cx, cy] = [from.x + (dx * d) / length, from.y + (dy * d) / length];
          const [ux, uy] = [dx / length, dy / length];
          g.moveTo(cx - nx * w * 0.45 - ux * w * 0.35, cy - ny * w * 0.45 - uy * w * 0.35).lineTo(cx + nx * w * 0.45 + ux * w * 0.35, cy + ny * w * 0.45 + uy * w * 0.35);
        }
        g.stroke({ width: Math.max(1, 1.6 * z), color: '#6b4524' });
        continue;
      }
      // A spring is a metal coil, squeezed or stretched with the distance it spans.
      const coil = () => {
        g.moveTo(from.x, from.y);
        const turns = 12;
        for (let i = 1; i < turns; i++) {
          const side = (i % 2 === 0 ? -1 : 1) * 10 * z;
          g.lineTo(from.x + (dx * i) / turns + nx * side, from.y + (dy * i) / turns + ny * side);
        }
        g.lineTo(to.x, to.y);
      };
      coil();
      g.stroke({ width: Math.max(3, 6 * z), color: '#37424f', join: 'round', cap: 'round' });
      coil();
      g.stroke({ width: Math.max(1.5, 3 * z), color: '#c9d4df', join: 'round', cap: 'round' });
    }
    for (const pull of pulls) {
      const [anchor, centre] = [at(pull.anchor), at(pull.centre)];
      // Two rubber bands from either side of the rest point to the stone, a little apart.
      const [dx, dy] = [centre.x - anchor.x, centre.y - anchor.y];
      const length = Math.hypot(dx, dy) || 1;
      const [nx, ny] = [(-dy / length) * 16 * z, (dx / length) * 16 * z];
      for (const side of [-1, 1]) {
        g.moveTo(anchor.x + nx * side, anchor.y + ny * side).lineTo(centre.x, centre.y).stroke({ width: Math.max(4, 9 * z), color: '#5a1f12', cap: 'round' });
        g.moveTo(anchor.x + nx * side, anchor.y + ny * side).lineTo(centre.x, centre.y).stroke({ width: Math.max(2, 4 * z), color: '#c8452a', cap: 'round' });
      }
      if (pull.throwSpeed.x === 0 && pull.throwSpeed.y === 0) continue;
      const gravity = pull.gravity ? this.gravity : 0;
      // About a second of flight, the dots thinning out as they go.
      for (let i = 1; i <= 18; i++) {
        const t = i * 0.06;
        const dot = at({ x: pull.centre.x + pull.throwSpeed.x * t, y: pull.centre.y + pull.throwSpeed.y * t + 0.5 * gravity * t * t });
        const r = Math.max(2, (7 - i * 0.25) * z);
        const alpha = Math.max(0.2, 0.95 - i * 0.04);
        g.circle(dot.x, dot.y + 1.5 * z, r).fill({ color: '#000000', alpha: alpha * 0.3 });
        g.circle(dot.x, dot.y, r).fill({ color: '#ffffff', alpha });
      }
    }
  }

  insertAbove(entity: Entity, below: Entity): void {
    this.entities.splice(this.entities.indexOf(below) + 1, 0, entity);
    this.listChanged();
    const layer = this.layerOf(entity);
    // In another layer there is no "just above"; it goes on top of that layer.
    if (layer === this.layerOf(below)) layer.addChildAt(entity.view, layer.getChildIndex(below.view) + 1);
    else layer.addChild(entity.view);
  }

  // ── Rules ────────────────────────────────────────────────────────────────

  private runRules(dt: number, screenTapped: boolean, left: Entity[]): void {
    // Deaths are handed to the rules one frame later, so every rule sees them whatever its place in the list.
    this.diedLastFrame = this.died;
    this.died = [];
    // Messages sent since the rules last ran arrive now; ones sent now arrive next step, so a message can never loop forever within one step.
    this.inbox = this.outbox;
    this.outbox = [];
    // Everything moved since the rules last asked where things are.
    this.contacts.stale();
    const step: TriggerStep = { dt, screenTapped, left };
    for (const rule of this.scene.rules) {
      for (const context of this.fired(rule, step)) {
        const ran = [rule.condition, ...(rule.also ?? [])].every((c) => !c || this.holds(c, context));
        this.logRule(rule.id, ran);
        if (ran) this.runActions(rule.then, context);
        else if (rule.otherwise?.length) this.runActions(rule.otherwise, context);
      }
    }
  }

  /** Notes for the try-out tools that a rule's trigger happened; the same rule again straight after is counted, not listed twice. */
  logRule(rule: string, ran: boolean): void {
    if (this.mode.kind !== 'play') return;
    const last = this.ruleLog.at(-1);
    if (last && last.rule === rule && last.ran === ran && last.scene === this.scene.id) {
      last.count += 1;
      last.time = this.time;
      return;
    }
    this.ruleLog.push({ scene: this.scene.id, rule, time: this.time, ran, count: 1 });
    if (this.ruleLog.length > 40) this.ruleLog.shift();
  }

  /** Performs actions in order. A "wait" sets the rest aside until its time has passed. */
  private runActions(actions: Action[], context: Context): void {
    // An action may move, make, remove or reorder objects: the groups and the next contact question look again.
    // Not after actions that never touch an object ("still": a value, a sound, a message), the most common ones.
    for (const action of actions) {
      if (actionBlocks.get(action.type)?.still) continue;
      this.listChanged();
      break;
    }
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      // A wait, or words to read: the rest of the rule runs later.
      if (actionBlocks.get(action.type)?.takesRest) return actionBlocks.get(action.type)!.run(this, action as never, context, actions.slice(i + 1));
      this.perform(action, context);
    }
  }

  /** The occasions, this frame, on which a rule's trigger happened. Every trigger is a block in its own file (src/blocks/triggers/). */
  private fired(rule: Rule, step: TriggerStep): Context[] {
    return triggerBlocks.get(rule.when.type)!.fired(this, rule.when as never, rule, step);
  }

  /** True on the frame a rule's test turns from false to true. `initial` is what it is taken to have been before the first frame. */
  becameTrue(ruleId: string, truth: boolean, initial: boolean): boolean {
    const was = this.ruleTruth.get(ruleId) ?? initial;
    this.ruleTruth.set(ruleId, truth);
    return truth && !was;
  }

  /** Every action is a block in its own file (src/blocks/actions/), listed in src/blocks/registry.ts. */
  private perform(action: Action, context: Context): void {
    actionBlocks.get(action.type)?.run(this, action as never, context, []);
  }

  /** Throws small squares out from the middle of an object. They are decoration only: nothing can touch them. */
  burst(from: Entity, color: string, count: number): void {
    const box = this.boxOf(from);
    for (let i = 0; i < Math.min(count, MAX_BURST); i++) {
      const size = 6 + Math.random() * 10;
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 400;
      const view = new Graphics().rect(-size / 2, -size / 2, size, size).fill(color);
      view.position.set(box.x + box.width / 2, box.y + box.height / 2);
      this.layerOf(from).addChild(view);
      const span = 0.4 + Math.random() * 0.4;
      this.particles.push({ view, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: span, span, gravity: 900 });
    }
  }

  /** Leaves one dot of a trail where an object is, drawn behind it. */
  puff(from: Entity, color: string, size: number): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const view = new Graphics().circle(0, 0, size / 2).fill(color);
    view.position.set(from.x + from.width / 2, from.y + from.height / 2);
    const layer = this.layerOf(from);
    layer.addChildAt(view, Math.max(0, layer.getChildIndex(from.view)));
    const span = 0.45;
    this.particles.push({ view, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: span, span, gravity: 0 });
  }

  /** Moves effects, glides, burst pieces and the screen shake along by one frame. */
  private stepEffects(dt: number): void {
    for (const t of this.tweens) {
      const e = t.entity;
      t.elapsed = Math.min(t.seconds, t.elapsed + dt);
      const part = t.elapsed / t.seconds;
      const done = part >= 1;
      switch (t.kind) {
        case 'pop':
          e.scale = 1 + 0.35 * Math.sin(Math.PI * part);
          break;
        case 'grow':
          e.scale = part;
          break;
        case 'shrink':
          e.scale = 1 - part;
          if (done) e.alive = false;
          break;
        case 'fadeIn':
          e.fade = part;
          break;
        case 'fadeOut':
          e.fade = 1 - part;
          if (done) {
            e.visible = false;
            e.fade = 1;
          }
          break;
        case 'dissolve':
          // Fades while specks of it break away and drift off; gone at the end.
          e.fade = (1 - part) ** 1.5;
          if (Math.random() < 0.8) this.puff(e, this.colourOf(e), Math.max(4, Math.min(e.width, e.height) * 0.12));
          if (done) {
            e.visible = false;
            e.fade = 1;
          }
          break;
        case 'glide': {
          // Slow at both ends and quick in the middle, unless another easing was chosen.
          const along = eased(t.ease, part);
          this.place(e, t.from.x + (t.to.x - t.from.x) * along, t.from.y + (t.to.y - t.from.y) * along);
          break;
        }
        case 'press':
          e.scale = 1 - 0.12 * Math.sin(Math.PI * part);
          break;
      }
    }
    this.tweens = this.tweens.filter((t) => t.elapsed < t.seconds && t.entity.alive);
    for (const e of this.entities) {
      if (e.squash && (e.squash.left -= dt) <= 0) e.squash = null;
    }

    for (const e of this.entities) {
      if (!e.flash) continue;
      e.flash.left -= dt;
      if (e.flash.left > 0) this.paintFlash(e);
      else {
        const done = e.flash.filter;
        e.flash = null;
        this.applyFilters(e);
        done.destroy();
      }
    }
    if (this.zoomGlide) this.stepZoom(dt);
    if (this.darknessGlide) {
      const glide = this.darknessGlide;
      glide.elapsed = Math.min(glide.seconds, glide.elapsed + dt);
      const part = glide.seconds > 0 ? glide.elapsed / glide.seconds : 1;
      this.darkness = glide.from + (glide.to - glide.from) * part;
      if (part >= 1) this.darknessGlide = null;
    }

    this.stepParticles(dt);
    this.stepBag(dt);

    if (this.shakeLeft > 0) {
      this.shakeLeft -= dt;
      // The shake dies away rather than stopping dead.
      const reach = this.shakeStrength * Math.max(0, this.shakeLeft / SHAKE_SECONDS);
      // Along one line when asked, swinging from side to side rather than jittering.
      const swing = Math.sin(this.shakeLeft * 70) * reach;
      if (this.shakeAxis === 'side') this.app.stage.position.set(swing, 0);
      else if (this.shakeAxis === 'up') this.app.stage.position.set(0, swing);
      else this.app.stage.position.set((Math.random() * 2 - 1) * reach, (Math.random() * 2 - 1) * reach);
    }
    this.stepScreenEffects(dt);
    this.stepDayNight();
    this.stepLiquids();
  }

  /** Mixes the flash colour into the object's own, strongly at first and fading to nothing. */
  paintFlash(e: Entity): void {
    if (!e.flash) return;
    const k = clamp(e.flash.left / e.flash.span, 0, 1);
    const hex = e.flash.color.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255 || 0);
    const keep = 1 - k;
    e.flash.filter.matrix = [keep, 0, 0, 0, r * k, 0, keep, 0, 0, g * k, 0, 0, keep, 0, b * k, 0, 0, 0, 1, 0];
  }

  /** Moves a camera zoom along, easing in and out, and keeps the followed object in the middle as it goes. */
  /** A character starts to speak: the game waits, the box shows, and the words appear letter by letter. */
  speak(action: Extract<Action, { type: 'say' }>, rest: Action[], context: Context): void {
    this.dialogue?.view.destroy({ children: true });
    const { width: W, height: H } = this.view;
    const font = [this.project.meta.fontFamily, FALLBACK_FONT, 'sans-serif'];
    const view = new Container();
    const box = new Graphics().roundRect(24, H - 330, W - 48, 290, 28).fill({ color: '#141a2e', alpha: 0.94 }).stroke({ width: 5, color: action.color });
    const name = new Text({ text: action.speaker, style: { fontFamily: font, fontSize: 38, fontWeight: 'bold', fill: action.color, padding: 12 } });
    name.position.set(56, H - 312);
    const words = new Text({ text: '', style: { fontFamily: font, fontSize: 36, fill: '#ffffff', wordWrap: true, wordWrapWidth: W - 120, lineHeight: 48, padding: 12 } });
    words.position.set(56, H - 254);
    const more = new Text({ text: '▼', style: { fontFamily: font, fontSize: 30, fill: action.color } });
    more.position.set(W - 90, H - 92);
    view.addChild(box, name, words, more);
    this.app.stage.addChild(view);
    const text = fillTemplate(action.speaker === '' ? action.text : action.text, this.variables, new Map(), this.textVariables);
    this.dialogue = { speaker: action.speaker, text, color: action.color, since: performance.now(), rest, context, view };
    this.paused = true;
    this.sound('click', 40);
    this.drawDialogue();
  }

  /** How many letters of the words show: about forty a second. */
  private dialogueShown(): number {
    const d = this.dialogue;
    return d ? Math.min(d.text.length, Math.floor(((performance.now() - d.since) / 1000) * 40)) : 0;
  }

  private drawDialogue(): void {
    const d = this.dialogue;
    if (!d) return;
    const shown = this.dialogueShown();
    (d.view.getChildAt(2) as Text).text = d.text.slice(0, shown);
    // The arrow that says "tap for more" blinks once all the words are there.
    d.view.getChildAt(3).visible = shown >= d.text.length && Math.floor(performance.now() / 400) % 2 === 0;
  }

  /** A tap shows all the words at once, or, once they are all there, closes the box and goes on. */
  private stepDialogue(tapped: boolean): void {
    const d = this.dialogue!;
    if (tapped && performance.now() - d.since > 150) {
      if (this.dialogueShown() < d.text.length) d.since = -1e9;
      else {
        d.view.destroy({ children: true });
        this.dialogue = null;
        this.paused = false;
        this.runActions(d.rest, d.context);
        return;
      }
    }
    this.drawDialogue();
  }

  private achievements(): string[] {
    try {
      return JSON.parse(localStorage.getItem(this.savedKey('#achievements')) ?? '[]');
    } catch {
      return [];
    }
  }

  /** The first time only: kept on the device, and a gold banner slides in to say so. */
  achieve(name: string): void {
    const got = this.achievements();
    if (got.includes(name)) return;
    try {
      localStorage.setItem(this.savedKey('#achievements'), JSON.stringify([...got, name]));
    } catch { /* Storage unavailable: shown, not kept. */ }
    this.toasts.push(name);
  }

  private stepToast(dt: number): void {
    if (!this.toast && this.toasts.length) {
      const { width: W } = this.view;
      const font = [this.project.meta.fontFamily, FALLBACK_FONT, 'sans-serif'];
      const view = new Container();
      // Slim, along the very top edge: above a menu's title (which starts lower), over the score only briefly.
      view.addChild(new Graphics().roundRect(0, 0, W - 160, 84, 22).fill({ color: '#2a1f05', alpha: 0.95 }).stroke({ width: 4, color: '#ffd23f' }));
      const text = new Text({ text: this.toasts.shift()!, style: { fontFamily: font, fontSize: 30, fontWeight: 'bold', fill: '#ffe066', padding: 8 } });
      text.position.set(96, 36);
      const heading = new Text({ text: 'Achievement unlocked', style: { fontFamily: font, fontSize: 20, fill: '#ffd23f', padding: 8 } });
      heading.position.set(96, 8);
      view.addChild(text, heading);
      const cup = new Text({ text: '🏆', style: { fontSize: 46, padding: 8 } });
      cup.position.set(22, 12);
      view.addChild(cup);
      // Never wider than the box: a long name gets smaller letters.
      if (text.width > W - 160 - 110) text.scale.set((W - 160 - 110) / text.width);
      view.position.set(80, -110);
      this.app.stage.addChild(view);
      this.toast = { view, left: 2.6 };
      this.sound('powerup', 60);
    }
    if (!this.toast) return;
    this.toast.left -= dt;
    const shown = 2.6 - this.toast.left;
    // Slides down, waits, slides back up.
    const y = shown < 0.3 ? -110 + (shown / 0.3) * 122 : this.toast.left < 0.3 ? 12 - ((0.3 - this.toast.left) / 0.3) * 122 : 12;
    this.toast.view.y = y;
    if (this.toast.left <= 0) {
      this.toast.view.destroy({ children: true });
      this.toast = null;
    }
  }

  private topScores(): number[] {
    try {
      const list = JSON.parse(localStorage.getItem(this.savedKey('#top')) ?? '[]');
      return Array.isArray(list) ? list.filter((n) => typeof n === 'number') : [];
    } catch {
      return [];
    }
  }

  recordScore(value: number): void {
    const list = [...this.topScores(), value].sort((a, b) => b - a).slice(0, 5);
    try {
      localStorage.setItem(this.savedKey('#top'), JSON.stringify(list));
    } catch { /* Storage unavailable. */ }
    this.showTop(list);
  }

  /** The variables top1, top2, top3 (when the game has them) show the best scores. */
  private showTop(list: number[]): void {
    for (let i = 1; i <= 5; i++) if (this.variables.has('top' + i)) this.variables.set('top' + i, list[i - 1] ?? 0);
  }

  /** Whether any of these keys went down since the last step, or a button of the group was touched. */
  private asked(keys: string[], tag: string): boolean {
    return keys.some((k) => this.pressed.has(k)) || (tag !== '' && this.taps.some((t) => this.hitsTag(t, tag)));
  }

  /** A platform hero's special moves, worked out just before its body moves. */
  private stepMoves(e: Entity, m: MovesBehavior, body: BodyBehavior, dt: number): void {
    const jumper = e.def.behaviors.find((b): b is JumperBehavior => b.type === 'jumper');
    const walker = e.def.behaviors.find((b): b is WalkerBehavior => b.type === 'walker');
    // The scene's pull this step, taken back by moves that float (a dash, hanging on a ladder).
    const pull = body.gravity ? this.gravity * dt : 0;
    if (e.kick && e.kick.left > 0) {
      e.vx = e.kick.vx;
      e.kick.left -= dt;
    }
    e.dashCool = Math.max(0, (e.dashCool ?? 0) - dt);
    if (m.dash && e.dashCool <= 0 && !e.pounding && this.asked(['ShiftLeft', 'ShiftRight', 'KeyX'], m.dashTag)) {
      e.dashLeft = 0.18;
      e.dashCool = 0.7;
      e.dashDir = e.facing || 1;
      e.squash = { x: 1.3, y: 0.78, left: 0.2, span: 0.2 };
      this.sound('jump', 35);
    }
    if ((e.dashLeft ?? 0) > 0) {
      e.dashLeft! -= dt;
      e.vx = (e.dashDir ?? 1) * Math.max(900, (walker?.speed ?? 320) * 3);
      e.vy = -pull;
      this.puff(e, '#ffffff', Math.min(e.width, e.height) * 0.4);
    }
    if (m.wallJump && !e.grounded && e.wallSide && e.vy > 160 - pull) e.vy = 160 - pull;
    if (m.climbTag) {
      const ladder = this.entities.find((o) => o !== e && o.alive && o.visible && o.def.tags.includes(m.climbTag) &&
        e.x < o.x + o.width && e.x + e.width > o.x && e.y < o.y + o.height && e.y + e.height > o.y);
      const up = ['ArrowUp', 'KeyW', 'Space'].some((k) => this.keys.has(k)) || Boolean(jumper?.on === 'button' && this.held(jumper.buttonTag));
      const down = ['ArrowDown', 'KeyS'].some((k) => this.keys.has(k)) || (m.poundTag !== '' && this.held(m.poundTag));
      if (!ladder || e.rising) e.climbing = false;
      else if (up || down || e.climbing) {
        // On the ladder: up and down by the buttons, and it hangs there when they are let go.
        e.climbing = true;
        e.pounding = false;
        e.vy = ((down ? 1 : 0) - (up ? 1 : 0)) * 260 - pull;
        if (jumper) e.jumpsLeft = jumper.maxJumps;
        // Not stepping off sideways: it slides to the middle of the ladder, so it climbs clear of the edges of the hole.
        if (Math.abs(e.vx) < 1) e.x += (ladder.x + ladder.width / 2 - (e.x + e.width / 2)) * Math.min(1, dt * 12);
      }
    }
    if (m.crouch) this.crouch(e, m, body);
    if (m.pound && !e.grounded && !e.climbing && !e.pounding && this.asked(['ArrowDown', 'KeyS'], m.poundTag)) {
      e.pounding = true;
      e.rising = false;
      e.dashLeft = 0;
    }
    if (e.pounding) {
      e.vx = 0;
      e.vy = Math.max(e.vy, 1500);
    }
  }

  /**
   * Crouching: on the ground with down held, it drops to six tenths of its height (its feet stay where they are) and
   * creeps; let go, it stands up again, unless something solid is right above it.
   */
  private crouch(e: Entity, m: MovesBehavior, body: BodyBehavior): void {
    const down = ['ArrowDown', 'KeyS'].some((k) => this.keys.has(k)) || (m.poundTag !== '' && this.held(m.poundTag));
    if (!e.crouchFrom && down && e.grounded && !e.climbing) {
      const low = Math.round(e.height * 0.6);
      e.crouchFrom = e.height;
      e.y += e.height - low;
      e.height = low;
    } else if (e.crouchFrom && (!down || !e.grounded)) {
      const rise = e.crouchFrom - e.height;
      const blocked = body.solidTag !== '' && this.tagged(body.solidTag).some((s) => s !== e && s.alive && s.visible &&
        e.x < s.x + s.width && e.x + e.width > s.x && e.y - rise < s.y + s.height && e.y > s.y);
      if (!blocked) {
        e.y -= rise;
        e.height = e.crouchFrom;
        e.crouchFrom = 0;
      }
    }
    if (e.crouchFrom) e.vx *= 0.35;
  }

  /** A ground pound hits the ground: a thud, dust, a jolt up and down, and it squashes flat for a moment. */
  private poundLanded(e: Entity): void {
    e.pounding = false;
    e.squash = { x: 1.35, y: 0.7, left: 0.25, span: 0.25 };
    this.burst(e, '#d7c4a3', 18);
    this.sound('thud', 80);
    this.shakeLeft = SHAKE_SECONDS;
    this.shakeStrength = 10;
    this.shakeAxis = 'up';
  }

  /** Cells of water and lava, which move through their frames as the game plays. */
  private liquidTiles: { sprite: Sprite; style: Exclude<TileStyle, 'flat'>; cell: number; open: OpenSides; variant: number }[] = [];
  private liquidFrame = 0;

  /** Water and lava cells show their next frame a few times a second. */
  private stepLiquids(): void {
    const frame = Math.floor(this.time / 0.18) % 4;
    if (frame === this.liquidFrame || this.liquidTiles.length === 0) return;
    this.liquidFrame = frame;
    this.liquidTiles = this.liquidTiles.filter((t) => !t.sprite.destroyed);
    for (const t of this.liquidTiles) t.sprite.texture = tileTexture(t.style, t.cell, t.open, t.variant, frame);
  }

  /** The camera's visit to something else, and how long it has left there. */
  focus: { entity: Entity; left: number } | null = null;

  /** A dodge roll: a quick dash the way it is going (or facing), safe from harm while it lasts. */
  roll(e: Entity, b: SteerBehavior, way: Point | null, dt: number): void {
    e.rollCool = Math.max(0, (e.rollCool ?? 0) - dt);
    if (e.rollCool <= 0 && this.asked(['ShiftLeft', 'ShiftRight', 'KeyX'], b.rollTag ?? '')) {
      e.rollLeft = 0.3;
      e.rollCool = 0.8;
      e.rollDir = way ?? { x: e.facing || 1, y: 0 };
      e.safeUntil = this.time + 0.4;
      e.squash = { x: 1.25, y: 0.8, left: 0.3, span: 0.3 };
      this.sound('jump', 35);
    }
    if ((e.rollLeft ?? 0) > 0) {
      e.rollLeft! -= dt;
      const d = e.rollDir ?? { x: 1, y: 0 };
      e.vx = d.x * b.speed * 2.6;
      e.vy = d.y * b.speed * 2.6;
      this.puff(e, '#ffffff', Math.min(e.width, e.height) * 0.35);
    }
  }

  /** The colour an object is mostly, for specks of it: its own colour, or a light grey for a picture. */
  private colourOf(e: Entity): string {
    const v = e.def.visual;
    return e.color ?? (v.kind === 'rect' || v.kind === 'ellipse' || v.kind === 'text' ? v.color : '#e8e2d6');
  }

  /** A homing object turns toward the nearest of its group, no faster than its turn, keeping its speed. */
  home(e: Entity, b: HomingBehavior, dt: number): void {
    if (!e.homing) {
      // It sets off with the speed it was given: by a shot, or its mover.
      const mover = e.def.behaviors.find((m): m is MoverBehavior => m.type === 'mover');
      if (mover && e.vx === 0 && e.vy === 0) [e.vx, e.vy] = [mover.vx, mover.vy];
      e.homing = true;
    }
    const speed = Math.hypot(e.vx, e.vy);
    const target = this.nearest(e, b.targetTag);
    if (!target || speed < 1) return;
    const want = Math.atan2(target.y + target.height / 2 - (e.y + e.height / 2), target.x + target.width / 2 - (e.x + e.width / 2));
    const now = Math.atan2(e.vy, e.vx);
    let turn = want - now;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    const most = (b.turn * Math.PI / 180) * dt;
    const angle = now + clamp(turn, -most, most);
    e.vx = Math.cos(angle) * speed;
    e.vy = Math.sin(angle) * speed;
    e.angle = angle + Math.PI / 2;
  }

  /** Ripples spreading and dying away, the view's punch closer and back, and the old screen's flicker. */
  private stepScreenEffects(dt: number): void {
    if (this.waves.length) {
      for (const w of this.waves) {
        w.filter.time += dt;
        w.left -= dt;
      }
      const done = this.waves.filter((w) => w.left <= 0);
      if (done.length) {
        this.waves = this.waves.filter((w) => w.left > 0);
        this.applyLook();
        for (const w of done) w.filter.destroy();
      }
    }
    const { width, height } = this.view;
    let scale = 1;
    if (this.punch) {
      this.punch.left -= dt;
      const p = clamp(1 - this.punch.left / this.punch.span, 0, 1);
      // In fast, out slow.
      const k = p < 0.2 ? p / 0.2 : 1 - ((p - 0.2) / 0.8) ** 0.6;
      scale = 1 + (this.punch.amount - 1) * k;
      if (this.punch.left <= 0) this.punch = null;
    }
    this.stepToast(dt);
    this.scenery.pivot.set(width / 2, height / 2);
    this.scenery.position.set(width / 2, height / 2);
    this.scenery.scale.set(scale);
    this.animateRetro(dt);
  }

  /** The arcade screen's lines roll and its noise changes; the old film flickers and gets new scratches. */
  private animateRetro(dt: number): void {
    const r = this.retroFilter;
    if (r instanceof CRTFilter) {
      r.time += dt * 2;
      r.seed = Math.random();
    } else if (r instanceof OldFilmFilter) r.seed = Math.random();
  }

  /** A scene with a day length darkens to night and lightens to day again, unless a rule is changing the darkness. */
  private stepDayNight(): void {
    const length = this.scene.dayLength ?? 0;
    if (length <= 0 || this.darknessGlide) return;
    const day = clamp(this.scene.darkness ?? 0, 0, 1);
    const night = Math.max(day, 0.82);
    // It starts at midday, is darkest halfway through, and is day again at the end.
    const dusk = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.time) / length);
    this.darkness = day + (night - day) * dusk;
  }

  stepZoom(dt: number): void {
    const glide = this.zoomGlide!;
    glide.elapsed = Math.min(glide.seconds, glide.elapsed + dt);
    const part = glide.seconds > 0 ? glide.elapsed / glide.seconds : 1;
    const eased = part * part * (3 - 2 * part);
    // Zoom about the middle of the view, so the scene does not slide off to one side.
    const { width, height } = this.view;
    const middle = { x: this.camera.x + width / this.z / 2, y: this.camera.y + height / this.z / 2 };
    this.playZoom = glide.from + (glide.to - glide.from) * eased;
    this.setCamera(middle.x - width / this.z / 2, middle.y - height / this.z / 2);
    if (part >= 1) this.zoomGlide = null;
  }

  place(e: Entity, x: number, y: number): void {
    e.x = e.homeX = x;
    e.y = e.homeY = y;
    e.age = 0;
    e.sway = 0;
    e.animApplied = null;
  }

  amount(amount: Amount, context: Context = {}): number {
    if (typeof amount === 'number') return amount;
    if ('variable' in amount) return this.variables.get(amount.variable) ?? 0;
    if ('count' in amount) return this.matching({ by: 'tag', tag: amount.count, where: amount.where }).length;
    if ('value' in amount) return this.targets(amount.of, context)[0]?.values.get(amount.value) ?? 0;
    const [low, high] = [Math.min(...amount.random), Math.max(...amount.random)];
    return Math.floor(low + Math.random() * (high - low + 1));
  }

  // ── Functions, questions and lists (Phase 4) ─────────────────────────────

  /** The rules of this scene that are functions (trigger "called") or questions ("asked") of this name. */
  private named(type: 'called' | 'asked', name: string): Rule[] {
    return this.scene.rules.filter((r) => (r.when.type === 'called' || r.when.type === 'asked') && r.when.type === type && r.when.name === name);
  }

  /** A function's or question's inputs are game values, filled from what the caller gives, worked out in its context. */
  private fillInputs(rule: Rule, given: (Amount | undefined)[], context: Context): void {
    const when = rule.when as { in1?: string; in2?: string; in3?: string };
    const names = [when.in1, when.in2, when.in3];
    // Every amount first, then every value: an input may be given another input's old value.
    const values = given.map((a) => (a === undefined ? undefined : this.amount(a, context)));
    names.forEach((name, i) => {
      if (name && values[i] !== undefined) this.setValueOf(name, values[i]!);
    });
  }

  /** Runs every function of this name in the scene, now, about the same objects as the rule that calls it. */
  callFunction(name: string, given: (Amount | undefined)[], context: Context): void {
    if (this.callDepth >= 32) return;
    this.callDepth += 1;
    try {
      for (const rule of this.named('called', name)) {
        this.fillInputs(rule, given, context);
        const ran = [rule.condition, ...(rule.also ?? [])].every((c) => !c || this.holds(c, context));
        this.logRule(rule.id, ran);
        if (ran) this.runActions(rule.then, context);
        else if (rule.otherwise?.length) this.runActions(rule.otherwise, context);
      }
    } finally {
      this.callDepth -= 1;
    }
  }

  /** A question's answer: yes when the first rule asked so has all its conditions holding (no such rule: no). */
  private ask(condition: Condition, context: Context): boolean {
    const rule = this.named('asked', condition.check ?? '')[0];
    if (!rule || this.callDepth >= 32) return false;
    this.callDepth += 1;
    try {
      this.fillInputs(rule, [condition.a1, condition.a2, condition.a3], context);
      const yes = [rule.condition, ...(rule.also ?? [])].every((c) => !c || this.holds(c, context));
      this.logRule(rule.id, yes);
      return yes;
    } finally {
      this.callDepth -= 1;
    }
  }

  /** A list's items (the list itself, to change); an empty one for a name the game has no list of. */
  list(name: string): (number | string)[] {
    let items = this.lists.get(name);
    if (!items) {
      items = [];
      this.lists.set(name, items);
    }
    return items;
  }

  /** Whether a list holds text rather than numbers. */
  listIsText(name: string): boolean {
    return this.project.lists?.find((l) => l.name === name)?.kind === 'text';
  }

  /** Puts an item into a value: a number into a game value, text into a text value. */
  putItem(into: string, item: number | string | undefined, text: boolean): void {
    if (text) this.setTextVariable(into, item === undefined ? '' : String(item));
    else this.setValueOf(into, typeof item === 'number' ? item : Number(item) || 0);
    this.valuesChanged = true;
  }

  compare(name: string, op: Comparison, value: number): boolean {
    return test(this.variables.get(name) ?? 0, op, value);
  }

  /** Whether a rule's condition holds, for the objects this firing of the rule is about. */
  private holds(condition: Condition, context: Context): boolean {
    if (condition.check !== undefined) return this.ask(condition, context) === (condition.answer ?? true);
    const than = this.amount(condition.value, context);
    if (condition.of === undefined) return this.compare(condition.name, condition.op, than);
    const subject = this.targets(condition.of, context)[0];
    return subject !== undefined && test(subject.values.get(condition.name) ?? 0, condition.op, than);
  }

  matching(ref: Ref): Entity[] {
    if (ref.by === 'id') return this.entities.filter((e) => e.alive && e.def.id === ref.id);
    const where = ref.where;
    const spot = ref.spot;
    const inSpot = (e: Entity) => {
      if (!spot) return true;
      if (spot.is === 'home' || spot.is === 'away') return (Math.abs(e.x - e.homeX) < 1 && Math.abs(e.y - e.homeY) < 1) === (spot.is === 'home');
      return this.occupants(spot.tag ?? '', { x: e.x, y: e.y, width: e.width, height: e.height }, e).length > 0 === (spot.is === 'on');
    };
    const found = this.tagged(ref.tag).filter((e) => e.alive && (!where || test(e.values.get(where.name) ?? 0, where.op, where.value)) && inSpot(e));
    return ref.pick === 'random' && found.length > 1 ? [found[Math.floor(Math.random() * found.length)]] : found;
  }

  /** Moves an object to a new place at once, and lets its picture travel there over `seconds`. */
  slideTo(e: Entity, x: number, y: number, seconds: number): void {
    // If it was still catching up from an earlier move, it goes on from where its picture is.
    const behind = e.slide ? e.slide.left / e.slide.span : 0;
    const from = { x: e.x + (e.slide?.x ?? 0) * behind, y: e.y + (e.slide?.y ?? 0) * behind };
    e.x = x;
    e.y = y;
    e.slide = seconds > 0 ? { x: from.x - x, y: from.y - y, left: seconds, span: seconds } : null;
  }

  /** Objects of a group overlapping a box, other than `except`. Boxes that only share an edge do not count. */
  occupants(tag: string, box: Box, except: Entity): Entity[] {
    if (tag === '') return [];
    return this.entities.filter(
      (e) => e.alive && e !== except && e.def.tags.includes(tag) && e.x < box.x + box.width - 1 && e.x + e.width > box.x + 1 && e.y < box.y + box.height - 1 && e.y + e.height > box.y + 1,
    );
  }

  /**
   * The objects of a group that stand in a straight line of `length` or more,
   * side by side on the scene's grid, sharing the same value of `name`.
   */
  inLines(group: Entity[], name: string, length: number, diagonal: boolean): Set<Entity> {
    const found = new Set<Entity>();
    if (group.length < length) return found;
    const cell = this.scene.cell || group[0].width || 1;
    const key = (col: number, row: number) => `${col},${row}`;
    const at = new Map<string, Entity>();
    const place = (e: Entity) => [Math.floor((e.x + e.width / 2) / cell), Math.floor((e.y + e.height / 2) / cell)] as const;
    // With no value named, every member counts as the same; a value of 0 means "nothing here yet".
    const kind = (e: Entity) => (name === '' ? 1 : (e.values.get(name) ?? 0));
    for (const e of group) at.set(key(...place(e)), e);
    const ways: [number, number][] = diagonal ? [[1, 0], [0, 1], [1, 1], [1, -1]] : [[1, 0], [0, 1]];
    for (const e of group) {
      const mine = kind(e);
      if (mine === 0) continue;
      const [col, row] = place(e);
      for (const [dx, dy] of ways) {
        const before = at.get(key(col - dx, row - dy));
        if (before && kind(before) === mine) continue; // Not the start of its run.
        const run = [e];
        for (let i = 1; ; i++) {
          const next = at.get(key(col + dx * i, row + dy * i));
          if (!next || kind(next) !== mine) break;
          run.push(next);
        }
        if (run.length >= length) run.forEach((member) => found.add(member));
      }
    }
    return found;
  }

  /** The objects a per-object test holds for now but did not hold for when the rule was last looked at. */
  newlyHeld(ruleId: string, now: Set<Entity>): Entity[] {
    const before = this.ruleHeld.get(ruleId) ?? new Set<Entity>();
    this.ruleHeld.set(ruleId, now);
    return [...now].filter((e) => !before.has(e));
  }

  /**
   * Turns an object's behaviors on and off for its `state` value: its
   * definition is swapped for one with only the behaviors of that state. The
   * things it is made of (body, physics, joints) are never switched off.
   */
  private applyState(e: Entity): void {
    const base = e.base ?? e.def;
    if (!base.behaviors.some((b) => b.onlyIn)) return;
    const state = e.values.get('state') ?? 0;
    if (e.base && e.stateShown === state) return;
    const always = new Set(['body', 'physics', 'joint']);
    e.base = base;
    e.stateShown = state;
    e.def = { ...base, behaviors: base.behaviors.filter((b) => always.has(b.type) || !b.onlyIn || b.onlyIn.includes(state)) };
  }

  // ── The player's bag ─────────────────────────────────────────────────────

  /** Sets a game variable, keeping it on the device if it is a saved one. */
  setTextVariable(name: string, value: string): void {
    this.textVariables.set(name, value);
    this.valuesChanged = true;
    if (this.project.textVariables?.find(v => v.name === name)?.saved) this.writeSaved('#text.' + name, value);
  }

  setValueOf(name: string, value: number): void {
    this.variables.set(name, value);
    if (this.project.variables.find((v) => v.name === name)?.saved) this.writeSaved(name, value);
  }

  /**
   * The things the player carries, in the order of the bag's places: by when
   * they were picked up. While editing, every thing the game has, to show how
   * the bag will look.
   */
  private carried(): string[] {
    const items = this.project.variables.filter((v) => v.item);
    if (this.mode.kind === 'edit') return items.map((v) => v.name);
    for (const v of items) {
      const has = (this.variables.get(v.name) ?? 0) > 0;
      if (has && !this.bagGot.has(v.name)) this.bagGot.set(v.name, this.bagSeq++);
      if (!has) this.bagGot.delete(v.name);
    }
    return [...this.bagGot.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  }

  /** A point of an object (in its own space, from its corner) as a point on the screen. */
  private onScreen(e: Entity, at: Point): Point {
    const [x, y] = [e.x + at.x, e.y + at.y];
    return e.def.fixed ? { x, y } : { x: (x - this.camera.x) * this.z, y: (y - this.camera.y) * this.z };
  }

  /** The bag on show, if there is one. */
  private bagOnShow(): Entity | undefined {
    return this.entities.find((e) => e.alive && e.visible && e.def.visual.kind === 'bag');
  }

  /** Which thing in a bag a touch landed on, if any. */
  bagHit(screen: Point): { bag: Entity; item: string } | null {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (!e.alive || !e.visible || e.def.visual.kind !== 'bag') continue;
      const p = this.inSpaceOf(e, screen);
      const index = slotAt(bagSlots(e.def.width, e.def.height, e.def.visual.slots), p.x - e.x, p.y - e.y);
      const item = index >= 0 ? this.carried()[index] : undefined;
      if (item) return { bag: e, item };
    }
    return null;
  }

  /** The picture of a thing flies from an object into its place in the bag, and pops there when it lands. */
  flyToBag(item: string, from: Entity, isNew: boolean): void {
    const asset = this.project.variables.find((v) => v.name === item)?.item?.asset;
    const texture = asset ? this.textures.get(asset)?.texture : undefined;
    const bag = this.bagOnShow();
    if (!texture || !bag || bag.def.visual.kind !== 'bag') return;
    const slots = bagSlots(bag.def.width, bag.def.height, bag.def.visual.slots);
    const slot = slots[this.carried().indexOf(item)] ?? slots[slots.length - 1];
    const view = new Sprite(texture);
    view.anchor.set(0.5);
    this.hud.addChild(view);
    this.flights.push({
      view,
      item,
      from: this.onScreen(from, { x: from.width / 2, y: from.height / 2 }),
      to: this.onScreen(bag, slot),
      fromSize: Math.max(24, Math.min(from.width, from.height) * this.z),
      toSize: slot.size * 0.7,
      t: 0,
      hides: isNew,
    });
    this.stepBag(0);
  }

  /** The object of a group a thing was let go over, if any: the one drawn on top. */
  droppedOn(at: Point, target: Ref): Entity | undefined {
    return this.matching(target).reverse().find((e) => e.visible && e.def.visual.kind !== 'bag' && contains(this.boxOf(e), this.inSpaceOf(e, at)));
  }

  /** Picks a thing up out of the bag under a finger, if a rule wants it dragged onto something. */
  private startBagDrag(pointer: number, screen: Point): boolean {
    const hit = this.bagHit(screen);
    if (!hit || hit.bag.def.visual.kind !== 'bag') return false;
    const item = hit.item;
    if (!this.scene.rules.some((r) => r.when.type === 'useItemOn' && r.when.item === item)) return false;
    const asset = this.project.variables.find((v) => v.name === item)?.item?.asset;
    const texture = asset ? this.textures.get(asset)?.texture : undefined;
    if (!texture) return false;
    const slots = bagSlots(hit.bag.def.width, hit.bag.def.height, hit.bag.def.visual.slots);
    const slot = slots[this.carried().indexOf(item)];
    const size = slot.size * 0.95;
    const view = new Sprite(texture);
    view.anchor.set(0.5);
    view.scale.set(size / Math.max(texture.width, texture.height, 1));
    view.alpha = 0.92;
    view.position.set(screen.x, screen.y - size * 0.4);
    this.hud.addChild(view);
    this.bagDrag = { pointer, item, view, start: screen, slot: this.onScreen(hit.bag, slot), size };
    this.pointers.set(pointer, { ...screen, startX: screen.x, startY: screen.y, startedAt: performance.now(), drag: null });
    this.bagPops.set(item, this.time);
    return true;
  }

  /**
   * Lets go of a thing taken out of the bag. A short press without moving is
   * a tap, which uses it; let go over something a rule waits for, it is used
   * on that; anywhere else it flies back into its place.
   */
  private endBagDrag(screen: Point): void {
    const drag = this.bagDrag!;
    this.bagDrag = null;
    const at = { x: screen.x, y: screen.y - drag.size * 0.4 };
    const moved = Math.hypot(screen.x - drag.start.x, screen.y - drag.start.y) >= 20;
    const used = moved && this.scene.rules.some((r) => r.when.type === 'useItemOn' && r.when.item === drag.item && this.droppedOn(at, r.when.target));
    if (!moved) this.taps.push(drag.start);
    else if (used) this.drops.push({ item: drag.item, at });
    if (used || !moved) {
      drag.view.destroy();
      return;
    }
    this.flights.push({ view: drag.view, item: drag.item, from: at, to: drag.slot, fromSize: drag.size, toSize: drag.size * 0.76, t: 0, hides: false });
  }

  /** Moves things flying into the bag, and lets the pictures in the bag pop. */
  private stepBag(dt: number): void {
    const FLIGHT = 0.6;
    const POP = 0.35;
    for (const f of this.flights) {
      f.t += dt;
      const k = Math.min(1, f.t / FLIGHT);
      // Off quickly, up in an arc, and settling into its place.
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const size = f.fromSize + (f.toSize - f.fromSize) * e;
      f.view.position.set(f.from.x + (f.to.x - f.from.x) * e, f.from.y + (f.to.y - f.from.y) * e - Math.sin(k * Math.PI) * 140);
      f.view.scale.set(size / Math.max(f.view.texture.width, f.view.texture.height, 1));
      f.view.rotation = Math.sin(k * Math.PI) * 0.5;
      if (k >= 1) {
        f.view.destroy();
        this.bagPops.set(f.item, this.time);
      }
    }
    this.flights = this.flights.filter((f) => f.t < FLIGHT);
    const hidden = new Set(this.flights.filter((f) => f.hides).map((f) => f.item));
    for (const e of this.entities) {
      const icons = e.def.visual.kind === 'bag' ? this.bagIcons.get(e) : undefined;
      if (!icons) continue;
      for (const [name, icon] of icons) {
        const age = this.time - (this.bagPops.get(name) ?? -1);
        icon.scale.set(age >= 0 && age < POP ? 1 + 0.4 * Math.sin((age / POP) * Math.PI) : 1);
        // A thing that is new to the bag appears in its place only when its picture lands there.
        icon.alpha = hidden.has(name) ? 0 : 1;
      }
    }
  }

  targets(target: Target, context: Context): Entity[] {
    if (target === 'first') return context.first?.alive ? [context.first] : [];
    if (target === 'second') return context.second?.alive ? [context.second] : [];
    return this.matching(target);
  }

  nearest(from: Entity, tag: string): Entity | undefined {
    let best: Entity | undefined;
    let bestDistance = Infinity;
    for (const e of this.entities) {
      if (e === from || !e.alive || !e.visible || !e.def.tags.includes(tag)) continue;
      const distance = Math.hypot(e.x - from.x, e.y - from.y);
      if (distance < bestDistance) [best, bestDistance] = [e, distance];
    }
    return best;
  }

  /**
   * The point a chaser heads for this step, or null to stand still: the middle
   * of its target, or, when it goes around walls, the next point on its way
   * there. A target out of range is not noticed.
   */
  chaseAim(e: Entity, b: ChaseBehavior, dt: number): Point | null {
    const target = this.nearest(e, b.targetTag);
    if (!target) return null;
    const goal = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    const me = { x: e.x + e.width / 2, y: e.y + e.height / 2 };
    if (b.range && b.range > 0 && Math.hypot(goal.x - me.x, goal.y - me.y) > b.range) {
      e.path = [];
      return null;
    }
    if (b.sight) {
      const walls = b.avoidTag || this.bodyOf(e)?.solidTag || '';
      if (walls && this.blocksView(me, goal, walls, e, target)) {
        // Out of sight: on to where it was last seen, a short look round there, then nothing.
        const last = e.lastSeen;
        if (last && last.arrivedAt === undefined && Math.hypot(last.x - me.x, last.y - me.y) <= Math.max(4, b.speed * dt)) last.arrivedAt = this.time;
        // Give up two seconds after arriving. Bound an unreachable search even if the route was sealed.
        const searchLimit = 2 + 2 * Math.hypot(this.scene.width, this.scene.height) / Math.max(1, b.speed);
        if (!last || (last.arrivedAt !== undefined ? this.time - last.arrivedAt > 2 : this.time - last.at > searchLimit)) {
          e.lastSeen = null;
          e.path = [];
          return null;
        }
        goal.x = last.x;
        goal.y = last.y;
      } else e.lastSeen = { x: goal.x, y: goal.y, at: this.time };
    }
    // Running away, or with no walls named, it goes straight.
    if (!b.avoidTag || b.away) return goal;
    e.pathIn -= dt;
    if (e.pathIn <= 0) {
      // Looked for again a few times a second: often enough to follow a target that moves.
      e.pathIn = 0.3;
      e.path = this.findPath(e, goal, b.avoidTag);
    }
    // Points already reached, or already passed on the way to the next, are dropped.
    const close = Math.max(2, b.speed * dt);
    while (e.path.length > 0) {
      const [p, q] = e.path;
      if (Math.hypot(p.x - me.x, p.y - me.y) <= close) e.path.shift();
      else if (q && Math.hypot(q.x - me.x, q.y - me.y) < Math.hypot(q.x - p.x, q.y - p.y)) e.path.shift();
      else break;
    }
    return e.path[0] ?? goal;
  }

  /** Whether anything of a group (other than the two looking at each other) lies across the straight line between two points. */
  private blocksView(from: Point, to: Point, tag: string, ...except: Entity[]): boolean {
    return this.entities.some((w) => {
      if (!w.alive || !w.visible || except.includes(w) || !w.def.tags.includes(tag)) return false;
      // The line against the box, by clipping the line's span to the box on each axis in turn.
      let [t0, t1] = [0, 1];
      const d = { x: to.x - from.x, y: to.y - from.y };
      for (const [p, dp, lo, hi] of [[from.x, d.x, w.x, w.x + w.width], [from.y, d.y, w.y, w.y + w.height]] as const) {
        if (Math.abs(dp) < 1e-9) {
          if (p < lo || p > hi) return false;
          continue;
        }
        let [a, b] = [(lo - p) / dp, (hi - p) / dp];
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        if (t0 > t1) return false;
      }
      return true;
    });
  }

  /**
   * A way through the world from a chaser to a point, around the objects of
   * the wall group, as the middles of the grid cells to pass. The grid is the
   * scene's own when its cells are big enough for the chaser, else cells the
   * chaser's size. Empty when there is no way, or the world is too big to search.
   */
  private findPath(e: Entity, goal: Point, wallTag: string): Point[] {
    const cell = Math.max(this.scene.cell ?? 0, Math.ceil(Math.max(e.width, e.height)));
    if (cell <= 0) return [];
    const key = `${wallTag}|${cell}`;
    let grid = this.blockedCells.get(key);
    if (!grid) {
      const cols = Math.ceil(this.scene.width / cell);
      const rows = Math.ceil(this.scene.height / cell);
      if (cols * rows > 60000) return [];
      const blocked = new Uint8Array(cols * rows);
      for (const w of this.entities) {
        if (!w.alive || !w.visible || w.def.fixed || !w.def.tags.includes(wallTag)) continue;
        // A cell that a wall reaches into at all is closed; a hair's overlap at the edge does not count.
        const c0 = Math.max(0, Math.floor((w.x + 1) / cell));
        const c1 = Math.min(cols - 1, Math.floor((w.x + w.width - 1) / cell));
        const r0 = Math.max(0, Math.floor((w.y + 1) / cell));
        const r1 = Math.min(rows - 1, Math.floor((w.y + w.height - 1) / cell));
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) blocked[r * cols + c] = 1;
      }
      grid = { cols, rows, cell, blocked };
      this.blockedCells.set(key, grid);
    }
    const { cols, rows, blocked } = grid;
    const at = (p: Point) => [clamp(Math.floor(p.x / cell), 0, cols - 1), clamp(Math.floor(p.y / cell), 0, rows - 1)] as const;
    const [sc, sr] = at({ x: e.x + e.width / 2, y: e.y + e.height / 2 });
    const [gc, gr] = at(goal);
    const start = sr * cols + sc;
    const end = gr * cols + gc;
    if (start === end) return [goal];
    // Breadth-first: the first time the goal's cell is reached is by a shortest way.
    const from = new Int32Array(cols * rows).fill(-1);
    from[start] = start;
    const queue = [start];
    for (let head = 0; head < queue.length && from[end] === -1; head++) {
      const now = queue[head];
      const c = now % cols;
      const r = (now - c) / cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const next = nr * cols + nc;
        // The goal's own cell may hold a wall's edge: the target can stand against one.
        if (from[next] !== -1 || (blocked[next] && next !== end)) continue;
        from[next] = now;
        queue.push(next);
      }
    }
    if (from[end] === -1) return [];
    const way: Point[] = [];
    for (let now = end; now !== start; now = from[now]) {
      const c = now % cols;
      way.push({ x: c * cell + cell / 2, y: ((now - c) / cols) * cell + cell / 2 });
    }
    way.push({ x: sc * cell + cell / 2, y: sr * cell + cell / 2 });
    way.reverse();
    // The last stretch goes to the target itself, not to the middle of its cell.
    way[way.length - 1] = goal;
    return way;
  }

  /** Plays a built-in effect by name, or a sound the user added by its asset id. */
  sound(name: string, volume?: number): void {
    if (!this.project.sound || !this.soundOn) return;
    playEffect(this.project, name, volume);
  }

  // ── Input ────────────────────────────────────────────────────────────────

  hitsTag(screen: Point, tag: string): boolean {
    return this.entities.some(
      (e) => e.alive && e.visible && e.def.tags.includes(tag) && contains(this.boxOf(e), this.inSpaceOf(e, screen)),
    );
  }

  /** Whether some finger is on an object of this group right now. */
  held(tag: string): boolean {
    return [...this.pointers.values()].some((p) => this.hitsTag(p, tag));
  }

  /**
   * Whether a touch landed on a button rather than on the screen at large: an
   * on-screen control, or any visible object that a "tapped on an object" rule
   * is waiting for. Such a touch does not also make the player jump.
   */
  onControl(screen: Point): boolean {
    if ([...this.controlTags].some((tag) => this.hitsTag(screen, tag))) return true;
    // A thing in the bag that a rule lets the player use is a button too.
    if (this.scene.rules.some((rule) => rule.when.type === 'useItem' || rule.when.type === 'useItemOn') && this.bagHit(screen)) return true;
    return this.scene.rules.some(
      (rule) =>
        rule.when.type === 'tapObject' &&
        this.matching(rule.when.target).some((e) => e.visible && contains(this.boxOf(e), this.inSpaceOf(e, screen))),
    );
  }

  /** A position on the page, as a point on the game's screen in design pixels. */
  private toScreen(clientX: number, clientY: number): Point {
    const rect = this.app.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.view.width,
      y: ((clientY - rect.top) / rect.height) * this.view.height,
    };
  }

  private topmostAt(screen: Point, accept: (e: Entity) => boolean): Entity | undefined {
    // Fixed objects are drawn over the world, so they are looked through first.
    for (const fixed of [true, false]) {
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const e = this.entities[i];
        if (Boolean(e.def.fixed) === fixed && e.alive && accept(e) && contains(this.boxOf(e), this.inSpaceOf(e, screen))) return e;
      }
    }
    return undefined;
  }

  private listen(): void {
    const onDown = (ev: PointerEvent) => {
      ev.preventDefault();
      const screen = this.toScreen(ev.clientX, ev.clientY);
      if (this.mode.kind === 'edit') return this.editDown(screen, ev);
      if (this.soundOn) resumeMusic();

      // A finger on an object with physics that can be grabbed or slung takes hold of it; that is not a tap.
      const physics = this.physics;
      const holdable = physics && this.time > TAP_GRACE ? this.topmostAt(screen, (e) => e.visible && physics.canHold(e)) : undefined;
      if (physics && holdable) {
        physics.hold(holdable, this.inSpaceOf(holdable, screen));
        this.pointers.set(ev.pointerId, { ...screen, startX: screen.x, startY: screen.y, startedAt: performance.now(), drag: { entity: holdable, dx: 0, dy: 0, held: true } });
        return;
      }

      // A finger on a thing in the bag that some rule wants dragged onto something picks it up.
      if (this.time > TAP_GRACE && !this.bagDrag && this.startBagDrag(ev.pointerId, screen)) return;

      const draggable = this.topmostAt(screen, (e) => e.visible && e.def.behaviors.some((b) => b.type === 'draggable'));
      const grip = draggable && this.inSpaceOf(draggable, screen);
      this.pointers.set(ev.pointerId, {
        ...screen,
        startX: screen.x,
        startY: screen.y,
        startedAt: performance.now(),
        drag: draggable && grip ? { entity: draggable, dx: grip.x - draggable.x, dy: grip.y - draggable.y } : null,
      });
      this.taps.push(screen);
      this.lastTap = screen;
    };
    const onMove = (ev: PointerEvent) => {
      const screen = this.toScreen(ev.clientX, ev.clientY);
      if (this.editDrag) return this.editMove(screen, ev);
      const pointer = this.pointers.get(ev.pointerId) ?? this.heldOver.get(ev.pointerId);
      if (pointer) Object.assign(pointer, screen);
      // The thing taken out of the bag follows the finger, held a little above it so it can be seen.
      if (this.bagDrag?.pointer === ev.pointerId) this.bagDrag.view.position.set(screen.x, screen.y - this.bagDrag.size * 0.4);
    };
    const onUp = (ev: PointerEvent) => {
      if (this.bagDrag?.pointer === ev.pointerId) this.endBagDrag(this.toScreen(ev.clientX, ev.clientY));
      const pointer = this.pointers.get(ev.pointerId);
      this.pointers.delete(ev.pointerId);
      this.heldOver.delete(ev.pointerId);
      if (pointer?.drag?.held && this.mode.kind === 'play') {
        // Where the finger was last is where the pull ended.
        this.physics?.aim(pointer.drag.entity, this.inSpaceOf(pointer.drag.entity, pointer));
        this.physics?.letGo(pointer.drag.entity);
      }
      if (pointer && !pointer.drag && (performance.now() - pointer.startedAt) / 1000 < SWIPE_SECONDS) {
        const dx = pointer.x - pointer.startX;
        const dy = pointer.y - pointer.startY;
        if (Math.hypot(dx, dy) >= SWIPE_DISTANCE) {
          this.swipes.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
        }
      }
      this.editUp();
    };
    const onWheel = (ev: WheelEvent) => {
      if (this.mode.kind !== 'edit') return;
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) return this.zoomTo(this.zoom * Math.exp(-ev.deltaY * 0.002), this.toScreen(ev.clientX, ev.clientY));
      // The wheel reports page pixels; the view moves in the game's own.
      const scale = this.view.width / (this.app.canvas.getBoundingClientRect().width || 1) / this.z;
      const [dx, dy] = ev.shiftKey ? [ev.deltaY, 0] : [ev.deltaX, ev.deltaY];
      this.setCamera(this.camera.x + dx * scale, this.camera.y + dy * scale);
      this.drawOverlay();
    };
    const onKey = (ev: KeyboardEvent) => {
      const down = ev.type === 'keydown';
      const jumpKey = ev.code === 'Space' || ev.code === 'ArrowUp';
      const moveKey = ev.code === 'ArrowLeft' || ev.code === 'ArrowRight' || ev.code === 'ArrowDown' || ev.code === 'KeyX' || ev.code === 'ShiftLeft' || ev.code === 'ShiftRight' || ev.code === 'KeyW' || ev.code === 'KeyS';
      if (!jumpKey && !moveKey) return;
      if (!down) {
        if (ev.code === 'Space') this.spaceHeld = false;
        return void this.keys.delete(ev.code);
      }
      // Inside an editor the same keys are needed for typing and for sliders.
      const target = ev.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, [contenteditable]')) return;
      if (this.mode.kind !== 'play') {
        // While editing, holding Space turns a drag into sliding the view.
        if (ev.code === 'Space') {
          this.spaceHeld = true;
          ev.preventDefault();
        }
        return;
      }
      ev.preventDefault();
      this.keys.add(ev.code);
      if (jumpKey && !ev.repeat) this.keyTap = true;
      if (!ev.repeat) this.pressed.add(ev.code);
    };
    // Out of sight (another app, another tab) the game and its music stand still.
    const onVisibility = () => {
      if (document.hidden) {
        this.app.ticker.stop();
        pauseMusic();
      } else {
        this.app.ticker.start();
        if (this.soundOn) resumeMusic();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    // The right button rubs out tile map cells while editing, so the page's own menu stays away.
    const onMenu = (ev: MouseEvent) => {
      if (this.mode.kind === 'edit') ev.preventDefault();
    };
    this.mount.addEventListener('contextmenu', onMenu);
    this.cleanup.push(() => this.mount.removeEventListener('contextmenu', onMenu));
    const resizeObserver = new ResizeObserver(() => this.fitToMount());
    resizeObserver.observe(this.mount);

    // The whole mount listens, not just the canvas, so a tap on the bars
    // beside a letterboxed game still counts on a phone.
    this.mount.addEventListener('pointerdown', onDown);
    this.mount.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    this.cleanup.push(
      () => this.mount.removeEventListener('pointerdown', onDown),
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => this.mount.removeEventListener('wheel', onWheel),
      () => window.removeEventListener('pointermove', onMove),
      () => window.removeEventListener('pointerup', onUp),
      () => window.removeEventListener('pointercancel', onUp),
      () => window.removeEventListener('keydown', onKey),
      () => window.removeEventListener('keyup', onKey),
      () => resizeObserver.disconnect(),
    );
  }

  // ── Editing ──────────────────────────────────────────────────────────────

  /** The selected object, if it is one that can be moved and resized (placed in the scene, not a prefab's sample). */
  private selectedPlaced(): Entity | undefined {
    return this.entities.find((e) => e.def.id === this.selection && this.scene.objects.includes(e.def));
  }

  private corners(e: Entity): Point[] {
    return [
      { x: e.x, y: e.y },
      { x: e.x + e.width, y: e.y },
      { x: e.x, y: e.y + e.height },
      { x: e.x + e.width, y: e.y + e.height },
    ];
  }

  private editDown(screen: Point, ev: PointerEvent): void {
    if (this.tool === 'hand' || this.spaceHeld || ev.button === 1) {
      this.editDrag = { kind: 'pan', from: screen, camera: { ...this.camera } };
      return;
    }
    // A resize handle of the selected object wins over whatever lies under it.
    const selected = this.selected.length === 1 ? this.selectedPlaced() : undefined;
    if (this.tool === 'paint' && selected?.def.visual.kind === 'tiles') {
      // Painting: each cell the pointer passes over takes the brush; the right button rubs out.
      this.editDrag = { kind: 'paint', entity: selected, rows: [...selected.def.visual.rows], changed: false };
      this.paintAt(screen, ev.button === 2 ? EMPTY_TILE : this.brush);
      return;
    }
    if (selected && selected.def.visual.kind !== 'text' && selected.def.visual.kind !== 'tiles' && !selected.def.locked) {
      const point = this.inSpaceOf(selected, screen);
      const reach = HANDLE / this.z;
      const corners = this.corners(selected);
      const grabbed = corners.findIndex((c) => Math.abs(c.x - point.x) <= reach && Math.abs(c.y - point.y) <= reach);
      if (grabbed >= 0) {
        this.editDrag = { kind: 'resize', entity: selected, anchor: corners[3 - grabbed], ratio: selected.width / selected.height, moved: false };
        return;
      }
    }

    // A locked object is looked through, so a background never gets in the way.
    const entity = this.topmostAt(screen, (e) => !e.def.locked);
    if (!entity) {
      this.editDrag = { kind: 'marquee', from: screen, to: screen, add: ev.shiftKey };
      return;
    }
    if (ev.shiftKey) return void this.options.onPick?.(entity.def.id, true);

    const inGroup = this.selected.length > 1 && this.selected.includes(entity.def.id);
    if (!inGroup) this.options.onPick?.(entity.def.id, false);
    const movable = (e: Entity) => this.scene.objects.includes(e.def) && !e.def.locked;
    const others = inGroup ? this.entities.filter((e) => e !== entity && this.selected.includes(e.def.id)) : [];
    const items = [entity, ...others].filter(movable).map((e) => {
      const point = this.inSpaceOf(e, screen);
      return { entity: e, dx: point.x - e.x, dy: point.y - e.y };
    });
    if (items.length > 0) this.editDrag = { kind: 'move', items, moved: false, single: inGroup ? entity.def.id : null };
  }

  /** Paints the cell of the tile map being painted that lies under a point on the screen. */
  private paintAt(screen: Point, brush: string): void {
    const d = this.editDrag;
    if (d?.kind !== 'paint') return;
    const e = d.entity;
    const v = e.def.visual as TilesVisual;
    const point = this.inSpaceOf(e, screen);
    const cell = Math.max(1, v.cell);
    const col = Math.floor((point.x - e.x) / cell);
    const row = Math.floor((point.y - e.y) / cell);
    if (row < 0 || row >= d.rows.length || col < 0 || col >= d.rows[row].length) return;
    const key = brush === EMPTY_TILE || v.kinds[brush] ? brush : EMPTY_TILE;
    if (d.rows[row][col] === key) return;
    d.rows[row] = d.rows[row].slice(0, col) + key + d.rows[row].slice(col + 1);
    d.changed = true;
    // The map is drawn again at once from the painted rows; the editor hears of them when the stroke ends.
    const old = e.view;
    e.view = centred(this.drawTiles({ ...v, rows: d.rows }), e.def);
    old.parent?.addChildAt(e.view, old.parent.getChildIndex(old));
    old.destroy({ children: true });
    this.syncView(e);
  }

  private editMove(screen: Point, ev: PointerEvent): void {
    const d = this.editDrag!;
    if (d.kind === 'paint') {
      this.paintAt(screen, ev.buttons === 2 ? EMPTY_TILE : this.brush);
      return;
    }
    if (d.kind === 'pan') {
      this.setCamera(d.camera.x - (screen.x - d.from.x) / this.z, d.camera.y - (screen.y - d.from.y) / this.z);
    } else if (d.kind === 'marquee') {
      d.to = screen;
    } else if (d.kind === 'move') {
      const lead = d.items[0];
      const point = this.inSpaceOf(lead.entity, screen);
      const wanted: Point = { x: Math.round(point.x - lead.dx), y: Math.round(point.y - lead.dy) };
      // Alt lets the object go exactly where the pointer is.
      const to = ev.altKey ? wanted : this.snap(lead.entity, wanted, d.items.map((i) => i.entity));
      if (ev.altKey) this.guides = null;
      const dx = to.x - lead.entity.x;
      const dy = to.y - lead.entity.y;
      for (const { entity } of d.items) {
        entity.x += dx;
        entity.y += dy;
        this.syncView(entity);
      }
      if (dx !== 0 || dy !== 0) d.moved = true;
    } else {
      const e = d.entity;
      const point = this.inSpaceOf(e, screen);
      let width = Math.max(MIN_SIZE, Math.abs(point.x - d.anchor.x));
      let height = Math.max(MIN_SIZE, Math.abs(point.y - d.anchor.y));
      // A picture keeps its shape unless Shift is held; a plain shape keeps it only while Shift is held.
      if ((e.def.visual.kind === 'image') !== ev.shiftKey) {
        if (width / height > d.ratio) height = width / d.ratio;
        else width = height * d.ratio;
      } else if (this.grid > 0) {
        width = Math.max(this.grid, Math.round(width / this.grid) * this.grid);
        height = Math.max(this.grid, Math.round(height / this.grid) * this.grid);
      }
      // The box spans from the fixed corner toward the pointer, never smaller than the minimum.
      e.width = Math.round(width);
      e.height = Math.round(height);
      e.x = Math.round(point.x < d.anchor.x ? d.anchor.x - e.width : d.anchor.x);
      e.y = Math.round(point.y < d.anchor.y ? d.anchor.y - e.height : d.anchor.y);
      d.moved = true;
      this.syncView(e);
    }
    this.drawOverlay();
  }

  private editUp(): void {
    const d = this.editDrag;
    this.editDrag = null;
    this.guides = null;
    if (!d) return;
    const boxed = (e: Entity) => ({ id: e.def.id, box: { x: e.x, y: e.y, width: e.width, height: e.height } });
    if (d.kind === 'paint') {
      if (d.changed) this.options.onTiles?.(d.entity.def.id, d.rows);
    } else if (d.kind === 'marquee') {
      if (Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y) < 6) {
        if (!d.add) this.options.onPick?.(null, false);
      } else {
        const covered = this.entities.filter((e) => {
          if (e.def.locked || !this.scene.objects.includes(e.def)) return false;
          const a = this.inSpaceOf(e, d.from);
          const b = this.inSpaceOf(e, d.to);
          const box = this.boxOf(e);
          return box.x <= Math.max(a.x, b.x) && box.x + box.width >= Math.min(a.x, b.x) && box.y <= Math.max(a.y, b.y) && box.y + box.height >= Math.min(a.y, b.y);
        });
        this.options.onPickMany?.(covered.map((e) => e.def.id), d.add);
      }
    } else if (d.kind === 'move') {
      if (d.moved) this.options.onChange?.(d.items.map((i) => boxed(i.entity)));
      else if (d.single) this.options.onPick?.(d.single, false);
    } else if (d.kind === 'resize' && d.moved) {
      this.options.onChange?.([boxed(d.entity)]);
    }
    this.drawOverlay();
  }

  /**
   * Where a dragged object should land: on the grid if one is on, otherwise
   * pulled to the nearest edge or middle of another object, or of the screen
   * or world, when it comes close. The lines it was pulled to are kept for drawing.
   */
  private snap(e: Entity, wanted: Point, moving: Entity[]): Point {
    this.guides = null;
    if (this.grid > 0) return { x: Math.round(wanted.x / this.grid) * this.grid, y: Math.round(wanted.y / this.grid) * this.grid };
    const fixed = Boolean(e.def.fixed);
    const box = this.boxOf(e);
    // A text's box does not start at its own position; the difference stays the same as it moves.
    const left = wanted.x + (box.x - e.x);
    const top = wanted.y + (box.y - e.y);
    const { width, height } = this.view;
    const [spaceW, spaceH] = fixed ? [width, height] : [this.scene.width, this.scene.height];
    const xs = [0, spaceW / 2, spaceW];
    const ys = [0, spaceH / 2, spaceH];
    for (const other of this.entities) {
      if (moving.includes(other) || Boolean(other.def.fixed) !== fixed) continue;
      const b = this.boxOf(other);
      xs.push(b.x, b.x + b.width / 2, b.x + b.width);
      ys.push(b.y, b.y + b.height / 2, b.y + b.height);
    }
    const reach = SNAP / this.z;
    const nearest = (lines: number[], start: number, size: number) => {
      let found: { shift: number; line: number } | null = null;
      for (const line of lines) {
        for (const part of [0, size / 2, size]) {
          const shift = line - (start + part);
          if (Math.abs(shift) <= reach && (!found || Math.abs(shift) < Math.abs(found.shift))) found = { shift, line };
        }
      }
      return found;
    };
    const sx = nearest(xs, left, box.width);
    const sy = nearest(ys, top, box.height);
    this.guides = { fixed, x: sx ? [sx.line] : [], y: sy ? [sy.line] : [] };
    return { x: Math.round(wanted.x + (sx?.shift ?? 0)), y: Math.round(wanted.y + (sy?.shift ?? 0)) };
  }

  /** Edit mode: the edge of the world, the grid, the selection outlines with their resize handles, and whatever a drag is showing. */
  private drawOverlay(): void {
    const g = this.overlay.clear();
    if (this.mode.kind !== 'edit') return;
    const { width: W, height: H } = this.view;
    const z = this.z;
    const origin = this.hudOrigin();
    const onCanvas = (fixed: boolean, p: Point): Point =>
      fixed ? { x: origin.x + p.x * z, y: origin.y + p.y * z } : { x: (p.x - this.camera.x) * z, y: (p.y - this.camera.y) * z };

    // Everything outside the world is dimmed, so its edge is plain to see.
    const world = { ...onCanvas(false, { x: 0, y: 0 }), width: this.scene.width * z, height: this.scene.height * z };
    const shade = { color: '#1b3a4b', alpha: 0.3 };
    if (world.y > 0) g.rect(0, 0, W, world.y).fill(shade);
    if (world.y + world.height < H) g.rect(0, world.y + world.height, W, H - world.y - world.height).fill(shade);
    const top = Math.max(0, world.y);
    const bottom = Math.min(H, world.y + world.height);
    if (world.x > 0) g.rect(0, top, world.x, bottom - top).fill(shade);
    if (world.x + world.width < W) g.rect(world.x + world.width, top, W - world.x - world.width, bottom - top).fill(shade);

    if (this.grid > 0 && this.grid * z >= 8) {
      const first = (from: number) => Math.ceil(from / this.grid) * this.grid;
      for (let x = first(Math.max(0, this.camera.x)); x <= Math.min(this.scene.width, this.camera.x + W / z); x += this.grid) {
        g.moveTo((x - this.camera.x) * z, top).lineTo((x - this.camera.x) * z, bottom);
      }
      for (let y = first(Math.max(0, this.camera.y)); y <= Math.min(this.scene.height, this.camera.y + H / z); y += this.grid) {
        g.moveTo(Math.max(0, world.x), (y - this.camera.y) * z).lineTo(Math.min(W, world.x + world.width), (y - this.camera.y) * z);
      }
      g.stroke({ width: 1, color: '#1b3a4b', alpha: 0.16 });
    }
    if (this.scene.width > W || this.scene.height > H || z !== 1) {
      g.rect(world.x, world.y, world.width, world.height).stroke({ width: 6, color: '#1b3a4b', alpha: 0.5 });
    }
    // Zoomed out, a frame the size of the phone's screen shows how much of the world the player sees at once.
    if (z < 1) {
      g.rect(origin.x, origin.y, W * z, H * z).stroke({ width: 7, color: '#1b3a4b', alpha: 0.75 });
      g.rect(origin.x, origin.y, W * z, H * z).stroke({ width: 3, color: '#ffffff' });
    }

    const pad = 8;
    for (const entity of this.entities) {
      if (!this.selected.includes(entity.def.id)) continue;
      const fixed = Boolean(entity.def.fixed);
      const box = this.boxOf(entity);
      const at = onCanvas(fixed, box);
      const args = [at.x - pad, at.y - pad, box.width * z + pad * 2, box.height * z + pad * 2, 10] as const;
      // Two strokes, dark under light, so the outline shows on any background.
      // A sample of something made during play is outlined in blue: it is on show, not placed in the scene.
      const placed = this.scene.objects.includes(entity.def);
      g.roundRect(...args).stroke({ width: 9, color: '#1b3a4b' }).roundRect(...args).stroke({ width: 4, color: placed ? '#ffd54a' : '#4fc3f7' });

      if (this.selected.length === 1 && entity.def.visual.kind !== 'text') {
        // What cannot be seen in the picture: the shape that counts for touching, and the path of a patrol.
        const inset = entity.def.hitboxInset ?? 0;
        const mid = onCanvas(fixed, { x: entity.x + entity.width / 2, y: entity.y + entity.height / 2 });
        if (entity.def.round) g.circle(mid.x, mid.y, Math.max(1, (Math.min(entity.width, entity.height) / 2 - inset) * z)).stroke({ width: 3, color: '#00b8d4' });
        else if (inset > 0) g.rect(at.x + inset * z, at.y + inset * z, (box.width - inset * 2) * z, (box.height - inset * 2) * z).stroke({ width: 3, color: '#00b8d4' });
        const patrol = entity.def.behaviors.find((b) => b.type === 'patrol');
        if (patrol?.type === 'patrol') {
          const end = onCanvas(fixed, { x: entity.x + entity.width / 2 + (patrol.axis === 'x' ? patrol.distance : 0), y: entity.y + entity.height / 2 + (patrol.axis === 'y' ? patrol.distance : 0) });
          g.moveTo(mid.x, mid.y).lineTo(end.x, end.y).stroke({ width: 4, color: '#00b8d4' }).circle(end.x, end.y, 8).fill('#00b8d4');
        }
        // A joint shows what it will hold on to: a line to the nearest object of its group, and the pin of a hinge.
        for (const joint of entity.def.behaviors) {
          if (joint.type !== 'joint' || fixed) continue;
          const other = this.nearest(entity, joint.targetTag);
          if (!other) continue;
          const to = onCanvas(false, { x: other.x + other.width / 2, y: other.y + other.height / 2 });
          g.moveTo(mid.x, mid.y).lineTo(to.x, to.y).stroke({ width: 4, color: '#ff6d00' });
          const pin = joint.at === 'other' ? to : joint.at === 'between' ? { x: (mid.x + to.x) / 2, y: (mid.y + to.y) / 2 } : mid;
          if (joint.kind === 'hinge' || joint.kind === 'weld' || joint.kind === 'wheel') g.circle(pin.x, pin.y, 9).fill('#ffffff').circle(pin.x, pin.y, 9).stroke({ width: 4, color: '#ff6d00' });
          if (joint.kind === 'slider') {
            // The rail it slides along, as far as it may go.
            const angle = ((joint.axis ?? 0) * Math.PI) / 180;
            const reach = (joint.range || 200) * z;
            const [ux, uy] = [Math.cos(angle) * reach, Math.sin(angle) * reach];
            g.moveTo(mid.x - ux, mid.y - uy).lineTo(mid.x + ux, mid.y + uy).stroke({ width: 6, color: '#ff6d00', alpha: 0.6 });
          }
        }
        // A wind shows which way it blows; a magnet, where it pulls to.
        for (const field of entity.def.behaviors) {
          if (field.type !== 'field' || field.kind === 'water') continue;
          const length = Math.min(entity.width, entity.height) * 0.35 * z;
          if (field.kind === 'wind') {
            const angle = (field.direction * Math.PI) / 180;
            const tip = { x: mid.x + Math.cos(angle) * length, y: mid.y + Math.sin(angle) * length };
            const back = (side: number) => ({ x: tip.x - Math.cos(angle + side) * 22, y: tip.y - Math.sin(angle + side) * 22 });
            const [l, r] = [back(0.5), back(-0.5)];
            g.moveTo(mid.x - Math.cos(angle) * length, mid.y - Math.sin(angle) * length).lineTo(tip.x, tip.y).moveTo(l.x, l.y).lineTo(tip.x, tip.y).lineTo(r.x, r.y).stroke({ width: 6, color: '#00b8d4' });
          } else {
            g.circle(mid.x, mid.y, 12).fill('#00b8d4').circle(mid.x, mid.y, length).stroke({ width: 3, color: '#00b8d4', alpha: 0.6 });
          }
        }
      }
      // A selected tile map shows its cells, so it is plain where a brush stroke will land.
      if (this.selected.length === 1 && entity.def.visual.kind === 'tiles') {
        const v = entity.def.visual;
        const cell = Math.max(1, v.cell);
        const cols = Math.max(0, ...v.rows.map((r) => r.length));
        if (cell * z >= 6) {
          for (let c = 0; c <= cols; c++) {
            const a = onCanvas(fixed, { x: entity.x + c * cell, y: entity.y });
            g.moveTo(a.x, a.y).lineTo(a.x, a.y + v.rows.length * cell * z);
          }
          for (let r = 0; r <= v.rows.length; r++) {
            const a = onCanvas(fixed, { x: entity.x, y: entity.y + r * cell });
            g.moveTo(a.x, a.y).lineTo(a.x + cols * cell * z, a.y);
          }
          g.stroke({ width: 1, color: '#1b3a4b', alpha: 0.35 });
        }
      }
      if (this.selected.length === 1 && entity === this.selectedPlaced() && entity.def.visual.kind !== 'text' && entity.def.visual.kind !== 'tiles' && !entity.def.locked) {
        for (const corner of this.corners(entity)) {
          const c = onCanvas(fixed, corner);
          g.rect(c.x - HANDLE, c.y - HANDLE, HANDLE * 2, HANDLE * 2).fill('#ffffff').stroke({ width: 4, color: '#1b3a4b' });
        }
      }
    }

    if (this.guides) {
      for (const x of this.guides.x) {
        const at = onCanvas(this.guides.fixed, { x, y: 0 }).x;
        g.moveTo(at, 0).lineTo(at, H);
      }
      for (const y of this.guides.y) {
        const at = onCanvas(this.guides.fixed, { x: 0, y }).y;
        g.moveTo(0, at).lineTo(W, at);
      }
      g.stroke({ width: 3, color: '#ff3d81' });
    }
    const d = this.editDrag;
    if (d?.kind === 'marquee') {
      const box = [Math.min(d.from.x, d.to.x), Math.min(d.from.y, d.to.y), Math.abs(d.to.x - d.from.x), Math.abs(d.to.y - d.from.y)] as const;
      g.rect(...box).fill({ color: '#ffd54a', alpha: 0.18 }).rect(...box).stroke({ width: 3, color: '#1b3a4b' });
    }
  }

  // ── Presentation ─────────────────────────────────────────────────────────

  /** Rewrites text objects when a variable they might show has changed. */
  refreshTexts(force: boolean): void {
    const key = [...this.variables.values()].join('|');
    if (!force && key === this.shownValues) return;
    this.shownValues = key;
    for (const e of this.entities) {
      const v = e.def.visual;
      if (v.kind === 'bar') {
        // While editing, a bar is shown mostly full so both of its colours can be seen.
        const value = this.mode.kind === 'edit' ? v.max * 0.7 : (this.variables.get(v.variable) ?? 0);
        const part = Math.min(1, Math.max(0, value / (v.max || 1)));
        const { width, height } = e.def;
        const g = (e.view as Graphics).clear().roundRect(0, 0, width, height, height / 2).fill(v.back);
        if (part > 0) g.roundRect(0, 0, Math.max(height, width * part), height, height / 2).fill(e.color ?? v.color);
      }
      if (v.kind === 'bag') {
        const things = this.carried().map((name) => {
          const asset = this.project.variables.find((x) => x.name === name)?.item?.asset;
          const count = this.mode.kind === 'edit' ? 1 : (this.variables.get(name) ?? 0);
          return { name, count, texture: asset ? (this.textures.get(asset)?.texture ?? null) : null };
        });
        const font = [this.project.meta.fontFamily, FALLBACK_FONT, 'sans-serif'];
        this.bagIcons.set(e, drawBag(e.view, bagSlots(e.def.width, e.def.height, v.slots), things, font));
      }
      if (e.def.visual.kind !== 'text') continue;
      // While editing, the text shows what was typed, placeholders included.
      const filled = this.mode.kind === 'edit' ? e.def.visual.text : fillTemplate(e.text ?? e.def.visual.text, this.variables, e.values, this.textVariables);
      const view = e.view as Text;
      const next = applyDirection(filled);
      // Measured again only when the words change (fitting changes the letters' size, which redraws them).
      if (view.text !== next || !this.fitted.has(view)) {
        view.text = next;
        this.fitText(e, view);
        this.fitted.add(view);
      }
    }
  }

  /**
   * A line of text never runs off the screen: one wider than the room it has (from where it stands to the
   * screen's edges, a small margin kept) is drawn in smaller letters. Text in a world wider than the screen
   * moves with it, so only text on the screen itself, or in a scene no wider than it, is fitted.
   */
  private fitText(e: Entity, view: Text): void {
    const v = e.def.visual;
    if (v.kind !== 'text') return;
    const W = this.project.meta.width;
    if (!e.def.fixed && this.scene.width > W) return;
    const margin = 24;
    const x = e.def.x;
    const room = v.align === 'left' ? W - margin - x : v.align === 'right' ? x - margin : 2 * Math.min(x - margin, W - margin - x);
    if (view.style.fontSize !== v.size) view.style.fontSize = v.size;
    const wide = view.width / Math.max(0.01, Math.abs(view.scale.x));
    if (room > 40 && wide > room) view.style.fontSize = Math.max(8, Math.floor((v.size * room) / wide));
  }

  /**
   * Scales the canvas to the largest size that fits the mount. Filling (see the option), a screen of
   * another shape than the design makes the view itself taller or wider (up to 1.6 times), so that no
   * strips are left; `relayout` lays out the scene on view for the new size.
   */
  private fitToMount(relayout = true): void {
    const { width: W, height: H } = this.project.meta;
    const box = this.mount.getBoundingClientRect();
    let next = { width: W, height: H };
    if (this.options.fill && this.mode.kind === 'play' && box.width > 0 && box.height > 0) {
      const shape = box.width / box.height;
      if (shape < W / H - 0.01) next = { width: W, height: Math.round(Math.min(H * 1.6, W / shape)) };
      else if (shape > W / H + 0.01) next = { width: Math.round(Math.min(W * 1.6, H * shape)), height: H };
    }
    if (next.width !== this.view.width || next.height !== this.view.height) {
      this.view = next;
      this.app.renderer.resize(next.width, next.height);
      if (relayout) this.relayout();
    }
    const scale = Math.min(box.width / this.view.width, box.height / this.view.height) || 1;
    this.app.canvas.style.width = `${Math.floor(this.view.width * scale)}px`;
    this.app.canvas.style.height = `${Math.floor(this.view.height * scale)}px`;
  }

  /** After the screen changed shape (a phone turned round): what covers the screen is sized anew, the HUD put back to its edges. */
  private relayout(): void {
    const backdrop = this.scene.background ?? this.project.meta.background;
    this.backdrop.clear().rect(-60, -60, this.view.width + 120, this.view.height + 120).fill(backdrop);
    this.curtain.clear().rect(0, 0, this.view.width, this.view.height).fill('#000000');
    if (this.skyView && this.scene.sky && this.scene.sky !== 'none') {
      this.skyView.destroy();
      this.skyView = new SkyView(this.scene.sky, this.view.width, this.view.height);
      this.scenery.addChildAt(this.skyView.container, 1);
    }
    this.weather.set(this.scene.weather ?? 'none', this.view.width, this.view.height);
    this.applyLook();
    this.placeOnScreen(this.entities);
    this.setCamera(this.camera.x, this.camera.y);
    this.followCameraTarget(true);
  }

  /**
   * Screen-fixed objects on a screen larger than the design keep to their edge: those in the top third of
   * the design stay at the top, the bottom third goes to the bottom, the middle stays in the middle. Something
   * inside another (a word on a button, a button on a menu) goes with it. A cover the size of the whole
   * screen grows to the new size.
   */
  private placeOnScreen(entities: Entity[]): void {
    if (this.mode.kind !== 'play') return;
    const { width: W, height: H } = this.project.meta;
    const [moreW, moreH] = [this.view.width - W, this.view.height - H];
    const fixed = entities.filter((e) => e.def.fixed);
    for (const e of fixed) if (!this.hudBase.has(e)) this.hudBase.set(e, { x: e.x, y: e.y, width: e.width, height: e.height });
    const share = (centre: number, size: number) => (centre < size / 3 ? 0 : centre > (size * 2) / 3 ? 1 : 0.5);
    const cover = (b: { width: number; height: number }) => b.width >= W * 0.9 && b.height >= H * 0.9;
    for (const e of fixed) {
      const base = this.hudBase.get(e)!;
      if (cover(base)) {
        Object.assign(e, { x: base.x, y: base.y, width: base.width + moreW, height: base.height + moreH });
        continue;
      }
      const centre = { x: base.x + base.width / 2, y: base.y + base.height / 2 };
      // The outermost other fixed thing it sits inside decides where it goes (never a whole-screen cover), so a
      // word on a button on a menu moves with the menu, as the button does: going by the button, a word on a
      // button low on the menu went to the bottom while its button stayed with the menu.
      const holder = fixed
        .map((o) => ({ o, b: this.hudBase.get(o)! }))
        .filter(({ o, b }) => o !== e && !cover(b) && b.width * b.height > base.width * base.height && contains(b, centre))
        .sort((a, b) => b.b.width * b.b.height - a.b.width * a.b.height)[0]?.b ?? base;
      const at = { x: holder.x + holder.width / 2, y: holder.y + holder.height / 2 };
      e.x = base.x + moreW * share(at.x, W);
      e.y = base.y + moreH * share(at.y, H);
    }
  }

  /** The area an object covers, in its own space. Text is measured; everything else uses its own size. */
  boxOf(e: Entity): Box {
    if (e.def.visual.kind !== 'text') return { x: e.x, y: e.y, width: e.width, height: e.height };
    const b = e.view.getLocalBounds();
    return { x: e.x + b.x, y: e.y + b.y, width: b.width, height: b.height };
  }

  // ── Saved variables ──────────────────────────────────────────────────────
  // Storage can be unavailable (private browsing, some embedded previews), and
  // a game should still play there, so every access is guarded.

  savedKey(name: string): string {
    return `save:${this.project.app.appId}:${name}`;
  }

  private readSaved(name: string, fallback: number): number {
    try {
      const raw = localStorage.getItem(this.savedKey(name));
      return raw === null || Number.isNaN(Number(raw)) ? fallback : Number(raw);
    } catch {
      return fallback;
    }
  }

  private writeSaved(name: string, value: number | string): void {
    try {
      localStorage.setItem(this.savedKey(name), String(value));
    } catch {
      // The value simply isn't remembered between sessions.
    }
  }
}

/** Which sides of a tile map's cell have no cell of the map next to them. */
function tileSides(tiles: TilesVisual, r: number, c: number): OpenSides {
  const filled = (row: number, col: number) => {
    const key = tiles.rows[row]?.[col];
    return key !== undefined && key !== EMPTY_TILE && tiles.kinds[key] !== undefined;
  };
  return { top: !filled(r - 1, c), bottom: !filled(r + 1, c), left: !filled(r, c - 1), right: !filled(r, c + 1) };
}

function assertPlayable(project: GameProject): void {
  // The player and the editor make an older project current before it gets here (src/format/migrate.ts).
  const problems = validateProject(project);
  if (problems.length > 0) throw new Error(`This game cannot be played:\n- ${problems.join('\n- ')}`);
}

/** Makes a shape turn around its centre instead of its top-left corner. */
/** Part of a picture, as fractions of it. Kept per picture and part, so pieces share their textures. */
const crops = new Map<string, Texture>();
function cropped(texture: Texture, crop: { x: number; y: number; w: number; h: number }): Texture {
  const key = `${texture.uid}:${crop.x}:${crop.y}:${crop.w}:${crop.h}`;
  let made = crops.get(key);
  if (!made) {
    const f = texture.frame;
    const frame = new Rectangle(f.x + crop.x * f.width, f.y + crop.y * f.height, Math.max(1, crop.w * f.width), Math.max(1, crop.h * f.height));
    made = new Texture({ source: texture.source, frame });
    crops.set(key, made);
  }
  return made;
}

function centred<T extends Container>(view: T, def: GameObject): T {
  view.pivot.set(def.width / 2, def.height / 2);
  return view;
}
