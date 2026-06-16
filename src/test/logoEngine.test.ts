import { describe, it, expect } from 'vitest';
import {
  brandPoolFor,
  canonicalIndexFromPick,
  createInitialLogoState,
  DEFAULT_LOGO_SETTINGS,
  fuzzyMatchBrand,
  levenshtein,
  normalizeGuess,
  pickBrandsForMatch,
  pickDistractors,
  pointsForRank,
  resolveLogoRound,
  shuffleOptionOrder,
  streakMultiplier,
  type LogoLockedAnswer,
  type LogoPlayerState,
} from '../../shared/src/games/logo/engine';
import { LOGO_BRANDS } from '../../shared/src/games/logo/brands';

describe('logo engine — normalize + fuzzy', () => {
  it('normalizes punctuation, diacritics, suffixes', () => {
    expect(normalizeGuess("McDonald's, Inc.")).toBe('mcdonald s');
    expect(normalizeGuess('Nestlé')).toBe('nestle');
    expect(normalizeGuess('  The   BBC ')).toBe('bbc');
  });

  it('levenshtein cap returns early for very different strings', () => {
    expect(levenshtein('apple', 'banana', 2)).toBeGreaterThan(2);
    expect(levenshtein('apple', 'aple', 2)).toBe(1);
  });

  it('fuzzyMatchBrand handles exact, close, partial, wrong', () => {
    const mtn = LOGO_BRANDS.find((b) => b.name === 'MTN')!;
    expect(fuzzyMatchBrand('MTN', mtn)).toBe('exact');
    expect(fuzzyMatchBrand('mtn nigeria', mtn)).toBe('exact'); // alias

    const mcd = LOGO_BRANDS.find((b) => b.name === "McDonald's")!;
    expect(fuzzyMatchBrand('mcdonald', mcd)).toBe('close');
    expect(fuzzyMatchBrand('mcd', mcd)).toBe('exact'); // alias

    const louis = LOGO_BRANDS.find((b) => b.name === 'Louis Vuitton')!;
    expect(fuzzyMatchBrand('louis', louis)).toBe('partial');

    const bmw = LOGO_BRANDS.find((b) => b.name === 'BMW')!;
    expect(fuzzyMatchBrand('toyota', bmw)).toBe('wrong');
  });
});

describe('logo engine — scoring', () => {
  it('streak multiplier kicks in at 3 and 5', () => {
    expect(streakMultiplier(2)).toBe(1);
    expect(streakMultiplier(3)).toBe(1.25);
    expect(streakMultiplier(5)).toBe(1.5);
  });

  it('pointsForRank: tiered + partial halves', () => {
    expect(pointsForRank(1, 1, false)).toBe(100);
    expect(pointsForRank(2, 1, false)).toBe(70);
    expect(pointsForRank(1, 3, false)).toBe(125); // 100 × 1.25
    expect(pointsForRank(1, 1, true)).toBe(50);   // partial
    expect(pointsForRank(0, 0, false)).toBe(0);
  });
});

describe('logo engine — round selection', () => {
  it('pickBrandsForMatch returns N distinct brands deterministically', () => {
    const a = pickBrandsForMatch(10, 'mixed', 1234);
    const b = pickBrandsForMatch(10, 'mixed', 1234);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(10);
  });

  it('pickDistractors returns 3 unique non-answer names', () => {
    const ans = LOGO_BRANDS[0];
    const ds = pickDistractors(ans, 'mixed', 42);
    expect(ds).toHaveLength(3);
    expect(ds).not.toContain(ans.name);
  });

  it('brandPoolFor naija includes africa entries', () => {
    const pool = brandPoolFor('naija');
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((b) => b.region === 'naija' || b.region === 'africa')).toBe(true);
  });
});

describe('logo engine — resolveLogoRound', () => {
  const players: LogoPlayerState[] = [
    { id: 'p1', displayName: 'P1', score: 0, streak: 0, correctCount: 0 },
    { id: 'p2', displayName: 'P2', score: 0, streak: 0, correctCount: 0 },
    { id: 'p3', displayName: 'P3', score: 0, streak: 0, correctCount: 0 },
  ];
  const brand = LOGO_BRANDS.find((b) => b.name === 'Apple')!;

  it('MC: canonical-index compare; speed-rank scoring', () => {
    const canonicalOptions: [string, string, string, string] = ['Apple', 'BMW', 'Tesla', 'MTN'];
    const locks = new Map<string, LogoLockedAnswer>([
      ['p1', { playerId: 'p1', guessText: null, pickedCanonicalIndex: 0, lockedAtMs: 100, matchKind: 'wrong' }],
      ['p2', { playerId: 'p2', guessText: null, pickedCanonicalIndex: 1, lockedAtMs: 110, matchKind: 'wrong' }],
      ['p3', { playerId: 'p3', guessText: null, pickedCanonicalIndex: 0, lockedAtMs: 200, matchKind: 'wrong' }],
    ]);
    const { results, updatedPlayers } = resolveLogoRound(brand, canonicalOptions, players, locks);
    expect(results.find((r) => r.playerId === 'p1')!.correct).toBe(true);
    expect(results.find((r) => r.playerId === 'p2')!.correct).toBe(false);
    expect(results.find((r) => r.playerId === 'p3')!.correct).toBe(true);
    expect(updatedPlayers.find((p) => p.id === 'p1')!.score).toBe(100); // rank 1
    expect(updatedPlayers.find((p) => p.id === 'p3')!.score).toBe(70);  // rank 2
    expect(updatedPlayers.find((p) => p.id === 'p2')!.streak).toBe(0);
  });

  it('free-text: exact + close score full, partial half, wrong zero', () => {
    const locks = new Map<string, LogoLockedAnswer>([
      ['p1', { playerId: 'p1', guessText: 'Apple', pickedCanonicalIndex: null, lockedAtMs: 100, matchKind: 'exact' }],
      ['p2', { playerId: 'p2', guessText: 'aple', pickedCanonicalIndex: null, lockedAtMs: 200, matchKind: 'close' }],
      ['p3', { playerId: 'p3', guessText: 'banana', pickedCanonicalIndex: null, lockedAtMs: 300, matchKind: 'wrong' }],
    ]);
    const { results } = resolveLogoRound(brand, null, players, locks);
    expect(results.find((r) => r.playerId === 'p1')!.pointsAwarded).toBe(100);
    expect(results.find((r) => r.playerId === 'p2')!.pointsAwarded).toBe(70);
    expect(results.find((r) => r.playerId === 'p3')!.pointsAwarded).toBe(0);
  });
});

describe('logo engine — option order helpers', () => {
  it('shuffleOptionOrder returns permutation of [0..3]', () => {
    const rng = (() => { let i = 0; const arr = [0.9, 0.1, 0.5, 0.3]; return () => arr[i++ % arr.length]; })();
    const order = shuffleOptionOrder(rng);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('canonicalIndexFromPick maps shuffled→canonical', () => {
    const order: [number, number, number, number] = [2, 0, 3, 1];
    expect(canonicalIndexFromPick(order, 0)).toBe(2);
    expect(canonicalIndexFromPick(order, 3)).toBe(1);
    expect(canonicalIndexFromPick(null, 0)).toBeNull();
  });
});

describe('logo engine — initial state', () => {
  it('createInitialLogoState wires defaults', () => {
    const s = createInitialLogoState([], DEFAULT_LOGO_SETTINGS);
    expect(s.phase).toBe('lobby');
    expect(s.settings.rounds).toBe(10);
    expect(s.settings.inputMode).toBe('multiple_choice');
  });
});
