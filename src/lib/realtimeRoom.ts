// Room state management using Supabase Realtime channels
// The host client acts as the authoritative game server

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { LudoState } from '@/game/ludoEngine';
import {
  DEFAULT_REACTION_POLICY,
  DEFAULT_TAUNT_POLICY,
  ReactionMoment,
  ReactionPolicy,
  ReactionStats,
  PauseState,
  RoomSettings,
  SeatPresence,
  TauntPolicy,
} from '@/lib/transport/types';

export type PlayerActionData = { tokenId?: number; dieChoice?: 'd1' | 'd2' | 'sum' };
export type PlayerAction = { type: string; playerId: string; data?: PlayerActionData };

export interface RoomMember {
  id: string;
  displayName: string;
  color: string;
  isReady: boolean;
  isHost: boolean;
  isBot?: boolean;
  isSpectator?: boolean;
  role?: 'host' | 'player' | 'crowd';
}

export interface PendingJoinRequest {
  id: string;
  deviceId: string;
  displayName: string;
  requestedAt: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'finished';
  members: RoomMember[];
  gameState: LudoState | null;
  reactions: { playerId: string; emoji: string; timestamp: number }[];
  pendingJoinRequests?: PendingJoinRequest[];
  roomPolicy?: 'open' | 'approval' | 'locked';
  reactionPolicy?: ReactionPolicy;
  tauntPolicy?: TauntPolicy;
  reactionStats?: ReactionStats;
  reactionMoments?: ReactionMoment[];
  pauseState?: PauseState;
  presenceBySeat?: Record<string, SeatPresence>;
  roomSettings?: RoomSettings;
  maxPlayers?: number;
  /** Whot scaffold (Step 4) — optional on the supabase path. */
  gameType?: 'ludo' | 'whot' | 'trivia' | 'connect-4' | 'ettt' | 'logo' | 'landlord' | 'half-half' | 'color-wahala' | 'hustle' | 'word-wahala';
  whotState?: unknown | null;
}

export const FALLBACK_REACTION_POLICY: ReactionPolicy = { ...DEFAULT_REACTION_POLICY };
export const FALLBACK_TAUNT_POLICY: TauntPolicy = { ...DEFAULT_TAUNT_POLICY };


export function createChannel(roomCode: string): RealtimeChannel {
  return supabase.channel(`room:${roomCode}`, {
    config: {
      broadcast: { self: true },
      presence: { key: '' },
    },
  });
}

export function broadcastState(channel: RealtimeChannel, state: RoomState) {
  channel.send({
    type: 'broadcast',
    event: 'room_state',
    payload: state,
  });
}

export function broadcastGameState(channel: RealtimeChannel, gameState: LudoState) {
  channel.send({
    type: 'broadcast',
    event: 'game_state',
    payload: gameState,
  });
}

export function sendAction(channel: RealtimeChannel, action: PlayerAction) {
  channel.send({
    type: 'broadcast',
    event: 'player_action',
    payload: action,
  });
}

export function sendReaction(channel: RealtimeChannel, playerId: string, emoji: string) {
  channel.send({
    type: 'broadcast',
    event: 'reaction',
    payload: { playerId, emoji, timestamp: Date.now() },
  });
}

export function requestState(channel: RealtimeChannel, playerId: string) {
  channel.send({
    type: 'broadcast',
    event: 'state_request',
    payload: { playerId },
  });
}

export function kickPlayer(channel: RealtimeChannel, playerId: string) {
  channel.send({
    type: 'broadcast',
    event: 'kick_player',
    payload: { playerId },
  });
}

export function broadcastCommentary(channel: RealtimeChannel, line: string) {
  channel.send({
    type: 'broadcast',
    event: 'ai_commentary',
    payload: { line, timestamp: Date.now() },
  });
}

export function broadcastRecap(
  channel: RealtimeChannel,
  recap: { headline: string; paragraph: string; mvp: string },
) {
  channel.send({
    type: 'broadcast',
    event: 'ai_recap',
    payload: { recap, timestamp: Date.now() },
  });
}

export type AIStatus = 'active' | 'fallback' | 'degraded' | 'offline';

export function broadcastAIStatus(channel: RealtimeChannel, status: AIStatus) {
  channel.send({
    type: 'broadcast',
    event: 'ai_status',
    payload: { status, timestamp: Date.now() },
  });
}
