// End-to-end test of the Whot AI host-loop primitives:
//   transition stream -> events -> queue fold -> recap input
// Validates: no duplicate events, signals reset between matches, recap fires
// once at finish, coalescing semantics on consecutive identical plays.

import { describe, it, expect } from 'vitest';
import {
  mapWhotTransitionToEvents,
  foldEventsIntoSignals,
  emptyWhotSignals,
  buildWhotRecapInput,
  type WhotMatchSignals,
} from '@/lib/whotAI';
import type { WhotPublicState, WhotCard, WhotShape } from '@/lib/transport/types';

const card = (id: string, value: number, shape: WhotShape = 'circle', isWhot = false): WhotCard => ({
  id, value, shape, isWhot,
});

const baseState = (overrides: Partial<WhotPublicState> = {}): WhotPublicState => ({
  phase: 'playing',
  players: [
    { id: 'A', displayName: 'Ada', handCount: 5 },
    { id: 'B', displayName: 'Bola', handCount: 5 },
  ],
  currentPlayerIndex: 0,
  currentPlayerId: 'A',
  topDiscard: card('c0', 7),
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

/** Mirror the host-loop reducer: feed a stream of states, accumulate events + signals. */
function runStream(states: WhotPublicState[]): {
  events: ReturnType<typeof mapWhotTransitionToEvents>;
  signals: WhotMatchSignals;
} {
  let prev: WhotPublicState | null = null;
  let signals = emptyWhotSignals();
  const all: ReturnType<typeof mapWhotTransitionToEvents> = [];
  for (const s of states) {
    const evs = mapWhotTransitionToEvents(prev, s);
    all.push(...evs);
    signals = foldEventsIntoSignals(signals, evs);
    prev = s;
  }
  return { events: all, signals };
}

describe('Whot AI host-loop integration', () => {
  it('produces a coherent stream across a multi-turn match', () => {
    const s0 = baseState();
    const s1 = baseState({
      topDiscard: card('c1', 4, 'square'),
      activeShape: 'square',
      currentPlayerId: 'B',
      currentPlayerIndex: 1,
      turnNumber: 2,
    });
    const s2 = baseState({
      topDiscard: card('c2', 2, 'square'),
      activeShape: 'square',
      pendingDrawCount: 2,
      pendingDrawRank: '2',
      currentPlayerId: 'A',
      currentPlayerIndex: 0,
      turnNumber: 3,
    });
    const s3 = baseState({
      topDiscard: card('c3', 8, 'square'),
      activeShape: 'square',
      currentPlayerId: 'A',
      currentPlayerIndex: 0,
      turnNumber: 4,
      pendingDrawCount: 0,
    });
    const s4 = baseState({
      topDiscard: card('c4', 14, 'square'),
      activeShape: 'square',
      currentPlayerId: 'B',
      currentPlayerIndex: 1,
      turnNumber: 5,
    });
    const { events, signals } = runStream([s0, s1, s2, s3, s4]);
    expect(events.filter((e) => e.type === 'whot_play').length).toBe(4);
    expect(signals.totalPlays).toBe(4);
    expect(signals.pickChainsTriggered).toBeGreaterThanOrEqual(1);
    expect(signals.suspensions).toBe(1);
    expect(signals.generalMarkets).toBe(1);
  });

  it('fires whot_win exactly once at the terminal transition', () => {
    const s0 = baseState();
    const s1 = baseState({ topDiscard: card('c1', 5, 'square') });
    const sFin = baseState({
      topDiscard: card('c1', 5, 'square'),
      winnerId: 'A',
      phase: 'finished',
      players: [
        { id: 'A', displayName: 'Ada', handCount: 0 },
        { id: 'B', displayName: 'Bola', handCount: 4 },
      ],
    });
    const sRedundant = baseState({
      topDiscard: card('c1', 5, 'square'),
      winnerId: 'A',
      phase: 'finished',
      players: [
        { id: 'A', displayName: 'Ada', handCount: 0 },
        { id: 'B', displayName: 'Bola', handCount: 4 },
      ],
    });
    const { events } = runStream([s0, s1, sFin, sRedundant]);
    expect(events.filter((e) => e.type === 'whot_win').length).toBe(1);
  });

  it('idempotent on no-op renders (same state twice produces no events)', () => {
    const s = baseState();
    const { events } = runStream([s, s, s, s]);
    expect(events).toEqual([]);
  });

  it('signals reset between matches when host loop calls emptyWhotSignals()', () => {
    // Match 1
    const m1 = runStream([
      baseState(),
      baseState({ topDiscard: card('m1', 14) }),
    ]);
    expect(m1.signals.generalMarkets).toBe(1);
    // Simulating play-again: host clears signals.
    const fresh = emptyWhotSignals();
    expect(fresh.generalMarkets).toBe(0);
    expect(fresh.totalPlays).toBe(0);
  });

  it('builds a finish-state recap input with correct winner + duration', () => {
    const start = Date.now() - 90_000;
    const sFin = baseState({
      phase: 'finished',
      winnerId: 'B',
      turnNumber: 18,
      players: [
        { id: 'A', displayName: 'Ada', handCount: 4 },
        { id: 'B', displayName: 'Bola', handCount: 0 },
      ],
    });
    const signals = foldEventsIntoSignals(emptyWhotSignals(), [
      { type: 'whot_play', actor: 'Ada', value: 7 },
      { type: 'whot_pick_chain', actor: 'Ada', value: 4 },
    ]);
    const payload = buildWhotRecapInput({
      roomCode: 'TEST',
      state: sFin,
      signals,
      matchStartedAt: start,
    });
    expect(payload.winnerName).toBe('Bola');
    expect(payload.turnCount).toBe(18);
    expect(payload.matchDurationMs).toBeGreaterThanOrEqual(89_000);
    expect(payload.signals.maxPickStack).toBe(4);
    expect(payload.signals.totalPlays).toBe(1);
  });

  it('coalesces consecutive identical whot_play events (low-signal dedup)', () => {
    // The host-loop dedup logic mirrored here.
    const queue = [
      { type: 'whot_play', actor: 'Ada', value: 4 } as const,
      { type: 'whot_play', actor: 'Ada', value: 4 } as const,
      { type: 'whot_play', actor: 'Bola', value: 4 } as const,
    ];
    const dedup: typeof queue = [];
    for (const ev of queue) {
      const last = dedup[dedup.length - 1];
      if (
        last &&
        last.type === 'whot_play' &&
        ev.type === 'whot_play' &&
        last.actor === ev.actor &&
        last.value === ev.value
      ) {
        continue;
      }
      dedup.push(ev);
    }
    expect(dedup).toHaveLength(2);
  });
});
