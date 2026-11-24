/**
 * NETLAB sound effects — synthesised live with the Web Audio API.
 * No audio files are downloaded. Browsers only allow sound after the first
 * click or key press, so the audio context is created lazily on that gesture.
 */
import { store } from './store';

type Wave = OscillatorType;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (master) master.gain.value = Math.max(0, Math.min(1, store.get().settings.volume ?? 0.6)) * 0.35;
  return ctx;
}

// Unlock audio on the first user gesture.
if (typeof window !== 'undefined') {
  const unlock = () => { if (enabled()) audio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

const enabled = () => store.get().settings.sound !== false;

function tone(freq: number, dur: number, { type = 'sine' as Wave, gain = 0.5, at = 0, to = 0, attack = 0.005 } = {}) {
  const a = audio(); if (!a || !master) return;
  const t0 = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, { gain = 0.3, at = 0, from = 400, to = 3000, q = 1.2 } = {}) {
  const a = audio(); if (!a || !master) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = a.currentTime + at;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

/** Layer 1–7 → a pitch, so higher layers sound brighter. */
const layerHz = (layer = 3) => 330 * 2 ** ((Math.max(1, Math.min(7, layer)) - 1) / 6);

let lastNav = 0;
const sfx = {
  /** A packet leaves a device. */
  send(layer?: number) { noise(0.32, { gain: 0.22, from: 500, to: 4000 }); tone(layerHz(layer), 0.12, { type: 'triangle', gain: 0.25, to: layerHz(layer) * 1.5 }); },
  /** One packet copied to several devices. */
  broadcast(layer?: number) { const f = layerHz(layer); [0, 0.07, 0.14].forEach((at, i) => tone(f * (1 + i * 0.25), 0.09, { type: 'triangle', gain: 0.22, at })); noise(0.35, { gain: 0.15, from: 800, to: 5000 }); },
  /** Processing inside one device. */
  local() { tone(1200, 0.04, { type: 'square', gain: 0.06 }); tone(1500, 0.04, { type: 'square', gain: 0.06, at: 0.09 }); tone(1800, 0.05, { type: 'square', gain: 0.06, at: 0.18 }); },
  /** Packet reaches its destination. */
  arrive() { tone(880, 0.16, { gain: 0.28 }); tone(1320, 0.28, { gain: 0.22, at: 0.07 }); },
  /** Packet dropped / blocked. */
  drop() { tone(240, 0.35, { type: 'square', gain: 0.12, to: 70 }); noise(0.25, { gain: 0.25, from: 300, to: 120, q: 0.7 }); },
  /** Malicious traffic in the security lab. */
  danger() { [0, 0.13, 0.26].forEach((at, i) => tone(i % 2 ? 520 : 690, 0.12, { type: 'sawtooth', gain: 0.08, at })); },
  /** A defence worked. */
  ok() { [660, 830, 990].forEach((f, i) => tone(f, 0.3, { gain: 0.2, at: i * 0.06 })); },
  /** Simulation finished. */
  done() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.18, { type: 'triangle', gain: 0.25, at: i * 0.1 })); },
  correct() { tone(660, 0.12, { type: 'triangle', gain: 0.3 }); tone(990, 0.3, { type: 'triangle', gain: 0.3, at: 0.1 }); },
  wrong() { tone(220, 0.18, { type: 'sawtooth', gain: 0.1, to: 180 }); tone(165, 0.3, { type: 'sawtooth', gain: 0.1, at: 0.16, to: 120 }); },
  /** Page change. */
  nav() { const n = Date.now(); if (n - lastNav < 250) return; lastNav = n; noise(0.22, { gain: 0.1, from: 300, to: 2500, q: 2 }); tone(520, 0.08, { gain: 0.08, at: 0.05, to: 780 }); },
  click() { tone(1400, 0.03, { type: 'square', gain: 0.05 }); },
  open() { tone(600, 0.1, { gain: 0.18, to: 900 }); },
  /** OSI lab: wrapping a header on, unwrapping it, and bits on the wire. */
  wrap(layer: number) { tone(layerHz(layer), 0.12, { type: 'triangle', gain: 0.25, to: layerHz(layer) * 1.33 }); noise(0.12, { gain: 0.08, from: 2000, to: 5000 }); },
  unwrap(layer: number) { tone(layerHz(layer) * 1.33, 0.14, { type: 'triangle', gain: 0.25, to: layerHz(layer) }); },
  wire() { for (let i = 0; i < 10; i++) tone(Math.random() > 0.5 ? 1600 : 1100, 0.025, { type: 'square', gain: 0.05, at: i * 0.045 }); },
};

export type Sfx = keyof typeof sfx;
export function play(name: Sfx, arg?: number) {
  if (!enabled()) return;
  try { sfx[name](arg as number); } catch { /* audio is best-effort */ }
}
