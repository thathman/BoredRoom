import { describe, expect, it } from 'vitest';
import {
  createInitialMarketPriceState,
  startRound,
  submitGuess,
  scoreGuess,
  resolveRound,
  leaderboard,
  winner,
  DEFAULT_MARKETPRICE_SETTINGS as S,
  type MarketPriceItem,
} from '../../shared/src/games/marketprice/engine';

const item: MarketPriceItem = { id: 'i1', name: 'Bag of rice', price: 1000 };

// AC-8.1: a new game plays end-to-end behind the adapter contract (engine correctness here).
describe('market price engine', () => {
  it('scores closer guesses higher', () => {
    expect(scoreGuess(1000, 1000, S)).toBe(S.maxPoints + S.exactBonus); // exact
    expect(scoreGuess(900, 1000, S)).toBeGreaterThan(scoreGuess(500, 1000, S));
    expect(scoreGuess(0, 1000, S)).toBe(0); // 100% off
    expect(scoreGuess(5000, 1000, S)).toBe(0); // way over
  });

  it('runs a round: guess -> resolve -> deltas applied', () => {
    let s = createInitialMarketPriceState([{ id: 'p1', name: 'Ada' }, { id: 'p2', name: 'Obi' }]);
    s = startRound(s, item);
    expect(s.phase).toBe('guessing');
    expect(s.round).toBe(1);
    s = submitGuess(s, 'p1', 1000); // exact
    s = submitGuess(s, 'p2', 700);
    s = resolveRound(s);
    expect(s.phase).toBe('scoring');
    expect(s.lastDeltas.p1).toBe(S.maxPoints + S.exactBonus);
    expect(s.lastDeltas.p2).toBeGreaterThan(0);
    expect(s.players.find((p) => p.id === 'p1')!.score).toBe(s.lastDeltas.p1);
  });

  it('ignores invalid guesses and unknown players', () => {
    let s = startRound(createInitialMarketPriceState([{ id: 'p1', name: 'Ada' }]), item);
    s = submitGuess(s, 'ghost', 100);
    s = submitGuess(s, 'p1', -5);
    s = submitGuess(s, 'p1', NaN);
    expect(s.guesses).toEqual({});
  });

  it('finishes after the configured rounds', () => {
    let s = createInitialMarketPriceState([{ id: 'p1', name: 'Ada' }], { ...S, rounds: 2 });
    s = startRound(s, item);
    s = resolveRound(s);
    expect(s.phase).toBe('scoring');
    s = startRound(s, item);
    s = resolveRound(s);
    expect(s.phase).toBe('finished');
  });

  it('ranks a leaderboard and finds a clear winner', () => {
    let s = createInitialMarketPriceState([{ id: 'p1', name: 'Ada' }, { id: 'p2', name: 'Obi' }], { ...S, rounds: 1 });
    s = startRound(s, item);
    s = submitGuess(s, 'p1', 1000);
    s = submitGuess(s, 'p2', 200);
    s = resolveRound(s);
    expect(leaderboard(s)[0].id).toBe('p1');
    expect(winner(s)?.id).toBe('p1');
  });

  it('no winner on a top tie', () => {
    let s = createInitialMarketPriceState([{ id: 'p1', name: 'Ada' }, { id: 'p2', name: 'Obi' }], { ...S, rounds: 1 });
    s = startRound(s, item);
    s = submitGuess(s, 'p1', 1000);
    s = submitGuess(s, 'p2', 1000);
    s = resolveRound(s);
    expect(winner(s)).toBeNull();
  });
});
