// Trivia audio engine — WWTBAM-style suspense bed + dramatic stings.
// - Bed: ElevenLabs-generated 30s loop, fetched once via edge function and cached
//   in the browser Cache API. Playback uses HTMLAudioElement with loop=true.
// - Stings: synthesized via Web Audio (no asset downloads). Mirrors src/lib/sounds.ts
//   patterns so global mute/volume controls apply uniformly.
//
// Public API:
//   triviaAudio.unlock()             — call once on user gesture
//   triviaAudio.startBed(intensity)  — begin / crossfade suspense loop ('low'|'mid'|'high')
//   triviaAudio.stopBed()            — fade out + stop
//   triviaAudio.lockIn()             — short "locked-in" affirm
//   triviaAudio.correct()            — celebratory rising stinger
//   triviaAudio.wrong()              — descending crash
//   triviaAudio.finalAnswer()        — deep drone hit
//   triviaAudio.roundIntro()         — bright "round begins" fanfare
//
// Mute / volume routing reads from the same `sounds` module so the UI's
// SoundControls panel works without a separate switch.

import { sounds } from '@/lib/sounds';

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/generate-trivia-bed`;
const CACHE_NAME = 'trivia-bed-v1';
const CACHE_KEY = '/__trivia_bed_v1.mp3';

let ctx: AudioContext | null = null;
let bedAudio: HTMLAudioElement | null = null;
let bedFadeRaf: number | null = null;
let bedLoading: Promise<string> | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function masterGain(): number {
  return sounds.isMuted() ? 0 : sounds.getVolume();
}

// ── Suspense bed loader (cache-first) ─────────────────────────────────────

async function loadBedUrl(): Promise<string> {
  if (bedLoading) return bedLoading;
  bedLoading = (async () => {
    if ('caches' in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const hit = await cache.match(CACHE_KEY);
        if (hit) {
          const blob = await hit.blob();
          return URL.createObjectURL(blob);
        }
      } catch {
        /* fall through to network */
      }
    }
    const resp = await fetch(FN_URL, { method: 'POST' });
    if (!resp.ok) throw new Error(`bed_fetch_failed_${resp.status}`);
    const blob = await resp.blob();
    if ('caches' in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(CACHE_KEY, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
      } catch {
        /* ignore cache write failures */
      }
    }
    return URL.createObjectURL(blob);
  })();
  return bedLoading;
}

function cancelBedFade() {
  if (bedFadeRaf != null) {
    cancelAnimationFrame(bedFadeRaf);
    bedFadeRaf = null;
  }
}

function fadeBedTo(target: number, durationMs: number, onDone?: () => void) {
  if (!bedAudio) return;
  cancelBedFade();
  const start = bedAudio.volume;
  const t0 = performance.now();
  const step = () => {
    if (!bedAudio) return;
    const t = Math.min(1, (performance.now() - t0) / durationMs);
    bedAudio.volume = start + (target - start) * t;
    if (t < 1) {
      bedFadeRaf = requestAnimationFrame(step);
    } else {
      bedFadeRaf = null;
      onDone?.();
    }
  };
  bedFadeRaf = requestAnimationFrame(step);
}

// ── Synthesized stings ────────────────────────────────────────────────────

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  vol = 0.15,
  when = 0,
) {
  const c = getCtx();
  if (!c || sounds.isMuted()) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol * masterGain(), t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function sweep(
  from: number,
  to: number,
  duration: number,
  type: OscillatorType = 'sawtooth',
  vol = 0.12,
  when = 0,
) {
  const c = getCtx();
  if (!c || sounds.isMuted()) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol * masterGain(), t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noiseHit(duration = 0.18, hp = 600, vol = 0.15, when = 0) {
  const c = getCtx();
  if (!c || sounds.isMuted()) return;
  const t0 = c.currentTime + when;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.setValueAtTime(hp, t0);
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol * masterGain(), t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filt).connect(gain).connect(c.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.05);
}

// ── Public API ────────────────────────────────────────────────────────────

const INTENSITY_VOL: Record<'low' | 'mid' | 'high', number> = {
  low: 0.18,
  mid: 0.32,
  high: 0.55,
};

export const triviaAudio = {
  unlock() {
    getCtx();
  },

  /** Start (or crossfade) the suspense bed. Safe to call repeatedly. */
  async startBed(intensity: 'low' | 'mid' | 'high' = 'mid') {
    if (sounds.isMuted()) return;
    const target = INTENSITY_VOL[intensity] * masterGain();
    try {
      if (!bedAudio) {
        const url = await loadBedUrl();
        bedAudio = new Audio(url);
        bedAudio.loop = true;
        bedAudio.volume = 0;
        bedAudio.preload = 'auto';
        // best-effort autoplay; will fail silently before any user gesture.
        await bedAudio.play().catch(() => {});
      } else if (bedAudio.paused) {
        await bedAudio.play().catch(() => {});
      }
      fadeBedTo(target, 600);
    } catch (err) {
      console.warn('[triviaAudio] bed failed', err);
    }
  },

  /** Fade out and pause the bed (keeps element for next start). */
  stopBed() {
    if (!bedAudio) return;
    fadeBedTo(0, 500, () => {
      bedAudio?.pause();
    });
  },

  /** Hard kill (e.g. when leaving the trivia route). */
  destroyBed() {
    cancelBedFade();
    if (bedAudio) {
      bedAudio.pause();
      bedAudio.src = '';
      bedAudio = null;
    }
  },

  // Stings — all synthesized.

  lockIn() {
    // bright "selected" double-chime
    tone(880, 0.08, 'triangle', 0.18, 0);
    tone(1320, 0.12, 'triangle', 0.16, 0.05);
    noiseHit(0.06, 2000, 0.06, 0.02);
  },

  correct() {
    // ascending celebratory triad + shimmer
    [659, 880, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'triangle', 0.18, i * 0.07));
    sweep(1200, 4000, 0.4, 'sine', 0.06, 0.05);
    noiseHit(0.25, 2500, 0.05, 0.1);
  },

  wrong() {
    // descending crash with low impact
    sweep(440, 90, 0.55, 'sawtooth', 0.22);
    tone(110, 0.45, 'sawtooth', 0.18, 0.02);
    noiseHit(0.45, 200, 0.18, 0);
  },

  finalAnswer() {
    // deep dramatic drone hit (the WWTBAM "is that your final answer" thump)
    tone(55, 0.9, 'sine', 0.28, 0);
    tone(82.5, 0.9, 'triangle', 0.18, 0);
    sweep(220, 60, 0.7, 'sawtooth', 0.14, 0.05);
    noiseHit(0.3, 80, 0.22, 0);
  },

  roundIntro() {
    // bright fanfare
    tone(523, 0.15, 'triangle', 0.16, 0);
    tone(659, 0.15, 'triangle', 0.16, 0.12);
    tone(784, 0.2, 'triangle', 0.18, 0.24);
    tone(1047, 0.32, 'triangle', 0.2, 0.36);
    sweep(2000, 6000, 0.6, 'sine', 0.05, 0.4);
  },

  countdownTick() {
    tone(1500, 0.04, 'square', 0.06, 0);
  },
};
