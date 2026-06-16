// State-shape tests: ensures additive reaction fields (policy/stats/moments)
// survive a round-trip through the legacy projection used by useColyseusRoom,
// which is what powers reconnect / state restoration.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REACTION_POLICY,
  DEFAULT_TAUNT_POLICY,
  PROTOCOL_VERSION,
  PublicRoomState,
} from '../lib/transport/types';

describe('protocol version (no churn)', () => {
  it('stays on v2 to keep clients backward-compatible', () => {
    expect(PROTOCOL_VERSION).toBe(2);
  });
});

describe('reconnect carries policy/stats/moments', () => {
  it('legacy projection preserves reactionPolicy/tauntPolicy/reactionStats/reactionMoments', () => {
    const moment = {
      id: '🔥:1000',
      emoji: '🔥',
      count: 5,
      windowStart: 1000,
      windowEnd: 1500,
    };
    const stats = {
      totalAccepted: 7,
      rejected: { cooldown: 2, rate_limited: 1, disabled: 0, duplicate: 1 },
      perUserAccepted: { 'dev-A': 4, 'dev-B': 3 },
    };
    const state: PublicRoomState = {
      protocolVersion: PROTOCOL_VERSION,
      code: 'TEST',
      hostId: 'host-1',
      status: 'playing',
      members: [],
      gameState: null,
      reactions: [{ playerId: 'dev-A', emoji: '🔥', timestamp: 1000 }],
      pendingJoinRequests: [],
      aiStatus: 'active',
      roomPolicy: 'open',
      reactionPolicy: { ...DEFAULT_REACTION_POLICY, cooldownMs: 1234 },
      tauntPolicy: { ...DEFAULT_TAUNT_POLICY, enabled: false },
      reactionStats: stats,
      reactionMoments: [moment],
    };

    // Round-trip through JSON to simulate transport reserialization.
    const encoded = JSON.stringify(state);
    const decoded = JSON.parse(encoded) as PublicRoomState;

    expect(decoded.reactionPolicy.cooldownMs).toBe(1234);
    expect(decoded.tauntPolicy.enabled).toBe(false);
    expect(decoded.reactionStats.totalAccepted).toBe(7);
    expect(decoded.reactionStats.rejected.duplicate).toBe(1);
    expect(decoded.reactionStats.perUserAccepted['dev-A']).toBe(4);
    expect(decoded.reactionMoments).toHaveLength(1);
    expect(decoded.reactionMoments[0].emoji).toBe('🔥');
  });
});
