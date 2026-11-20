import { SOUND_NAMES, type GameProject, type SoundName } from '../format/types';

/**
 * Built-in sound effects, synthesised on the spot so a game needs no audio
 * files. Each is a few layers played together, the way game sounds are made:
 * notes (a coin's "ding-ding", a win's rising chord), pitch sweeps, and bursts
 * of filtered noise for the body of a hit or an explosion. They all go
 * through one compressor, so many at once stay clean instead of clipping.
 */
interface Layer {
  wave: OscillatorType | 'noise';
  /** Pitch at the start and, if it slides, at the end (Hz). For noise: the filter's cut-off. */
  from: number;
  to?: number;
  /** When it starts after the sound does, and how long it lasts (s). */
  at?: number;
  seconds: number;
  gain?: number;
  /** A low-pass filter on a tone, softening it (Hz). */
  soften?: number;
}

const note = (wave: OscillatorType, hz: number, at: number, seconds: number, gain = 1): Layer => ({ wave, from: hz, at, seconds, gain });

const SOUNDS: Record<SoundName, Layer[]> = {
  jump: [{ wave: 'square', from: 280, to: 720, seconds: 0.16, gain: 0.5, soften: 2600 }, { wave: 'sine', from: 140, to: 360, seconds: 0.14, gain: 0.7 }],
  coin: [note('square', 988, 0, 0.08, 0.35), note('square', 1319, 0.07, 0.28, 0.35), { wave: 'sine', from: 2638, at: 0.07, seconds: 0.22, gain: 0.25 }],
  hit: [{ wave: 'noise', from: 1400, to: 300, seconds: 0.12, gain: 0.9 }, { wave: 'triangle', from: 190, to: 70, seconds: 0.16, gain: 0.8 }],
  win: [523, 659, 784].map((hz, i) => note('triangle', hz, i * 0.1, 0.18, 0.8))
    .concat([note('triangle', 1047, 0.3, 0.5, 0.9), note('sine', 2093, 0.3, 0.45, 0.25), note('square', 523, 0.3, 0.45, 0.12)]),
  lose: [392, 330, 262].map((hz, i) => ({ ...note('triangle', hz, i * 0.16, 0.2, 0.8), soften: 1800 }))
    .concat([{ wave: 'sawtooth', from: 196, to: 98, at: 0.48, seconds: 0.55, gain: 0.35, soften: 900 }]),
  click: [note('sine', 1500, 0, 0.035, 0.6), { wave: 'noise', from: 6000, seconds: 0.02, gain: 0.25 }],
  pop: [{ wave: 'sine', from: 380, to: 1300, seconds: 0.07, gain: 0.9 }, { wave: 'noise', from: 3000, seconds: 0.03, gain: 0.2 }],
  laser: [{ wave: 'square', from: 1800, to: 180, seconds: 0.2, gain: 0.35, soften: 3500 }, { wave: 'sawtooth', from: 1810, to: 190, seconds: 0.2, gain: 0.15, soften: 2500 }],
  boom: [{ wave: 'noise', from: 900, to: 80, seconds: 0.7, gain: 1 }, { wave: 'sine', from: 110, to: 35, seconds: 0.55, gain: 1 }],
  powerup: [523, 659, 784, 1047, 1319].map((hz, i) => note('square', hz, i * 0.055, 0.12, 0.3))
    .concat([{ wave: 'triangle', from: 600, to: 2400, seconds: 0.35, gain: 0.35 }]),
  bounce: [{ wave: 'sine', from: 180, to: 520, seconds: 0.12, gain: 0.9 }, { wave: 'triangle', from: 360, to: 1040, seconds: 0.08, gain: 0.25 }],
  tick: [note('sine', 1900, 0, 0.025, 0.5), { wave: 'noise', from: 8000, seconds: 0.012, gain: 0.15 }],
};

let context: AudioContext | null = null;
let output: AudioNode | null = null;
let noise: AudioBuffer | null = null;

/** Everything built in goes through one gentle compressor at a modest level. */
function out(audio: AudioContext): AudioNode {
  if (!output) {
    const squeeze = audio.createDynamicsCompressor();
    squeeze.threshold.value = -18;
    squeeze.ratio.value = 6;
    const level = audio.createGain();
    level.gain.value = 0.32;
    level.connect(squeeze).connect(audio.destination);
    output = level;
  }
  return output;
}

