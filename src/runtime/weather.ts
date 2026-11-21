import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { Weather } from '../format/types';

/**
 * Weather over the whole screen: rain, a storm with lightning, snow, falling
 * leaves, rising embers, drifting fog. It is drawn in screen space, and shifts
 * as the camera moves so it seems to be out there in the world. Only for
 * looking at; it touches nothing.
 */
interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  turn: number;
  colour: number;
}

const LEAF_COLOURS = [0xe07b39, 0xc94f2c, 0xe9b949, 0x9a6b2f];
const between = (low: number, high: number) => low + Math.random() * (high - low);

export class WeatherView {
  /** Under the darkness, so rain at night is seen only near lights. */
  readonly view = new Container();
  /** Over the darkness: the flash of lightning lights up everything. */
  readonly flash = new Graphics();
  private readonly drawn = new Graphics();
  private readonly glowing = new Graphics();
  private readonly fog: Sprite[] = [];
  private drops: Drop[] = [];
  private kind: Weather = 'none';
  private width = 0;
  private height = 0;
  /** Lightning: how bright the flash is now, when the next comes, and how many there have been. */
  private strike = 0;
  private nextStrike = 0;
  private bolt: number[] | null = null;
  private strikes = 0;
  private last: { x: number; y: number } | null = null;
  private time = 0;
  private thinned = false;
  /** Called on each lightning strike, for the thunder. */
  onThunder: (() => void) | null = null;

  constructor(private readonly softTexture: () => Texture) {
    this.glowing.blendMode = 'add';
    this.view.addChild(this.drawn, this.glowing);
  }

  /** Starts the weather of a scene afresh. */
  set(kind: Weather, width: number, height: number): void {
    this.kind = kind;
    this.width = width;
    this.height = height;
    this.strike = 0;
    this.strikes = 0;
    this.bolt = null;
    // The first flash of a storm comes soon, so the player knows at once what kind of night it is.
    this.nextStrike = 1.2;
    this.last = null;
    for (const s of this.fog.splice(0)) s.destroy();
    this.drawn.clear();
    this.glowing.clear();
    this.flash.clear();
    const count = { none: 0, rain: 130, storm: 220, snow: 120, leaves: 26, embers: 60, fog: 0 }[kind];
    this.drops = Array.from({ length: this.thinned ? Math.ceil(count / 2) : count }, () => this.drop(true));
    if (kind === 'fog') {
      for (let i = 0; i < 5; i++) {
        const s = new Sprite(this.softTexture());
        s.anchor.set(0.5);
        s.width = width * between(1.2, 1.8);
        s.height = height * between(0.35, 0.55);
        s.position.set(Math.random() * width, height * (0.3 + 0.17 * i));
        s.tint = 0xdfe6ee;
        s.alpha = between(0.16, 0.26);
        (s as Sprite & { drift?: number }).drift = between(10, 28) * (i % 2 ? -1 : 1);
        this.fog.push(s);
        this.view.addChild(s);
      }
    }
  }

  /** A new drop, flake or leaf: anywhere on the screen at the start, at the edge it comes in from after. */
  private drop(anywhere: boolean): Drop {
    const W = this.width;
    const H = this.height;
    const d: Drop = { x: Math.random() * W, y: anywhere ? Math.random() * H : -30, vx: 0, vy: 0, size: 1, phase: Math.random() * 6.3, turn: between(-3, 3), colour: 0xffffff };
    switch (this.kind) {
      case 'rain':
        d.vy = between(1000, 1300);
        d.vx = d.vy * 0.16;
        d.size = between(22, 34);
        break;
      case 'storm':
        d.vy = between(1400, 1750);
        d.vx = d.vy * 0.32;
        d.size = between(28, 42);
        d.x = Math.random() * (W + H * 0.4) - H * 0.4;
        break;
      case 'snow':
        d.vy = between(50, 120);
        d.vx = 18;
        d.size = between(2, 5.5);
        break;
      case 'leaves':
        d.vy = between(60, 110);
        d.vx = between(40, 90);
        d.size = between(9, 15);
        d.colour = LEAF_COLOURS[Math.floor(Math.random() * LEAF_COLOURS.length)];
        d.x = Math.random() * (W + 200) - 200;
        break;
      case 'embers':
        d.vy = -between(40, 95);
        d.vx = between(-10, 10);
        d.size = between(1.6, 3.6);
        d.y = anywhere ? Math.random() * H : H + 10;
        d.colour = Math.random() < 0.5 ? 0xffb347 : 0xff7043;
        break;
    }
    return d;
  }

