// Web-Audio-Synthese fuer das DJ-Soundboard.
// Alle Sounds werden live per OscillatorNode/AudioBuffer erzeugt — keine
// externen Samples, keine Lizenz-Risiken, keine Bandbreite.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    interface WindowWithLegacy extends Window {
      webkitAudioContext?: typeof AudioContext;
    }
    const W = window as WindowWithLegacy;
    audioCtx = new (window.AudioContext || W.webkitAudioContext!)();
  }
  // iOS / einige Browser fordern resume() nach User-Geste
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

interface MasterOptions {
  volume?: number; // 0..1
  duration?: number; // Sekunden — Auto-Stop nach Ablauf
}

function createMaster(opts: MasterOptions = {}): {
  ctx: AudioContext;
  master: GainNode;
  now: number;
  endAt: number;
} {
  const ctx = getCtx();
  const master = ctx.createGain();
  master.gain.value = opts.volume ?? 0.5;
  master.connect(ctx.destination);
  const now = ctx.currentTime;
  const endAt = now + (opts.duration ?? 1);
  return { ctx, master, now, endAt };
}

// ─── Sirens ──────────────────────────────────────────────────────────

// Polizei-Sirene (USA-Style: schnelles Auf/Ab)
export function playPoliceSiren(): void {
  const { ctx, master, now } = createMaster({ volume: 0.35, duration: 3 });
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 800;
  lfo.frequency.value = 4; // 4 Schwingungen/sek
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(master);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.35, now + 0.05);
  master.gain.setValueAtTime(0.35, now + 2.7);
  master.gain.linearRampToValueAtTime(0, now + 3);
  osc.start(now);
  lfo.start(now);
  osc.stop(now + 3);
  lfo.stop(now + 3);
}

// Feuerwehr-Sirene (langsames, tiefes Auf/Ab)
export function playFireSiren(): void {
  const { ctx, master, now } = createMaster({ volume: 0.4, duration: 3.5 });
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.linearRampToValueAtTime(750, now + 0.8);
  osc.frequency.linearRampToValueAtTime(400, now + 1.6);
  osc.frequency.linearRampToValueAtTime(750, now + 2.4);
  osc.frequency.linearRampToValueAtTime(400, now + 3.2);
  osc.connect(master);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.4, now + 0.1);
  master.gain.setValueAtTime(0.4, now + 3.2);
  master.gain.linearRampToValueAtTime(0, now + 3.5);
  osc.start(now);
  osc.stop(now + 3.5);
}

// Krankenwagen / EU-Sirene (Zwei-Ton)
export function playAmbulance(): void {
  const { ctx, master, now } = createMaster({ volume: 0.35, duration: 3 });
  const osc = ctx.createOscillator();
  osc.type = "square";
  // Zwei-Ton: 660 Hz / 880 Hz Wechsel alle 0.5s
  const pattern = [660, 880, 660, 880, 660, 880];
  let t = now;
  for (const f of pattern) {
    osc.frequency.setValueAtTime(f, t);
    t += 0.5;
  }
  osc.connect(master);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.35, now + 0.05);
  master.gain.setValueAtTime(0.35, now + 2.8);
  master.gain.linearRampToValueAtTime(0, now + 3);
  osc.start(now);
  osc.stop(now + 3);
}

// ─── Horns / Hits ────────────────────────────────────────────────────

// Air Horn — kraftig, mit Obertoenen
export function playAirHorn(): void {
  const { ctx, master, now } = createMaster({ volume: 0.45, duration: 1.5 });
  // Drei Oszillatoren fuer einen vollen, satten Sound
  const f0 = ctx.createOscillator();
  const f1 = ctx.createOscillator();
  const f2 = ctx.createOscillator();
  f0.type = "sawtooth"; f0.frequency.value = 220;
  f1.type = "sawtooth"; f1.frequency.value = 330;
  f2.type = "sawtooth"; f2.frequency.value = 440;
  // Leichter Pitch-Bend nach oben
  [f0, f1, f2].forEach((osc) => {
    osc.frequency.linearRampToValueAtTime(osc.frequency.value * 1.05, now + 1.4);
  });
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2000;
  f0.connect(filter); f1.connect(filter); f2.connect(filter);
  filter.connect(master);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.45, now + 0.02);
  master.gain.setValueAtTime(0.45, now + 1.3);
  master.gain.linearRampToValueAtTime(0, now + 1.5);
  f0.start(now); f1.start(now); f2.start(now);
  f0.stop(now + 1.5); f1.stop(now + 1.5); f2.stop(now + 1.5);
}

// Bass-Drop / Boom
export function playBassDrop(): void {
  const { ctx, master, now } = createMaster({ volume: 0.7, duration: 1 });
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.8);
  osc.connect(master);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.7, now + 0.01);
  master.gain.exponentialRampToValueAtTime(0.001, now + 1);
  osc.start(now);
  osc.stop(now + 1);
}

