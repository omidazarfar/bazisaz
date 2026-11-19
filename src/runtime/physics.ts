import {
  Box, Chain, Circle, DistanceJoint, MouseJoint, Polygon, PrismaticJoint, RevoluteJoint, RopeJoint, WeldJoint, WheelJoint, World,
  type Body, type Contact, type Joint,
} from 'planck';
import type { FieldBehavior, GameObject, JointBehavior, PhysicsBehavior } from '../format/types';

/**
 * Real physics for the objects that ask for it, worked out by planck (a port
 * of Box2D). The game keeps its own picture of every object (where it is, how
 * it is turned, how fast it goes); before each step that picture is handed to
 * the physics world, so a rule or another behavior can still move an object,
 * and after the step the world's answer is written back.
 *
 * Three kinds of thing take part:
 * - moving: has the physics behavior and moves by itself, falling and tumbling.
 * - still: has the physics behavior but never moves by itself; whatever else
 *   moves it (a patrol, a rule, a spin) drives it, and it shoves what it meets.
 *   It can carry what rests on it along (a conveyor) or let things up through
 *   it from below (a jump-through platform).
 * - wall: has no physics behavior, but is in a group that some moving object
 *   is told to meet (the ground, a tile map), or is the other end of a joint.
 *   It is driven like a still one.
 *
 * Objects with the field behavior push moving things inside their area: wind,
 * water (which holds things up by their weight, so light ones float), magnets.
 */

/** Pixels in one of the engine's metres. Box2D is tuned for things 0.1 to 10 m across; at 40 a 60-pixel crate is 1.5 m. */
const M = 40;
/** How far a sling can be pulled back, in pixels. */
const MAX_PULL = 200;
/** A still object asked to move further than this in one step is put there, not swept there, so a jump across the screen does not knock everything flying. */
const TELEPORT_SPEED = 3000;
/** A sling can be pulled only once its object has (almost) stopped, in pixels per second. */
const REST_SPEED = 40;
/** Below this speed, for this long, a moving thing counts as having come to rest. */
const STOP_SPEED = 25;
const STOP_TIME = 0.4;
/** A slung object that has not come back after this long is brought back anyway. */
const LONGEST_FLIGHT = 10;

/** What the game's objects look like to the physics: enough to build a body and to keep it in step. */
export interface Thing {
  def: GameObject;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  vx: number;
  vy: number;
  visible: boolean;
  alive: boolean;
}

interface Point {
  x: number;
  y: number;
}

type Role = 'moving' | 'still' | 'wall';

interface Hold {
  mode: 'grab' | 'sling';
  /** Where the finger is now, in pixels. */
  finger: Point;
  /** Sling: where the object was when the pull began; it is thrown back toward here. */
  anchor: Point;
  /** Sling: where on the object the finger landed, from its middle. */
  grip: Point;
  joint: MouseJoint | null;
}

interface Rec<T> {
  thing: T;
  body: Body;
  role: Role;
  physics: PhysicsBehavior | null;
  /** The object as the world left it after the last step, so a change made by anything else since can be noticed. */
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  held: Hold | null;
  /**
   * What a slung object was resting on when it was pulled back (the post of
   * the sling). It passes through these until it is clear of them, so the
   * throw is not stopped by its own stand.
   */
  ignore: Set<Body> | null;
  /** The way it was thrown, and seconds since: it is clear of its stand once past it that way, or after a while. */
  thrown: { x: number; y: number; age: number } | null;
  /** A sling that reloads: the middle of where it waits, in pixels, and whether it is waiting there now. */
  home: Point | null;
  ready: boolean;
  /** For noticing it come to rest: whether it has been moving, and for how long it has been nearly still. */
  moved: boolean;
  still: number;
}

interface JointRec<T> {
  behavior: JointBehavior;
  a: T;
  b: T;
  joint: Joint;
}

export interface Hit<T> {
  a: T;
  b: T;
  /** How fast they came together, head-on, in pixels per second. */
  speed: number;
}

/** What a sling being pulled looks like, for drawing the band and where the throw would go. */
export interface Pull {
  anchor: Point;
  centre: Point;
  /** The speed it would be thrown at if let go now, in pixels per second. */
  throwSpeed: Point;
  gravity: boolean;
}

export class Physics<T extends Thing> {
  private readonly world = new World({ gravity: { x: 0, y: 0 } });
  private readonly recs = new Map<T, Rec<T>>();
  /** Things that turned out to need no body, so they are not looked at again. */
  private readonly ignored = new WeakSet<T>();
  /** Things with a joint behavior whose joint is not made yet, because the other end has not appeared. */
  private readonly pendingJoints: T[] = [];
  private readonly joints: JointRec<T>[] = [];
  /** Groups whose members take part as walls even without physics of their own. */
  private readonly wallTags: Set<string>;
  /** A body with no shape that grabbed objects hang from. */
  private readonly ground: Body;
  /** Contacts with a jump-through platform that were let through, kept so until the two part. */
  private readonly passing = new WeakSet<Contact>();
  private readonly size: { width: number; height: number };
  /** The pull of gravity during the current step, in metres per second squared. */
  private gravity = 0;
  /** What happened during the last step, for the rules. */
  hits: Hit<T>[] = [];
  thrown: T[] = [];
  snapped: { a: T; b: T }[] = [];
  rested: T[] = [];
  /** Joints cut by a rule, handed to the rules with the next step's events, so every rule hears of them. */
  private readonly cuts: { a: T; b: T }[] = [];

