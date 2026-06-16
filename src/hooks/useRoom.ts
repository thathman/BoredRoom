import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  createChannel,
  RoomState,
  RoomMember,
  AIStatus,
  broadcastState,
  sendAction,
  requestState,
  kickPlayer as sendKick,
  broadcastCommentary,
  broadcastRecap,
  broadcastAIStatus,
} from '@/lib/realtimeRoom';
import { LudoState, createInitialState, rollDice, moveToken } from '@/game/ludoEngine';
import { sounds, vibrate } from '@/lib/sounds';
import { recordMatchFinished } from '@/lib/profile';
import { ensureDisplayPartyId, ensureHostDisplayId } from '@/lib/roomUtils';
import { getCommentary, getRecap, PublicEvent, RecapPayload, onAICall } from '@/lib/ai';
import { deriveSyncStatus, SyncStatus } from '@/lib/syncStatus';
import { AIStatusTracker } from '@/lib/aiStatus';

import { useColyseusRoom } from './useColyseusRoom';

interface UseRoomOptions {
  roomCode: string;
  isHost: boolean;
  playerId: string;
  displayName?: string;
  hostToken?: string;
  /** Optional: requested gameType. Honored only when the host first creates the room. */
  gameType?: import('@/lib/transport/types').GameType;
}

const COLYSEUS_ENABLED = !!import.meta.env.VITE_COLYSEUS_URL;
const TRANSPORT_FALLBACK_KEY = 'boredroom_transport_fallback';
const FALLBACK_TTL_MS = 2 * 60 * 1000;

/**
 * useRoom — branches on transport at module init.
 *  - When VITE_COLYSEUS_URL is set: delegates to useColyseusRoom (server is authority).
 *  - Otherwise: uses the legacy Supabase host-authoritative loop (today's behavior).
 *
 * The Supabase path does NOT support host:approve_join / host:add_bot / etc.
 * Those new actions are exposed as no-ops on that branch; UI should hide them
 * unless transportKind === 'colyseus'.
 */
export function useRoom(opts: UseRoomOptions) {
  const isHostSession = opts.isHost;
  const requestedGameType = opts.gameType ?? 'ludo';
  const [transportMode] = useState<'colyseus' | 'supabase' | 'supabase-fallback'>(() => {
    if (!COLYSEUS_ENABLED) return 'supabase';
    if (requestedGameType === 'whot' || requestedGameType === 'trivia' || requestedGameType === 'connect-4' || requestedGameType === 'ettt' || requestedGameType === 'logo' || requestedGameType === 'landlord' || requestedGameType === 'half-half' || requestedGameType === 'color-wahala' || requestedGameType === 'hustle' || requestedGameType === 'word-wahala') return 'colyseus';
    const fallbackUntil =
      typeof window !== 'undefined'
        ? Number(sessionStorage.getItem(TRANSPORT_FALLBACK_KEY) ?? 0)
        : 0;
    return isHostSession && fallbackUntil > Date.now() ? 'supabase-fallback' : 'colyseus';
  });
  const handleFatalConnectionError = useCallback(() => {
    if (!isHostSession) return;
    if (requestedGameType === 'whot' || requestedGameType === 'trivia' || requestedGameType === 'connect-4' || requestedGameType === 'ettt' || requestedGameType === 'logo' || requestedGameType === 'landlord' || requestedGameType === 'half-half' || requestedGameType === 'color-wahala' || requestedGameType === 'hustle' || requestedGameType === 'word-wahala') return;
    if (typeof window === 'undefined') return;
    const activeUntil = Number(sessionStorage.getItem(TRANSPORT_FALLBACK_KEY) ?? 0);
    if (activeUntil > Date.now()) return;
    sessionStorage.setItem(TRANSPORT_FALLBACK_KEY, String(Date.now() + FALLBACK_TTL_MS));
    window.location.reload();
  }, [isHostSession, requestedGameType]);

  const colyseusRoom = useColyseusRoom({
    ...opts,
    enabled: transportMode === 'colyseus',
    onFatalConnectionError: handleFatalConnectionError,
  });
  const supabaseRoom = useSupabaseRoom({ ...opts, enabled: transportMode !== 'colyseus' });

  return transportMode === 'colyseus'
    ? colyseusRoom
    : transportMode === 'supabase-fallback'
      ? { ...supabaseRoom, transportKind: 'supabase-fallback' as const }
      : supabaseRoom;
}

