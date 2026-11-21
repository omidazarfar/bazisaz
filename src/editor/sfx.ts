/**
 * A sound-effect maker: a short sound worked out from a few settings (a wave,
 * a pitch that slides, a little wobble, how long, how much noise), written as
 * a WAV file the game carries like any other sound. Presets give a coin, a
 * jump, a laser and the rest, and each can be shaken up at random.
 */
export interface SfxSettings {
  wave: 'square' | 'saw' | 'sine' | 'noise';
  /** Starting pitch, in hertz. */
  pitch: number;
  /** How far the pitch slides by the end: 1 doubles it, -0.5 halves it. */
  slide: number;
  /** Seconds. */
  length: number;
  /** A wobble in the pitch, 0 to 1. */
  vibrato: number;
  /** A jump up in pitch partway through (a coin's "ding-ding"), 0 for none; 0.5 is up a fifth. */
  jump: number;
  /** Seconds to rise to full loudness. */
  attack: number;
  volume: number;
}

export const SFX_PRESETS: Record<string, SfxSettings> = {
  coin: { wave: 'square', pitch: 900, slide: 0, length: 0.3, vibrato: 0, jump: 0.5, attack: 0, volume: 0.5 },
  jump: { wave: 'square', pitch: 300, slide: 1.2, length: 0.25, vibrato: 0, jump: 0, attack: 0, volume: 0.5 },
  laser: { wave: 'saw', pitch: 1400, slide: -0.8, length: 0.22, vibrato: 0, jump: 0, attack: 0, volume: 0.4 },
  explosion: { wave: 'noise', pitch: 120, slide: -0.6, length: 0.8, vibrato: 0, jump: 0, attack: 0, volume: 0.7 },
  powerup: { wave: 'square', pitch: 400, slide: 1.5, length: 0.6, vibrato: 0.35, jump: 0, attack: 0, volume: 0.45 },
  hit: { wave: 'noise', pitch: 500, slide: -0.5, length: 0.15, vibrato: 0, jump: 0, attack: 0, volume: 0.6 },
  blip: { wave: 'sine', pitch: 700, slide: 0, length: 0.08, vibrato: 0, jump: 0, attack: 0, volume: 0.5 },
  magic: { wave: 'sine', pitch: 600, slide: 0.8, length: 0.9, vibrato: 0.6, jump: 0.5, attack: 0.1, volume: 0.45 },
};

const RATE = 22050;

/** The sound's samples, from -1 to 1. */
export function synth(s: SfxSettings): Float32Array {
  const n = Math.max(1, Math.round(Math.max(0.02, Math.min(3, s.length)) * RATE));
  const out = new Float32Array(n);
  let phase = 0;
  let noise = 0;
  let lastCycle = -1;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    let f = s.pitch * Math.max(0.05, 1 + s.slide * t);
    if (s.jump && t > 0.35) f *= 1 + s.jump;
    if (s.vibrato) f *= 1 + 0.08 * s.vibrato * Math.sin(2 * Math.PI * 7 * (i / RATE));
    phase += f / RATE;
    const cycle = phase % 1;
    let v: number;
    switch (s.wave) {
      case 'square': v = cycle < 0.5 ? 1 : -1; break;
      case 'saw': v = 2 * cycle - 1; break;
      case 'sine': v = Math.sin(2 * Math.PI * phase); break;
      default:
        // Noise that changes at the pitch: low pitch rumbles, high pitch hisses.
        if (Math.floor(phase * 2) !== lastCycle) {
          lastCycle = Math.floor(phase * 2);
          noise = Math.random() * 2 - 1;
        }
        v = noise;
    }
    const seconds = i / RATE;
    const attack = s.attack > 0 ? Math.min(1, seconds / s.attack) : 1;
    // Fades out over its length, more steeply at the end.
    const release = (1 - t) ** 1.6;
    out[i] = v * attack * release * Math.max(0, Math.min(1, s.volume));
  }
  return out;
}

/** A 16-bit mono WAV file of the samples, as a data URL. */
export function toWav(samples: Float32Array): string {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'data:audio/wav;base64,' + btoa(binary);
}

/** The same kind of sound, a little different: for "shake it up". */
export function vary(s: SfxSettings): SfxSettings {
  const wobble = (v: number, by: number) => v * (1 + (Math.random() * 2 - 1) * by);
  return { ...s, pitch: Math.round(wobble(s.pitch, 0.35)), slide: +(s.slide + (Math.random() - 0.5) * 0.6).toFixed(2), length: +Math.max(0.05, wobble(s.length, 0.3)).toFixed(2), vibrato: +Math.min(1, Math.max(0, s.vibrato + (Math.random() - 0.5) * 0.3)).toFixed(2) };
}
