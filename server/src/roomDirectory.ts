import type { GameType, RoomPolicy } from '../../shared/src/contracts/index.js';

export interface RoomDirectoryEntry {
  code: string;
  gameType: GameType;
  status: 'lobby' | 'playing' | 'finished';
  roomPolicy: RoomPolicy;
  players: number;
  maxPlayers: number;
  updatedAt: number;
}

const rooms = new Map<string, RoomDirectoryEntry>();

export function upsertRoom(entry: Omit<RoomDirectoryEntry, 'updatedAt'>) {
  rooms.set(entry.code, { ...entry, updatedAt: Date.now() });
}

export function getRoom(code: string): RoomDirectoryEntry | null {
  return rooms.get(code.toUpperCase()) ?? null;
}

export function removeRoom(code: string) {
  rooms.delete(code.toUpperCase());
}