/** A second of white noise, made once and reused. */
function whiteNoise(audio: AudioContext): AudioBuffer {
  if (!noise) {
    noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** Rule volumes are percentages. Older projects play at full volume. */
export function playEffect(project: GameProject, name: string, volume = 100): void {
  const level = Math.min(100, Math.max(0, volume)) / 100;
  if (!level) return;
  if ((SOUND_NAMES as readonly string[]).includes(name)) return playSound(name as SoundName, level);
  const asset = project.assets[name];
  if (asset?.type === 'sound') playClip(asset.src, level);
}

export function playSound(name: SoundName, level = 1): void {
  try {
    // Browsers only allow audio after a touch; a game's first sound always follows one.
    context ??= new AudioContext();
    const audio = context;
    if (audio.state === 'suspended') void audio.resume();
    const start = audio.currentTime + 0.005;
    for (const layer of SOUNDS[name]) {
      const t = start + (layer.at ?? 0);
      const end = t + layer.seconds;
      const gain = audio.createGain();
      // A very short attack, then a smooth fall to silence: no clicks at either end.
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime((layer.gain ?? 1) * level, t + Math.min(0.006, layer.seconds / 4));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      gain.connect(out(audio));
      let source: AudioScheduledSourceNode;
      let into: AudioNode = gain;
      if (layer.wave === 'noise' || layer.soften) {
        const filter = audio.createBiquadFilter();
        filter.type = 'lowpass';
        const cut = layer.wave === 'noise' ? layer.from : layer.soften!;
        filter.frequency.setValueAtTime(cut, t);
        if (layer.wave === 'noise' && layer.to) filter.frequency.exponentialRampToValueAtTime(layer.to, end);
        filter.connect(gain);
        into = filter;
      }
      if (layer.wave === 'noise') {
        const buffer = audio.createBufferSource();
        buffer.buffer = whiteNoise(audio);
        source = buffer;
      } else {
        const oscillator = audio.createOscillator();
        oscillator.type = layer.wave;
        oscillator.frequency.setValueAtTime(layer.from, t);
        if (layer.to) oscillator.frequency.exponentialRampToValueAtTime(layer.to, end);
        source = oscillator;
      }
      source.connect(into);
      source.start(t);
      source.stop(end + 0.02);
    }
  } catch {
    // No audio on this device or page; the game plays on silently.
  }
}

// Sounds the user added are decoded once and then played straight from memory.
// Starting an <audio> element for every coin costs a noticeable delay on a phone.
const clips = new Map<string, Promise<AudioBuffer>>();

function decoded(src: string): Promise<AudioBuffer> {
  let clip = clips.get(src);
  if (!clip) {
    context ??= new AudioContext();
    const audio = context;
    clip = fetch(src)
      .then((response) => response.arrayBuffer())
      .then((bytes) => audio.decodeAudioData(bytes));
    clips.set(src, clip);
  }
  return clip;
}

/** Gets a sound ready ahead of time, so its first play is as quick as its later ones. */
export function preloadClip(src: string): void {
  try {
    decoded(src).catch(() => {});
  } catch {
    // No audio here; it will simply not play.
  }
}

/** Plays a sound the user added. The same clip can overlap itself. */
export function playClip(src: string, level = 1): void {
  try {
    decoded(src).then(
      (buffer) => {
        if (!context) return;
        if (context.state === 'suspended') void context.resume();
        const source = context.createBufferSource();
        source.buffer = buffer;
        const gain = context.createGain();
        gain.gain.value = 0.8 * level;
        source.connect(gain).connect(context.destination);
        source.start();
      },
      // A file the browser cannot decode this way may still play as an ordinary audio element.
      () => {
        const audio = new Audio(src);
        audio.volume = level;
        void audio.play().catch(() => {});
      },
    );
  } catch {
    // No audio here; carry on silently.
  }
}

let music: HTMLAudioElement | null = null;

/** Starts looping music, stops it (null), or leaves it alone if the same piece is already playing. */
export function setMusic(src: string | null): void {
  if (music && music.src === src) return;
  music?.pause();
  music = null;
  if (!src) return;
  try {
    music = new Audio(src);
    music.loop = true;
    music.volume = 0.6;
    resumeMusic();
  } catch {
    music = null;
  }
}

/** Holds the music while the game is out of sight, e.g. when the player switches to another app. */
export function pauseMusic(): void {
  music?.pause();
}

/** Browsers refuse to start audio before the first touch; this is called again on every touch until it sticks. */
export function resumeMusic(): void {
  if (music?.paused) void music.play().catch(() => {});
}
