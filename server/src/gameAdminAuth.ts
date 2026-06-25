import { createHmac, timingSafeEqual } from 'crypto';

export const GAME_ADMIN_COOKIE = 'boredroom_game_admin';
export const GAME_ADMIN_TTL_MS = 8 * 60 * 60 * 1000;

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 5;

interface LoginWindow {
  count: number;
  resetAt: number;
}

const loginWindows = new Map<string, LoginWindow>();

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function verifyGameAdminPassphrase(passphrase: string, secret: string | undefined): boolean {
  return Boolean(secret && passphrase && safeEqual(passphrase, secret));
}

export function issueGameAdminSession(secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + GAME_ADMIN_TTL_MS })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyGameAdminSession(
  token: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!token || !secret) return false;
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra || !safeEqual(suppliedSignature, signature(payload, secret))) {
    return false;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof parsed.exp === 'number' && parsed.exp > now;
  } catch {
    return false;
  }
}

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

export function gameAdminCookie(token: string): string {
  return `${GAME_ADMIN_COOKIE}=${encodeURIComponent(token)}; Max-Age=${GAME_ADMIN_TTL_MS / 1000}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function clearGameAdminCookie(): string {
  return `${GAME_ADMIN_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function consumeLoginAttempt(
  key: string,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const current = loginWindows.get(key);
  const window = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + LOGIN_WINDOW_MS }
    : current;
  window.count += 1;
  loginWindows.set(key, window);
  return {
    allowed: window.count <= LOGIN_ATTEMPT_LIMIT,
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  };
}

export function clearLoginAttempts(key: string): void {
  loginWindows.delete(key);
}

export function isAllowedGameAdminOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const configured = (process.env.GAME_ADMIN_ORIGINS ?? 'https://party.hendrix.com.ng')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