  /** Forgets what happened, once the rules have heard of it. */
  endStep(): void {
    this.hits = [];
    this.thrown = [];
    this.snapped = [];
    this.rested = [];
  }

  constructor(width: number, height: number, behaviors: (PhysicsBehavior | JointBehavior)[]) {
    this.size = { width, height };
    this.wallTags = new Set(
      behaviors.map((b) => (b.type === 'physics' ? b.solidTag : b.targetTag)).filter((tag) => tag !== ''),
    );
    this.ground = this.world.createBody({ type: 'static' });
    // The world's edges, as one loop of walls; only objects that ask for them meet them.
    const edges = this.world.createBody({ type: 'static', userData: 'edge' });
    const [w, h] = [width / M, height / M];
    const loop = edges.createFixture({ shape: new Chain([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], true), friction: 0.6 });
    loop.shouldCollide = (that) => this.allowed('edge', that.getBody().getUserData());
    this.world.on('begin-contact', (contact) => this.onContact(contact));
    this.world.on('pre-solve', (contact) => this.beforeSolving(contact));
    this.world.on('end-contact', (contact) => this.passing.delete(contact));
  }

  /**
   * Moves the world on by one step. `things` are all the game's objects; new
   * ones are given bodies and the bodies of removed ones are taken away.
   */
  step(things: T[], dt: number, gravity: number): void {
    // What happened since the rules last looked (a throw, a cut) is kept for them; the step adds to it.
    this.snapped.push(...this.cuts.splice(0));
    this.gravity = gravity / M;
    const fields: { thing: T; field: FieldBehavior }[] = [];
    for (const t of things) {
      if (!t.alive) continue;
      if (t.visible) for (const b of t.def.behaviors) if (b.type === 'field') fields.push({ thing: t, field: b });
      if (this.ignored.has(t)) continue;
      let rec = this.recs.get(t);
      if (!rec) {
        const role = this.roleOf(t);
        if (!role) {
          this.ignored.add(t);
          continue;
        }
        rec = this.make(t, role);
      }
      this.prepare(rec, dt);
    }
    for (const [t, rec] of this.recs) {
      if (t.alive) continue;
      this.world.destroyBody(rec.body);
      this.recs.delete(t);
    }
    if (this.pendingJoints.length > 0) this.makeJoints(things);
    for (let i = this.joints.length - 1; i >= 0; i--) {
      if (!this.joints[i].a.alive || !this.joints[i].b.alive) this.joints.splice(i, 1);
    }
    for (const { thing, field } of fields) this.push(thing, field, dt);
    for (const rec of this.recs.values()) if (rec.role === 'moving' && !rec.held && !rec.ready && rec.body.isAwake()) this.resistRolling(rec, dt);
    this.driveSliders();

    this.world.setGravity({ x: 0, y: this.gravity });
    this.world.step(dt, 8, 3);
    this.breakJoints(dt);

    for (const rec of this.recs.values()) {
      const t = rec.thing;
      if (rec.role === 'moving') {
        const p = rec.body.getPosition();
        const v = rec.body.getLinearVelocity();
        t.x = p.x * M - t.width / 2;
        t.y = p.y * M - t.height / 2;
        t.angle = rec.body.getAngle();
        t.vx = v.x * M;
        t.vy = v.y * M;
        this.noticeRest(rec, dt);
      }
      rec.x = t.x;
      rec.y = t.y;
      rec.angle = t.angle;
      rec.vx = t.vx;
      rec.vy = t.vy;
    }
  }

  /** Whether the thing has a body that moves by itself. */
  moves(t: T): boolean {
    if (this.ignored.has(t)) return false;
    return this.recs.get(t)?.role === 'moving' || (!this.recs.has(t) && this.roleOf(t) === 'moving');
  }

  /** Whether the thing has a body that holds firm: a still one, or a wall. */
  firm(t: T): boolean {
    const rec = this.recs.get(t);
    return rec !== undefined && rec.role !== 'moving';
  }

  /** What a moving thing is standing on: null if it is in the air, the edge of the world as `on: null`. Undefined if it has no body. */
  standing(t: T): { on: T | null } | null | undefined {
    const rec = this.recs.get(t);
    if (!rec || rec.role !== 'moving') return undefined;
    for (let edge = rec.body.getContactList(); edge; edge = edge.next) {
      const contact = edge.contact;
      if (!contact.isTouching() || !contact.isEnabled()) continue;
      const manifold = contact.getWorldManifold(null);
      if (!manifold) continue;
      // The normal points from A to B; seen from this body, the other is below when it points down.
      const down = contact.getFixtureA().getBody() === rec.body ? manifold.normal.y : -manifold.normal.y;
      if (down > 0.5) {
        const other = edge.other?.getUserData();
        return { on: isRec<T>(other) ? other.thing : null };
      }
    }
    return null;
  }

  /** Whether two things' bodies are pressed together right now (resting on each other counts). */
  touches(a: T, b: T): boolean {
    const ra = this.recs.get(a);
    const rb = this.recs.get(b);
    if (!ra || !rb) return false;
    for (let edge = ra.body.getContactList(); edge; edge = edge.next) {
      if (edge.other === rb.body && edge.contact.isTouching() && edge.contact.isEnabled()) return true;
    }
    return false;
  }

