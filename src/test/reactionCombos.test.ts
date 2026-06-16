import { describe, it, expect } from 'vitest';
import {
  bucketReactions,
  isOnCooldown,
  isSoftCapped,
  COOLDOWN_MS,
  SOFT_CAP_WINDOW_MS,
} from '@/lib/reactionFeed';

const r = (emoji: string, timestamp: number, playerId = 'p1') => ({ emoji, timestamp, playerId });

describe('bucketReactions', () => {
  it('returns empty result for no reactions', () => {
    const out = bucketReactions([], 0);
    expect(out.combos).toEqual([]);
    expect(out.singles).toEqual([]);
    expect(out.hype).toBeNull();
  });

  it('groups 3 same-emoji reactions within window into a combo', () => {
    const out = bucketReactions([r('🔥', 0), r('🔥', 500), r('🔥', 1000)], 1100);
    expect(out.combos.length).toBe(1);
    expect(out.combos[0].emoji).toBe('🔥');
    expect(out.combos[0].count).toBe(3);
    expect(out.singles.length).toBe(0);
  });

  it('keeps a single-shot reaction as a single (not a combo)', () => {
    const out = bucketReactions([r('😂', 0)], 100);
    expect(out.combos.length).toBe(0);
    expect(out.singles.length).toBe(1);
    expect(out.singles[0].emoji).toBe('😂');
  });

  it('does not combo when reactions are spaced beyond window', () => {
    const out = bucketReactions([r('🔥', 0), r('🔥', 2000), r('🔥', 4000)], 4100);
    expect(out.combos.length).toBe(0);
    expect(out.singles.length).toBe(3);
  });

  it('flags hype when a single emoji crosses threshold within 10s', () => {
    const reactions = [0, 1000, 2000, 3000, 4000, 5000].map(t => r('😂', t));
    const out = bucketReactions(reactions, 5500);
    expect(out.hype).not.toBeNull();
    expect(out.hype?.emoji).toBe('😂');
    expect(out.hype?.count).toBeGreaterThanOrEqual(5);
  });

  it('does not flag hype when below threshold', () => {
    const out = bucketReactions([r('😂', 0), r('😂', 1000)], 1500);
    expect(out.hype).toBeNull();
  });
});

describe('cooldown helpers', () => {
  it('isOnCooldown true within COOLDOWN_MS', () => {
    expect(isOnCooldown(1000, 1000 + COOLDOWN_MS - 1)).toBe(true);
  });

  it('isOnCooldown false after COOLDOWN_MS', () => {
    expect(isOnCooldown(1000, 1000 + COOLDOWN_MS + 1)).toBe(false);
  });

  it('isOnCooldown false when never sent', () => {
    expect(isOnCooldown(undefined, 1000)).toBe(false);
  });

  it('isSoftCapped true when 4+ within window', () => {
    const now = 5000;
    const sends = [now - 100, now - 500, now - 1000, now - 1500];
    expect(isSoftCapped(sends, now)).toBe(true);
  });

  it('isSoftCapped false when sends fall outside window', () => {
    const now = 5000;
    const sends = [now - SOFT_CAP_WINDOW_MS - 1, now - 100];
    expect(isSoftCapped(sends, now)).toBe(false);
  });
});
