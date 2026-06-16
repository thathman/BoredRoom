// Shared room helpers — canonical phase projection + transition guard.
// Imported by every game room. Keep tiny and dependency-free.

import {
  CanonicalGamePhase,
  canTransitionCanonicalPhase,
  PublicRoomState,
} from '../../../shared/src/contracts/index.js';
import { log } from '../logger.js';

/**
 * Apply a canonical phase transition with guard. Logs (does not throw) on
 * illegal transitions to avoid bricking a live room — the per-game phase
 * remains authoritative for game logic.
 */
export function setCanonicalPhase(
  pub: PublicRoomState,
  next: CanonicalGamePhase,
): void {
  const current = pub.canonicalPhase ?? 'lobby';
  if (!canTransitionCanonicalPhase(current, next)) {
    log('warn', 'canonical_phase_illegal_transition', {
      room: pub.code,
      from: current,
      to: next,
    });
  }
  pub.canonicalPhase = next;
}

/**
 * Default projection from PublicRoomState.status to canonical phase. Rooms
 * with richer per-phase information should call setCanonicalPhase directly.
 */
export function projectCanonicalPhaseFromStatus(pub: PublicRoomState): CanonicalGamePhase {
  if (pub.status === 'lobby') return 'lobby';
  if (pub.status === 'finished') return 'game_over';
  return 'round_active';
}
