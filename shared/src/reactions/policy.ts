// Server-side reaction policy enforcement (pure functions, easy to unit test).
// This module is consumed by the Colyseus LudoRoom but stays free of Colyseus
// imports so it can be reused / tested in isolation.

import {
  DEFAULT_REACTION_POLICY,
  DEFAULT_TAUNT_POLICY,
  ReactionMoment,
  ReactionPolicy,
  ReactionRejectReason,
  ReactionStats,
  TauntPolicy,
} from '../contracts/index.js';

export interface PerUserReactionState {
  /** Sorted asc timestamps of accepted reactions in the burst window. */
  recent: number[];
  /** Last accepted timestamp per emoji, used for duplicate suppression. */
  lastByEmoji: Map<string, number>;
  /** Last accepted timestamp regardless of emoji. */
  lastAny: number;
}

export interface ReactionEvaluation {
  ok: boolean;
  reason?: ReactionRejectReason;
  retryAfterMs?: number;
}

export function createPerUserState(): PerUserReactionState {
  return { recent: [], lastByEmoji: new Map(), lastAny: 0 };
}

export function createReactionStats(): ReactionStats {
  return {
    totalAccepted: 0,
    rejected: { cooldown: 0, rate_limited: 0, disabled: 0, duplicate: 0 },
    perUserAccepted: {},
  };
}

/**
 * Heuristic taunt detection — anything that's not a 1–2 char emoji counts.
 * (Mirrors the controller's "long string == taunt" assumption.)
 */
export function isTaunt(emoji: string): boolean {
  return emoji.trim().length > 3;
}

export function evaluateReaction(
  state: PerUserReactionState,
  emoji: string,
  now: number,
  policy: ReactionPolicy,
  tauntPolicy: TauntPolicy,
): ReactionEvaluation {
  if (!policy.enabled) return { ok: false, reason: 'disabled' };
  if (isTaunt(emoji) && !tauntPolicy.enabled) return { ok: false, reason: 'disabled' };

  const sinceLast = now - state.lastAny;
  if (state.lastAny > 0 && sinceLast < policy.cooldownMs) {
    return { ok: false, reason: 'cooldown', retryAfterMs: policy.cooldownMs - sinceLast };
  }

  const lastSameEmoji = state.lastByEmoji.get(emoji) ?? 0;
  if (lastSameEmoji > 0 && now - lastSameEmoji < policy.duplicateWindowMs) {
    return {
      ok: false,
      reason: 'duplicate',
      retryAfterMs: policy.duplicateWindowMs - (now - lastSameEmoji),
    };
  }

  const burstCutoff = now - policy.burstWindowMs;
  const recentInWindow = state.recent.filter((t) => t >= burstCutoff);
  if (recentInWindow.length >= policy.burstMax) {
    const oldest = recentInWindow[0];
    return {
      ok: false,
      reason: 'rate_limited',
      retryAfterMs: Math.max(0, policy.burstWindowMs - (now - oldest)),
    };
  }

  return { ok: true };
}

export function commitReaction(
  state: PerUserReactionState,
  emoji: string,
  now: number,
  policy: ReactionPolicy,
): void {
  state.recent.push(now);
  // Trim to burst window so memory stays bounded.
  const cutoff = now - policy.burstWindowMs;
  while (state.recent.length > 0 && state.recent[0] < cutoff) state.recent.shift();
  state.lastByEmoji.set(emoji, now);
  state.lastAny = now;
}

export function recordRejected(stats: ReactionStats, reason: ReactionRejectReason): void {
  stats.rejected[reason] = (stats.rejected[reason] ?? 0) + 1;
}

export function recordAccepted(stats: ReactionStats, deviceId: string): void {
  stats.totalAccepted += 1;
  stats.perUserAccepted[deviceId] = (stats.perUserAccepted[deviceId] ?? 0) + 1;
}

/**
 * Detect a "moment": ≥3 of the same emoji within 1500ms of `now` across the
 * full reaction buffer. Returns a stable id keyed by emoji + windowStart so
 * callers can dedupe.
 */
export function detectMoment(
  reactions: { emoji: string; timestamp: number }[],
  now: number,
  windowMs = 1500,
  threshold = 3,
): ReactionMoment | null {
  const cutoff = now - windowMs;
  const counts = new Map<string, { count: number; first: number; last: number }>();
  for (const r of reactions) {
    if (r.timestamp < cutoff) continue;
    const cur = counts.get(r.emoji);
    if (!cur) {
      counts.set(r.emoji, { count: 1, first: r.timestamp, last: r.timestamp });
    } else {
      cur.count += 1;
      cur.last = Math.max(cur.last, r.timestamp);
      cur.first = Math.min(cur.first, r.timestamp);
    }
  }
  let best: ReactionMoment | null = null;
  for (const [emoji, info] of counts.entries()) {
    if (info.count < threshold) continue;
    if (!best || info.count > best.count) {
      best = {
        id: `${emoji}:${info.first}`,
        emoji,
        count: info.count,
        windowStart: info.first,
        windowEnd: info.last,
      };
    }
  }
  return best;
}

export const SERVER_DEFAULTS = {
  reaction: DEFAULT_REACTION_POLICY,
  taunt: DEFAULT_TAUNT_POLICY,
};
