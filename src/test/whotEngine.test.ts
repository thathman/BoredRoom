import { describe, expect, it } from 'vitest';
import type { WhotCard, WhotPublicState } from '../../shared/src/contracts/index';
import {
  applyAnnounceSemiLastCard,
  applyAnnounceLastCard,
  applyCallSuit,
  applyDraw,
  applyPlay,
  getLegalCardIds,
  pickWhotBotMove,
  validatePlay,
} from '../../shared/src/games/whotEngine';

function card(id: string, shape: WhotCard['shape'], value: number, isWhot = false): WhotCard {
  return { id, shape, value, isWhot };
}

function baseState(partial?: Partial<WhotPublicState>): WhotPublicState {
  return {
    phase: 'playing',
    players: [
      { id: 'p1', displayName: 'Ada', handCount: 3 },
      { id: 'p2', displayName: 'Bode', handCount: 3 },
      { id: 'p3', displayName: 'Cheta', handCount: 3 },
    ],
    currentPlayerIndex: 0,
    currentPlayerId: 'p1',
    topDiscard: card('d1', 'circle', 7),
    activeShape: 'circle',
    drawPileCount: 30,
    turnNumber: 1,
    winnerId: null,
    lastAction: 'start',
    pendingDrawCount: 0,
    pendingDrawRank: null,
    mustCallSuit: false,
    lastCardAnnounced: [],
    ...partial,
  };
}

describe('whotEngine legality', () => {
  it('returns legal cards by active shape/value and whot wildcard', () => {
    const state = baseState();
    const hand = [
      card('a', 'circle', 3),
      card('b', 'square', 7),
      card('c', 'star', 5),
      card('w', 'whot', 20, true),
    ];
    const legal = new Set(getLegalCardIds(hand, state));
    expect(legal.has('a')).toBe(true);
    expect(legal.has('b')).toBe(true);
    expect(legal.has('w')).toBe(true);
    expect(legal.has('c')).toBe(false);
  });

  it('requires same-rank counter during pick-two chain', () => {
    const state = baseState({ pendingDrawCount: 4, pendingDrawRank: '2' });
    const hand = [card('x', 'circle', 2), card('y', 'circle', 5)];
    expect(validatePlay(hand, 'y', state, 'p1', undefined)).toEqual({
      ok: false,
      reason: 'must_counter_pick',
    });
    expect(validatePlay(hand, 'x', state, 'p1', undefined)).toEqual({ ok: true });
  });

  it('requires last-card announce and allows final whot win after announce', () => {
    const whotOnly = [card('w', 'whot', 20, true)];
    const s1 = baseState({ lastCardAnnounced: [] });
    expect(validatePlay(whotOnly, 'w', s1, 'p1', 'star')).toEqual({
      ok: false,
      reason: 'must_announce_last_card',
    });

    const s2 = baseState({ lastCardAnnounced: ['p1'] });
    expect(validatePlay(whotOnly, 'w', s2, 'p1', 'star')).toEqual({ ok: true });
  });
});

describe('whotEngine transitions', () => {
  it('stacks pick-two across players and shifts turn to next defender', () => {
    const state = baseState();
    const hand = [card('x', 'circle', 2), card('y', 'star', 9)];
    const played = applyPlay(state, hand, 'x', undefined);
    expect(played.state.pendingDrawCount).toBe(2);
    expect(played.state.pendingDrawRank).toBe('2');
    expect(played.state.currentPlayerId).toBe('p2');
  });

  it('defender may counter with same rank or must draw stack', () => {
    const state = baseState({
      currentPlayerIndex: 1,
      currentPlayerId: 'p2',
      pendingDrawCount: 4,
      pendingDrawRank: '2',
    });
    const hand = [card('bad', 'circle', 7), card('good', 'square', 2)];
    expect(validatePlay(hand, 'bad', state, 'p2', undefined)).toEqual({
      ok: false,
      reason: 'must_counter_pick',
    });
    expect(validatePlay(hand, 'good', state, 'p2', undefined)).toEqual({ ok: true });

    const draw = applyDraw(state);
    expect(draw.drawCount).toBe(4);
    expect(draw.state.pendingDrawCount).toBe(0);
    expect(draw.state.pendingDrawRank).toBeNull();
    expect(draw.state.currentPlayerId).toBe('p3');
  });

  it('general market makes every other player draw one and keeps turn with actor', () => {
    const state = baseState();
    const hand = [card('gm', 'circle', 14), card('gm2', 'square', 14), card('n', 'circle', 4)];
    const played = applyPlay(state, hand, 'gm', undefined);
    expect(played.draws).toEqual([
      { seatId: 'p2', count: 1 },
      { seatId: 'p3', count: 1 },
    ]);
    expect(played.state.currentPlayerId).toBe('p1');

    const second = applyPlay(played.state, played.newHand, 'gm2', undefined);
    expect(second.draws).toEqual([
      { seatId: 'p2', count: 1 },
      { seatId: 'p3', count: 1 },
    ]);
    expect(second.state.currentPlayerId).toBe('p1');
  });

  it('forces suit call after whot and advances turn after call', () => {
    const state = baseState();
    const hand = [card('w', 'whot', 20, true), card('n', 'circle', 4)];
    const played = applyPlay(state, hand, 'w', undefined);
    expect(played.state.mustCallSuit).toBe(true);
    expect(played.state.currentPlayerId).toBe('p1');

    const called = applyCallSuit(played.state, 'star');
    if (!called.ok) throw new Error('expected call suit success');
    expect(called.state.mustCallSuit).toBe(false);
    expect(called.state.activeShape).toBe('star');
    expect(called.state.currentPlayerId).toBe('p2');
  });

  it('star 8 skips two players', () => {
    const state = baseState({ currentPlayerIndex: 0, currentPlayerId: 'p1' });
    const hand = [card('s8', 'star', 8)];
    const played = applyPlay(state, hand, 's8', undefined);
    expect(played.state.currentPlayerId).toBe('p1'); // 3-player table: skip p2 and p3, back to p1
  });

  it('optional direction toggle reverses on pick two', () => {
    const state = baseState({ turnDirection: 1, currentPlayerIndex: 0, currentPlayerId: 'p1' });
    const hand = [card('x', 'circle', 2), card('y', 'circle', 9)];
    const played = applyPlay(state, hand, 'x', undefined, { reverseOnPickTwo: true });
    expect(played.state.turnDirection).toBe(-1);
    expect(played.state.currentPlayerId).toBe('p3');
  });

  it('announce_last_card marks player as announced', () => {
    const state = baseState();
    const hand = [card('z', 'circle', 9)];
    const result = applyAnnounceLastCard(state, hand, 'p1');
    if (!result.ok) throw new Error('expected announce success');
    expect(result.state.lastCardAnnounced).toContain('p1');
  });

  it('announce_semi_last_card marks player at hand size 2', () => {
    const state = baseState();
    const hand = [card('a', 'circle', 4), card('b', 'square', 9)];
    const result = applyAnnounceSemiLastCard(state, hand, 'p1');
    if (!result.ok) throw new Error('expected semi-last announce success');
    expect(result.state.semiLastCardAnnounced).toContain('p1');
  });
});

describe('whotEngine bot move', () => {
  it('bot chooses legal move only', () => {
    const state = baseState();
    const hand = [card('a', 'square', 4), card('b', 'circle', 9), card('c', 'circle', 10)];
    const move = pickWhotBotMove(hand, state);
    if (move.kind !== 'play') throw new Error('expected bot to play');
    const v = validatePlay(hand, move.cardId, state, 'p1', move.calledShape);
    expect(v.ok).toBe(true);
  });
});

