// Colyseus transport. Lazy-imported by ./index.ts only when selected.
import { Client, Room } from 'colyseus.js';
import {
  PROTOCOL_VERSION,
  Intent,
  ServerEvent,
} from './types';
import type { TransportConnectOptions, TransportHandle } from './index';

const COLYSEUS_URL = import.meta.env.VITE_COLYSEUS_URL || 'ws://localhost:2567';
const CONNECT_TIMEOUT_MS = 8000;

export async function connectColyseus(opts: TransportConnectOptions): Promise<TransportHandle> {
  const client = new Client(COLYSEUS_URL);
  // Each game has its own Colyseus room. Whot was extracted from LudoRoom in
  // the per-game-room refactor; the room types now match the game slugs 1:1
  // (with the exception of 'connect-4' / 'ettt' that retain their hyphenated
  // slugs).
  const colyseusRoomType =
    opts.gameType === 'whot' ? 'whot'
    : opts.gameType === 'trivia' ? 'trivia'
    : opts.gameType === 'connect-4' ? 'connect-4'
    : opts.gameType === 'ettt' ? 'ettt'
    : opts.gameType === 'logo' ? 'logo'
    : opts.gameType === 'landlord' ? 'landlord'
    : opts.gameType === 'half-half' ? 'half-half'
    : opts.gameType === 'color-wahala' ? 'color-wahala'
    : opts.gameType === 'hustle' ? 'hustle'
    : opts.gameType === 'word-wahala' ? 'word-wahala'
    : 'ludo';
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('connect_timeout')), CONNECT_TIMEOUT_MS);
  });
  const room: Room = await Promise.race([
    client.joinOrCreate(colyseusRoomType, {
      protocolVersion: PROTOCOL_VERSION,
      deviceId: opts.deviceId,
      displayName: opts.displayName,
      role: opts.isHost ? 'host' : 'player',
      hostToken: opts.hostToken,
      code: opts.roomCode,
      gameType: opts.gameType,
      partyId: opts.partyId,
    }),
    timeoutPromise,
  ]).finally(() => {
    if (timeoutId != null) clearTimeout(timeoutId);
  }) as Room;

  const handlers = new Set<(evt: ServerEvent) => void>();
  room.onMessage('event', (evt: ServerEvent) => {
    handlers.forEach((h) => h(evt));
  });
  room.onLeave(() => {
    handlers.forEach((h) => h({ type: 'error', code: 'disconnected', message: 'left_room' }));
  });

  return {
    kind: 'colyseus',
    send(intent: Intent) {
      room.send('intent', intent);
    },
    onEvent(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    disconnect() {
      handlers.clear();
      room.leave();
    },
  };
}