  /** Moves the weather on by `dt` seconds (0 holds it still) and draws it. */
  update(dt: number, camera: { x: number; y: number }, zoom: number): void {
    if (this.kind === 'none') return;
    this.time += dt;
    const W = this.width;
    const H = this.height;
    // The camera moved: what is out there seems to slide the other way.
    const shift = this.last ? { x: (camera.x - this.last.x) * zoom, y: (camera.y - this.last.y) * zoom } : { x: 0, y: 0 };
    this.last = { ...camera };
    for (const s of this.fog) {
      const drift = (s as Sprite & { drift?: number }).drift ?? 0;
      s.x = wrap(s.x + drift * dt - shift.x * 0.5, -s.width / 2, W + s.width / 2);
    }
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      const sway = this.kind === 'snow' ? Math.cos(this.time * 1.7 + d.phase) * 22 : this.kind === 'leaves' ? Math.cos(this.time * 2.2 + d.phase) * 45 : this.kind === 'embers' ? Math.sin(this.time * 3 + d.phase) * 18 : 0;
      d.x += (d.vx + sway) * dt - shift.x;
      d.y += d.vy * dt - shift.y;
      d.phase += d.turn * dt * (this.kind === 'leaves' ? 1 : 0);
      const gone = d.vy > 0 ? d.y > H + 40 : d.y < -20;
      if (gone) this.drops[i] = this.drop(false);
      else if (d.x < -260) d.x += W + 260;
      else if (d.x > W + 260) d.x -= W + 260;
    }
    this.draw();
    if (this.kind === 'storm') this.lightning(dt);
  }

  private draw(): void {
    const g = this.drawn.clear();
    const glow = this.glowing.clear();
    switch (this.kind) {
      case 'rain':
      case 'storm': {
        const lean = this.kind === 'storm' ? 0.32 : 0.16;
        for (const d of this.drops) g.moveTo(d.x, d.y).lineTo(d.x - d.size * lean, d.y - d.size);
        g.stroke({ width: this.kind === 'storm' ? 2.2 : 2, color: 0xb3d4ff, alpha: this.kind === 'storm' ? 0.55 : 0.45 });
        break;
      }
      case 'snow':
        for (const d of this.drops) g.circle(d.x, d.y, d.size);
        g.fill({ color: 0xffffff, alpha: 0.85 });
        break;
      case 'leaves':
        for (const colour of LEAF_COLOURS) {
          for (const d of this.drops) {
            if (d.colour !== colour) continue;
            // A leaf: a pointed oval, turning as it falls.
            const [c, s] = [Math.cos(d.phase), Math.sin(d.phase)];
            const r = d.size;
            const w = r * 0.45 * Math.abs(Math.cos(this.time * 2 + d.phase * 2)) + r * 0.12;
            g.poly([d.x + c * r, d.y + s * r, d.x - s * w, d.y + c * w, d.x - c * r, d.y - s * r, d.x + s * w, d.y - c * w]);
          }
          g.fill({ color: colour, alpha: 0.95 });
        }
        break;
      case 'embers':
        for (const d of this.drops) glow.circle(d.x, d.y, d.size);
        glow.fill({ color: 0xffa040, alpha: 0.75 + 0.25 * Math.sin(this.time * 9) });
        break;
    }
  }

  /** Now and then a flash, a jagged bolt and a roll of thunder. */
  private lightning(dt: number): void {
    this.nextStrike -= dt;
    if (this.nextStrike <= 0) {
      this.nextStrike = between(3.5, 8);
      this.strike = 0.8;
      this.strikes += 1;
      let x = between(this.width * 0.15, this.width * 0.85);
      let y = 0;
      this.bolt = [x, y];
      while (y < this.height * 0.55) {
        y += between(30, 70);
        x += between(-45, 45);
        this.bolt.push(x, y);
      }
      this.onThunder?.();
    }
    const f = this.flash.clear();
    if (this.strike <= 0) return;
    // Two quick flickers as it fades, like real lightning.
    const flicker = this.strike > 0.55 ? 1 : this.strike > 0.4 ? 0.3 : 0.8;
    f.rect(0, 0, this.width, this.height).fill({ color: 0xeef4ff, alpha: this.strike * 0.55 * flicker });
    if (this.bolt && this.strike > 0.35) {
      f.poly(this.bolt, false).stroke({ width: 5, color: 0xffffff, alpha: 0.9, join: 'miter' });
      f.poly(this.bolt, false).stroke({ width: 14, color: 0xb0c8ff, alpha: 0.35 });
    }
    this.strike = Math.max(0, this.strike - dt * 1.6);
  }

  /** A slow phone: half as much falling from now on (this scene and the next ones). */
  thin(): void {
    this.thinned = true;
    this.drops = this.drops.slice(0, Math.ceil(this.drops.length / 2));
  }

  /** For the tests: what is falling, and the lightning. */
  state(): { kind: Weather; drops: number; fog: number; flash: number; strikes: number } {
    return { kind: this.kind, drops: this.drops.length, fog: this.fog.length, flash: this.strike, strikes: this.strikes };
  }
}

function wrap(value: number, low: number, high: number): number {
  const span = high - low;
  return ((((value - low) % span) + span) % span) + low;
}
