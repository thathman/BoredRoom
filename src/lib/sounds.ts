// Lightweight Web Audio sound effects — no asset downloads needed.
// All sounds are synthesized on demand. Safe on iOS (resumes on first gesture).

let ctx: AudioContext | null = null;

// Server HTTP base derived from the realtime URL (ws→http) for the dynamic TTS endpoint.
function ttsServerBase(): string {
  const raw = (import.meta.env.VITE_COLYSEUS_URL as string | undefined) ?? '';
  return raw.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/+$/, '');
}

let muted = typeof localStorage !== 'undefined' ? localStorage.getItem('boredroom_sound_muted') === 'true' : false;
let volume = typeof localStorage !== 'undefined' ? Number(localStorage.getItem('boredroom_sound_volume') ?? '0.85') : 0.85;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15, when = 0) {
  const c = getCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume * getVolume(), t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function sweep(from: number, to: number, duration: number, type: OscillatorType = 'sawtooth', volume = 0.12) {
  const c = getCtx();
  if (!c || muted) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume * getVolume(), t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// Reaction-sound ducking: at most one cue per REACTION_SFX_GAP_MS.
// Prevents bursts from stacking audio into a wall of noise.
const REACTION_SFX_GAP_MS = 200;
let lastReactionSfxAt = 0;

function getVolume() {
  return Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.85));
}

function glassClack(when = 0, strength = 1) {
  const c = getCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.04), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.8);
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  const high = c.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.setValueAtTime(1600 + Math.random() * 900, t0);
  const peak = c.createBiquadFilter();
  peak.type = 'bandpass';
  peak.frequency.setValueAtTime(2600 + Math.random() * 1800, t0);
  peak.Q.setValueAtTime(7, t0);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.12 * strength * getVolume(), t0 + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
  source.connect(high).connect(peak).connect(gain).connect(c.destination);
  source.start(t0);
  source.stop(t0 + 0.08);
}

function glassRoll() {
  const c = getCtx();
  if (!c || muted) return;
  const t0 = c.currentTime;
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.42), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const decay = Math.pow(1 - i / data.length, 1.4);
    data[i] = (Math.random() * 2 - 1) * decay * 0.35;
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(900, t0);
  band.frequency.exponentialRampToValueAtTime(2400, t0 + 0.32);
  band.Q.setValueAtTime(2.5, t0);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.035 * getVolume(), t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
  source.connect(band).connect(gain).connect(c.destination);
  source.start(t0);
  source.stop(t0 + 0.48);
  for (let i = 0; i < 5; i++) glassClack(0.035 + i * (0.055 + Math.random() * 0.045), 0.55 + Math.random() * 0.5);
  glassClack(0.39, 1.25);
}

