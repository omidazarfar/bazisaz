import { isBuiltinMusic } from '../format/types';

/**
 * The music that comes with the engine. Each piece is written out note by
 * note here (a chord sequence, a bass line, a tune and drums, all from a fixed
 * seed so a piece is the same every time) and turned into a looping WAV the
 * first time it is played. Nothing is downloaded and nothing is stored in the game.
 */

const RATE = 22050;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

type Shape = 'sine' | 'square' | 'triangle' | 'saw';

interface Piece {
  bpm: number;
  /** The key's home note, as a MIDI number (60 is middle C). */
  root: number;
  minor: boolean;
  /** One chord per bar, as steps of the scale, repeated. */
  chords: number[];
  lead: Shape;
  drums: 'full' | 'soft' | 'sparse' | 'none';
  /** Broken chords running underneath, or long held ones. */
  bed: 'arp' | 'pad';
  seed: number;
}

const PIECES: Record<string, Piece> = {
  'music:happy': { bpm: 128, root: 60, minor: false, chords: [0, 4, 5, 3], lead: 'square', drums: 'full', bed: 'arp', seed: 3 },
  'music:adventure': { bpm: 140, root: 62, minor: true, chords: [0, 5, 2, 6], lead: 'saw', drums: 'full', bed: 'arp', seed: 11 },
  'music:calm': { bpm: 84, root: 65, minor: false, chords: [0, 3, 5, 4], lead: 'triangle', drums: 'soft', bed: 'pad', seed: 5 },
  'music:tense': { bpm: 152, root: 57, minor: true, chords: [0, 0, 5, 4], lead: 'square', drums: 'full', bed: 'arp', seed: 17 },
  'music:mystery': { bpm: 90, root: 59, minor: true, chords: [0, 5, 3, 4], lead: 'triangle', drums: 'sparse', bed: 'pad', seed: 23 },
};

const made = new Map<string, string>();

/** A built-in piece as a data: URL of a looping WAV, made once and then remembered. */
export function builtinMusic(id: string): string | null {
  if (!isBuiltinMusic(id) || !PIECES[id]) return null;
  let src = made.get(id);
  if (!src) {
    src = wav(render(PIECES[id]));
    made.set(id, src);
  }
  return src;
}