type PlayerActionData = { tokenId?: number; dieChoice?: 'd1' | 'd2' | 'sum' };
type PlayerAction = { type: string; playerId: string; data?: PlayerActionData };

function useSupabaseRoom({ roomCode, isHost, playerId, displayName = '', gameType = 'ludo', enabled = true }: UseRoomOptions & { enabled?: boolean }) {
  const [roomState, setRoomState] = useState<RoomState>({
    code: roomCode,
    hostId: isHost ? playerId : '',
    status: 'lobby',
    members: [],
    gameState: null,
    reactions: [],
    roomPolicy: 'open',
    gameType,
    whotState: null,
    pauseState: { paused: false, reason: null, requestedBy: null, since: null, message: null },
    presenceBySeat: {},
    maxPlayers: gameType === 'whot' ? 8 : 4,
    roomSettings: {
      aiAssistance: true,
      maxPlayers: gameType === 'whot' ? 8 : 4,
      whotPenaltyStreaks: true,
      reactionBursts: true,
    },
  } as RoomState);
  const [connected, setConnected] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [hasAuthoritativeState, setHasAuthoritativeState] = useState(false);
  const [lastChannelError, setLastChannelError] = useState<string | null>(null);
  const wasReadyRef = useRef(false);
  const [presenceTick, setPresenceTick] = useState(0);
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const stateRequestRetriesRef = useRef<number[]>([]);
  const [kicked, setKicked] = useState(false);
  const [commentaryLine, setCommentaryLine] = useState<string | null>(null);
  const [recap, setRecap] = useState<RecapPayload | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus>('active');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef(roomState);
  stateRef.current = roomState;
  const prevGameStateRef = useRef<LudoState | null>(null);
  const prevMemberCountRef = useRef(0);
  const eventQueueRef = useRef<PublicEvent[]>([]);
  const commentaryFlushTimerRef = useRef<number | null>(null);
  const commentaryInFlightRef = useRef(false);
  const matchStartRef = useRef<number | null>(null);
  const recapRequestedRef = useRef(false);
  const aiTrackerRef = useRef<AIStatusTracker>(new AIStatusTracker());
  const lastBroadcastedAIStatusRef = useRef<AIStatus | null>(null);

  // Derived sync status
  const syncStatus: SyncStatus = deriveSyncStatus({
    subscribed,
    hasAuthoritativeState: isHost ? subscribed : hasAuthoritativeState,
    wasReady: wasReadyRef.current,
    lastError: lastChannelError,
  });
  if (syncStatus === 'ready') wasReadyRef.current = true;

  // Host-local presence tick — refresh dot states every 2s
  useEffect(() => {
    if (!isHost) return;
    const id = window.setInterval(() => setPresenceTick(t => t + 1), 2000);
    return () => window.clearInterval(id);
  }, [isHost]);

  const stampSeen = useCallback((id?: string) => {
    if (!id) return;
    lastSeenRef.current.set(id, Date.now());
  }, []);

  // Snapshot of presence map (re-derived on tick)
  const presenceMap: Record<string, number> = {};
  void presenceTick;
  lastSeenRef.current.forEach((v, k) => {
    presenceMap[k] = v;
  });

  // Effects: detect game state changes for sounds + haptics + AI events (runs on every client)
  useEffect(() => {
    const prev = prevGameStateRef.current;
    const next = roomState.gameState;
    if (next) {
      // Dice rolled
      if (next.diceValue && next.diceValue !== prev?.diceValue) {
        sounds.ludoDiceGlassRoll();
        const isMyTurn = next.players[next.currentPlayerIndex]?.id === playerId;
        if (isMyTurn && !isHost) vibrate([20, 40, 20]);
      }
      // Capture detection
      if (prev && next.lastAction !== prev.lastAction) {
        if (next.lastAction.includes('captured')) {
          sounds.capture();
          vibrate([60, 30, 60]);
        } else if (next.lastAction.includes('home')) {
          sounds.enterHome();
        } else if (next.phase === 'finished') {
          sounds.win();
          vibrate([100, 50, 100, 50, 200]);
        }
      }
      // Token moved (position change without capture sound already)
      if (prev && next.turnNumber !== prev.turnNumber) {
        // turn advanced — likely a move happened
        if (!next.lastAction.includes('captured') && !next.lastAction.includes('home')) {
          sounds.tokenMove();
        }
      }
    }
    prevGameStateRef.current = next;
  }, [roomState.gameState, playerId, isHost]);

  // Host-only: flush queued public events to AI commentary on a debounce.
  useEffect(() => {
    if (!isHost) return;
    const tick = () => {
      if (commentaryInFlightRef.current) return;
      const queue = eventQueueRef.current;
      if (queue.length === 0) return;
      const events = queue.splice(0, queue.length);
      const current = stateRef.current;
      const players = current.gameState?.players.map(p => ({ name: p.displayName, color: p.color })) ?? [];
      commentaryInFlightRef.current = true;
      getCommentary({ roomCode: current.code, events, players, gameType: 'ludo' })
        .then(line => {
          if (line && channelRef.current) {
            broadcastCommentary(channelRef.current, line);
          }
        })
        .finally(() => {
          commentaryInFlightRef.current = false;
        });
    };
    commentaryFlushTimerRef.current = window.setInterval(tick, 4000);
    return () => {
      if (commentaryFlushTimerRef.current) window.clearInterval(commentaryFlushTimerRef.current);
    };
  }, [isHost]);

  // Host-only: subscribe to AI call results, derive status, broadcast on change.
  useEffect(() => {
    if (!isHost) return;
    const unsub = onAICall((_kind, meta) => {
      const next = aiTrackerRef.current.record(meta);
      setAiStatus(next);
      if (next !== lastBroadcastedAIStatusRef.current && channelRef.current) {
        lastBroadcastedAIStatusRef.current = next;
        broadcastAIStatus(channelRef.current, next);
      }
    });
    return () => { unsub(); };
  }, [isHost]);

  // Host-only: when game finishes, request a recap once.
  useEffect(() => {
    if (!isHost) return;
    const gs = roomState.gameState;
    if (!gs || gs.phase !== 'finished' || recapRequestedRef.current) return;
    recapRequestedRef.current = true;
    const winner = gs.players.find(p => p.id === gs.winner);
    const start = matchStartRef.current ?? Date.now();
    getRecap({
      roomCode: roomState.code,
      players: gs.players.map(p => ({ name: p.displayName, color: p.color, tokensHome: p.finishedTokens })),
      winnerName: winner?.displayName ?? '',
      turnCount: gs.turnNumber,
      matchDurationMs: Date.now() - start,
      gameType: 'ludo',
    }).then(r => {
      if (r) {
        setRecap(r);
        if (channelRef.current) broadcastRecap(channelRef.current, r);
      }
    });
  }, [isHost, roomState.gameState, roomState.code]);

  // Auto-clear commentary line after a few seconds
  useEffect(() => {
    if (!commentaryLine) return;
    const t = window.setTimeout(() => setCommentaryLine(null), 6500);
    return () => window.clearTimeout(t);
  }, [commentaryLine]);

  // Detect new members joining (host plays sound)
  useEffect(() => {
    if (isHost && roomState.members.length > prevMemberCountRef.current) {
      sounds.join();
    }
    prevMemberCountRef.current = roomState.members.length;
  }, [roomState.members.length, isHost]);

  // Reactions sound
  useEffect(() => {
    if (roomState.reactions.length === 0) return;
    const last = roomState.reactions[roomState.reactions.length - 1];
    if (Date.now() - last.timestamp < 1500 && last.playerId !== playerId) {
      sounds.reaction();
    }
  }, [roomState.reactions, playerId]);

  const handlePlayerAction = useCallback((action: PlayerAction) => {
    const current = stateRef.current;
    if (!current.gameState) return;

    const prevGameState = current.gameState;
    let newGameState: LudoState;

    if (action.type === 'roll_dice') {
      if (prevGameState.players[prevGameState.currentPlayerIndex]?.id !== action.playerId) return;
      newGameState = rollDice(prevGameState);
    } else if (action.type === 'move_token') {
      if (prevGameState.players[prevGameState.currentPlayerIndex]?.id !== action.playerId) return;
      newGameState = moveToken(prevGameState, action.data?.tokenId ?? -1, action.data?.dieChoice);
    } else {
      return;
    }

    // Host-only: derive public events for AI commentary
    if (isHost) {
      const actor = prevGameState.players[prevGameState.currentPlayerIndex];
      const lastAction = newGameState.lastAction;
      if (action.type === 'roll_dice' && newGameState.dice) {
        const [d1, d2] = newGameState.dice;
        if (d1 === 6 || d2 === 6) {
          eventQueueRef.current.push({ type: 'roll', actor: actor.displayName, value: 6 });
        }
        if (lastAction.includes('forfeited') || lastAction.includes('3 sixes')) {
          eventQueueRef.current.push({ type: 'skip', actor: actor.displayName });
        }
      }
      if (action.type === 'move_token') {
        if (lastAction.includes('captured')) {
          // Try to extract target name from message "X captured Y's token!"
          const m = lastAction.match(/captured (.+?)'s token/);
          eventQueueRef.current.push({ type: 'capture', actor: actor.displayName, target: m?.[1] });
        }
        if (lastAction.includes('home') && newGameState.phase !== 'finished') {
          eventQueueRef.current.push({ type: 'home', actor: actor.displayName });
        }
        if (newGameState.phase === 'finished') {
          eventQueueRef.current.push({ type: 'win', actor: actor.displayName });
        }
      }
      // Cap queue size to avoid runaway memory
      if (eventQueueRef.current.length > 12) {
        eventQueueRef.current = eventQueueRef.current.slice(-12);
      }
    }

    const newState = { ...current, gameState: newGameState };
    if (newGameState.phase === 'finished') {
      newState.status = 'finished' as const;
      // Persist match (host only — single source of truth)
      if (isHost) {
        const playerNames: Record<string, string> = {};
        newGameState.players.forEach(p => { playerNames[p.id] = p.displayName; });
        recordMatchFinished({
          roomCode: current.code,
          winnerDeviceId: newGameState.winner,
          playerDeviceIds: newGameState.players.map(p => p.id),
          playerNames,
          gameType: 'ludo',
          matchKey: `${current.code}|ludo|${newGameState.winner ?? '_'}|${newGameState.players.map(p => p.id).sort().join(',')}`,
          hostDisplayId: ensureHostDisplayId(),
          partyId: ensureDisplayPartyId(),
        }).catch(err => console.error('[match] persist failed', err));
      }
    }
    stateRef.current = newState;
    setRoomState(newState);
    if (channelRef.current) {
      broadcastState(channelRef.current, newState);
    }
  }, [isHost]);

  useEffect(() => {
    if (!enabled) return;
    const channel = createChannel(roomCode);
    channelRef.current = channel;

    channel.on('broadcast', { event: 'room_state' }, ({ payload }) => {
      const next = payload as RoomState;
      if (!next.roomPolicy) next.roomPolicy = 'open';
      setRoomState(next);
      // Mark authoritative state for non-hosts once we appear in members,
      // OR if we're explicitly the host id.
      if (!isHost) {
        if (next.members?.some(m => m.id === playerId) || next.hostId === playerId) {
          setHasAuthoritativeState(true);
          setLastChannelError(null);
        }
      } else {
        setHasAuthoritativeState(true);
      }
    });

    channel.on('broadcast', { event: 'game_state' }, ({ payload }) => {
      setRoomState(prev => ({ ...prev, gameState: payload as LudoState }));
    });

    channel.on('broadcast', { event: 'player_action' }, ({ payload }) => {
      const action = payload as PlayerAction;
      if (isHost) stampSeen(action.playerId);
      if (!isHost) return;
      handlePlayerAction(action);
    });

    channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      const reaction = payload as { playerId: string; emoji: string; timestamp: number };
      if (isHost) stampSeen(reaction.playerId);
      setRoomState(prev => ({
        ...prev,
        reactions: [...prev.reactions.slice(-20), reaction],
      }));
    });

    channel.on('broadcast', { event: 'join_request' }, ({ payload }) => {
      if (!isHost) return;
      const member = payload as RoomMember;
      stampSeen(member.id);
      const current = stateRef.current;
      const existing = current.members.find(m => m.id === member.id);

      // Reconnect path: same id rejoining
      if (existing) {
        const newState = {
          ...current,
          members: current.members.map(m =>
            m.id === member.id ? { ...m, displayName: member.displayName } : m
          ),
        };
        stateRef.current = newState;
        setRoomState(newState);
        broadcastState(channel, newState);
        return;
      }

      // Reject if game in progress or full
      if (current.status !== 'lobby') return;
      if (current.members.length >= 4) return;

      const newState = {
        ...current,
        members: [...current.members, member],
      };
      stateRef.current = newState;
      setRoomState(newState);
      broadcastState(channel, newState);
    });

    channel.on('broadcast', { event: 'state_request' }, ({ payload }) => {
      if (!isHost) return;
      const { playerId: pid } = payload as { playerId: string };
      stampSeen(pid);
      const current = stateRef.current;
      // Only respond if requester is a known member
      if (!current.members.find(m => m.id === pid)) return;
      broadcastState(channel, current);
    });

    channel.on('broadcast', { event: 'ready_toggle' }, ({ payload }) => {
      if (!isHost) return;
      const { playerId: pid } = payload as { playerId: string };
      stampSeen(pid);
      const current = stateRef.current;
      const newState = {
        ...current,
        members: current.members.map(m =>
          m.id === pid ? { ...m, isReady: !m.isReady } : m
        ),
      };
      stateRef.current = newState;
      setRoomState(newState);
      broadcastState(channel, newState);
    });

    channel.on('broadcast', { event: 'kick_player' }, ({ payload }) => {
      const { playerId: pid } = payload as { playerId: string };
      // Kicked player: mark themselves
      if (pid === playerId && !isHost) {
        setKicked(true);
        return;
      }
      // Host applies the kick to roster
      if (isHost) {
        const current = stateRef.current;
        if (current.status !== 'lobby') return;
        const newState = {
          ...current,
          members: current.members.filter(m => m.id !== pid),
        };
        stateRef.current = newState;
        setRoomState(newState);
        broadcastState(channel, newState);
      }
    });

    channel.on('broadcast', { event: 'ai_commentary' }, ({ payload }) => {
      const { line } = payload as { line: string };
      if (line) setCommentaryLine(line);
    });

    channel.on('broadcast', { event: 'ai_recap' }, ({ payload }) => {
      const { recap: r } = payload as { recap: RecapPayload };
      if (r) setRecap(r);
    });

    channel.on('broadcast', { event: 'ai_status' }, ({ payload }) => {
      const { status: s } = payload as { status: AIStatus };
      if (s) setAiStatus(s);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        setSubscribed(true);
        setLastChannelError(null);

        if (isHost) {
          // Preserve any existing state if rehydrating; otherwise initialize
          const existing = stateRef.current;
          if (existing.members.length === 0) {
            const initialState: RoomState = {
              code: roomCode,
              hostId: playerId,
              status: 'lobby',
              members: [],
              gameState: null,
              reactions: [],
              gameType,
              whotState: null,
              pauseState: { paused: false, reason: null, requestedBy: null, since: null, message: null },
              presenceBySeat: {},
              maxPlayers: gameType === 'whot' ? 8 : 4,
              roomSettings: {
                aiAssistance: true,
                maxPlayers: gameType === 'whot' ? 8 : 4,
                whotPenaltyStreaks: true,
                reactionBursts: true,
              },
            };
            stateRef.current = initialState;
            setRoomState(initialState);
            broadcastState(channel, initialState);
          } else {
            broadcastState(channel, existing);
          }
          setHasAuthoritativeState(true);
        } else {
          // Send join request (idempotent on host side)
          channel.send({
            type: 'broadcast',
            event: 'join_request',
            payload: {
              id: playerId,
              displayName,
              color: '#888888',
              isReady: false,
              isHost: false,
            } as RoomMember,
          });

          // Bounded retry: request state until we hear back, then stop.
          // Schedule at 300ms / 1s / 2.5s / 5s — bail by 8s.
          const schedule = [300, 1000, 2500, 5000];
          stateRequestRetriesRef.current.forEach(id => clearTimeout(id));
          stateRequestRetriesRef.current = [];
          schedule.forEach(delay => {
            const id = window.setTimeout(() => {
              if (!stateRef.current.members.find(m => m.id === playerId) && channelRef.current) {
                requestState(channelRef.current, playerId);
              }
            }, delay);
            stateRequestRetriesRef.current.push(id);
          });
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setSubscribed(false);
        setLastChannelError(status);
      }
    });

    return () => {
      stateRequestRetriesRef.current.forEach(id => clearTimeout(id));
      stateRequestRetriesRef.current = [];
      channel.unsubscribe();
    };
  }, [enabled, roomCode, isHost, playerId, displayName, gameType, handlePlayerAction, stampSeen]);

  const startGame = useCallback(() => {
    if (!isHost || !channelRef.current) return;
    const current = stateRef.current;
    const activeMembers = current.members.filter((m) => !m.isSpectator);
    if (activeMembers.length < 2) return;
    if (!activeMembers.every((m) => m.isReady || m.isBot)) return;

    const gameState = createInitialState(
      activeMembers.map(m => ({ id: m.id, displayName: m.displayName }))
    );

    // Reset AI state for the new match
    eventQueueRef.current = [];
    matchStartRef.current = Date.now();
    recapRequestedRef.current = false;
    setRecap(null);
    setCommentaryLine(null);

    const newState: RoomState = {
      ...current,
      status: 'playing',
      gameState,
    };
    stateRef.current = newState;
    setRoomState(newState);
    broadcastState(channelRef.current, newState);
  }, [isHost]);

  const playAgain = useCallback(() => {
    if (!isHost || !channelRef.current) return;
    const current = stateRef.current;
    const newState: RoomState = {
      ...current,
      status: 'lobby',
      gameState: null,
      members: current.members.map(m => ({ ...m, isReady: Boolean(m.isBot) })),
    };
    stateRef.current = newState;
    setRoomState(newState);
    broadcastState(channelRef.current, newState);
  }, [isHost]);

  const performAction = useCallback((type: string, data?: PlayerActionData) => {
    if (!channelRef.current) return;
    sendAction(channelRef.current, { type, playerId, data });
    if (isHost) {
      handlePlayerAction({ type, playerId, data });
    }
  }, [isHost, playerId, handlePlayerAction]);

  const toggleReady = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'ready_toggle',
      payload: { playerId },
    });
    if (isHost) {
      const current = stateRef.current;
      const newState = {
        ...current,
        members: current.members.map(m =>
          m.id === playerId ? { ...m, isReady: !m.isReady } : m
        ),
      };
      stateRef.current = newState;
      setRoomState(newState);
      broadcastState(channelRef.current, newState);
    }
  }, [isHost, playerId]);

  const sendEmoji = useCallback((emoji: string) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { playerId, emoji, timestamp: Date.now() },
    });
  }, [playerId]);

  const kickPlayer = useCallback((targetId: string) => {
    if (!isHost || !channelRef.current) return;
    if (targetId === playerId) return; // can't kick yourself
    sendKick(channelRef.current, targetId);
    // Apply locally too
    const current = stateRef.current;
    if (current.status !== 'lobby') return;
    const newState = {
      ...current,
      members: current.members.filter(m => m.id !== targetId),
    };
    stateRef.current = newState;
    setRoomState(newState);
    broadcastState(channelRef.current, newState);
  }, [isHost, playerId]);

  // No-op host actions for the Supabase path. The Colyseus server
  // implements these for real; keeping them present (as no-ops) lets UI
  // share one shape across transports.
  const noop = useCallback(() => {}, []);

  return {
    transportKind: 'supabase' as const,
    roomState,
    privateState: null as null,
    connected,
    syncStatus,
    presenceMap,
    kicked,
    commentaryLine,
    recap,
    aiStatus,
    lastErrorCode: lastChannelError,
    retryCount: 0,
    lastReactionAck: null as null | { ok: boolean; emoji: string; reason?: 'cooldown' | 'rate_limited' | 'disabled' | 'duplicate'; retryAfterMs?: number; clientNonce?: string },
    onReactionAck: (() => () => {}) as (fn: (ack: { ok: boolean; emoji: string; reason?: 'cooldown' | 'rate_limited' | 'disabled' | 'duplicate'; retryAfterMs?: number; clientNonce?: string }) => void) => () => void,
    startGame,
    performAction,
    toggleReady,
    sendEmoji: sendEmoji as (emoji: string, clientNonce?: string) => void,
    playAgain,
    pauseGame: noop as () => void,
    resumeGame: noop as () => void,
    endGame: noop as (reason?: string) => void,
    requestPause: noop as () => void,
    requestLeave: noop as () => void,
    kickPlayer,
    approveJoin: noop as (requestId: string, mode: 'spectator' | 'transfer' | 'spawn', targetSeatId?: string) => void,
    rejectJoin: noop as (requestId: string) => void,
    addBot: noop as (difficulty?: 'easy' | 'smart') => void,
    removeBot: noop as (botId: string) => void,
    replaceBotWithHuman: noop as (botId: string, humanDeviceId: string) => void,
    autofillBots: noop as (targetCount: number, difficulty?: 'easy' | 'smart') => void,
    setRoomPolicy: noop as (policy: 'open' | 'approval' | 'locked') => void,
    setAiAssistance: noop as (enabled: boolean) => void,
    setGameSettings: noop as (settings: Partial<import('@/lib/transport/types').RoomSettings>) => void,
    setReactionPolicy: noop as (policy: Partial<import('@/lib/transport/types').ReactionPolicy>) => void,
    setTauntPolicy: noop as (policy: Partial<import('@/lib/transport/types').TauntPolicy>) => void,
    clearReactions: noop as () => void,
    // Whot scaffold parity (supabase path is no-op; types match Colyseus shape).
    privateWhotState: null as null | import('@/lib/transport/types').WhotPrivateState,
    setGameType: noop as (gameType: import('@/lib/transport/types').GameType) => void,
    whotDrawCard: noop as () => void,
    whotPlayCard: noop as (cardId: string, calledShape?: import('@/lib/transport/types').WhotShape) => void,
    whotCallSuit: noop as (shape: import('@/lib/transport/types').WhotShape) => void,
    whotAnnounceLastCard: noop as () => void,
    // Trivia parity (supabase path is no-op).
    privateTriviaState: null as null | import('@/lib/transport/types').TriviaPrivateState,
    setTriviaSettings: noop as (settings: Partial<import('@/lib/transport/types').TriviaSettings>) => void,
    triviaLockAnswer: noop as (pickedIndex: 0 | 1 | 2 | 3) => void,
    crowdVoteTrivia: noop as (pickedIndex: 0 | 1 | 2 | 3) => void,
    // Connect 4 parity (supabase path is no-op; connect-4 is colyseus-only).
    connect4Drop: noop as (column: number) => void,
    // ETTT parity (supabase path is no-op; ettt is colyseus-only).
    etttPlace: noop as (row: number, col: number) => void,
    // Logo Guesser parity (supabase path is no-op; logo is colyseus-only).
    privateLogoState: null as null | import('@/lib/transport/types').LogoPrivateState,
    setLogoSettings: noop as (settings: Partial<import('@/lib/transport/types').LogoSettings>) => void,
    logoLockPick: noop as (pickedIndex: 0 | 1 | 2 | 3) => void,
    logoLockText: noop as (guess: string) => void,
    // Oga Landlord parity (supabase path is no-op; landlord is colyseus-only).
    landlordRoll: noop as () => void,
    landlordBuy: noop as () => void,
    landlordDecline: noop as () => void,
    landlordAckCard: noop as () => void,
    landlordPayJailFine: noop as () => void,
    landlordUseJailCard: noop as () => void,
    landlordEndTurn: noop as () => void,
    landlordBuild: noop as (propertyId: number) => void,
    landlordSellHouse: noop as (propertyId: number) => void,
    landlordMortgage: noop as (propertyId: number) => void,
    landlordUnmortgage: noop as (propertyId: number) => void,
    landlordBid: noop as (amount: number) => void,
    landlordBidPass: noop as () => void,
    landlordProposeTrade: noop as (offer: {
      toId: string;
      cashFromOfferer: number;
      offererPropertyIds: number[];
      targetPropertyIds: number[];
      offererJailCards: number;
      targetJailCards: number;
    }) => void,
    landlordCancelTrade: noop as () => void,
    landlordRespondTrade: noop as (accept: boolean) => void,
    setLandlordSettings: noop as (settings: Partial<import('@/lib/transport/types').LandlordSettings>) => void,
    // Half & Half parity (supabase path is no-op; half-half is colyseus-only).
    privateHalfHalfState: null as null | import('@/lib/transport/types').HalfHalfPrivateState,
    setHalfHalfSettings: noop as (settings: Partial<import('@/lib/transport/types').HalfHalfSettings>) => void,
    halfHalfLockGuess: noop as (position: number) => void,
    // Color Wahala parity (supabase path is no-op; color-wahala is colyseus-only).
    privateColorWahalaState: null as null | import('@/lib/transport/types').ColorWahalaPrivateState,
    setColorWahalaSettings: noop as (settings: Partial<import('@/lib/transport/types').ColorWahalaSettings>) => void,
    colorWahalaTap: noop as (colorId: string) => void,
    // Hustle parity (supabase path is no-op; hustle is colyseus-only).
    setHustleSettings: noop as (settings: Partial<import('@/lib/transport/types').HustleSettings>) => void,
    hustleRoll: noop as () => void,
    hustlePlayCard: noop as (instanceId: string, targetPlayerId?: string | null) => void,
    hustleClaimJapa: noop as () => void,
    hustleDeclineJapa: noop as () => void,
    // Word Wahala parity (supabase path is no-op; word-wahala is colyseus-only).
    privateWordWahalaState: null as null | import('@/lib/transport/types').WordWahalaPrivateState,
    setWordWahalaSettings: noop as (settings: Partial<import('@/lib/transport/types').WordWahalaSettings>) => void,
    wordWahalaPlay: noop as (placements: import('@/lib/transport/types').WordWahalaPlacementIntent[]) => void,
    wordWahalaPass: noop as () => void,
    wordWahalaSwap: noop as (letters: string[]) => void,
    channel: channelRef.current,
  };
}