  /** Whether a finger can take hold of this thing now, as its physics says. */
  canHold(t: T): boolean {
    const rec = this.recs.get(t);
    const drag = rec?.physics?.drag ?? 'none';
    if (!rec || rec.role !== 'moving' || drag === 'none' || rec.held) return false;
    return drag === 'grab' || rec.ready || (!rec.home && Math.hypot(t.vx, t.vy) < REST_SPEED);
  }

  /** A finger takes hold of a thing at `point`, in pixels. */
  hold(t: T, point: Point): void {
    const rec = this.recs.get(t);
    if (!rec || !this.canHold(t)) return;
    const body = rec.body;
    const centre = rec.ready && rec.home ? { ...rec.home } : { x: t.x + t.width / 2, y: t.y + t.height / 2 };
    if (rec.physics!.drag === 'grab') {
      const joint = this.world.createJoint(
        new MouseJoint({ maxForce: body.getMass() * 1500, frequencyHz: 6, dampingRatio: 0.8 }, this.ground, body, { x: point.x / M, y: point.y / M }),
      );
      body.setAwake(true);
      rec.held = { mode: 'grab', finger: point, anchor: centre, grip: { x: 0, y: 0 }, joint };
      return;
    }
    // Held by the sling it does not fall; it follows the finger until let go.
    rec.ignore = new Set();
    rec.thrown = null;
    for (let edge = body.getContactList(); edge; edge = edge.next) {
      if (edge.other && edge.contact.isTouching()) rec.ignore.add(edge.other);
    }
    this.refilter(rec);
    body.setType('kinematic');
    body.setLinearVelocity({ x: 0, y: 0 });
    body.setAngularVelocity(0);
    rec.held = { mode: 'sling', finger: point, anchor: centre, grip: { x: point.x - (t.x + t.width / 2), y: point.y - (t.y + t.height / 2) }, joint: null };
  }

  /** The finger holding a thing has moved to `point`, in pixels. */
  aim(t: T, point: Point): void {
    const held = this.recs.get(t)?.held;
    if (!held) return;
    held.finger = point;
    held.joint?.setTarget({ x: point.x / M, y: point.y / M });
  }

  /** The finger lets go: a grabbed thing drops, a slung one is thrown. */
  letGo(t: T): void {
    const rec = this.recs.get(t);
    const held = rec?.held;
    if (!rec || !held) return;
    rec.held = null;
    if (held.joint) {
      this.world.destroyJoint(held.joint);
      return;
    }
    const speed = this.throwSpeed(rec, held);
    if (speed.x === 0 && speed.y === 0) {
      // Not thrown, only let go: it goes back into the sling, or settles back on its stand.
      rec.ignore = null;
      this.refilter(rec);
      if (rec.home && rec.ready) return this.reload(rec);
      rec.body.setType('dynamic');
      rec.body.setAwake(true);
      return;
    }
    rec.ready = false;
    rec.thrown = { x: speed.x, y: speed.y, age: 0 };
    // Pulled back into the ground or a wall, it does not get stuck there: it flies out through whatever it overlaps.
    rec.ignore ??= new Set();
    for (let f = rec.body.getFixtureList(); f; f = f.getNext()) {
      this.world.queryAABB(f.getAABB(0), (other) => {
        const body = other.getBody();
        const owner = body.getUserData();
        if (body !== rec.body && isRec<T>(owner) && owner.role !== 'moving') rec.ignore!.add(body);
        return true;
      });
    }
    this.refilter(rec);
    rec.body.setType('dynamic');
    rec.body.setAwake(true);
    rec.body.setLinearVelocity({ x: speed.x / M, y: speed.y / M });
    t.vx = rec.vx = speed.x;
    t.vy = rec.vy = speed.y;
    rec.moved = true;
    rec.still = 0;
    this.thrown.push(t);
  }

  /** Slings being pulled right now. */
  pulls(): Pull[] {
    const out: Pull[] = [];
    for (const rec of this.recs.values()) {
      if (rec.held?.mode !== 'sling') continue;
      const t = rec.thing;
      out.push({ anchor: rec.held.anchor, centre: { x: t.x + t.width / 2, y: t.y + t.height / 2 }, throwSpeed: this.throwSpeed(rec, rec.held), gravity: rec.physics?.gravity !== false });
    }
    return out;
  }

  /** Ropes and springs, end to end in pixels, for drawing. Hinges, wheels, sliders and welds are not seen. */
  lines(): { kind: 'rope' | 'spring'; from: Point; to: Point }[] {
    return this.joints
      .filter((j) => (j.behavior.kind === 'rope' || j.behavior.kind === 'spring') && j.a.visible && j.b.visible)
      .map((j) => {
        const [a, b] = [j.joint.getAnchorA(), j.joint.getAnchorB()];
        return { kind: j.behavior.kind as 'rope' | 'spring', from: { x: a.x * M, y: a.y * M }, to: { x: b.x * M, y: b.y * M } };
      });
  }