export const sounds = {
  setMuted(v: boolean) {
    muted = v;
    try { localStorage.setItem('boredroom_sound_muted', String(v)); } catch { /* ignore */ }
  },
  isMuted() { return muted; },
  setVolume(v: number) {
    volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('boredroom_sound_volume', String(volume)); } catch { /* ignore */ }
  },
  getVolume,
  unlock() { getCtx(); },
  // Ludo glass-table roll: quick clacks + sliding resonance.
  ludoDiceGlassRoll() {
    glassRoll();
    tone(420 + Math.random() * 80, 0.08, 'triangle', 0.025, 0.36);
  },
  // Backward-compatible alias.
  diceRoll() {
    this.ludoDiceGlassRoll();
  },
  tokenMove() {
    tone(660, 0.06, 'sine', 0.08);
  },
  capture() {
    sweep(800, 120, 0.3, 'sawtooth', 0.18);
  },
  enterHome() {
    tone(523, 0.1, 'triangle', 0.12, 0);
    tone(659, 0.1, 'triangle', 0.12, 0.1);
    tone(784, 0.18, 'triangle', 0.14, 0.2);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.16, i * 0.12));
  },
  // ── Money Trivia (original cues; no reused Feud/Hustle audio) ─────────────
  mtCountdown() { tone(880, 0.08, 'square', 0.10); },
  mtLockIn() { tone(392, 0.09, 'sawtooth', 0.14); tone(261, 0.18, 'sine', 0.12, 0.06); },
  mtCorrect() { [523, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, i * 0.09)); },
  mtWrong() { tone(300, 0.18, 'sawtooth', 0.16); tone(180, 0.32, 'sine', 0.14, 0.12); },
  mtWin() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.17, i * 0.11)); },
  join() {
    tone(523, 0.08, 'sine', 0.1, 0);
    tone(784, 0.1, 'sine', 0.1, 0.08);
  },
  reaction() {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - lastReactionSfxAt < REACTION_SFX_GAP_MS) return;
    lastReactionSfxAt = now;
    tone(880, 0.05, 'sine', 0.08);
  },
  click() {
    tone(440, 0.03, 'square', 0.05);
  },
  // ── Landlord cues ────────────────────────────────────────────────────────
  landlordRoll() {
    glassRoll();
  },
  landlordBuy() {
    tone(523, 0.08, 'triangle', 0.12, 0);
    tone(784, 0.10, 'triangle', 0.14, 0.06);
    tone(1047, 0.14, 'triangle', 0.14, 0.14);
  },
  landlordRent() {
    tone(330, 0.10, 'sawtooth', 0.10, 0);
    tone(220, 0.18, 'sawtooth', 0.10, 0.08);
  },
  landlordAuction() {
    sweep(660, 220, 0.35, 'square', 0.10);
  },
  landlordTradeAccept() {
    tone(659, 0.08, 'sine', 0.12, 0);
    tone(880, 0.08, 'sine', 0.12, 0.07);
    tone(1175, 0.16, 'sine', 0.14, 0.14);
  },
  // ── Hustle cues ──────────────────────────────────────────────────────────
  hustleRoll() {
    glassRoll();
  },
  hustleLadder() {
    [392, 523, 659, 784, 988].forEach((f, i) => tone(f, 0.09, 'triangle', 0.12, i * 0.05));
  },
  hustleSnake() {
    sweep(880, 110, 0.45, 'sawtooth', 0.14);
  },
  hustleJapa() {
    [523, 659, 784, 988, 1318].forEach((f, i) => tone(f, 0.16, 'triangle', 0.14, i * 0.08));
  },
  hustleCard() {
    tone(740, 0.06, 'square', 0.08, 0);
    tone(880, 0.06, 'square', 0.08, 0.05);
  },
  whotCallout(kind: 'semi_last_card' | 'last_card' | 'check_up') {
    const variants = WHOT_CALLOUTS[kind];
    if (!variants?.length) return;
    const index = Math.floor(Math.random() * variants.length);
    playSample(variants[index], 1.05);
  },
  // Dynamic Naija line via the server TTS endpoint, falling back to a fixed clip if TTS is slow
  // or down. Decoded buffers are cached per line so repeats are instant, and the fetch is given a
  // hard timeout so a slow generation drops to the pre-recorded clip fast instead of hanging.
  async whotCalloutLine(line: string, kind: 'semi_last_card' | 'last_card' | 'check_up') {
    const c = getCtx();
    if (!c || muted) return;
    const cached = ttsLineCache.get(line);
    if (cached) { fireSample(c, cached, 1.05); return; }
    try {
      const res = await fetch(`${ttsServerBase()}/tts?line=${encodeURIComponent(line)}`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`tts_${res.status}`);
      const buf = await res.arrayBuffer();
      const decoded = await c.decodeAudioData(buf);
      ttsLineCache.set(line, decoded);
      fireSample(c, decoded, 1.05);
    } catch {
      this.whotCallout(kind); // fail-soft to the pre-recorded clip
    }
  },
  // ── Word Wahala cues ─────────────────────────────────────────────────────
  wahalaTilePlace() {
    tone(1100 + Math.random() * 200, 0.04, 'triangle', 0.08);
  },
  wahalaSubmit() {
    tone(523, 0.09, 'sine', 0.12, 0);
    tone(659, 0.09, 'sine', 0.12, 0.07);
    tone(880, 0.16, 'sine', 0.14, 0.14);
  },
  wahalaReject() {
    sweep(440, 180, 0.25, 'sawtooth', 0.12);
  },
  wahalaSwap() {
    tone(660, 0.05, 'square', 0.08, 0);
    tone(440, 0.05, 'square', 0.08, 0.06);
    tone(660, 0.05, 'square', 0.08, 0.12);
  },
  timerWarn() {
    tone(880, 0.08, 'square', 0.10, 0);
    tone(880, 0.08, 'square', 0.10, 0.18);
  },
  // ── Faith Feud cues (sampled, adapted from Friendly-Feud, MIT) ───────────────
  feudCorrect() { playSample('/sounds/feud/good-answer.mp3'); },
  feudWrong() { playSample('/sounds/feud/wrong.mp3'); },
  feudDuplicate() { playSample('/sounds/feud/duplicate.mp3'); },
  feudSteal() { playSample('/sounds/feud/try-again.mp3'); },
  feudReveal() { playSample('/sounds/feud/fm-answer-reveal.mp3'); },
  feudBuzz() { playSample('/sounds/feud/buzzer.wav', 0.7); },
};

const WHOT_CALLOUTS = {
  semi_last_card: [
    '/audio/whot/semi-idera.mp3',
    '/audio/whot/semi-jude.mp3',
    '/audio/whot/semi-chinenye.mp3',
  ],
  last_card: [
    '/audio/whot/last-emma.mp3',
    '/audio/whot/last-wura.mp3',
    '/audio/whot/last-osagie.mp3',
  ],
  check_up: [
    '/audio/whot/check-emma.mp3',
    '/audio/whot/check-jude.mp3',
  ],
} as const;

// Sampled-audio playback for assets that synthesis can't match (e.g. the Family-Feud cues).
// Respects mute/volume, caches decoded buffers, and fails silently offline.
const sampleCache = new Map<string, AudioBuffer | null>();
// Decoded TTS callouts, cached per spoken line so a repeated line never re-hits the server.
const ttsLineCache = new Map<string, AudioBuffer>();
function playSample(url: string, gainScale = 1): void {
  const c = getCtx();
  if (!c || muted) return;
  const cached = sampleCache.get(url);
  if (cached) { fireSample(c, cached, gainScale); return; }
  if (cached === null) return; // previously failed to load
  fetch(url)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error('sample_fetch_failed'))))
    .then((buf) => c.decodeAudioData(buf))
    .then((decoded) => { sampleCache.set(url, decoded); fireSample(c, decoded, gainScale); })
    .catch(() => { sampleCache.set(url, null); });
}
function fireSample(c: AudioContext, buffer: AudioBuffer, gainScale: number): void {
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buffer;
  gain.gain.value = getVolume() * gainScale;
  src.connect(gain).connect(c.destination);
  src.start();
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}
