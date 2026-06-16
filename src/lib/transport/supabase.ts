// Supabase transport — wraps the existing realtimeRoom + host-authoritative
// loop. This adapter exists to provide a uniform Intent/Event surface so the
// rest of the app can swap transports without reading two flavors of code.
//
// IMPORTANT: This file is intentionally a thin shim. The real
// host-authoritative reducer still lives in src/hooks/useRoom.ts for the
// supabase path. This adapter is only used by code that has migrated to the
// transport interface; useRoom continues to use realtimeRoom directly today
// to avoid a same-pass rewrite of every component.

import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_REACTION_POLICY,
  DEFAULT_TAUNT_POLICY,
  Intent,
  PROTOCOL_VERSION,
  ServerEvent,
} from './types';
import type { TransportConnectOptions, TransportHandle } from './index';

export async function connectSupabase(opts: TransportConnectOptions): Promise<TransportHandle> {
  // We do not re-implement the host-authoritative reducer here; instead we
  // expose a passthrough that mirrors broadcast events into the ServerEvent
  // shape. Code that wants the legacy semantics keeps using useRoom().
  const channel = supabase.channel(`room:${opts.roomCode}`, {
    config: { broadcast: { self: true }, presence: { key: '' } },
  });

  const handlers = new Set<(evt: ServerEvent) => void>();
  const dispatch = (evt: ServerEvent) => handlers.forEach((h) => h(evt));

  channel.on('broadcast', { event: 'room_state' }, ({ payload }) => {
    const p = payload as Record<string, unknown>;
    dispatch({
      type: 'public_state',
      state: {
        protocolVersion: PROTOCOL_VERSION,
        code: opts.roomCode,
        hostId: (p?.hostId as string) ?? '',
        status: (p?.status as 'lobby' | 'playing' | 'finished') ?? 'lobby',
        members: (p?.members as never[]) ?? [],
        gameState: (p?.gameState as never) ?? null,
        reactions: (p?.reactions as never[]) ?? [],
        pendingJoinRequests: [],
        aiStatus: 'active',
        roomPolicy: 'open',
        reactionPolicy: { ...DEFAULT_REACTION_POLICY },
        tauntPolicy: { ...DEFAULT_TAUNT_POLICY },
        reactionStats: {
          totalAccepted: 0,
          rejected: { cooldown: 0, rate_limited: 0, disabled: 0, duplicate: 0 },
          perUserAccepted: {},
        },
        reactionMoments: [],
        gameType: 'ludo',
        whotState: null,
      },
    });
  });
  channel.on('broadcast', { event: 'ai_commentary' }, ({ payload }) => {
    const p = payload as { line: string; timestamp: number };
    dispatch({ type: 'ai_commentary', line: p.line, timestamp: p.timestamp });
  });
  channel.on('broadcast', { event: 'ai_recap' }, ({ payload }) => {
    const p = payload as { recap: { headline: string; paragraph: string; mvp: string }; timestamp: number };
    dispatch({ type: 'ai_recap', recap: p.recap, timestamp: p.timestamp });
  });

  await new Promise<void>((resolve) => channel.subscribe((s) => s === 'SUBSCRIBED' && resolve()));

  return {
    kind: 'supabase',
    send(intent: Intent) {
      // Map intents back onto legacy broadcast events.
      if (intent.type === 'roll_dice' || intent.type === 'move_token') {
        channel.send({
          type: 'broadcast',
          event: 'player_action',
          payload: {
            type: intent.type,
            playerId: opts.deviceId,
            data: intent.type === 'move_token'
              ? { tokenId: intent.tokenId, dieChoice: intent.dieChoice }
              : undefined,
          },
        });
      } else if (intent.type === 'toggle_ready') {
        channel.send({ type: 'broadcast', event: 'ready_toggle', payload: { playerId: opts.deviceId } });
      } else if (intent.type === 'send_reaction') {
        // Supabase path is best-effort — emit an immediate accepted ack so the
        // controller UX still pulses; real authority is on the colyseus path.
        channel.send({
          type: 'broadcast',
          event: 'reaction',
          payload: { playerId: opts.deviceId, emoji: intent.emoji, timestamp: Date.now() },
        });
        dispatch({
          type: 'reaction_accepted',
          emoji: intent.emoji,
          timestamp: Date.now(),
          clientNonce: intent.clientNonce,
        });
      } else if (intent.type === 'request_state') {
        channel.send({ type: 'broadcast', event: 'state_request', payload: { playerId: opts.deviceId } });
      } else if (intent.type === 'host:kick') {
        channel.send({ type: 'broadcast', event: 'kick_player', payload: { playerId: intent.playerId } });
      }
      // Other host:* intents (approvals, bots, reaction policies) are not
      // implemented on the supabase transport — those features only run
      // against the colyseus server. UI surfaces should hide them when
      // transport.kind==='supabase'.
    },
    onEvent(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    disconnect() {
      handlers.clear();
      channel.unsubscribe();
    },
  };
}