  /** Throws moving things within `radius` of `centre` away from it; `strength` is the speed given to one right at the centre. */
  blast(centre: Point, strength: number, radius: number): void {
    for (const rec of this.recs.values()) {
      if (rec.role !== 'moving' || rec.held || rec.ready || !rec.body.isActive()) continue;
      const t = rec.thing;
      const [dx, dy] = [t.x + t.width / 2 - centre.x, t.y + t.height / 2 - centre.y];
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      // Right on top of the blast it goes straight up.
      const [ux, uy] = distance > 1 ? [dx / distance, dy / distance] : [0, -1];
      const speed = (strength * (1 - distance / Math.max(1, radius))) / M;
      const mass = rec.body.getMass();
      rec.body.applyLinearImpulse({ x: ux * speed * mass, y: uy * speed * mass }, rec.body.getWorldCenter(), true);
    }
  }

  /** Sets how fast a moving thing turns, in degrees per second. */
  spin(t: T, degrees: number): void {
    const rec = this.recs.get(t);
    if (!rec || rec.role !== 'moving' || rec.held) return;
    if (rec.ready) this.launch(rec);
    rec.body.setAngularVelocity((degrees * Math.PI) / 180);
    rec.body.setAwake(true);
  }

  /** Cuts every joint a thing has, at either end. */
  cut(t: T): void {
    for (let i = this.joints.length - 1; i >= 0; i--) {
      const j = this.joints[i];
      if (j.a !== t && j.b !== t) continue;
      this.world.destroyJoint(j.joint);
      this.joints.splice(i, 1);
      this.cuts.push({ a: j.a, b: j.b });
      for (const end of [j.a, j.b]) this.recs.get(end)?.body.setAwake(true);
    }
    // A joint still waiting for its other end is not made after all.
    const waiting = this.pendingJoints.indexOf(t);
    if (waiting >= 0) this.pendingJoints.splice(waiting, 1);
  }

  /** Lets a thing with physics fall and tumble, or makes it hold firm where it is. */
  setKind(t: T, kind: 'moving' | 'still'): void {
    const rec = this.recs.get(t);
    if (!rec || !rec.physics || rec.held) return;
    const role: Role = kind === 'moving' ? 'moving' : 'still';
    if (rec.role === role) return;
    rec.role = role;
    rec.ready = false;
    rec.body.setType(role === 'moving' ? 'dynamic' : 'kinematic');
    rec.body.setLinearVelocity({ x: 0, y: 0 });
    rec.body.setAngularVelocity(0);
    rec.body.setAwake(true);
    this.refilter(rec);
    for (let edge = rec.body.getContactList(); edge; edge = edge.next) edge.other?.setAwake(true);
  }

  private throwSpeed(rec: Rec<T>, held: Hold): Point {
    const t = rec.thing;
    const [dx, dy] = [held.anchor.x - (t.x + t.width / 2), held.anchor.y - (t.y + t.height / 2)];
    // A pull too short to mean anything just lets it drop.
    if (Math.hypot(dx, dy) < 12) return { x: 0, y: 0 };
    const power = rec.physics?.power ?? 8;
    return { x: dx * power, y: dy * power };
  }

  private roleOf(t: T): Role | null {
    const def = t.def;
    // Things fixed to the screen, and texts (whose size is their words), are never part of the world's physics.
    if (def.fixed || def.visual.kind === 'text' || !(t.width > 0) || !(t.height > 0)) return null;
    const physics = def.behaviors.find((b): b is PhysicsBehavior => b.type === 'physics');
    if (physics) return physics.kind === 'still' ? 'still' : 'moving';
    if (def.behaviors.some((b) => b.type === 'joint')) return 'wall';
    return def.tags.some((tag) => this.wallTags.has(tag)) ? 'wall' : null;
  }

  private make(t: T, role: Role): Rec<T> {
    const physics = t.def.behaviors.find((b): b is PhysicsBehavior => b.type === 'physics') ?? null;
    const slow = (physics?.slowdown ?? 0) * 4;
    const sling = role === 'moving' && physics?.drag === 'sling';
    // A sling that reloads waits in the air where it was put, until it is thrown.
    const waits = sling && physics?.reload !== false;
    const body = this.world.createBody({
      type: role === 'moving' && !waits ? 'dynamic' : 'kinematic',
      position: { x: (t.x + t.width / 2) / M, y: (t.y + t.height / 2) / M },
      angle: t.angle,
      linearVelocity: role === 'moving' && !waits ? { x: t.vx / M, y: t.vy / M } : { x: 0, y: 0 },
      fixedRotation: physics ? !physics.rotates : false,
      gravityScale: physics?.gravity === false ? 0 : 1,
      linearDamping: slow,
      angularDamping: slow + 0.05,
      // Something thrown fast must not pass through a thin target between two steps.
      bullet: sling,
      active: t.visible,
    });
    const rec: Rec<T> = {
      thing: t, body, role, physics, x: t.x, y: t.y, angle: t.angle, vx: waits ? 0 : t.vx, vy: waits ? 0 : t.vy, width: t.width, height: t.height,
      held: null, ignore: null, thrown: null, home: waits ? { x: t.x + t.width / 2, y: t.y + t.height / 2 } : null, ready: waits, moved: false, still: 0,
    };
    if (waits) t.vx = t.vy = 0;
    body.setUserData(rec);
    this.shape(rec);
    this.recs.set(t, rec);
    if (t.def.behaviors.some((b) => b.type === 'joint')) this.pendingJoints.push(t);
    return rec;
  }

