import { describe, it, expect } from 'vitest';
import {
  canTransitionCanonicalPhase,
  CANONICAL_PHASE_TRANSITIONS,
} from '../../shared/src/contracts/index';

describe('CanonicalGamePhase', () => {
  it('allows lobby -> game_intro -> round_active -> round_resolution -> game_over', () => {
    expect(canTransitionCanonicalPhase('lobby', 'game_intro')).toBe(true);
    expect(canTransitionCanonicalPhase('game_intro', 'round_active')).toBe(true);
    expect(canTransitionCanonicalPhase('round_active', 'round_resolution')).toBe(true);
    expect(canTransitionCanonicalPhase('round_resolution', 'round_active')).toBe(true);
    expect(canTransitionCanonicalPhase('round_resolution', 'game_over')).toBe(true);
  });

  it('allows game_over -> lobby for rematch', () => {
    expect(canTransitionCanonicalPhase('game_over', 'lobby')).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(canTransitionCanonicalPhase('lobby', 'round_active')).toBe(false);
    expect(canTransitionCanonicalPhase('lobby', 'game_over')).toBe(false);
    expect(canTransitionCanonicalPhase('game_over', 'round_active')).toBe(false);
  });

  it('treats same-phase as legal (no-op)', () => {
    for (const phase of Object.keys(CANONICAL_PHASE_TRANSITIONS) as Array<
      keyof typeof CANONICAL_PHASE_TRANSITIONS
    >) {
      expect(canTransitionCanonicalPhase(phase, phase)).toBe(true);
    }
  });
});
