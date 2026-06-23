import { describe, expect, it, beforeEach } from 'vitest';
import {
  rememberHouseSession,
  getLastHouseSession,
  clearLastHouseSession,
} from '@/lib/houseSessionResume';

// Flow 2 (Resume previous session): the host device remembers its last house session.
describe('house session resume store', () => {
  beforeEach(() => clearLastHouseSession());

  it('returns null when nothing remembered', () => {
    expect(getLastHouseSession()).toBeNull();
  });

  it('remembers and recalls a session with timestamp', () => {
    rememberHouseSession({ code: 'ABCDE', packId: 'pack.naija' });
    const s = getLastHouseSession();
    expect(s?.code).toBe('ABCDE');
    expect(s?.packId).toBe('pack.naija');
    expect(s?.createdAt).toBeTruthy();
  });

  it('clears the remembered session', () => {
    rememberHouseSession({ code: 'ZZZZZ' });
    clearLastHouseSession();
    expect(getLastHouseSession()).toBeNull();
  });
});
