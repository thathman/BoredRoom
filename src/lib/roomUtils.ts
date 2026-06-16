import { v4 as uuidv4 } from 'uuid';

const HOST_DISPLAY_ID_KEY = 'boredroom_host_display_id';
const DISPLAY_PARTY_ID_KEY = 'boredroom_display_party_id';
const DISPLAY_PARTY_NAME_KEY = 'boredroom_display_party_name';

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generatePlayerId(): string {
  // Check localStorage for existing player ID
  const existing = localStorage.getItem('boredroom_player_id');
  if (existing) return existing;
  const id = uuidv4();
  localStorage.setItem('boredroom_player_id', id);
  return id;
}

export function getPlayerId(): string {
  return localStorage.getItem('boredroom_player_id') || generatePlayerId();
}

export function getPlayerName(): string {
  return localStorage.getItem('boredroom_player_name') || '';
}

export function setPlayerName(name: string): void {
  localStorage.setItem('boredroom_player_name', name);
}

export function getPlayerColor(): string {
  return localStorage.getItem('boredroom_player_color') || '';
}

export function setPlayerColor(color: string): void {
  localStorage.setItem('boredroom_player_color', color);
}

export function ensureHostDisplayId(): string {
  const existingLocal = localStorage.getItem(HOST_DISPLAY_ID_KEY);
  if (existingLocal) return existingLocal;

  const existingSession = sessionStorage.getItem(HOST_DISPLAY_ID_KEY);
  if (existingSession) {
    localStorage.setItem(HOST_DISPLAY_ID_KEY, existingSession);
    return existingSession;
  }

  const id = uuidv4();
  localStorage.setItem(HOST_DISPLAY_ID_KEY, id);
  return id;
}

export function ensureDisplayPartyId(): string {
  const existing = localStorage.getItem(DISPLAY_PARTY_ID_KEY);
  if (existing) return existing;
  const id = uuidv4();
  localStorage.setItem(DISPLAY_PARTY_ID_KEY, id);
  return id;
}

export function getDisplayPartyName(): string {
  return localStorage.getItem(DISPLAY_PARTY_NAME_KEY) || 'Home table';
}

export function setDisplayPartyName(name: string): void {
  const clean = name.trim().slice(0, 40);
  localStorage.setItem(DISPLAY_PARTY_NAME_KEY, clean || 'Home table');
}
