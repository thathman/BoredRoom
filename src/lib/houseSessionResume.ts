// Client-side memory of the host's last house session, for Flow 2 (Resume previous session).
// The server is the source of truth (selectResumableSession), but the host's own device remembers
// the last session it created so the landing page can offer a one-tap continue without a round-trip.

const KEY = 'boredroom_last_house_session';

export interface LastHouseSession {
  code: string;
  packId?: string;
  createdAt: string;
}

export function rememberHouseSession(s: { code: string; packId?: string }): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, createdAt: new Date().toISOString() }));
  } catch {
    /* storage unavailable — resume just won't be offered */
  }
}

export function getLastHouseSession(): LastHouseSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastHouseSession;
    return parsed.code ? parsed : null;
  } catch {
    return null;
  }
}

export function clearLastHouseSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
