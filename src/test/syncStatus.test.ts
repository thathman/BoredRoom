import { describe, it, expect } from 'vitest';
import { deriveSyncStatus } from '@/lib/syncStatus';

describe('deriveSyncStatus', () => {
  it('returns connecting before subscribe', () => {
    expect(
      deriveSyncStatus({ subscribed: false, hasAuthoritativeState: false, wasReady: false }),
    ).toBe('connecting');
  });

  it('returns syncing after subscribe but before authoritative state', () => {
    expect(
      deriveSyncStatus({ subscribed: true, hasAuthoritativeState: false, wasReady: false }),
    ).toBe('syncing');
  });

  it('returns ready when subscribed and state present', () => {
    expect(
      deriveSyncStatus({ subscribed: true, hasAuthoritativeState: true, wasReady: false }),
    ).toBe('ready');
  });

  it('returns reconnecting when wasReady and lastError present', () => {
    expect(
      deriveSyncStatus({
        subscribed: false,
        hasAuthoritativeState: true,
        wasReady: true,
        lastError: 'CHANNEL_ERROR',
      }),
    ).toBe('reconnecting');
  });

  it('returns reconnecting when wasReady but state cleared after subscribe', () => {
    expect(
      deriveSyncStatus({ subscribed: true, hasAuthoritativeState: false, wasReady: true }),
    ).toBe('reconnecting');
  });

  it('does not flip to reconnecting before first ready', () => {
    expect(
      deriveSyncStatus({
        subscribed: true,
        hasAuthoritativeState: false,
        wasReady: false,
        lastError: 'TIMED_OUT',
      }),
    ).toBe('syncing');
  });
});