/** A small, fixed random number source, so a piece comes out the same every time. */
function random(seed: number): () => number {
  let s = seed * 2654435761;
  return () => {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    return s / 4294967296;
  };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function wave(shape: Shape, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (shape) {
    case 'sine': return Math.sin(2 * Math.PI * p);
    case 'square': return p < 0.5 ? 0.7 : -0.7;
    case 'triangle': return 4 * Math.abs(p - 0.5) - 1;
    case 'saw': return (2 * p - 1) * 0.6;
  }
}

function render(piece: Piece): Float32Array {
  const rnd = random(piece.seed);
  const bars = 8;
  const step = 60 / piece.bpm / 4;
  const length = Math.round(bars * 16 * step * RATE);
  const out = new Float32Array(length);
  const scale = piece.minor ? MINOR : MAJOR;
  /** A step of the scale (any whole number) as a MIDI note above the root. */
  const note = (degree: number) => piece.root + scale[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);

  const play = (startStep: number, steps: number, freq: number, shape: Shape, volume: number, attack = 0.005) => {
    const start = Math.round(startStep * step * RATE);
    const n = Math.round(steps * step * RATE);
    const release = Math.min(n, Math.round(0.06 * RATE));
    for (let i = 0; i < n && start + i < length; i++) {
      const env = Math.min(1, i / (attack * RATE)) * Math.min(1, (n - i) / release);
      out[start + i] += wave(shape, (freq * i) / RATE) * volume * env;
    }
  };
  const noise = random(piece.seed + 99);
  const hit = (startStep: number, kind: 'kick' | 'snare' | 'hat', volume: number) => {
    const start = Math.round(startStep * step * RATE);
    const n = Math.round((kind === 'kick' ? 0.16 : kind === 'snare' ? 0.14 : 0.04) * RATE);
    let phase = 0;
    let last = 0;
    for (let i = 0; i < n && start + i < length; i++) {
      const t = i / RATE;
      const env = Math.exp(-t * (kind === 'kick' ? 22 : kind === 'snare' ? 30 : 90));
      let v: number;
      if (kind === 'kick') {
        phase += (45 + 110 * Math.exp(-t * 30)) / RATE;
        v = Math.sin(2 * Math.PI * phase);
      } else {
        const white = noise() * 2 - 1;
        // A hat is the hiss alone (with the low part taken out); a snare adds a short tone.
        v = kind === 'hat' ? white - last : white * 0.8 + Math.sin(2 * Math.PI * 185 * t) * 0.4;
        last = white;
      }
      out[start + i] += v * env * volume;
    }
  };

  // The tune: a two-bar phrase, played as A A B A, with its last note changed the second time.
  const phrase = (from: number): { at: number; steps: number; degree: number }[] => {
    const notes: { at: number; steps: number; degree: number }[] = [];
    let degree = from;
    for (let at = 0; at < 32; ) {
      const steps = [2, 2, 2, 4, 1, 1, 3][Math.floor(rnd() * 7)];
      const chord = piece.chords[Math.floor(at / 16) % piece.chords.length];
      // On the strong beats the tune lands on a note of the chord; in between it steps up or down.
      degree = at % 8 === 0 ? chord + [0, 2, 4][Math.floor(rnd() * 3)] : degree + [-2, -1, -1, 1, 1, 2][Math.floor(rnd() * 6)];
      degree = Math.max(-2, Math.min(9, degree));
      if (rnd() > 0.18 || at % 8 === 0) notes.push({ at, steps: Math.min(steps, 32 - at), degree });
      at += steps;
    }
    return notes;
  };
  const a = phrase(4);
  const b = phrase(6);
  const tune = [a, a.map((n, i) => (i === a.length - 1 ? { ...n, degree: piece.chords[0] + 7 } : n)), b, a];
  tune.forEach((part, p) => part.forEach((n) => play(p * 32 + n.at, n.steps * 0.9, hz(note(n.degree) + 12), piece.lead, piece.lead === 'triangle' ? 0.16 : 0.09)));

  for (let bar = 0; bar < bars; bar++) {
    const chord = piece.chords[bar % piece.chords.length];
    const at = bar * 16;
    // The bass: the chord's root, with its fifth between.
    for (let s = 0; s < 16; s += piece.bpm > 110 ? 2 : 4) play(at + s, (piece.bpm > 110 ? 2 : 4) * 0.85, hz(note(chord + (s % 8 === 4 ? 4 : 0)) - 24), 'triangle', 0.3);
    if (piece.bed === 'arp') {
      for (let s = 0; s < 16; s++) play(at + s, 0.9, hz(note(chord + [0, 2, 4, 2][s % 4])), 'square', 0.035);
    } else {
      for (const tone of [0, 2, 4]) play(at, 16, hz(note(chord + tone)), 'sine', 0.06, 0.4);
    }
    for (let s = 0; s < 16; s++) {
      if (piece.drums === 'full') {
        if (s === 0 || s === 8 || (s === 10 && bar % 2 === 1)) hit(at + s, 'kick', 0.55);
        if (s === 4 || s === 12) hit(at + s, 'snare', 0.22);
        if (s % 2 === 0) hit(at + s, 'hat', 0.06);
      } else if (piece.drums === 'soft') {
        if (s % 4 === 2) hit(at + s, 'hat', 0.04);
      } else if (piece.drums === 'sparse') {
        if (s === 0) hit(at + s, 'kick', 0.4);
        if (s === 10) hit(at + s, 'hat', 0.05);
      }
    }
  }
  return out;
}

/** Samples as a 16-bit mono WAV file, softly limited so loud moments do not crackle. */
function wav(samples: Float32Array): string {
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
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.tanh(samples[i] * 1.3) * 0.85 * 32767, true);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:audio/wav;base64,${btoa(binary)}`;
}
