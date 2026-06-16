// Reaction policy enforcement tests — pure (no Colyseus / no DOM needed).
// Targets shared/src/reactions/policy.ts.

import { describe, it, expect } from 'vitest';
import {
  commitReaction,
  createPerUserState,
  createReactionStats,
  detectMoment,
  evaluateReaction,
  recordAccepted,
  recordRejected,
} from '../../shared/src/reactions/policy';
import {
  DEFAULT_REACTION_POLICY,
  DEFAULT_TAUNT_POLICY,
} from '../../shared/src/contracts';

const POLICY = { ...DEFAULT_REACTION_POLICY };
const TAUNT_OFF = { enabled: false };
const TAUNT_ON = { ...DEFAULT_TAUNT_POLICY };

describe('reaction policy enforcement', () => {
  it('accepts the first reaction', () => {
    const s = createPerUserState();
    const v = evaluateReaction(s, '🔥', 1000, POLICY, TAUNT_ON);
    expect(v.ok).toBe(true);
  });

  it('rejects with cooldown when too soon', () => {
    const s = createPerUserState();
    commitReaction(s, '🔥', 1000, POLICY);
    const v = evaluateReaction(s, '😂', 1000 + 100, POLICY, TAUNT_ON);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('cooldown');
    expect(v.retryAfterMs).toBeGreaterThan(0);
  });

  it('rejects duplicate emoji within duplicateWindowMs', () => {
    const s = createPerUserState();
    // Use a custom policy where duplicate window is comfortably > cooldown so
    // we can exercise the duplicate path independently of cooldown.
    const policy = { ...POLICY, cooldownMs: 100, duplicateWindowMs: 1500 };
    commitReaction(s, '🔥', 1000, policy);
    const t = 1000 + 200; // past cooldown, well inside duplicate window
    const v = evaluateReaction(s, '🔥', t, policy, TAUNT_ON);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('duplicate');
  });

  it('rejects with rate_limited once burst window cap is hit', () => {
    const s = createPerUserState();
    // Tight policy: small cooldown so we can pack burstMax accepts inside the
    // burst window, then verify the next one is rate_limited.
    const policy = {
      ...POLICY,
      cooldownMs: 50,
      duplicateWindowMs: 0,
      burstMax: 4,
      burstWindowMs: 1000,
    };
    let now = 0;
    const emojis = ['🔥', '😂', '😱', '👏'];
    for (let i = 0; i < policy.burstMax; i++) {
      now += policy.cooldownMs + 10;
      const v = evaluateReaction(s, emojis[i], now, policy, TAUNT_ON);
      expect(v.ok).toBe(true);
      commitReaction(s, emojis[i], now, policy);
    }
    now += policy.cooldownMs + 10;
    const v = evaluateReaction(s, '🆕', now, policy, TAUNT_ON);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('rate_limited');
  });

  it('rejects all reactions when policy.enabled=false', () => {
    const s = createPerUserState();
    const v = evaluateReaction(s, '🔥', 1000, { ...POLICY, enabled: false }, TAUNT_ON);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('disabled');
  });

  it('rejects taunts (long strings) when tauntPolicy is off', () => {
    const s = createPerUserState();
    const v = evaluateReaction(s, 'Easy!', 1000, POLICY, TAUNT_OFF);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('disabled');
  });

  it('allows short emoji even when taunts are off', () => {
    const s = createPerUserState();
    const v = evaluateReaction(s, '🔥', 1000, POLICY, TAUNT_OFF);
    expect(v.ok).toBe(true);
  });
});

describe('reaction stats', () => {
  it('records accepted and rejected counters', () => {
    const stats = createReactionStats();
    recordAccepted(stats, 'dev-A');
    recordAccepted(stats, 'dev-A');
    recordAccepted(stats, 'dev-B');
    recordRejected(stats, 'cooldown');
    recordRejected(stats, 'duplicate');
    expect(stats.totalAccepted).toBe(3);
    expect(stats.perUserAccepted['dev-A']).toBe(2);
    expect(stats.perUserAccepted['dev-B']).toBe(1);
    expect(stats.rejected.cooldown).toBe(1);
    expect(stats.rejected.duplicate).toBe(1);
    expect(stats.rejected.rate_limited).toBe(0);
  });
});

describe('moment detection', () => {
  it('detects ≥3 of same emoji within window', () => {
    const now = 10_000;
    const m = detectMoment(
      [
        { emoji: '🔥', timestamp: now - 1000 },
        { emoji: '🔥', timestamp: now - 600 },
        { emoji: '🔥', timestamp: now - 100 },
        { emoji: '😂', timestamp: now - 50 },
      ],
      now,
    );
    expect(m).not.toBeNull();
    expect(m!.emoji).toBe('🔥');
    expect(m!.count).toBe(3);
    expect(m!.id.startsWith('🔥:')).toBe(true);
  });

  it('returns null when no emoji crosses the threshold', () => {
    const now = 10_000;
    const m = detectMoment(
      [
        { emoji: '🔥', timestamp: now - 100 },
        { emoji: '😂', timestamp: now - 50 },
      ],
      now,
    );
    expect(m).toBeNull();
  });
});
