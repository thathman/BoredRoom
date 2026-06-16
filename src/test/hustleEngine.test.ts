import { describe, expect, it } from 'vitest';
import {
  applyRoll,
  advanceTurn,
  claimJapa,
  createInitialHustleState,
  DEFAULT_HUSTLE_SETTINGS,
  makeInitialPlayer,
  playCard,
  rollDie,
  type HustlePlayerState,
  type HustleSettings,
} from '../../shared/src/games/hustle/engine';
import {
  HUSTLE_LADDERS,
  HUSTLE_SNAKES,
  HUSTLE_WIN_SQUARE,
  HUSTLE_JAPA_EXITS,
  HUSTLE_MARKETS,
} from '../../shared/src/games/hustle/board';

const LEGACY_SETTINGS: HustleSettings = { ...DEFAULT_HUSTLE_SETTINGS, japaEndgame: false };

function detPlayers(): HustlePlayerState[] {
  // Build players with deterministic empty hands so card-pool RNG doesn't
  // muddy the tested code paths. We populate hands explicitly per case.
  const a = makeInitialPlayer('a', 'Ada', 'green', 0);
  const b = makeInitialPlayer('b', 'Bem', 'red', 0);
  return [a, b];
}

describe('Hustle engine', () => {
  it('rollDie produces 1..6 across many seeds', () => {
    let prng = 0;
    const fakeRand = () => {
      prng = (prng + 0.1666667) % 1;
      return prng;
    };
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) seen.add(rollDie(fakeRand));
    for (const v of seen) expect(v).toBeGreaterThanOrEqual(1);
    for (const v of seen) expect(v).toBeLessThanOrEqual(6);
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('applies a normal roll, advances pointer next turn', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    const after = applyRoll(state, 3);
    expect(after.state.players[0].position).toBe(3);
    expect(after.isWin).toBe(false);
    const next = advanceTurn(after.state);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.lastDie).toBeNull();
  });

  it('triggers a ladder when landing on a head', () => {
    const ladder = HUSTLE_LADDERS[0];
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].position = ladder.from - 1;
    const after = applyRoll(state, 1);
    expect(after.state.players[0].position).toBe(ladder.to);
    expect(after.banners.some((b) => b.kind === 'ladder')).toBe(true);
  });

  it('triggers a snake and snake-shield burns instead', () => {
    const snake = HUSTLE_SNAKES[0];
    const baseState = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    baseState.players[0].position = snake.from - 1;
    const bitten = applyRoll(baseState, 1);
    expect(bitten.state.players[0].position).toBe(snake.to);

    const shielded = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    shielded.players[0].position = snake.from - 1;
    shielded.players[0].hasSnakeShield = true;
    const dodged = applyRoll(shielded, 1);
    expect(dodged.state.players[0].position).toBe(snake.from);
    expect(dodged.state.players[0].hasSnakeShield).toBe(false);
  });

  it('crab-in-a-bucket pushes a colliding opponent back', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].position = 7;
    state.players[1].position = 10;
    const after = applyRoll(state, 3);
    const me = after.state.players[0];
    const opp = after.state.players[1];
    expect(me.position).toBe(10);
    expect(opp.position).toBe(Math.max(1, 10 - DEFAULT_HUSTLE_SETTINGS.collisionPushback));
    expect(after.banners.some((b) => b.kind === 'collision')).toBe(true);
  });

  it('overshoot bounces back instead of winning', () => {
    const state = createInitialHustleState(detPlayers(), LEGACY_SETTINGS);
    state.players[0].position = HUSTLE_WIN_SQUARE - 2;
    const after = applyRoll(state, 5);
    expect(after.isWin).toBe(false);
    expect(after.state.players[0].position).toBeLessThan(HUSTLE_WIN_SQUARE);
  });

  it('legacy mode: exact landing on 60 wins immediately', () => {
    const state = createInitialHustleState(detPlayers(), LEGACY_SETTINGS);
    state.players[0].position = HUSTLE_WIN_SQUARE - 4;
    const after = applyRoll(state, 4);
    expect(after.isWin).toBe(true);
    expect(after.state.phase).toBe('finished');
    expect(after.state.winnerId).toBe('a');
  });

  it('owambe invite flags the target to skip next turn', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].hand = [{ instanceId: 'x1', cardId: 'owambe_invite' }];
    const res = playCard(state, 'a', 'x1', 'b');
    expect(res.ok).toBe(true);
    expect(res.state.players[1].skipsNextTurn).toBe(true);
    const next = advanceTurn(res.state);
    expect(next.players[1].skipsNextTurn).toBe(false);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it('connection card sets a one-shot snake shield', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].hand = [{ instanceId: 'c1', cardId: 'connection' }];
    const res = playCard(state, 'a', 'c1', null);
    expect(res.ok).toBe(true);
    expect(res.state.players[0].hasSnakeShield).toBe(true);
  });

  // ── v1.1: economy + Japa ────────────────────────────────────────────────

  it('landing on a market pays naira and grants a document', () => {
    const market = HUSTLE_MARKETS[0]; // position 6
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    const startMoney = state.players[0].money;
    state.players[0].position = market.position - 1;
    const after = applyRoll(state, 1);
    expect(after.state.players[0].money).toBe(startMoney + market.reward);
    expect(after.state.players[0].documents).toBe(1);
    expect(after.banners.some((b) => b.kind === 'market')).toBe(true);
  });

  it('Japa endgame: landing on UK gate triggers japaPrompt, not finish', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].position = HUSTLE_JAPA_EXITS.uk - 1;
    state.players[0].money = 500;
    const after = applyRoll(state, 1);
    expect(after.state.phase).toBe('japaPrompt');
    expect(after.state.pendingJapaExit).toBe('uk');
    expect(after.isWin).toBe(false);
  });

  it('claimJapa(uk) succeeds when player has ₦200', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].position = HUSTLE_JAPA_EXITS.uk - 1;
    state.players[0].money = 250;
    const rolled = applyRoll(state, 1);
    const claimed = claimJapa(rolled.state);
    expect(claimed.ok).toBe(true);
    expect(claimed.state.phase).toBe('finished');
    expect(claimed.state.winnerId).toBe('a');
    expect(claimed.state.winnerExit).toBe('uk');
    expect(claimed.state.players[0].money).toBe(50);
  });

  it('claimJapa(canada) fails without enough documents', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].position = HUSTLE_JAPA_EXITS.canada - 1;
    state.players[0].money = 500;
    state.players[0].documents = 1;
    const rolled = applyRoll(state, 1);
    const claimed = claimJapa(rolled.state);
    expect(claimed.ok).toBe(false);
    expect(claimed.rejection).toBe('insufficient_documents');
  });

  it('claimJapa(us) free flight on exact landing', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].position = HUSTLE_JAPA_EXITS.us - 3;
    const rolled = applyRoll(state, 3);
    expect(rolled.state.phase).toBe('japaPrompt');
    expect(rolled.state.pendingJapaExit).toBe('us');
    const claimed = claimJapa(rolled.state);
    expect(claimed.ok).toBe(true);
    expect(claimed.state.winnerExit).toBe('us');
  });

  it('bribe card costs ₦80 and arms snake shield', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].hand = [{ instanceId: 'br1', cardId: 'bribe' }];
    state.players[0].money = 100;
    const res = playCard(state, 'a', 'br1', null);
    expect(res.ok).toBe(true);
    // 100 − 80 cost + 100 immediate GO kick-back (linear board, no GO loop) = 120.
    expect(res.state.players[0].money).toBe(120);
    expect(res.state.players[0].hasSnakeShield).toBe(true);
    expect(res.state.players[0].bribeGoBonus).toBe(true);
  });

  it('village_people sends target back 8 squares for ₦40', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].hand = [{ instanceId: 'v1', cardId: 'village_people' }];
    state.players[0].money = 100;
    state.players[1].position = 20;
    const res = playCard(state, 'a', 'v1', 'b');
    expect(res.ok).toBe(true);
    expect(res.state.players[0].money).toBe(60);
    expect(res.state.players[1].position).toBe(12);
  });

  it('rejects card play when funds insufficient', () => {
    const state = createInitialHustleState(detPlayers(), DEFAULT_HUSTLE_SETTINGS);
    state.players[0].hand = [{ instanceId: 'br1', cardId: 'bribe' }];
    state.players[0].money = 10;
    const res = playCard(state, 'a', 'br1', null);
    expect(res.ok).toBe(false);
    expect(res.rejection).toBe('insufficient_funds');
  });
});