  /** Gives a body the shape of its object: a circle, a ramp's triangle or a box, as big as the object is now. */
  private shape(rec: Rec<T>): void {
    const { body, thing: t, physics } = rec;
    for (let f = body.getFixtureList(); f; ) {
      const next = f.getNext();
      body.destroyFixture(f);
      f = next;
    }
    const inset = t.def.hitboxInset ?? 0;
    const hw = Math.max(1, t.width / 2 - inset) / M;
    const hh = Math.max(1, t.height / 2 - inset) / M;
    const def = t.def;
    const shape =
      def.round || def.visual.kind === 'ellipse' ? new Circle(Math.min(hw, hh))
      : def.slope === 'rise' ? new Polygon([{ x: -hw, y: hh }, { x: hw, y: hh }, { x: hw, y: -hh }])
      : def.slope === 'fall' ? new Polygon([{ x: -hw, y: -hh }, { x: -hw, y: hh }, { x: hw, y: hh }])
      : new Box(hw, hh);
    const fixture = body.createFixture({
      shape,
      density: physics ? Math.max(0.01, physics.weight) : 1,
      friction: physics ? physics.friction : 0.6,
      restitution: physics ? physics.bounce : 0,
    });
    fixture.shouldCollide = (that) => this.allowed(rec, that.getBody().getUserData());
    rec.width = t.width;
    rec.height = t.height;
  }

  /** Makes the world look again at which pairs may meet, after a change to what a body ignores. */
  private refilter(rec: Rec<T>): void {
    for (let f = rec.body.getFixtureList(); f; f = f.getNext()) f.refilter();
  }

  /** Puts a slung object back where it waits, still and ready to be pulled again. */
  private reload(rec: Rec<T>): void {
    if (!rec.home) return;
    const t = rec.thing;
    rec.body.setType('kinematic');
    rec.body.setTransform({ x: rec.home.x / M, y: rec.home.y / M }, 0);
    rec.body.setLinearVelocity({ x: 0, y: 0 });
    rec.body.setAngularVelocity(0);
    t.x = rec.x = rec.home.x - t.width / 2;
    t.y = rec.y = rec.home.y - t.height / 2;
    t.angle = rec.angle = 0;
    t.vx = t.vy = rec.vx = rec.vy = 0;
    rec.ready = true;
    rec.thrown = null;
    rec.moved = false;
    rec.ignore = null;
    this.refilter(rec);
  }

  /** A waiting slung object is set going by something other than the sling (a rule's push, a spin). */
  private launch(rec: Rec<T>): void {
    rec.ready = false;
    rec.body.setType('dynamic');
    rec.body.setAwake(true);
    rec.moved = true;
    rec.still = 0;
  }

  /** Hands the game's picture of a thing to its body before a step. */
  private prepare(rec: Rec<T>, dt: number): void {
    const { thing: t, body } = rec;
    if (body.isActive() !== t.visible) body.setActive(t.visible);
    if (t.width !== rec.width || t.height !== rec.height) this.shape(rec);
    const [cx, cy] = [(t.x + t.width / 2) / M, (t.y + t.height / 2) / M];

    if (rec.held?.mode === 'sling') {
      // Follows the finger, but no further from where it started than the band reaches.
      const held = rec.held;
      let [tx, ty] = [held.finger.x - held.grip.x - held.anchor.x, held.finger.y - held.grip.y - held.anchor.y];
      const pull = Math.hypot(tx, ty);
      if (pull > MAX_PULL) [tx, ty] = [(tx / pull) * MAX_PULL, (ty / pull) * MAX_PULL];
      const p = body.getPosition();
      body.setLinearVelocity({ x: ((held.anchor.x + tx) / M - p.x) / dt, y: ((held.anchor.y + ty) / M - p.y) / dt });
      body.setAngularVelocity(0);
      return;
    }

    if (rec.ready) {
      // Waiting in the sling. A rule may move it (it then waits there) or set it going.
      if (Math.abs(t.x - rec.x) > 0.01 || Math.abs(t.y - rec.y) > 0.01) {
        rec.home = { x: t.x + t.width / 2, y: t.y + t.height / 2 };
        body.setTransform({ x: cx, y: cy }, t.angle);
      }
      if (Math.abs(t.vx - rec.vx) > 0.01 || Math.abs(t.vy - rec.vy) > 0.01) {
        this.launch(rec);
        body.setLinearVelocity({ x: t.vx / M, y: t.vy / M });
      }
      return;
    }

    if (rec.ignore) {
      // Clear of its stand once it has gone past it the way it was thrown (or after a second), and no longer overlaps it.
      const thrown = rec.thrown;
      if (thrown) thrown.age += dt;
      const p = body.getPosition();
      const past = (other: Body) => {
        const q = other.getPosition();
        return !thrown || thrown.age > 1 || (p.x - q.x) * thrown.x + (p.y - q.y) * thrown.y > 0;
      };
      if ([...rec.ignore].every((other) => past(other) && !overlapping(body, other))) {
        rec.ignore = null;
        this.refilter(rec);
      }
    }

    if (rec.role === 'moving') {
      if (rec.home && !rec.ready) {
        // A thrown object goes back into the sling once it has stopped, left the world, or been gone too long.
        const flight = (rec.thrown ? (rec.thrown.age += rec.ignore ? 0 : dt) : 0);
        const p = { x: t.x + t.width / 2, y: t.y + t.height / 2 };
        const out = p.x < -200 || p.x > this.size.width + 200 || p.y > this.size.height + 200 || p.y < -3000;
        // It lies where it landed for a second, so the player sees what the throw did.
        const stopped = !rec.moved && rec.still >= 1;
        if (out || stopped || flight > LONGEST_FLIGHT) return this.reload(rec);
      }
      // Something else moved it, turned it or changed its speed since the last step (a rule, a jump, a walk).
      if (Math.abs(t.x - rec.x) > 0.01 || Math.abs(t.y - rec.y) > 0.01 || Math.abs(t.angle - rec.angle) > 1e-4) {
        body.setTransform({ x: cx, y: cy }, t.angle);
        body.setAwake(true);
      }
      if (Math.abs(t.vx - rec.vx) > 0.01 || Math.abs(t.vy - rec.vy) > 0.01) {
        body.setLinearVelocity({ x: t.vx / M, y: t.vy / M });
        body.setAwake(true);
      }
      return;
    }

    // Still things and walls go where the game has put them, sweeping there so they push what is in the way.
    const p = body.getPosition();
    const [dx, dy] = [cx - p.x, cy - p.y];
    const turn = t.angle - body.getAngle();
    if ((Math.hypot(dx, dy) * M) / dt > TELEPORT_SPEED) {
      body.setTransform({ x: cx, y: cy }, t.angle);
      body.setLinearVelocity({ x: 0, y: 0 });
      body.setAngularVelocity(0);
      return;
    }
    body.setLinearVelocity({ x: dx / dt, y: dy / dt });
    body.setAngularVelocity(turn / dt);
    // Something resting on it would otherwise sleep through being carried away (or along a conveyor).
    if (dx !== 0 || dy !== 0 || turn !== 0 || rec.physics?.surfaceSpeed) {
      for (let edge = body.getContactList(); edge; edge = edge.next) edge.other?.setAwake(true);
    }
  }

