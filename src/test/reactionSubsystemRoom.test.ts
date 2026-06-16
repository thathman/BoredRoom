// Integration-ish test for the server reaction subsystem (no Colyseus).
// We exercise ReactionSubsystem with a fake bridge and verify the full
// intent → ack → broadcast flow, including hype moment surfacing and
// host-side stat updates.

import { describe, it, expect } from 'vitest';
import { ReactionSubsystem } from '../../server/src/rooms/reactions';
import {
  DEFAULT_REACTION_POLICY,
  DEFAULT_TAUNT_POLICY,
  PROTOCOL_VERSION,
  PublicRoomState,
  ServerEvent,
} from '../../shared/src/contracts';
import { createReactionStats } from '../../shared/src/reactions/policy';

function makeState(): PublicRoomState {
  return {
    protocolVersion: PROTOCOL_VERSION,
    code: 'TEST',
    hostId: 'host-1',
    status: 'lobby',
    members: [],
    gameState: null,
    reactions: [],
    pendingJoinRequests: [],
    aiStatus: 'active',
    roomPolicy: 'open',
    reactionPolicy: { ...DEFAULT_REACTION_POLICY, cooldownMs: 50, duplicateWindowMs: 0 },
    tauntPolicy: { ...DEFAULT_TAUNT_POLICY },
    reactionStats: createReactionStats(),
    reactionMoments: [],
  };
}

function makeBridge() {
  const sent: { sessionId: string; evt: ServerEvent }[] = [];
  let broadcastCount = 0;
  return {
    sent,
    get broadcasts() {
      return broadcastCount;
    },
    bridge: {
      sendToClient: (sessionId: string, evt: ServerEvent) => {
        sent.push({ sessionId, evt });
      },
      broadcastPublic: () => {
        broadcastCount += 1;
      },
    },
  };
}

describe('ReactionSubsystem integration', () => {
  it('accepts a reaction, emits ack, and broadcasts state', () => {
    const state = makeState();
    const { bridge, sent } = makeBridge();
    const sub = new ReactionSubsystem(bridge);

    sub.handleSendReaction(state, 'sess-A', 'dev-A', '🔥', 'nonce-1', 1000);

    expect(state.reactions).toHaveLength(1);
    expect(state.reactionStats.totalAccepted).toBe(1);
    expect(state.reactionStats.perUserAccepted['dev-A']).toBe(1);

    const ack = sent.at(-1)!.evt;
    expect(ack.type).toBe('reaction_accepted');
  });

  it('rejects with cooldown reason and updates stats', () => {
    const state = makeState();
    state.reactionPolicy.cooldownMs = 500;
    const { bridge, sent } = makeBridge();
    const sub = new ReactionSubsystem(bridge);

    sub.handleSendReaction(state, 'sess-A', 'dev-A', '🔥', 'n1', 1000);
    sub.handleSendReaction(state, 'sess-A', 'dev-A', '😂', 'n2', 1100);

    const last = sent.at(-1)!.evt as Extract<ServerEvent, { type: 'reaction_rejected' }>;
    expect(last.type).toBe('reaction_rejected');
    expect(last.reason).toBe('cooldown');
    expect(last.retryAfterMs).toBeGreaterThan(0);
    expect(state.reactionStats.rejected.cooldown).toBe(1);
  });

  it('appends a hype moment when ≥3 same emoji land in window', () => {
    const state = makeState();
    state.reactionPolicy.cooldownMs = 10;
    state.reactionPolicy.duplicateWindowMs = 0;
    const { bridge } = makeBridge();
    const sub = new ReactionSubsystem(bridge);

    // 3 different users all firing 🔥 within window → triggers a moment.
    sub.handleSendReaction(state, 'sess-A', 'dev-A', '🔥', undefined, 5000);
    sub.handleSendReaction(state, 'sess-B', 'dev-B', '🔥', undefined, 5100);
    sub.handleSendReaction(state, 'sess-C', 'dev-C', '🔥', undefined, 5200);

    expect(state.reactionMoments.length).toBe(1);
    expect(state.reactionMoments[0].emoji).toBe('🔥');
    expect(state.reactionMoments[0].count).toBeGreaterThanOrEqual(3);
  });

  it('clearAll empties reactions/moments but keeps cooldown state', () => {
    const state = makeState();
    state.reactionPolicy.cooldownMs = 1000;
    const { bridge } = makeBridge();
    const sub = new ReactionSubsystem(bridge);

    sub.handleSendReaction(state, 'sess-A', 'dev-A', '🔥', undefined, 1000);
    expect(state.reactions.length).toBe(1);

    sub.clearAll(state);
    expect(state.reactions.length).toBe(0);
    expect(state.reactionMoments.length).toBe(0);

    // Cooldown should still apply — user can't bypass burst cap by clearing.
    sub.handleSendReaction(state, 'sess-A', 'dev-A', '😂', undefined, 1100);
    expect(state.reactions.length).toBe(0);
    expect(state.reactionStats.rejected.cooldown).toBe(1);
  });
});
