import type { HouseSessionRole } from '@/hooks/useHouseSession';

const KEY = 'boredroom_player_session_resume';

export interface PlayerSessionResume {
  code: string;
  role: Extract<HouseSessionRole, 'controller' | 'crowd' | 'companion'>;
  displayName: string;
  savedAt: string;
}

export function rememberPlayerSession(input: Omit<PlayerSessionResume, 'savedAt'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      ...input,
      code: input.code.trim().toUpperCase(),
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // If storage is unavailable, reconnect still works while the tab stays alive.
  }
}

export function getPlayerSessionResume(): PlayerSessionResume | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlayerSessionResume>;
    if (!parsed.code || parsed.code.length !== 4) return null;
    if (!parsed.role || !['controller', 'crowd', 'companion'].includes(parsed.role)) return null;
    return {
      code: parsed.code.toUpperCase(),
      role: parsed.role,
      displayName: parsed.displayName ?? '',
      savedAt: parsed.savedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearPlayerSessionResume(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
