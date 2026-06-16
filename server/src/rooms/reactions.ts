// Reaction subsystem extracted from LudoRoom.
// Owns the per-user enforcement state, moment dedup set, and the "process a
// send_reaction intent" flow. LudoRoom delegates here so the room file stays
// focused on lifecycle + game rules.
//
// All Colyseus-specific I/O (broadcast / client.send) is performed by the
// caller via the small Bridge interface — keeps this module unit-testable
// without spinning up a Room.

import {
  PublicRoomState,
  ReactionRejectReason,
  ServerEvent,
} from '../../../shared/src/contracts/index.js';
import {
  PerUserReactionState,
  commitReaction,
  createPerUserState,
  detectMoment,
  evaluateReaction,
  recordAccepted,
  recordRejected,
} from '../../../shared/src/reactions/policy.js';

const MAX_MOMENTS_KEPT = 12;

export interface ReactionBridge {
  /** Send an event back to the originating client only. */
  sendToClient: (sessionId: string, evt: ServerEvent) => void;
  /** Broadcast public state to everyone in the room. */
  broadcastPublic: () => void;
}

export class ReactionSubsystem {
  private readonly stateByUser = new Map<string, PerUserReactionState>();
  private readonly seenMomentIds = new Set<string>();

  constructor(private readonly bridge: ReactionBridge) {}

  /**
   * Process a `send_reaction` intent. Mutates `publicState` in place when
   * accepted (push to buffer + maybe push moment) and notifies the sender.
   */
  handleSendReaction(
    publicState: PublicRoomState,
    sessionId: string,
    deviceId: string,
    emoji: string,
    clientNonce: string | undefined,
    now: number = Date.now(),
  ): void {
    let perUser = this.stateByUser.get(deviceId);
    if (!perUser) {
      perUser = createPerUserState();
      this.stateByUser.set(deviceId, perUser);
    }

    const verdict = evaluateReaction(
      perUser,
      emoji,
      now,
      publicState.reactionPolicy,
      publicState.tauntPolicy,
    );

    if (!verdict.ok) {
      const reason = verdict.reason as ReactionRejectReason;
      recordRejected(publicState.reactionStats, reason);
      this.bridge.sendToClient(sessionId, {
        type: 'reaction_rejected',
        reason,
        emoji,
        clientNonce,
        retryAfterMs: verdict.retryAfterMs,
      });
      // Broadcast so host stats reflect the rejection live.
      this.bridge.broadcastPublic();
      return;
    }

    commitReaction(perUser, emoji, now, publicState.reactionPolicy);
    recordAccepted(publicState.reactionStats, deviceId);

    publicState.reactions.push({ playerId: deviceId, emoji, timestamp: now });
    const cap = Math.max(8, publicState.reactionPolicy.maxBufferedReactions);
    if (publicState.reactions.length > cap) {
      publicState.reactions = publicState.reactions.slice(-cap);
    }

    const moment = detectMoment(publicState.reactions, now);
    if (moment && !this.seenMomentIds.has(moment.id)) {
      this.seenMomentIds.add(moment.id);
      publicState.reactionMoments.push(moment);
      if (publicState.reactionMoments.length > MAX_MOMENTS_KEPT) {
        publicState.reactionMoments = publicState.reactionMoments.slice(-MAX_MOMENTS_KEPT);
      }
    }

    this.bridge.sendToClient(sessionId, {
      type: 'reaction_accepted',
      emoji,
      timestamp: now,
      clientNonce,
    });
    this.bridge.broadcastPublic();
  }

  /**
   * Host moderation: clear all current reactions/moments. Per-user cooldown
   * state is intentionally preserved so a clear isn't a back-door to bypass
   * the burst cap.
   */
  clearAll(publicState: PublicRoomState): void {
    publicState.reactions = [];
    publicState.reactionMoments = [];
    this.seenMomentIds.clear();
  }
}
