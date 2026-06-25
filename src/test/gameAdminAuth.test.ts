import { describe, expect, it } from 'vitest';
import {
  issueGameAdminSession,
  verifyGameAdminPassphrase,
  verifyGameAdminSession,
} from '../../server/src/gameAdminAuth';

describe('game owner authentication', () => {
  it('uses timing-safe passphrase and expiring signed sessions', () => {
    const secret = 'long-owner-secret';
    expect(verifyGameAdminPassphrase(secret, secret)).toBe(true);
    expect(verifyGameAdminPassphrase('wrong', secret)).toBe(false);
    const token = issueGameAdminSession(secret, 1000);
    expect(verifyGameAdminSession(token, secret, 1001)).toBe(true);
    expect(verifyGameAdminSession(token, 'wrong', 1001)).toBe(false);
    expect(verifyGameAdminSession(token, secret, 1000 + 8 * 60 * 60 * 1000 + 1)).toBe(false);
  });
});
