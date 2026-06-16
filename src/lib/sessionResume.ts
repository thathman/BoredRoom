import type { GameType } from '@/lib/transport/types';

export interface ActiveSession {
  gameType: GameType;
  roomCode: string;
  isHost: boolean;
}

export function getActiveSession(): ActiveSession | null {
  const roomCode = sessionStorage.getItem('boredroom_room_code') ?? '';
  const gameType = sessionStorage.getItem('boredroom_game_type') as GameType | null;
  const isHost = sessionStorage.getItem('boredroom_is_host') === 'true';
  if (!roomCode || !gameType) return null;
  return { roomCode, gameType, isHost };
}

export function clearActiveSession(): void {
  sessionStorage.removeItem('boredroom_room_code');
  sessionStorage.removeItem('boredroom_game_type');
  sessionStorage.removeItem('boredroom_is_host');
}

