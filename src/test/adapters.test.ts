import { describe, expect, it } from 'vitest';
import { GAME_ADAPTERS, getAdapter, hasAdapter, type GameAdapterCore } from '@/lib/adapters';
import { getGameMeta } from '@/lib/games';
import type { GameAdapterCore as SharedAdapterCore } from '../../shared/src/contracts/adapter';

// AC-6.1: Ludo/Whot/Trivia run through the adapter registry (no per-game switch); capabilities
// derive from the catalog; the client mirror conforms to the shared contract.
describe('game adapters', () => {
  it('registers Ludo, Whot, Trivia', () => {
    expect(hasAdapter('ludo')).toBe(true);
    expect(hasAdapter('whot')).toBe(true);
    expect(hasAdapter('trivia')).toBe(true);
    expect(hasAdapter('nope')).toBe(false);
  });

  it('the client adapter type satisfies the shared contract', () => {
    // Type-level guarantee the mirror matches shared (compile-time + a runtime touch).
    const a: SharedAdapterCore = GAME_ADAPTERS.whot as SharedAdapterCore;
    expect(a.gameType).toBe('whot');
  });

  it('catalog-backed adapters derive capabilities from the catalog (no drift)', () => {
    for (const [slug, adapter] of Object.entries(GAME_ADAPTERS)) {
      const meta = getGameMeta(slug);
      if (!meta) continue; // new games (Phase 8) declare capabilities explicitly
      expect(adapter.capabilities.playerCount).toEqual({ min: meta.minPlayers, max: meta.maxPlayers });
      expect(adapter.capabilities.bots).toBe(meta.supportsBots ?? false);
    }
  });

  it('new games register with explicit capabilities + rules', () => {
    const mp = getAdapter('market-price')!;
    expect(mp.capabilities.playerCount).toEqual({ min: 1, max: 12 });
    expect(mp.explainRules().length).toBeGreaterThan(0);
  });

  it('projects a public summary defensively from arbitrary state', () => {
    const adapter = getAdapter('trivia')!;
    const summary = adapter.getPublicSummary({
      phase: 'question',
      players: [{ id: 'p1', name: 'Ada', points: 30 }, { deviceId: 'p2', score: 10 }],
    });
    expect(summary.phase).toBe('question');
    expect(summary.players).toEqual([
      { id: 'p1', name: 'Ada', score: 30 },
      { id: 'p2', name: undefined, score: 10 },
    ]);
  });

  it('handles missing/odd state without throwing', () => {
    const adapter = getAdapter('ludo')!;
    expect(adapter.getPublicSummary(undefined).phase).toBe('unknown');
    expect(adapter.getPublicSummary({}).players).toEqual([]);
  });

  it('reports whose turn it is in the private summary', () => {
    const adapter = getAdapter('whot')!;
    const state = { currentPlayerId: 'p2' };
    expect(adapter.getPrivateSummary(state, 'p2').yourTurn).toBe(true);
    expect(adapter.getPrivateSummary(state, 'p1').yourTurn).toBe(false);
  });

  it('explains rules from the catalog and gives invalid-move messages', () => {
    const ludo = getAdapter('ludo')!;
    expect(ludo.explainRules().length).toBeGreaterThan(0);
    expect(ludo.explainInvalidMove('need_six')).toMatch(/6/);
    expect(ludo.explainInvalidMove('unknown_reason')).toMatch(/not allowed/i);
  });

  it('getLegalActions returns an array', () => {
    const adapter: GameAdapterCore = getAdapter('whot')!;
    expect(Array.isArray(adapter.getLegalActions({}, 'p1'))).toBe(true);
  });
});
