import { describe, expect, it } from 'vitest';
import {
  buildWhotDeck,
  createInitialWhotState,
  shuffleDeck,
  WHOT_INITIAL_HAND_SIZE,
} from '../../shared/src/games/whot';

describe('Whot deck', () => {
  it('builds an authentic 54-card Nigerian Whot deck', () => {
    const deck = buildWhotDeck();
    expect(deck).toHaveLength(54);

    const byShape = deck.reduce<Record<string, number>>((acc, c) => {
      acc[c.shape] = (acc[c.shape] ?? 0) + 1;
      return acc;
    }, {});
    expect(byShape).toEqual({
      circle: 12,
      triangle: 12,
      cross: 9,
      square: 9,
      star: 7,
      whot: 5,
    });

    // Whots are wildcards valued 20.
    const whots = deck.filter((c) => c.isWhot);
    expect(whots).toHaveLength(5);
    expect(whots.every((c) => c.value === 20 && c.shape === 'whot')).toBe(true);

    // Card ids unique.
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(54);
  });

  it('shuffleDeck is deterministic with a seed and preserves all cards', () => {
    const a = shuffleDeck(buildWhotDeck(), 1234);
    const b = shuffleDeck(buildWhotDeck(), 1234);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));

    const c = shuffleDeck(buildWhotDeck(), 999);
    expect(c.map((c) => c.id)).not.toEqual(a.map((c) => c.id));

    expect(a).toHaveLength(54);
    expect(new Set(a.map((c) => c.id)).size).toBe(54);
  });
});

describe('createInitialWhotState', () => {
  const players = [
    { id: 'p1', displayName: 'Ada' },
    { id: 'p2', displayName: 'Bode' },
    { id: 'p3', displayName: 'Cheta' },
  ];

  it('deals INITIAL_HAND_SIZE to each seat and flips a non-Whot top discard', () => {
    const init = createInitialWhotState({ players, seed: 42 });

    expect(init.publicState.players).toHaveLength(3);
    for (const p of players) {
      expect(init.privateHands[p.id]).toHaveLength(WHOT_INITIAL_HAND_SIZE);
    }

    expect(init.publicState.topDiscard).not.toBeNull();
    expect(init.publicState.topDiscard?.isWhot).toBe(false);
    expect(init.publicState.activeShape).toBe(init.publicState.topDiscard?.shape);
  });

  it('initial pointer + counts are coherent', () => {
    const init = createInitialWhotState({ players, seed: 7 });

    expect(init.publicState.phase).toBe('playing');
    expect(init.publicState.currentPlayerIndex).toBe(0);
    expect(init.publicState.currentPlayerId).toBe('p1');
    expect(init.publicState.turnNumber).toBe(1);
    expect(init.publicState.winnerId).toBeNull();

    // Total accounted-for cards = hands + discard + remaining draw pile = 54.
    const handTotal = players.reduce(
      (n, p) => n + (init.privateHands[p.id]?.length ?? 0),
      0,
    );
    const discardCount = init.publicState.topDiscard ? 1 : 0;
    expect(handTotal + discardCount + init.drawPile.length).toBe(54);

    expect(init.publicState.drawPileCount).toBe(init.drawPile.length);

    // Each player's reported handCount matches the dealt hand.
    for (const p of init.publicState.players) {
      expect(p.handCount).toBe(init.privateHands[p.id]?.length);
    }
  });

  it('respects deterministic seed', () => {
    const a = createInitialWhotState({ players, seed: 100 });
    const b = createInitialWhotState({ players, seed: 100 });
    expect(a.publicState.topDiscard?.id).toBe(b.publicState.topDiscard?.id);
    for (const p of players) {
      expect(a.privateHands[p.id].map((c) => c.id)).toEqual(
        b.privateHands[p.id].map((c) => c.id),
      );
    }
  });
});
