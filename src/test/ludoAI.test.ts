import { describe, expect, it } from 'vitest';
import { buildLudoRecapInput, mapLudoTransitionToEvents } from '@/lib/ludoAI';
import type { LudoState } from '@/game/ludoEngine';

const state = (overrides: Partial<LudoState> = {}): LudoState => ({
  players: [
    { id: 'A', displayName: 'Ada', color: 'red', tokens: [], finishedTokens: 2 },
    { id: 'B', displayName: 'Bola', color: 'green', tokens: [], finishedTokens: 1 },
  ],
  currentPlayerIndex: 0,
  dice: null,
  diceRemaining: [],
  diceValue: null,
  diceRolled: false,
  phase: 'rolling',
  winner: null,
  consecutiveSixes: 0,
  consecutiveDoubleSixes: 0,
  lastAction: '',
  turnNumber: 1,
  ...overrides,
});

describe('Ludo AI adapters', () => {
  it('maps Ludo transitions to commentary events', () => {
    const prev = state();
    const next = state({ dice: [6, 2], diceValue: 8, diceRolled: true, lastAction: "Ada captured Bola's token!" });
    const events = mapLudoTransitionToEvents(prev, next);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'roll', actor: 'Ada', value: 6 }),
      expect.objectContaining({ type: 'capture', actor: 'Ada', target: 'Bola' }),
    ]));
  });

  it('builds an explicit Ludo recap payload', () => {
    const payload = buildLudoRecapInput({
      roomCode: 'LUDO',
      state: state({ phase: 'finished', winner: 'A', turnNumber: 42 }),
      matchStartedAt: Date.now() - 10_000,
    });
    expect(payload.gameType).toBe('ludo');
    expect(payload.winnerName).toBe('Ada');
    expect(payload.players[0]).toMatchObject({ name: 'Ada', color: 'red', tokensHome: 2 });
  });
});
