// Transport adapter — gives the rest of the web app one interface for both
// Supabase Realtime (legacy) and Colyseus (new authoritative server).
//
// Selection rules (evaluated at module import):
//   1. If VITE_TRANSPORT is explicitly set, honor it.
//   2. Else if VITE_COLYSEUS_URL is set, default to "colyseus".
//   3. Else default to "supabase" (fallback preview path).
//
// The adapter exposes the SAME shape for both transports so useRoom doesn't
// care which one is active. The supabase adapter is the existing
// realtimeRoom + host-authoritative loop. The colyseus adapter delegates
// authority to the server.

import type { GameType, Intent, PublicRoomState, ServerEvent } from '@/lib/transport/types';

export type TransportKind = 'supabase' | 'colyseus';

export interface TransportConnectOptions {
  roomCode: string;
  isHost: boolean;
  deviceId: string;
  displayName: string;
  hostToken?: string;
  /** Optional: requested gameType when host creates a room. Honored only on first create. */
  gameType?: GameType;
  /** Optional host display party id for history continuity. */
  partyId?: string;
}

export interface TransportHandle {
  kind: TransportKind;
  send(intent: Intent): void;
  onEvent(handler: (evt: ServerEvent) => void): () => void;
  disconnect(): void;
}

export function getTransportKind(): TransportKind {
  const explicit = (import.meta.env.VITE_TRANSPORT as string | undefined)?.toLowerCase();
  if (explicit === 'colyseus' || explicit === 'supabase') return explicit;
  if (import.meta.env.VITE_COLYSEUS_URL) return 'colyseus';
  return 'supabase';
}

export async function connectTransport(opts: TransportConnectOptions): Promise<TransportHandle> {
  const kind = getTransportKind();
  if (kind === 'colyseus') {
    const { connectColyseus } = await import('./colyseus');
    return connectColyseus(opts);
  }
  const { connectSupabase } = await import('./supabase');
  return connectSupabase(opts);
}
