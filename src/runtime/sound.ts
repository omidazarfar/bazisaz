import type { SoundName } from '../format/types';

/**
 * Built-in sound effects, synthesised on the spot so a game needs no audio
 * files. Each is one short tone that slides from one pitch to another.
 */
const SOUNDS: Record<SoundName, { from: number; to: number; seconds: number; wave: OscillatorType }> = {
  jump: { from: 320, to: 660, seconds: 0.16, wave: 'square' },
  coin: { from: 880, to: 1320, seconds: 0.12, wave: 'triangle' },
  hit: { from: 220, to: 110, seconds: 0.18, wave: 'sawtooth' },
  win: { from: 520, to: 1040, seconds: 0.4, wave: 'triangle' },
  lose: { from: 300, to: 70, seconds: 0.45, wave: 'sawtooth' },
  click: { from: 600, to: 600, seconds: 0.05, wave: 'square' },
  pop: { from: 500, to: 1000, seconds: 0.07, wave: 'sine' },
  laser: { from: 1400, to: 300, seconds: 0.18, wave: 'square' },
  boom: { from: 180, to: 40, seconds: 0.5, wave: 'sawtooth' },
  powerup: { from: 400, to: 1600, seconds: 0.35, wave: 'square' },
  bounce: { from: 240, to: 480, seconds: 0.1, wave: 'sine' },
  tick: { from: 1000, to: 900, seconds: 0.03, wave: 'triangle' },
};

let context: AudioContext | null = null;

export function playSound(name: SoundName): void {
  try {
    // Browsers only allow audio after a touch; a game's first sound always follows one.
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const { from, to, seconds, wave } = SOUNDS[name];
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + seconds);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + seconds);
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
export function playClip(src: string): void {
  try {
    decoded(src).then(
      (buffer) => {
        if (!context) return;
        if (context.state === 'suspended') void context.resume();
        const source = context.createBufferSource();
        source.buffer = buffer;
        const gain = context.createGain();
        gain.gain.value = 0.8;
        source.connect(gain).connect(context.destination);
        source.start();
      },
      // A file the browser cannot decode this way may still play as an ordinary audio element.
      () => void new Audio(src).play().catch(() => {}),
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