  /**
   * Rolling resistance, which Box2D leaves out: a ball rolling on the ground
   * would otherwise roll for ever. Whatever touches something slows its turning
   * a little, and a round thing its rolling with it.
   */
  private resistRolling(rec: Rec<T>, dt: number): void {
    const body = rec.body;
    let touching = false;
    for (let edge = body.getContactList(); edge && !touching; edge = edge.next) touching = edge.contact.isTouching() && edge.contact.isEnabled();
    if (!touching) return;
    const grip = 0.6 + (rec.physics?.friction ?? 0.6);
    body.setAngularVelocity(body.getAngularVelocity() * Math.exp(-grip * 1.2 * dt));
    if (rec.thing.def.round || rec.thing.def.visual.kind === 'ellipse') {
      const v = body.getLinearVelocity();
      const keep = Math.exp(-grip * 0.35 * dt);
      body.setLinearVelocity({ x: v.x * keep, y: v.y });
    }
  }

  /** Notes a moving thing coming to a stop, for the "rest" trigger and for bringing a slung one back. */
  private noticeRest(rec: Rec<T>, dt: number): void {
    if (rec.ready || rec.held) return;
    const speed = Math.hypot(rec.thing.vx, rec.thing.vy);
    if (speed > STOP_SPEED * 3) {
      rec.moved = true;
      rec.still = 0;
    } else if (speed < STOP_SPEED) {
      rec.still += dt;
      if (rec.moved && rec.still >= STOP_TIME) {
        rec.moved = false;
        this.rested.push(rec.thing);
      }
    }
  }

  /** The push of a wind, water or magnet on every moving thing inside its area. */
  private push(field: T, b: FieldBehavior, dt: number): void {
    const box = { x: field.x, y: field.y, w: field.width, h: field.height };
    const round = field.def.round || field.def.visual.kind === 'ellipse';
    const middle = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    for (const rec of this.recs.values()) {
      if (rec.role !== 'moving' || rec.held || rec.ready || !rec.body.isActive()) continue;
      const t = rec.thing;
      const c = { x: t.x + t.width / 2, y: t.y + t.height / 2 };
      const inside = round
        ? ((c.x - middle.x) / (box.w / 2)) ** 2 + ((c.y - middle.y) / (box.h / 2)) ** 2 <= 1
        : c.x >= box.x && c.x <= box.x + box.w && c.y >= box.y - t.height / 2 && c.y <= box.y + box.h + t.height / 2;
      if (!inside) continue;
      const body = rec.body;
      const mass = body.getMass();
      if (b.kind === 'wind') {
        const angle = (b.direction * Math.PI) / 180;
        body.applyForceToCenter({ x: Math.cos(angle) * (b.strength / M) * mass, y: Math.sin(angle) * (b.strength / M) * mass }, true);
      } else if (b.kind === 'magnet') {
        const [dx, dy] = [middle.x - c.x, middle.y - c.y];
        const d = Math.hypot(dx, dy);
        if (d >= 1) body.applyForceToCenter({ x: (dx / d) * (b.strength / M) * mass, y: (dy / d) * (b.strength / M) * mass }, true);
        // A pulling magnet also holds: what it draws in settles at its middle instead of swinging through for ever.
        if (b.strength > 0) {
          const v = body.getLinearVelocity();
          const keep = Math.exp(-3 * dt);
          body.setLinearVelocity({ x: v.x * keep, y: v.y * keep });
        }
      } else {
        // How much of it is under the surface; that much is held up, more so the lighter it is for its size.
        const sunk = clamp((t.y + t.height - box.y) / t.height, 0, 1);
        if (sunk <= 0) continue;
        const weight = Math.max(0.1, rec.physics?.weight ?? 1);
        const lift = this.gravity * sunk * b.strength * 1.5 / weight;
        body.applyForceToCenter({ x: 0, y: -lift * mass }, true);
        // Water slows whatever moves in it; up and down most, so something light settles at the surface instead of bobbing out of it.
        const v = body.getLinearVelocity();
        body.setLinearVelocity({ x: v.x * Math.exp(-3 * sunk * dt), y: v.y * Math.exp(-8 * Math.min(1, sunk * 3) * dt) });
        body.setAngularVelocity(body.getAngularVelocity() * Math.exp(-2 * sunk * dt));
      }
    }
  }

