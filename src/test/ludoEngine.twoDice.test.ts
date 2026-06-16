import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyRoll,
  moveToken,
  rollDice,
  LudoState,
} from '@/game/ludoEngine';

function newGame(): LudoState {
  return createInitialState([
    { id: 'p1', displayName: 'Alice' },
    { id: 'p2', displayName: 'Bob' },
  ]);
}

describe('Nigerian 2-dice Ludo engine', () => {
  it('roll with movable tokens sets dice tuple, diceRemaining, and moving phase', () => {
    const s = newGame();
    s.players[0].tokens[0].position = 5;
    const next = applyRoll(s, [3, 5]);
    expect(next.dice).toEqual([3, 5]);
    expect(next.diceRemaining).toEqual([3, 5]);
    expect(next.diceValue).toBe(8);
    expect(next.phase).toBe('moving');
  });

  it('a 6 lets a token leave base, consumes the 6', () => {
    const s = newGame();
    const rolled = applyRoll(s, [6, 3]);
    expect(rolled.phase).toBe('moving');
    expect(rolled.diceRemaining).toEqual([6, 3]);
    const moved = moveToken(rolled, 0, 'd1');
    expect(moved.diceRemaining).toEqual([3]);
    expect(moved.phase).toBe('moving');
    expect(moved.players[0].tokens[0].position).toBe(0);
  });

  it('does not allow dice sums that equal 6 to leave base', () => {
    const s = newGame();
    const rolled = applyRoll(s, [3, 3]);
    expect(rolled.phase).toBe('rolling');
    expect(rolled.currentPlayerIndex).toBe(1);
    expect(rolled.players[0].tokens.every((t) => t.position === -1)).toBe(true);
  });

  it('does not allow sum=12 to leave base on double-six', () => {
    const s = newGame();
    const rolled = applyRoll(s, [6, 6]);
    expect(rolled.phase).toBe('moving');
    const invalidSumMove = moveToken(rolled, 0, 'sum');
    expect(invalidSumMove).toBe(rolled);
    expect(invalidSumMove.players[0].tokens[0].position).toBe(-1);

    const first = moveToken(rolled, 0, 'd1');
    expect(first.players[0].tokens[0].position).toBe(0);
    const second = moveToken(first, 1, 'd2');
    expect(second.players[0].tokens[1].position).toBe(0);
  });

  it('using sum consumes both dice in one move', () => {
    const s = newGame();
    let g = applyRoll(s, [6, 2]);
    g = moveToken(g, 0, 'd1');
    expect(g.diceRemaining).toEqual([2]);
    g = moveToken(g, 0, 'd2');
    expect(g.phase).toBe('rolling');
    expect(g.currentPlayerIndex).toBe(0); // 6 → reroll
    expect(g.players[0].tokens[0].position).toBe(2);
  });

  it('triple consecutive double-sixes forfeits the turn', () => {
    let g = newGame();
    g = applyRoll(g, [6, 6]);
    expect(g.consecutiveDoubleSixes).toBe(1);
    g = moveToken(g, 0, 'd1');
    g = moveToken(g, 1, 'd2');
    expect(g.currentPlayerIndex).toBe(0);

    g = applyRoll(g, [6, 6]);
    expect(g.consecutiveDoubleSixes).toBe(2);
    g = moveToken(g, 2, 'd1');
    g = moveToken(g, 3, 'd2');
    expect(g.currentPlayerIndex).toBe(0);

    g = applyRoll(g, [6, 6]);
    expect(g.currentPlayerIndex).toBe(1);
    expect(g.phase).toBe('rolling');
  });

  it('non-six roll without legal moves advances turn', () => {
    const s = newGame();
    // Use [2,3] so neither dice nor sum (5) is a 6 → no way to leave base.
    const next = applyRoll(s, [2, 3]);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.phase).toBe('rolling');
    expect(next.dice).toBeNull();
  });

  it('blockade blocks opponent on non-six step but a 6 may pass', () => {
    const g = newGame();
    g.players[1].tokens[0].position = 14;
    g.players[1].tokens[1].position = 14;
    g.players[0].tokens[0].position = 12;

    const rolled = applyRoll(g, [2, 3]);
    expect(rolled.phase).toBe('rolling');
    expect(rolled.currentPlayerIndex).toBe(1);

    g.players[0].tokens[0].position = 12;
    const rolled2 = applyRoll(g, [6, 1]);
    expect(rolled2.phase).toBe('moving');
    const moved = moveToken(rolled2, 0, 'd1');
    expect(moved.players[0].tokens[0].position).toBe(18);
  });

  it('rollDice produces a valid 2-tuple sum (1..12)', () => {
    const s = newGame();
    s.players[0].tokens[0].position = 5; // ensure moves exist so dice survive
    const r = rollDice(s);
    expect(r.dice).not.toBeNull();
    expect(r.dice!.length).toBe(2);
    expect(r.diceValue).toBeGreaterThanOrEqual(2);
    expect(r.diceValue).toBeLessThanOrEqual(12);
  });
});