// Snare-Hit (Noise-Burst + Sinus)
export function playSnare(): void {
  const { ctx, master, now } = createMaster({ volume: 0.4, duration: 0.25 });
  // Noise-Komponente
  const bufferSize = ctx.sampleRate * 0.25;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = 1000;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(master);
  // Sinus-Komponente
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 200;
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.4, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(oscGain); oscGain.connect(master);
  noise.start(now); osc.start(now);
  noise.stop(now + 0.25); osc.stop(now + 0.25);
}

// Cowbell — zwei Oszillatoren
export function playCowbell(): void {
  const { ctx, master, now } = createMaster({ volume: 0.35, duration: 0.5 });
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  o1.type = "square"; o1.frequency.value = 800;
  o2.type = "square"; o2.frequency.value = 540;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 1;
  o1.connect(filter); o2.connect(filter); filter.connect(master);
  master.gain.setValueAtTime(0.35, now);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  o1.start(now); o2.start(now);
  o1.stop(now + 0.5); o2.stop(now + 0.5);
}

// ─── FX ──────────────────────────────────────────────────────────────

// Record-Scratch (Pitch-modulierter Noise-Burst)
export function playScratch(): void {
  const { ctx, master, now } = createMaster({ volume: 0.45, duration: 0.5 });
  const bufferSize = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  // Schneller Pitch-Sweep — simuliert das Scratch-Charakteristikum
  source.playbackRate.setValueAtTime(2.5, now);
  source.playbackRate.linearRampToValueAtTime(0.4, now + 0.15);
  source.playbackRate.linearRampToValueAtTime(2.0, now + 0.3);
  source.playbackRate.linearRampToValueAtTime(0.5, now + 0.45);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2000;
  filter.Q.value = 3;
  source.connect(filter); filter.connect(master);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.45, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  source.start(now);
  source.stop(now + 0.5);
}

// Riser / Build-up FX (steigender Filtered Noise)
export function playRiser(): void {
  const { ctx, master, now } = createMaster({ volume: 0.3, duration: 2 });
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 8;
  filter.frequency.setValueAtTime(200, now);
  filter.frequency.exponentialRampToValueAtTime(8000, now + 1.9);
  source.connect(filter); filter.connect(master);
  master.gain.setValueAtTime(0.05, now);
  master.gain.linearRampToValueAtTime(0.4, now + 1.9);
  master.gain.linearRampToValueAtTime(0, now + 2);
  source.start(now);
  source.stop(now + 2);
}

// Crowd Cheer / Applaus (rosa rauschen mit Modulation)
export function playApplause(): void {
  const { ctx, master, now } = createMaster({ volume: 0.4, duration: 3 });
  const bufferSize = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Rosa-Rauschen (gefiltert) als Basis
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.0990460;
    b1 = 0.96300 * b1 + white * 0.2965164;
    b2 = 0.57000 * b2 + white * 1.0526913;
    const pink = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    // Random "clap"-bursts hinzufuegen
    const burst = Math.random() < 0.05 ? (Math.random() - 0.5) * 0.5 : 0;
    data[i] = pink + burst;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(master);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.4, now + 0.2);
  master.gain.setValueAtTime(0.4, now + 2.7);
  master.gain.linearRampToValueAtTime(0, now + 3);
  source.start(now);
  source.stop(now + 3);
}

// Beep (Pure Sine — Standardton, z. B. fuer Aufmerksamkeit)
export function playBeep(): void {
  const { ctx, master, now } = createMaster({ volume: 0.4, duration: 0.4 });
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 1000;
  osc.connect(master);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.4, now + 0.01);
  master.gain.setValueAtTime(0.4, now + 0.3);
  master.gain.linearRampToValueAtTime(0, now + 0.4);
  osc.start(now);
  osc.stop(now + 0.4);
}

// Drop / "Boom Splash" — kurzer Knall + Reverb-aehnliche Tail
export function playBoom(): void {
  const { ctx, master, now } = createMaster({ volume: 0.6, duration: 1.5 });
  // Tiefe Sinus-Welle (Sub-Bass)
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(80, now);
  sub.frequency.exponentialRampToValueAtTime(25, now + 1.4);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.6, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  sub.connect(subGain); subGain.connect(master);
  // Noise-Crash oben drauf
  const bufferSize = ctx.sampleRate * 1.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.3));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.3;
  noise.connect(noiseGain); noiseGain.connect(master);
  sub.start(now); noise.start(now);
  sub.stop(now + 1.5); noise.stop(now + 1.5);
}

// Wassertropfen — kurz und hell
export function playDrop(): void {
  const { ctx, master, now } = createMaster({ volume: 0.4, duration: 0.5 });
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1500, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
  osc.connect(master);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.4, now + 0.01);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc.start(now);
  osc.stop(now + 0.5);
}
