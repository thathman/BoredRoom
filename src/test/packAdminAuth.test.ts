import { describe, expect, it } from 'vitest';
import {
  clearPackAdminCookie,
  consumeLoginAttempt,
  isAllowedPackAdminOrigin,
  issuePackAdminSession,
  packAdminCookie,
  PACK_ADMIN_COOKIE,
  PACK_ADMIN_TTL_MS,
  readCookie,
  verifyPackAdminPassphrase,
  verifyPackAdminSession,
} from '../../server/src/packAdminAuth';

describe('pack admin authentication', () => {
  const secret = 'correct-horse-battery-staple';

  it('uses timing-safe passphrase verification', () => {
    expect(verifyPackAdminPassphrase(secret, secret)).toBe(true);
    expect(verifyPackAdminPassphrase('wrong', secret)).toBe(false);
    expect(verifyPackAdminPassphrase(secret, undefined)).toBe(false);
  });

  it('issues an expiring signed session and rejects alteration', () => {
    const now = 1_000;
    const token = issuePackAdminSession(secret, now);
    expect(verifyPackAdminSession(token, secret, now + PACK_ADMIN_TTL_MS - 1)).toBe(true);
    expect(verifyPackAdminSession(token, secret, now + PACK_ADMIN_TTL_MS)).toBe(false);
    expect(verifyPackAdminSession(`${token}x`, secret, now)).toBe(false);
    expect(verifyPackAdminSession(token, 'different-secret', now)).toBe(false);
  });

  it('emits hardened cookie headers and parses cookies', () => {
    const token = issuePackAdminSession(secret);
    const header = packAdminCookie(token);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Strict');
    expect(readCookie(`${PACK_ADMIN_COOKIE}=${encodeURIComponent(token)}; other=1`, PACK_ADMIN_COOKIE)).toBe(token);
    expect(clearPackAdminCookie()).toContain('Max-Age=0');
  });

  it('rate limits repeated login attempts', () => {
    const key = `test-${Math.random()}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(consumeLoginAttempt(key, 1_000).allowed).toBe(true);
    }
    expect(consumeLoginAttempt(key, 1_000).allowed).toBe(false);
    expect(consumeLoginAttempt(key, 1_000 + 15 * 60 * 1000).allowed).toBe(true);
  });

  it('allows production and local origins while rejecting foreign origins', () => {
    expect(isAllowedPackAdminOrigin('https://party.hendrix.com.ng')).toBe(true);
    expect(isAllowedPackAdminOrigin('http://127.0.0.1:8080')).toBe(true);
    expect(isAllowedPackAdminOrigin('https://evil.example')).toBe(false);
    expect(isAllowedPackAdminOrigin(undefined)).toBe(true);
  });
});
