import { normalizeRoomCode } from '@/lib/roomCode';

export interface RoomSessionSnapshot {
  requestedHostMode: boolean;
  storedHostToken: string;
  storedRoomCode: string | null;
  storedGameType: string | null;
  routeRoomCode: string | undefined;
  routeGameType: string | undefined;
}

export interface ResolvedRoomSessionRole {
  isHost: boolean;
  shouldClearHostSession: boolean;
}

/**
 * Host tokens are only valid for the room/game that created them. Without this
 * guard, a stale host session can hijack a controller URL and try to join as a
 * host, which produces host_token_invalid and leaves the controller unusable.
 */
export function resolveRoomSessionRole(snapshot: RoomSessionSnapshot): ResolvedRoomSessionRole {
  const routeCode = normalizeRoomCode(snapshot.routeRoomCode ?? '');
  const storedCode = normalizeRoomCode(snapshot.storedRoomCode ?? '');
  const routeGame = snapshot.routeGameType ?? '';
  const storedGame = snapshot.storedGameType ?? '';
  const hasBoundHostToken =
    snapshot.requestedHostMode &&
    snapshot.storedHostToken.length > 0 &&
    routeCode.length > 0 &&
    storedCode === routeCode &&
    storedGame === routeGame;

  return {
    isHost: hasBoundHostToken,
    shouldClearHostSession: snapshot.requestedHostMode && !hasBoundHostToken,
  };
}