  /** A slider with a motor and a range goes back and forth between the ends of its range. */
  private driveSliders(): void {
    for (const j of this.joints) {
      if (j.behavior.kind !== 'slider' || !j.behavior.motor || !j.behavior.range) continue;
      const slider = j.joint as PrismaticJoint;
      const at = slider.getJointTranslation();
      const end = j.behavior.range / M - 0.02;
      const speed = slider.getMotorSpeed();
      if (at >= end && speed > 0) slider.setMotorSpeed(-speed);
      else if (at <= -end && speed < 0) slider.setMotorSpeed(-speed);
    }
  }

  /** Joints with a strength snap when pulled harder than that many times their object's weight. */
  private breakJoints(dt: number): void {
    const g = Math.abs(this.gravity) || 15;
    for (let i = this.joints.length - 1; i >= 0; i--) {
      const j = this.joints[i];
      const strength = j.behavior.strength ?? 0;
      if (strength <= 0) continue;
      const ra = this.recs.get(j.a);
      const rb = this.recs.get(j.b);
      const mass = ra?.body.getMass() || rb?.body.getMass() || 1;
      const force = j.joint.getReactionForce(1 / dt);
      if (Math.hypot(force.x, force.y) <= strength * mass * g) continue;
      this.world.destroyJoint(j.joint);
      this.joints.splice(i, 1);
      this.snapped.push({ a: j.a, b: j.b });
    }
  }

  /** Joins things to the nearest member of their joint's group, once both are there. */
  private makeJoints(things: T[]): void {
    for (let i = this.pendingJoints.length - 1; i >= 0; i--) {
      const t = this.pendingJoints[i];
      const rec = this.recs.get(t);
      if (!rec || !t.alive) {
        this.pendingJoints.splice(i, 1);
        continue;
      }
      let waiting = false;
      for (const b of t.def.behaviors) {
        if (b.type !== 'joint') continue;
        const other = nearest(t, things.filter((o) => o !== t && o.alive && o.def.tags.includes(b.targetTag)));
        if (!other) {
          waiting = true;
          continue;
        }
        let otherRec = this.recs.get(other);
        if (!otherRec) {
          // The other end has no body yet; it becomes a wall, so it holds without moving.
          if (other.def.fixed || other.def.visual.kind === 'text') continue;
          this.ignored.delete(other);
          otherRec = this.make(other, 'wall');
        }
        const joint = this.join(b, rec, otherRec);
        if (joint) this.joints.push({ behavior: b, a: t, b: other, joint });
      }
      if (!waiting) this.pendingJoints.splice(i, 1);
    }
  }

  private join(b: JointBehavior, mine: Rec<T>, theirs: Rec<T>): Joint | null {
    const centre = (r: Rec<T>) => ({ x: (r.thing.x + r.thing.width / 2) / M, y: (r.thing.y + r.thing.height / 2) / M });
    const [a, o] = [centre(mine), centre(theirs)];
    const pin = b.at === 'other' ? o : b.at === 'between' ? { x: (a.x + o.x) / 2, y: (a.y + o.y) / 2 } : a;
    const motor = b.motor ?? 0;
    const mass = mine.body.getMass() + theirs.body.getMass() + 1;
    // The other is body A, so a motor turns (or moves) this object, body B, the way a positive speed says.
    switch (b.kind) {
      case 'hinge': {
        const limit = ((b.limit ?? 0) * Math.PI) / 180;
        return this.world.createJoint(
          new RevoluteJoint(
            { enableMotor: motor !== 0, motorSpeed: (motor * Math.PI) / 180, maxMotorTorque: mass * 60, enableLimit: limit > 0, lowerAngle: -limit, upperAngle: limit },
            theirs.body, mine.body, pin,
          ),
        );
      }
      case 'wheel':
        return this.world.createJoint(
          new WheelJoint(
            { enableMotor: motor !== 0, motorSpeed: (motor * Math.PI) / 180, maxMotorTorque: mass * 60, frequencyHz: 4, dampingRatio: 0.7 },
            theirs.body, mine.body, a, { x: 0, y: 1 },
          ),
        );
      case 'slider': {
        const angle = ((b.axis ?? 0) * Math.PI) / 180;
        const range = (b.range ?? 0) / M;
        return this.world.createJoint(
          new PrismaticJoint(
            { enableLimit: range > 0, lowerTranslation: -range, upperTranslation: range, enableMotor: motor !== 0, motorSpeed: motor / M, maxMotorForce: mass * 400 },
            theirs.body, mine.body, a, { x: Math.cos(angle), y: Math.sin(angle) },
          ),
        );
      }
      case 'rope':
        return this.world.createJoint(
          new RopeJoint({ bodyA: theirs.body, bodyB: mine.body, maxLength: Math.hypot(a.x - o.x, a.y - o.y), localAnchorA: { x: 0, y: 0 }, localAnchorB: { x: 0, y: 0 }, collideConnected: true }),
        );
      case 'spring':
        return this.world.createJoint(new DistanceJoint({ frequencyHz: 2.5, dampingRatio: 0.15, collideConnected: true }, theirs.body, mine.body, o, a));
      case 'weld':
        return this.world.createJoint(new WeldJoint({}, theirs.body, mine.body, pin));
    }
  }

