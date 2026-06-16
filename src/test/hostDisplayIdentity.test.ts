import { beforeEach, describe, expect, it } from 'vitest';
import { ensureHostDisplayId } from '@/lib/roomUtils';

describe('host display identity', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persists display identity in localStorage so refreshes keep history continuity', () => {
    const first = ensureHostDisplayId();
    const second = ensureHostDisplayId();
    expect(second).toBe(first);
    expect(localStorage.getItem('boredroom_host_display_id')).toBe(first);
  });

  it('migrates an existing session display id without changing it', () => {
    sessionStorage.setItem('boredroom_host_display_id', 'session-display');
    expect(ensureHostDisplayId()).toBe('session-display');
    expect(localStorage.getItem('boredroom_host_display_id')).toBe('session-display');
  });
});
