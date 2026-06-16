import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COLORWAHALA_SETTINGS,
  generatePrompt,
  resolveColorWahalaRound,
  scoreTap,
  createInitialColorWahalaState,
  type ColorWahalaPlayerState,
  type ColorWahalaTap,
} from '../../shared/src/games/colorwahala/engine';
import { COLOR_IDS } from '../../shared/src/games/colorwahala/palette';

function mkPlayer(id: string): ColorWahalaPlayerState {
  return { id, displayName: id, score: 0, correctCount: 0, bestStreak: 0, currentStreak: 0, totalLatencyMs: 0 };
}

describe('Color Wahala engine', () => {
  it('always generates a prompt where word ink mismatches word text', () => {
    for (let r = 1; r <= 100; r++) {
      const p = generatePrompt(r, 15, DEFAULT_COLORWAHALA_SETTINGS, 12345);
      expect(p.word.id).not.toBe(p.ink.id);
      expect(COLOR_IDS).toContain(p.word.id);
      expect(COLOR_IDS).toContain(p.ink.id);
    }
  });

  it('say_word answer == word.id; say_color answer == ink.id', () => {
    for (let r = 1; r <= 200; r++) {
      const p = generatePrompt(r, 30, DEFAULT_COLORWAHALA_SETTINGS, r * 7919);
      if (p.mode === 'say_word') expect(p.answer).toBe(p.word.id);
      if (p.mode === 'say_color') expect(p.answer).toBe(p.ink.id);
      if (p.mode === 'say_heard') {
        expect(p.heard).not.toBeNull();
        expect(p.answer).toBe(p.heard!.id);
      }
    }
  });

  it('say_heard disabled when audioEnabled=false', () => {
    const settings = { ...DEFAULT_COLORWAHALA_SETTINGS, audioEnabled: false };
    for (let r = 1; r <= 50; r++) {
      const p = generatePrompt(r, 15, settings, r * 31);
      expect(p.mode === 'say_heard').toBe(false);
      expect(p.heard).toBeNull();
    }
  });

  it('lock window ramps from start to end across rounds', () => {
    const s = { ...DEFAULT_COLORWAHALA_SETTINGS, startLockMs: 6000, endLockMs: 2500, rounds: 10 };
    const first = generatePrompt(1, 10, s, 1);
    const last = generatePrompt(10, 10, s, 1);
    expect(first.lockMs).toBe(6000);
    expect(last.lockMs).toBe(2500);
  });

  it('scoreTap: faster correct = more points; first-correct gets bonus', () => {
    expect(scoreTap(0, 5000, true, true, 250)).toBe(1000 + 250);
    expect(scoreTap(2500, 5000, true, false, 250)).toBe(500);
    expect(scoreTap(5000, 5000, true, false, 250)).toBe(0);
    expect(scoreTap(1000, 5000, false, false, 250)).toBe(0);
  });

  it('resolveRound awards points, locks out wrong, sets streaks', () => {
    const players = [mkPlayer('a'), mkPlayer('b'), mkPlayer('c')];
    const prompt = generatePrompt(1, 5, DEFAULT_COLORWAHALA_SETTINGS, 42);
    const wrongColor = COLOR_IDS.find((c) => c !== prompt.answer)!;
    const taps = new Map<string, ColorWahalaTap>([
      ['a', { playerId: 'a', pickedColor: prompt.answer, serverTs: 0, latencyMs: 500, correct: true }],
      ['b', { playerId: 'b', pickedColor: prompt.answer, serverTs: 0, latencyMs: 1500, correct: true }],
      ['c', { playerId: 'c', pickedColor: wrongColor, serverTs: 0, latencyMs: 100, correct: false }],
    ]);
    const { results, updatedPlayers, firstCorrectPlayerId } = resolveColorWahalaRound(
      prompt,
      players,
      taps,
      DEFAULT_COLORWAHALA_SETTINGS,
    );
    expect(firstCorrectPlayerId).toBe('a');
    const a = results.find((r) => r.playerId === 'a')!;
    const c = results.find((r) => r.playerId === 'c')!;
    expect(a.correct).toBe(true);
    expect(a.pointsAwarded).toBeGreaterThan(0);
    expect(a.speedRank).toBe(1);
    expect(c.correct).toBe(false);
    expect(c.lockedOut).toBe(true);
    expect(c.pointsAwarded).toBe(0);
    const aPlayer = updatedPlayers.find((p) => p.id === 'a')!;
    expect(aPlayer.currentStreak).toBe(1);
    expect(aPlayer.bestStreak).toBe(1);
    const cPlayer = updatedPlayers.find((p) => p.id === 'c')!;
    expect(cPlayer.currentStreak).toBe(0);
  });

  it('mode mix roughly respects probabilities over many samples', () => {
    const settings = { ...DEFAULT_COLORWAHALA_SETTINGS, audioEnabled: true };
    const counts = { say_word: 0, say_color: 0, say_heard: 0 };
    for (let r = 1; r <= 2000; r++) {
      counts[generatePrompt(r, 15, settings, r * 9973).mode]++;
    }
    expect(counts.say_word).toBeGreaterThan(counts.say_color);
    expect(counts.say_color).toBeGreaterThan(counts.say_heard);
  });

  it('createInitialColorWahalaState yields lobby phase', () => {
    const s = createInitialColorWahalaState([], DEFAULT_COLORWAHALA_SETTINGS);
    expect(s.phase).toBe('lobby');
    expect(s.round).toBe(0);
  });
});
