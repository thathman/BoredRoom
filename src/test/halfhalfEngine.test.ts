import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HALFHALF_SETTINGS,
  createInitialHalfHalfState,
  pickObjectsForMatch,
  pointsForGuess,
  resolveHalfHalfRound,
  sanitizePosition,
  type HalfHalfPlayerGuess,
  type HalfHalfPlayerState,
} from '../../shared/src/games/halfhalf/engine';
import { HALFHALF_OBJECTS, objectById } from '../../shared/src/games/halfhalf/objects';

const mkPlayers = (n: number): HalfHalfPlayerState[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    displayName: `P${i}`,
    score: 0,
    bullseyes: 0,
  }));

describe('Half & Half engine', () => {
  it('catalog has at least 40 objects with valid truths', () => {
    expect(HALFHALF_OBJECTS.length).toBeGreaterThanOrEqual(40);
    for (const o of HALFHALF_OBJECTS) {
      expect(o.truth).toBeGreaterThanOrEqual(0);
      expect(o.truth).toBeLessThanOrEqual(1);
      expect(o.id).toMatch(/^[a-zA-Z0-9_]+$/);
    }
  });

  it('object ids are unique', () => {
    const ids = new Set(HALFHALF_OBJECTS.map((o) => o.id));
    expect(ids.size).toBe(HALFHALF_OBJECTS.length);
  });

  it('sanitizePosition clamps and rejects garbage', () => {
    expect(sanitizePosition(0.5)).toBe(0.5);
    expect(sanitizePosition(-1)).toBe(0);
    expect(sanitizePosition(2)).toBe(1);
    expect(sanitizePosition('0.3')).toBeCloseTo(0.3);
    expect(sanitizePosition('nope')).toBeNull();
    expect(sanitizePosition(NaN)).toBeNull();
    expect(sanitizePosition(undefined)).toBeNull();
  });

  it('pointsForGuess: perfect = 1000, opposite end = 0, half off = 500', () => {
    expect(pointsForGuess(0.5, 0.5)).toBe(1000);
    expect(pointsForGuess(0.0, 1.0)).toBe(0);
    expect(pointsForGuess(0.0, 0.5)).toBe(500);
    expect(pointsForGuess(0.6, 0.5)).toBe(900);
  });

  it('pickObjectsForMatch returns distinct objects, deterministic', () => {
    const a = pickObjectsForMatch(8, 1234);
    const b = pickObjectsForMatch(8, 1234);
    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id));
    expect(new Set(a.map((o) => o.id)).size).toBe(8);
  });

  it('resolveHalfHalfRound awards closest bonus to single closest player', () => {
    const players = mkPlayers(3);
    const obj = objectById('baguette')!; // truth 0.5
    const guesses = new Map<string, HalfHalfPlayerGuess>([
      ['p0', { playerId: 'p0', position: 0.51, lockedAtMs: 1 }],
      ['p1', { playerId: 'p1', position: 0.30, lockedAtMs: 2 }],
      ['p2', { playerId: 'p2', position: 0.80, lockedAtMs: 3 }],
    ]);
    const { results, updatedPlayers, closestPlayerId } = resolveHalfHalfRound(obj, players, guesses, 200);
    expect(closestPlayerId).toBe('p0');
    const r0 = results.find((r) => r.playerId === 'p0')!;
    expect(r0.closest).toBe(true);
    expect(r0.pointsAwarded).toBe(pointsForGuess(0.51, 0.5) + 200);
    const u0 = updatedPlayers.find((p) => p.id === 'p0')!;
    expect(u0.bullseyes).toBe(1);
    expect(u0.lastAccuracy).toBeCloseTo(1 - 0.01, 3);
  });

  it('resolveHalfHalfRound: ties suppress closest bonus', () => {
    const players = mkPlayers(2);
    const obj = objectById('baguette')!; // 0.5
    const guesses = new Map<string, HalfHalfPlayerGuess>([
      ['p0', { playerId: 'p0', position: 0.45, lockedAtMs: 1 }],
      ['p1', { playerId: 'p1', position: 0.55, lockedAtMs: 2 }],
    ]);
    const { results, closestPlayerId } = resolveHalfHalfRound(obj, players, guesses, 200);
    expect(closestPlayerId).toBeNull();
    expect(results.every((r) => !r.closest)).toBe(true);
  });

  it('resolveHalfHalfRound: missing guess → 0 points, no bullseye, lastAccuracy unchanged', () => {
    const players = mkPlayers(2);
    const obj = objectById('baguette')!;
    const guesses = new Map<string, HalfHalfPlayerGuess>([
      ['p0', { playerId: 'p0', position: 0.5, lockedAtMs: 1 }],
    ]);
    const { results, updatedPlayers } = resolveHalfHalfRound(obj, players, guesses, 200);
    const r1 = results.find((r) => r.playerId === 'p1')!;
    expect(r1.pointsAwarded).toBe(0);
    expect(r1.position).toBeNull();
    const u1 = updatedPlayers.find((p) => p.id === 'p1')!;
    expect(u1.lastAccuracy).toBeUndefined();
    expect(u1.score).toBe(0);
  });

  it('createInitialHalfHalfState seeds lobby phase', () => {
    const s = createInitialHalfHalfState([], DEFAULT_HALFHALF_SETTINGS);
    expect(s.phase).toBe('lobby');
    expect(s.round).toBe(0);
    expect(s.settings.rounds).toBe(8);
  });
});
