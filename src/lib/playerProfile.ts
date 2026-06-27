// Persistent player profile. One per device, stored in localStorage so a player keeps their
// name, avatar, accent colour and preferences across parties, refreshes, and phone locks.
import { getPlayerId } from './roomUtils';

const PROFILE_KEY = 'boredroom_player_profile';

export type AvatarType = 'emoji' | 'photo' | 'default';

export interface PlayerProfile {
  id: string;
  displayName: string;
  avatarType: AvatarType;
  avatarValue: string; // emoji char, data URL (photo), or '' for default
  accentColor: string; // hex
  preferences: {
    sound: boolean;
    haptics: boolean;
    language: 'en' | 'pcm';
  };
  updatedAt: string;
}

export const AVATAR_EMOJIS = ['😎', '🦁', '🔥', '👑', '🎮', '⚡', '🌟', '🦅', '🐍', '🎲', '🥁', '🌍', '💚', '🚀', '🎤', '🧠'];
export const ACCENT_COLORS = ['#45f36b', '#a855f7', '#f59e0b', '#38bdf8', '#fb7185', '#34d399', '#f472b6', '#facc15'];

function defaultProfile(): PlayerProfile {
  const id = getPlayerId();
  return {
    id,
    displayName: localStorage.getItem('boredroom_player_name') || '',
    avatarType: 'default',
    avatarValue: '',
    accentColor: localStorage.getItem('boredroom_player_color') || ACCENT_COLORS[0],
    preferences: { sound: true, haptics: true, language: 'en' },
    updatedAt: new Date().toISOString(),
  };
}

export function getPlayerProfile(): PlayerProfile {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      const base = defaultProfile();
      return {
        ...base,
        ...parsed,
        id: base.id, // device id is authoritative
        preferences: { ...base.preferences, ...(parsed.preferences ?? {}) },
      };
    } catch {
      // fall through to default
    }
  }
  return defaultProfile();
}

export function hasPlayerProfile(): boolean {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw) {
    try {
      if ((JSON.parse(raw) as Partial<PlayerProfile>).displayName) return true;
    } catch {
      // fall through to legacy check
    }
  }
  // A returning player who joined via the older flow has a name but no profile JSON yet —
  // don't re-prompt them for a profile they effectively already have.
  return Boolean(localStorage.getItem('boredroom_player_name'));
}

export function savePlayerProfile(update: Partial<PlayerProfile>): PlayerProfile {
  const next: PlayerProfile = {
    ...getPlayerProfile(),
    ...update,
    preferences: { ...getPlayerProfile().preferences, ...(update.preferences ?? {}) },
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  // Keep legacy keys in sync so older code paths still resolve name/colour.
  if (next.displayName) localStorage.setItem('boredroom_player_name', next.displayName);
  localStorage.setItem('boredroom_player_color', next.accentColor);
  return next;
}

// What the avatar should render as. Photo/emoji return their value; default derives an initial.
export function avatarGlyph(profile: Pick<PlayerProfile, 'avatarType' | 'avatarValue' | 'displayName'>): string {
  if (profile.avatarType === 'emoji' && profile.avatarValue) return profile.avatarValue;
  return profile.displayName.slice(0, 1).toUpperCase() || '?';
}
