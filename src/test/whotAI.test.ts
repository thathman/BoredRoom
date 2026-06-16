import { describe, it, expect } from 'vitest';
import {
  mapWhotTransitionToEvents,
  foldEventsIntoSignals,
  emptyWhotSignals,
  buildWhotRecapInput,
} from '@/lib/whotAI';
import type { WhotPublicState, WhotCard, WhotShape } from '@/lib/transport/types';

const card = (id: string, value: number, shape: WhotShape = 'circle', isWhot = false): WhotCard => ({
  id, value, shape, isWhot,
});

const baseState = (overrides: Partial<WhotPublicState> = {}): WhotPublicState => ({
  phase: 'playing',
  players: [
    { id: 'A', displayName: 'Ada', handCount: 5 },
    { id: 'B', displayName: 'Bola', handCount: 4 },
  ],
  currentPlayerIndex: 0,
  currentPlayerId: 'A',
  topDiscard: card('c1', 7),
  activeShape: 'circle',
  drawPileCount: 30,
  turnNumber: 1,
  winnerId: null,
  lastAction: '',
  pendingDrawCount: 0,
  pendingDrawRank: null,
  mustCallSuit: false,
  lastCardAnnounced: [],
  ...overrides,
});

describe('mapWhotTransitionToEvents', () => {
  it('returns [] when prev is null', () => {
    expect(mapWhotTransitionToEvents(null, baseState())).toEqual([]);
  });

  it('emits whot_play on top discard change', () => {
    const prev = baseState();
    const next = baseState({ topDiscard: card('c2', 4, 'square'), activeShape: 'square' });
    const evs = mapWhotTransitionToEvents(prev, next);
    expect(evs.some((e) => e.type === 'whot_play' && e.value === 4)).toBe(true);
  });

  it('emits whot_pick_chain when pendingDrawCount grows', () => {
    const prev = baseState({ pendingDrawCount: 2, pendingDrawRank: '2' });
    const next = baseState({
      pendingDrawCount: 4,
      pendingDrawRank: '2',
      topDiscard: card('c3', 2, 'circle'),
    });
    const evs = mapWhotTransitionToEvents(prev, next);
    expect(evs.find((e) => e.type === 'whot_pick_chain')?.value).toBe(4);
  });

  it('emits whot_pick_consume when chain drops to 0 without a play', () => {
    const prev = baseState({ pendingDrawCount: 4, pendingDrawRank: '2' });
    const next = baseState({ pendingDrawCount: 0, pendingDrawRank: null });
    const evs = mapWhotTransitionToEvents(prev, next);
    expect(evs.some((e) => e.type === 'whot_pick_consume')).toBe(true);
  });

  it('emits whot_suit_call when mustCallSuit clears with shape change', () => {
    const prev = baseState({ mustCallSuit: true, activeShape: 'whot' });
    const next = baseState({ mustCallSuit: false, activeShape: 'star' });
    const evs = mapWhotTransitionToEvents(prev, next);
    expect(evs.find((e) => e.type === 'whot_suit_call')?.shape).toBe('star');
  });

  it('emits whot_suspension on value 8', () => {
    const prev = baseState();
    const next = baseState({ topDiscard: card('s1', 8, 'circle') });
    const evs = mapWhotTransitionToEvents(prev, next);
    expect(evs.some((e) => e.type === 'whot_suspension')).toBe(true);
  });

  it('emits whot_general_market on value 14', () => {
    const prev = baseState();
    const next = baseState({ topDiscard: card('m1', 14, 'circle') });
    const evs = mapWhotTransitionToEvents(prev, next);
    expect(evs.some((e) => e.type === 'whot_general_market')).toBe(true);
  });

  it('emits whot_last_card for newly announcing seats', () => {
    const prev = baseState({ lastCardAnnounced: [] });
    const next = baseState({ lastCardAnnounced: ['A'] });
    const evs = mapWhotTransitionToEvents(prev, next);
    expect(evs.some((e) => e.type === 'whot_last_card' && e.actor === 'Ada')).toBe(true);
  });

  it('emits whot_win and stops at terminal moment', () => {
    const prev = baseState();
    const next = baseState({ winnerId: 'A', phase: 'finished' });
    const evs = mapWhotTransitionToEvents(prev, next);
    expect(evs).toHaveLength(1);
    expect(evs[0].type).toBe('whot_win');
  });
});

describe('foldEventsIntoSignals', () => {
  it('accumulates totals correctly and tracks max stack', () => {
    let s = emptyWhotSignals();
    s = foldEventsIntoSignals(s, [
      { type: 'whot_play', actor: 'Ada', value: 7 },
      { type: 'whot_pick_chain', actor: 'Ada', value: 2 },
      { type: 'whot_pick_chain', actor: 'Bola', value: 4 },
      { type: 'whot_pick_consume', actor: 'Ada', value: 4 },
      { type: 'whot_suspension', actor: 'Bola' },
      { type: 'whot_general_market', actor: 'Ada' },
      { type: 'whot_suit_call', actor: 'Ada', shape: 'star' },
      { type: 'whot_last_card', actor: 'Bola' },
    ]);
    expect(s.totalPlays).toBe(1);
    expect(s.pickChainsTriggered).toBe(2);
    expect(s.pickChainsConsumed).toBe(1);
    expect(s.maxPickStack).toBe(4);
    expect(s.suspensions).toBe(1);
    expect(s.generalMarkets).toBe(1);
    expect(s.suitCalls).toBe(1);
    expect(s.lastCardAnnounces).toBe(1);
  });

  it('does not mutate input', () => {
    const s = emptyWhotSignals();
    const out = foldEventsIntoSignals(s, [{ type: 'whot_play', actor: 'A', value: 1 }]);
    expect(s.totalPlays).toBe(0);
    expect(out.totalPlays).toBe(1);
  });
});

describe('buildWhotRecapInput', () => {
  it('produces a recap-compatible payload with winner + signals', () => {
    const state = baseState({
      phase: 'finished',
      winnerId: 'A',
      turnNumber: 22,
      players: [
        { id: 'A', displayName: 'Ada', handCount: 0 },
        { id: 'B', displayName: 'Bola', handCount: 6 },
      ],
    });
    const signals = foldEventsIntoSignals(emptyWhotSignals(), [
      { type: 'whot_play', actor: 'Ada', value: 1 },
    ]);
    const payload = buildWhotRecapInput({
      roomCode: 'XYZ',
      state,
      signals,
      matchStartedAt: Date.now() - 60000,
    });
    expect(payload.winnerName).toBe('Ada');
    expect(payload.turnCount).toBe(22);
    expect(payload.players).toHaveLength(2);
    expect(payload.matchDurationMs).toBeGreaterThanOrEqual(60000);
    expect(payload.signals.totalPlays).toBe(1);
  });
});