  /** Which pairs meet at all. Moving things meet each other and still things always; walls only if they are in the mover's solid group; the edges only if asked. */
  private allowed(a: unknown, b: unknown): boolean {
    if (a === 'edge' || b === 'edge') {
      const other = a === 'edge' ? b : a;
      if (!isRec<T>(other) || other.role !== 'moving' || other.physics?.edges !== true) return false;
      // Something even partly outside the world (a sling pulled back past the edge) is not held out by it:
      // it comes in through the edge, which only becomes a wall to it once it is wholly inside.
      for (let f = other.body.getFixtureList(); f; f = f.getNext()) {
        const box = f.getAABB(0);
        if (box.lowerBound.x * M < -1 || box.upperBound.x * M > this.size.width + 1 || box.lowerBound.y * M < -1 || box.upperBound.y * M > this.size.height + 1) return false;
      }
      return true;
    }
    if (!isRec<T>(a) || !isRec<T>(b)) return false;
    if (a.ignore?.has(b.body) || b.ignore?.has(a.body)) return false;
    if (a.role === 'moving' && b.role === 'moving') return true;
    const [mover, other] = a.role === 'moving' ? [a, b] : [b, a];
    if (mover.role !== 'moving') return false;
    if (other.role === 'still') return true;
    const tag = mover.physics?.solidTag ?? '';
    return tag !== '' && other.thing.def.tags.includes(tag);
  }

  /**
   * Just before a touching pair is worked out: a jump-through platform lets
   * through what comes from below (and keeps letting it through until the two
   * part), and a conveyor's top carries what rests on it along.
   */
  private beforeSolving(contact: Contact): void {
    const [ra, rb] = [contact.getFixtureA().getBody().getUserData(), contact.getFixtureB().getBody().getUserData()];
    if (!isRec<T>(ra) || !isRec<T>(rb)) return;
    for (const [surface, other] of [[ra, rb], [rb, ra]] as const) {
      const p = surface.physics;
      if (!p || surface.role === 'moving' || other.role !== 'moving') continue;
      if (p.oneWay) {
        if (this.passing.has(contact)) {
          contact.setEnabled(false);
          return;
        }
        const top = surface.thing.y;
        const bottom = other.thing.y + other.thing.height;
        const vy = other.body.getLinearVelocity().y * M;
        if (bottom > top + 4 + Math.max(0, vy) / 60 || vy < -1) {
          this.passing.add(contact);
          contact.setEnabled(false);
          return;
        }
      }
      if (p.surfaceSpeed) contact.setTangentSpeed(-p.surfaceSpeed / M);
    }
  }

  /** Notes a crash as two bodies meet, while their speeds are still those from before it. */
  private onContact(contact: Contact): void {
    const [bodyA, bodyB] = [contact.getFixtureA().getBody(), contact.getFixtureB().getBody()];
    const [ra, rb] = [bodyA.getUserData(), bodyB.getUserData()];
    if (!isRec<T>(ra) || !isRec<T>(rb)) return;
    const manifold = contact.getWorldManifold(null);
    if (!manifold || contact.getManifold().pointCount === 0) return;
    const point = manifold.points[0];
    const va = bodyA.getLinearVelocityFromWorldPoint(point);
    const vb = bodyB.getLinearVelocityFromWorldPoint(point);
    const speed = Math.abs((vb.x - va.x) * manifold.normal.x + (vb.y - va.y) * manifold.normal.y) * M;
    this.hits.push({ a: ra.thing, b: rb.thing, speed });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Whether the boxes around two bodies' shapes overlap. */
function overlapping(a: Body, b: Body): boolean {
  for (let f = a.getFixtureList(); f; f = f.getNext()) {
    for (let g = b.getFixtureList(); g; g = g.getNext()) {
      const [p, q] = [f.getAABB(0), g.getAABB(0)];
      if (p.lowerBound.x < q.upperBound.x && q.lowerBound.x < p.upperBound.x && p.lowerBound.y < q.upperBound.y && q.lowerBound.y < p.upperBound.y) return true;
    }
  }
  return false;
}

function isRec<T>(value: unknown): value is Rec<T> {
  return typeof value === 'object' && value !== null && 'body' in value && 'thing' in value;
}

function nearest<T extends Thing>(from: T, among: T[]): T | undefined {
  let best: T | undefined;
  let distance = Infinity;
  for (const o of among) {
    const d = Math.hypot(o.x + o.width / 2 - (from.x + from.width / 2), o.y + o.height / 2 - (from.y + from.height / 2));
    if (d < distance) [best, distance] = [o, d];
  }
  return best;
}
