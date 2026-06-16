// Pure helpers for reactions UX polish. No backend contract changes —
// derives combo bursts and a rolling "top hype" emoji purely from the
// existing reactions array kept on RoomState.

export interface ReactionItem {
  playerId: string;
  emoji: string;
  timestamp: number;
}

export interface ComboGroup {
  emoji: string;
  count: number;
  /** timestamp of the most recent reaction in the group */
  lastTimestamp: number;
  /** ids contributing to this group (order: oldest → newest) */
  timestamps: number[];
}

export interface BucketResult {
  /** Combo groups within COMBO_WINDOW_MS where count >= COMBO_THRESHOLD. */
  combos: ComboGroup[];
  /** Single-shot reactions outside any combo, newest first. */
  singles: ReactionItem[];
  /** Top-hype info from the trailing HYPE_WINDOW_MS, if it crosses HYPE_THRESHOLD. */
  hype: { emoji: string; count: number } | null;
}

export const COMBO_WINDOW_MS = 1500;
export const COMBO_THRESHOLD = 3;
export const HYPE_WINDOW_MS = 10_000;
export const HYPE_THRESHOLD = 5;

/**
 * Bucket reactions into combos + singles + an optional top-hype emoji.
 * Pure: takes the full reaction list and a "now" timestamp.
 */
export function bucketReactions(reactions: ReactionItem[], now: number): BucketResult {
  if (reactions.length === 0) {
    return { combos: [], singles: [], hype: null };
  }

  // Sort ascending by timestamp (defensive — may already be sorted).
  const sorted = [...reactions].sort((a, b) => a.timestamp - b.timestamp);

  // Combo bucketing within COMBO_WINDOW_MS, per emoji.
  // Walk the list; for each emoji track its "open" group and close when the gap exceeds the window.
  const open = new Map<string, ComboGroup>();
  const closed: ComboGroup[] = [];
  const singleCandidates: ReactionItem[] = [];

  for (const r of sorted) {
    const cur = open.get(r.emoji);
    if (cur && r.timestamp - cur.lastTimestamp <= COMBO_WINDOW_MS) {
      cur.count += 1;
      cur.lastTimestamp = r.timestamp;
      cur.timestamps.push(r.timestamp);
    } else {
      if (cur) closed.push(cur);
      open.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        lastTimestamp: r.timestamp,
        timestamps: [r.timestamp],
      });
    }
  }
  for (const g of open.values()) closed.push(g);

  const combos: ComboGroup[] = [];
  for (const g of closed) {
    if (g.count >= COMBO_THRESHOLD) {
      combos.push(g);
    } else {
      // Members of non-combo groups become singles.
      for (const ts of g.timestamps) {
        const match = sorted.find(r => r.emoji === g.emoji && r.timestamp === ts);
        if (match) singleCandidates.push(match);
      }
    }
  }

  // Sort combos by recency (newest last bubble first feels right for overlay layering).
  combos.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  // Singles newest-first.
  singleCandidates.sort((a, b) => b.timestamp - a.timestamp);

  // Top-hype: most-frequent emoji in trailing HYPE_WINDOW_MS.
  const cutoff = now - HYPE_WINDOW_MS;
  const counts = new Map<string, number>();
  for (const r of sorted) {
    if (r.timestamp >= cutoff) {
      counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    }
  }
  let hype: { emoji: string; count: number } | null = null;
  for (const [emoji, count] of counts.entries()) {
    if (count >= HYPE_THRESHOLD && (!hype || count > hype.count)) {
      hype = { emoji, count };
    }
  }

  return { combos, singles: singleCandidates, hype };
}

// ---------- Controller-side cooldown helpers ----------

export const COOLDOWN_MS = 800;
export const SOFT_CAP_COUNT = 4;
export const SOFT_CAP_WINDOW_MS = 3000;

export function isOnCooldown(lastSentAt: number | undefined, now: number): boolean {
  if (!lastSentAt) return false;
  return now - lastSentAt < COOLDOWN_MS;
}

export function isSoftCapped(recentSends: number[], now: number): boolean {
  const cutoff = now - SOFT_CAP_WINDOW_MS;
  return recentSends.filter(t => t >= cutoff).length >= SOFT_CAP_COUNT;
}
