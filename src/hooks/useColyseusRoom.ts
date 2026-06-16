// Colyseus-backed implementation of the useRoom contract. Used only when
// VITE_COLYSEUS_URL is set. Mirrors the surface of the legacy supabase-based
// useRoom so callers don't branch.

import { useCallback, useEffect, useRef, useState } from 'react';
import { connectColyseus } from '@/lib/transport/colyseus';
import {
  AIStatus,
  ColorWahalaPublicState,
  ColorWahalaSettings,
  Connect4PublicState,
  DEFAULT_REACTION_POLICY,
  DEFAULT_TAUNT_POLICY,
  EtttPublicState,
  GameType,
  HalfHalfPublicState,
  HalfHalfSettings,
  Intent,
  LogoPublicState,
  LogoSettings,
  PendingJoinRequest,
  PauseState,
  PrivateSeatState,
  PublicRoomState,
  ReactionMoment,
  ReactionPolicy,
  ReactionRejectReason,
  ReactionStats,
  RoomMember,
  RoomSettings,
  SeatPresence,
  ServerEvent,
  TauntPolicy,
  TriviaPublicState,
  TriviaPrivateState,
  TriviaSettings,
  WhotPublicState,
  WhotShape,
} from '@/lib/transport/types';
import type { LudoState } from '@/game/ludoEngine';
import type { SyncStatus } from '@/lib/syncStatus';
import { getCommentary, getRecap, onAICall, type RecapPayload } from '@/lib/ai';
import { AIStatusTracker } from '@/lib/aiStatus';
import { buildLudoRecapInput, mapLudoTransitionToEvents } from '@/lib/ludoAI';
import {
  emptyWhotSignals,
  foldEventsIntoSignals,
  mapWhotTransitionToEvents,
  buildWhotRecapInput,
  type WhotMatchSignals,
} from '@/lib/whotAI';
import { recordMatchFinished } from '@/lib/profile';
import { ensureDisplayPartyId, ensureHostDisplayId } from '@/lib/roomUtils';
import { sounds, vibrate } from '@/lib/sounds';
import { triviaAudio } from '@/lib/triviaAudio';

interface Options {
  roomCode: string;
  isHost: boolean;
  playerId: string;
  displayName?: string;
  hostToken?: string;
  gameType?: GameType;
  enabled?: boolean;
  onFatalConnectionError?: (reason: string) => void;
}

export interface ReactionAckEvent {
  ok: boolean;
  emoji: string;
  reason?: ReactionRejectReason;
  retryAfterMs?: number;
  clientNonce?: string;
}

interface LegacyRoomState {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'finished';
  members: RoomMember[];
  gameState: LudoState | null;
  reactions: { playerId: string; emoji: string; timestamp: number }[];
  pendingJoinRequests: PendingJoinRequest[];
  roomPolicy: 'open' | 'approval' | 'locked';
  reactionPolicy: ReactionPolicy;
  tauntPolicy: TauntPolicy;
  reactionStats: ReactionStats;
  reactionMoments: ReactionMoment[];
  pauseState: PauseState;
  presenceBySeat: Record<string, SeatPresence>;
  roomSettings: RoomSettings;
  maxPlayers: number;
  /** Whot scaffold: which game is loaded into this room. */
  gameType: GameType;
  /** Whot scaffold: public match state. Null while gameType !== 'whot'. */
  whotState: WhotPublicState | null;
  /** Trivia: public state. Null while gameType !== 'trivia'. */
  triviaState: TriviaPublicState | null;
  /** Connect 4: public state. Null while gameType !== 'connect-4'. */
  connect4State: Connect4PublicState | null;
  /** ETTT: public state. Null while gameType !== 'ettt'. */
  etttState: EtttPublicState | null;
  /** Logo Guesser: public state. Null while gameType !== 'logo'. */
  logoState: LogoPublicState | null;
  /** Half & Half: public state. Null while gameType !== 'half-half'. */
  halfHalfState: HalfHalfPublicState | null;
  /** Color Wahala: public state. Null while gameType !== 'color-wahala'. */
  colorWahalaState: ColorWahalaPublicState | null;
  /** Hustle: public state. Null while gameType !== 'hustle'. */
  hustleState: import('@/lib/transport/types').HustlePublicState | null;
  /** Word Wahala: public state. Null while gameType !== 'word-wahala'. */
  wordWahalaState: import('@/lib/transport/types').WordWahalaPublicState | null;
}

function projectToLegacy(state: PublicRoomState): LegacyRoomState {
  return {
    code: state.code,
    hostId: state.hostId,
    status: state.status,
    members: state.members,
    gameState: state.gameState as unknown as LudoState | null,
    reactions: state.reactions,
    pendingJoinRequests: state.pendingJoinRequests,
    roomPolicy: state.roomPolicy,
    reactionPolicy: state.reactionPolicy ?? { ...DEFAULT_REACTION_POLICY },
    tauntPolicy: state.tauntPolicy ?? { ...DEFAULT_TAUNT_POLICY },
    reactionStats: state.reactionStats ?? {
      totalAccepted: 0,
      rejected: { cooldown: 0, rate_limited: 0, disabled: 0, duplicate: 0 },
      perUserAccepted: {},
    },
    reactionMoments: state.reactionMoments ?? [],
    pauseState: state.pauseState ?? { paused: false, reason: null, requestedBy: null, since: null, message: null },
    presenceBySeat: state.presenceBySeat ?? {},
    roomSettings: state.roomSettings ?? {
      aiAssistance: true,
      maxPlayers: state.maxPlayers ?? (state.gameType === 'whot' ? 8 : 4),
      whotPenaltyStreaks: true,
      reactionBursts: true,
    },
    maxPlayers: state.maxPlayers ?? state.roomSettings?.maxPlayers ?? (state.gameType === 'whot' ? 8 : state.gameType === 'trivia' ? 8 : state.gameType === 'connect-4' ? 2 : state.gameType === 'ettt' ? 2 : state.gameType === 'logo' ? 8 : 4),
    gameType: state.gameType ?? 'ludo',
    whotState: state.whotState ?? null,
    triviaState: state.triviaState ?? null,
    connect4State: state.connect4State ?? null,
    etttState: (state as { etttState?: EtttPublicState | null }).etttState ?? null,
    logoState: (state as { logoState?: LogoPublicState | null }).logoState ?? null,
    halfHalfState: (state as { halfHalfState?: HalfHalfPublicState | null }).halfHalfState ?? null,
    colorWahalaState: (state as { colorWahalaState?: ColorWahalaPublicState | null }).colorWahalaState ?? null,
    hustleState: (state as { hustleState?: import('@/lib/transport/types').HustlePublicState | null }).hustleState ?? null,
    wordWahalaState: (state as { wordWahalaState?: import('@/lib/transport/types').WordWahalaPublicState | null }).wordWahalaState ?? null,
  };
}

export function useColyseusRoom({
  roomCode,
  isHost,
  playerId,
  displayName = '',
  hostToken,
  gameType,
  enabled = true,
  onFatalConnectionError,
}: Options) {
  const [roomState, setRoomState] = useState<LegacyRoomState>({
    code: roomCode,
    hostId: '',
    status: 'lobby',
    members: [],
    gameState: null,
    reactions: [],
    pendingJoinRequests: [],
    roomPolicy: 'open',
    reactionPolicy: { ...DEFAULT_REACTION_POLICY },
    tauntPolicy: { ...DEFAULT_TAUNT_POLICY },
    reactionStats: {
      totalAccepted: 0,
      rejected: { cooldown: 0, rate_limited: 0, disabled: 0, duplicate: 0 },
      perUserAccepted: {},
    },
    reactionMoments: [],
    pauseState: { paused: false, reason: null, requestedBy: null, since: null, message: null },
    presenceBySeat: {},
    roomSettings: {
      aiAssistance: true,
      maxPlayers: gameType === 'whot' ? 8 : gameType === 'connect-4' || gameType === 'ettt' ? 2 : gameType === 'logo' ? 8 : 4,
      whotPenaltyStreaks: true,
      reactionBursts: true,
    },
    maxPlayers: gameType === 'whot' ? 8 : gameType === 'trivia' ? 8 : gameType === 'connect-4' || gameType === 'ettt' ? 2 : gameType === 'logo' ? 8 : 4,
    gameType: gameType ?? 'ludo',
    whotState: null,
    triviaState: null,
    connect4State: null,
    etttState: null,
    logoState: null,
    halfHalfState: null,
    colorWahalaState: null,
    hustleState: null,
    wordWahalaState: null,
  });
  const [privateState, setPrivateState] = useState<PrivateSeatState | null>(null);
  const [connected, setConnected] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [commentaryLine, setCommentaryLine] = useState<string | null>(null);
  const [recap, setRecap] = useState<RecapPayload | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus>('active');
  const [lastError, setLastError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [lastReactionAck, setLastReactionAck] = useState<ReactionAckEvent | null>(null);

  const handleRef = useRef<{ send: (i: Intent) => void; disconnect: () => void } | null>(null);
  const hasEverConnectedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reactionAckListenersRef = useRef<Set<(ack: ReactionAckEvent) => void>>(new Set());
  const prevCueStateRef = useRef<LegacyRoomState | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    setConnected(false);
    setSubscribed(false);
    setLastError(null);
    setKicked(false);

    (async () => {
      try {
        const handle = await connectColyseus({
          roomCode,
          isHost,
          deviceId: playerId,
          displayName,
          hostToken,
          gameType,
          partyId: isHost ? ensureDisplayPartyId() : undefined,
        });
        if (cancelled) {
          handle.disconnect();
          return;
        }
        handleRef.current = handle;
        setConnected(true);
        setSubscribed(true);
        hasEverConnectedRef.current = true;
        unsub = handle.onEvent((evt: ServerEvent) => {
          if (evt.type === 'public_state') {
            setRoomState(projectToLegacy(evt.state));
            setAiStatus(evt.state.aiStatus);
            setLastError(null);
          } else if (evt.type === 'private_state') {
            setPrivateState(evt.state);
          } else if (evt.type === 'kicked') {
            setKicked(true);
          } else if (evt.type === 'ai_commentary') {
            setCommentaryLine(evt.line);
          } else if (evt.type === 'ai_recap') {
            setRecap(evt.recap);
          } else if (evt.type === 'reaction_accepted') {
            const ack: ReactionAckEvent = {
              ok: true,
              emoji: evt.emoji,
              clientNonce: evt.clientNonce,
            };
            setLastReactionAck(ack);
            reactionAckListenersRef.current.forEach((fn) => fn(ack));
          } else if (evt.type === 'reaction_rejected') {
            const ack: ReactionAckEvent = {
              ok: false,
              emoji: evt.emoji,
              reason: evt.reason,
              retryAfterMs: evt.retryAfterMs,
              clientNonce: evt.clientNonce,
            };
            setLastReactionAck(ack);
            reactionAckListenersRef.current.forEach((fn) => fn(ack));
          } else if (evt.type === 'error') {
            setLastError(evt.code);
            if (evt.code === 'disconnected') {
              setConnected(false);
              setSubscribed(false);
              if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = window.setTimeout(() => {
                setReconnectAttempt((v) => v + 1);
              }, 1500);
            }
          }
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'connect_failed';
        setLastError(reason);
        setConnected(false);
        setSubscribed(false);
        if (!hasEverConnectedRef.current) {
          onFatalConnectionError?.(reason);
        } else {
          if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = window.setTimeout(() => {
            setReconnectAttempt((v) => v + 1);
          }, 1500);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      handleRef.current?.disconnect();
      handleRef.current = null;
    };
  }, [enabled, roomCode, isHost, playerId, displayName, hostToken, gameType, onFatalConnectionError, reconnectAttempt]);

  // Auto-clear commentary
  useEffect(() => {
    if (!commentaryLine) return;
    const t = window.setTimeout(() => setCommentaryLine(null), 6500);
    return () => window.clearTimeout(t);
  }, [commentaryLine]);

  useEffect(() => {
    const prev = prevCueStateRef.current;
    const curr = roomState;
    prevCueStateRef.current = curr;
    if (!prev) return;

    if (curr.status === 'finished' && prev.status !== 'finished') {
      sounds.win();
      if (!isHost) vibrate([90, 40, 90]);
    }
    if (curr.pauseState?.paused && !prev.pauseState?.paused) {
      sounds.click();
      if (!isHost) vibrate(20);
    }
    if (curr.members.length > prev.members.length) sounds.join();
    if (curr.reactions.length > prev.reactions.length) sounds.reaction();

    if (curr.gameType === 'trivia') {
      const prevLast = (prev.triviaState as { lastAction?: string } | null | undefined)?.lastAction ?? null;
      const nextLast = (curr.triviaState as { lastAction?: string } | null | undefined)?.lastAction ?? null;
      if (nextLast && nextLast !== prevLast) {
        if (/correct/i.test(nextLast)) triviaAudio.correct();
        else if (/wrong/i.test(nextLast)) triviaAudio.wrong();
        else triviaAudio.lockIn();
      }
      return;
    }

    if (curr.gameType === 'whot') {
      const prevPending = prev.whotState?.pendingDrawCount ?? 0;
      const nextPending = curr.whotState?.pendingDrawCount ?? 0;
      if (nextPending > prevPending) {
        sounds.capture();
        if (!isHost) vibrate([20, 25, 20]);
      }
      if (curr.whotState?.mustCallSuit && !prev.whotState?.mustCallSuit) sounds.click();
      return;
    }

    if (curr.gameType === 'ludo') {
      const prevAction = prev.gameState?.lastAction ?? '';
      const nextAction = curr.gameState?.lastAction ?? '';
      if (nextAction && nextAction !== prevAction) {
        if (/rolled/i.test(nextAction)) sounds.ludoDiceGlassRoll();
        else if (/captur/i.test(nextAction)) sounds.capture();
        else if (/home/i.test(nextAction)) sounds.enterHome();
        else sounds.tokenMove();
      }
      return;
    }

    const currAny = curr as unknown as Record<string, { lastAction?: string } | null | undefined>;
    const prevAny = prev as unknown as Record<string, { lastAction?: string } | null | undefined>;
    const nextKey = (
      currAny.connect4State?.lastAction ??
      currAny.etttState?.lastAction ??
      currAny.logoState?.lastAction ??
      currAny.landlordState?.lastAction ??
      currAny.halfHalfState?.lastAction ??
      currAny.colorWahalaState?.lastAction ??
      ''
    );
    const prevKey = (
      prevAny.connect4State?.lastAction ??
      prevAny.etttState?.lastAction ??
      prevAny.logoState?.lastAction ??
      prevAny.landlordState?.lastAction ??
      prevAny.halfHalfState?.lastAction ??
      prevAny.colorWahalaState?.lastAction ??
      ''
    );
    if (!nextKey || nextKey === prevKey) return;

    if (curr.gameType === 'connect-4' || curr.gameType === 'ettt') {
      if (/win|four|three|line|match/i.test(nextKey)) sounds.win();
      else if (/drop|place|move|turn/i.test(nextKey)) sounds.tokenMove();
      else sounds.click();
      return;
    }
    if (curr.gameType === 'logo') {
      if (/correct/i.test(nextKey)) triviaAudio.correct();
      else if (/wrong|reveal|answer/i.test(nextKey)) triviaAudio.wrong();
      else triviaAudio.lockIn();
      return;
    }
    if (curr.gameType === 'landlord') {
      if (/roll|dice|double/i.test(nextKey)) sounds.ludoDiceGlassRoll();
      else if (/buy|rent|pay|card|jail|mortgage|house/i.test(nextKey)) sounds.capture();
      else if (/win|bankrupt|finished/i.test(nextKey)) sounds.win();
      else sounds.click();
      if (!isHost && /pay|rent|jail|bankrupt/i.test(nextKey)) vibrate([25, 30, 25]);
      return;
    }
    if (curr.gameType === 'half-half') {
      if (/lock|guess/i.test(nextKey)) triviaAudio.lockIn();
      else if (/truth|reveal|closest|bullseye/i.test(nextKey)) sounds.capture();
      else sounds.click();
      return;
    }
    if (curr.gameType === 'color-wahala') {
      if (/tap|round|prompt/i.test(nextKey)) sounds.click();
      if (/correct|streak|bonus/i.test(nextKey)) triviaAudio.correct();
      else if (/wrong|answer/i.test(nextKey)) triviaAudio.wrong();
      return;
    }
    sounds.click();
  }, [roomState, isHost]);

  // Persist match on finish (host-only fallback, idempotent per match). The
  // server is authoritative in Colyseus; this path only covers fail-soft cases.
  const persistedMatchKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost) return;
    if (roomState.status !== 'finished') {
      // Reset so a subsequent match in the same session can persist.
      if (persistedMatchKeyRef.current && roomState.status === 'lobby') {
        persistedMatchKeyRef.current = null;
      }
      return;
    }
    const gt: GameType = roomState.gameType ?? 'ludo';
    let winnerDeviceId: string | null = null;
    let playerDeviceIds: string[] = [];
    const playerNames: Record<string, string> = {};
    let turnCount: number | undefined;
    if (gt === 'whot' && roomState.whotState) {
      winnerDeviceId = roomState.whotState.winnerId ?? null;
      playerDeviceIds = roomState.whotState.players.map((p) => p.id);
      roomState.whotState.players.forEach((p) => { playerNames[p.id] = p.displayName; });
      turnCount = roomState.whotState.turnNumber;
    } else if (roomState.gameState) {
      winnerDeviceId = roomState.gameState.winner ?? null;
      playerDeviceIds = roomState.gameState.players.map((p) => p.id);
      roomState.gameState.players.forEach((p) => { playerNames[p.id] = p.displayName; });
      turnCount = roomState.gameState.turnNumber;
    } else {
      return; // nothing to persist
    }
    // Client fallback only; server path uses the same deterministic key.
    const key = `${roomState.code}|${gt}|${winnerDeviceId ?? '_'}|${[...playerDeviceIds].sort().join(',')}`;
    if (persistedMatchKeyRef.current === key) return;
    persistedMatchKeyRef.current = key;
    recordMatchFinished({
      roomCode: roomState.code,
      winnerDeviceId,
      playerDeviceIds,
      playerNames,
      gameType: gt === 'whot' ? 'whot' : 'ludo',
      matchKey: key,
      turnCount,
      hostDisplayId: ensureHostDisplayId(),
      partyId: ensureDisplayPartyId(),
      skipProfileStats: true,
    }).catch((err) => console.error('[match] persist failed', err));
  }, [
    isHost,
    roomState.status,
    roomState.gameType,
    roomState.code,
    roomState.gameState,
    roomState.whotState,
  ]);

  const aiTrackerRef = useRef<AIStatusTracker>(new AIStatusTracker());
  const lastBroadcastedAIStatusRef = useRef<AIStatus | null>(null);

  // Host-only: derive and fan out AI health for Colyseus rooms too.
  useEffect(() => {
    if (!isHost) return;
    const unsub = onAICall((_kind, meta) => {
      const next = aiTrackerRef.current.record(meta);
      setAiStatus(next);
      if (next !== lastBroadcastedAIStatusRef.current) {
        lastBroadcastedAIStatusRef.current = next;
        handleRef.current?.send({ type: 'host:set_ai_status', status: next });
      }
    });
    return () => { unsub(); };
  }, [isHost]);

  // ──────────────────────────────────────────────────────────────────────
  // Host-only: Ludo AI commentary + recap wiring for Colyseus rooms.
  // ──────────────────────────────────────────────────────────────────────
  const prevLudoStateRef = useRef<LudoState | null>(null);
  const ludoEventQueueRef = useRef<ReturnType<typeof mapLudoTransitionToEvents>>([]);
  const ludoMatchStartRef = useRef<number | null>(null);
  const ludoCommentaryInFlightRef = useRef(false);
  const ludoRecapRequestedRef = useRef(false);
  const ludoLastFlushAtRef = useRef<number>(0);

  const resetLudoAIRefs = useCallback(() => {
    prevLudoStateRef.current = null;
    ludoEventQueueRef.current = [];
    ludoMatchStartRef.current = null;
    ludoCommentaryInFlightRef.current = false;
    ludoRecapRequestedRef.current = false;
    ludoLastFlushAtRef.current = 0;
  }, []);

  useEffect(() => {
    if (!isHost) return;
    if (roomState.gameType === 'whot' || roomState.status === 'lobby') {
      resetLudoAIRefs();
    }
  }, [isHost, roomState.gameType, roomState.status, resetLudoAIRefs]);

  useEffect(() => {
    if (!isHost) return;
    if (roomState.gameType === 'whot') return;
    const next = roomState.gameState;
    if (!next) return;
    if (ludoMatchStartRef.current == null && next.phase !== 'finished') {
      ludoMatchStartRef.current = Date.now();
      ludoRecapRequestedRef.current = false;
    }
    const events = mapLudoTransitionToEvents(prevLudoStateRef.current, next);
    if (events.length > 0) {
      ludoEventQueueRef.current.push(...events);
      if (ludoEventQueueRef.current.length > 12) {
        ludoEventQueueRef.current = ludoEventQueueRef.current.slice(-12);
      }
    }
    prevLudoStateRef.current = next;
  }, [isHost, roomState.gameType, roomState.gameState]);

  useEffect(() => {
    if (!isHost) return;
    let cancelled = false;
    const TICK_MS = 1000;
    const COOLDOWN_MS = 4000;
    const id = window.setInterval(() => {
      if (cancelled) return;
      if (ludoCommentaryInFlightRef.current) return;
      const queue = ludoEventQueueRef.current;
      if (queue.length === 0) return;
      const gs = roomState.gameState;
      if (!gs) return;
      const now = Date.now();
      if (now - ludoLastFlushAtRef.current < COOLDOWN_MS) return;
      const dedup: typeof queue = [];
      for (const ev of queue) {
        const last = dedup[dedup.length - 1];
        if (last && last.type === ev.type && last.actor === ev.actor && last.value === ev.value) continue;
        dedup.push(ev);
      }
      ludoEventQueueRef.current = [];
      ludoLastFlushAtRef.current = now;
      const players = gs.players.map((p) => ({ name: p.displayName, color: p.color }));
      ludoCommentaryInFlightRef.current = true;
      getCommentary({ roomCode: roomState.code, events: dedup, players, gameType: 'ludo', persona: roomState.roomSettings?.aiPersona })
        .then((line) => {
          if (cancelled || !line) return;
          setCommentaryLine(line);
          handleRef.current?.send({ type: 'host:broadcast_commentary', line });
        })
        .finally(() => {
          ludoCommentaryInFlightRef.current = false;
        });
    }, TICK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isHost, roomState.code, roomState.gameState, roomState.roomSettings?.aiPersona]);

  useEffect(() => {
    if (!isHost) return;
    if (roomState.gameType === 'whot') return;
    const gs = roomState.gameState;
    if (!gs || gs.phase !== 'finished') return;
    if (ludoRecapRequestedRef.current) return;
    ludoRecapRequestedRef.current = true;
    const payload = buildLudoRecapInput({
      roomCode: roomState.code,
      state: gs,
      matchStartedAt: ludoMatchStartRef.current ?? Date.now(),
    });
    getRecap(payload).then((r) => {
      if (!r) return;
      setRecap(r);
      handleRef.current?.send({ type: 'host:broadcast_recap', recap: r });
    });
  }, [isHost, roomState.gameType, roomState.gameState, roomState.code]);

  // ──────────────────────────────────────────────────────────────────────
  // Host-only: Whot AI commentary + recap wiring (additive; no protocol break)
  // ──────────────────────────────────────────────────────────────────────
  const prevWhotStateRef = useRef<typeof roomState.whotState>(null);
  const whotEventQueueRef = useRef<ReturnType<typeof mapWhotTransitionToEvents>>([]);
  const whotSignalsRef = useRef<WhotMatchSignals>(emptyWhotSignals());
  const whotMatchStartRef = useRef<number | null>(null);
  const whotCommentaryInFlightRef = useRef(false);
  const whotRecapRequestedRef = useRef(false);
  const whotLastFlushAtRef = useRef<number>(0);

  const resetWhotAIRefs = useCallback(() => {
    prevWhotStateRef.current = null;
    whotEventQueueRef.current = [];
    whotSignalsRef.current = emptyWhotSignals();
    whotMatchStartRef.current = null;
    whotRecapRequestedRef.current = false;
    whotCommentaryInFlightRef.current = false;
    whotLastFlushAtRef.current = 0;
  }, []);

  // Reset when leaving Whot or returning to lobby (covers play-again).
  useEffect(() => {
    if (!isHost) return;
    if (roomState.gameType !== 'whot' || roomState.status === 'lobby') {
      resetWhotAIRefs();
    }
  }, [isHost, roomState.gameType, roomState.status, resetWhotAIRefs]);

  // Diff whot state on every roomState change (host-only).
  useEffect(() => {
    if (!isHost) return;
    if (roomState.gameType !== 'whot') return;
    const next = roomState.whotState;
    if (!next) return;
    // First time we see a playing state, stamp match start + reset signals.
    if (whotMatchStartRef.current == null && next.phase === 'playing') {
      whotMatchStartRef.current = Date.now();
      whotSignalsRef.current = emptyWhotSignals();
      whotRecapRequestedRef.current = false;
    }
    const events = mapWhotTransitionToEvents(prevWhotStateRef.current ?? null, next);
    if (events.length > 0) {
      whotEventQueueRef.current.push(...events);
      whotSignalsRef.current = foldEventsIntoSignals(whotSignalsRef.current, events);
    }
    prevWhotStateRef.current = next;
  }, [isHost, roomState.gameType, roomState.whotState]);

  // Adaptive debounced commentary flush (host-only).
  useEffect(() => {
    if (!isHost) return;
    let cancelled = false;
    const TICK_MS = 750;
    const COOLDOWN_FAST_MS = 1500;
    const COOLDOWN_SLOW_MS = 5000;
    const id = window.setInterval(() => {
      if (cancelled) return;
      if (whotCommentaryInFlightRef.current) return;
      const queue = whotEventQueueRef.current;
      if (queue.length === 0) return;
      const wState = roomState.whotState;
      if (!wState) return;
      const now = Date.now();
      const cooldown = queue.length >= 3 ? COOLDOWN_FAST_MS : COOLDOWN_SLOW_MS;
      if (now - whotLastFlushAtRef.current < cooldown) return;
      // Coalesce: dedupe consecutive whot_play of same actor+value (low signal).
      const dedup: typeof queue = [];
      for (const ev of queue) {
        const last = dedup[dedup.length - 1];
        if (
          last &&
          last.type === 'whot_play' &&
          ev.type === 'whot_play' &&
          last.actor === ev.actor &&
          last.value === ev.value
        ) {
          continue;
        }
        dedup.push(ev);
      }
      whotEventQueueRef.current = [];
      whotLastFlushAtRef.current = now;
      const players = wState.players.map((p) => ({ name: p.displayName, color: p.color ?? '' }));
      whotCommentaryInFlightRef.current = true;
      getCommentary({ roomCode: roomState.code, events: dedup, players, gameType: 'whot', persona: roomState.roomSettings?.aiPersona })
        .then((line) => {
          if (cancelled || !line) return;
          // Local immediate update + broadcast to all clients via server.
          setCommentaryLine(line);
          handleRef.current?.send({ type: 'host:broadcast_commentary', line });
        })
        .finally(() => {
          whotCommentaryInFlightRef.current = false;
        });
    }, TICK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isHost, roomState.code, roomState.whotState, roomState.roomSettings?.aiPersona]);

  // Recap on Whot finish (host-only, fires once per match, broadcast to all).
  useEffect(() => {
    if (!isHost) return;
    if (roomState.gameType !== 'whot') return;
    const wState = roomState.whotState;
    if (!wState || wState.phase !== 'finished') return;
    if (whotRecapRequestedRef.current) return;
    whotRecapRequestedRef.current = true;
    const payload = buildWhotRecapInput({
      roomCode: roomState.code,
      state: wState,
      signals: whotSignalsRef.current,
      matchStartedAt: whotMatchStartRef.current ?? Date.now(),
    });
    getRecap(payload).then((r) => {
      if (!r) return;
      setRecap(r);
      handleRef.current?.send({ type: 'host:broadcast_recap', recap: r });
    });
  }, [isHost, roomState.gameType, roomState.whotState, roomState.code]);


  const send = useCallback((intent: Intent) => {
    handleRef.current?.send(intent);
  }, []);

  useEffect(() => {
    if (!enabled || isHost) return;
    const sendVisibility = () => {
      send({ type: 'player:set_visibility', hidden: document.visibilityState === 'hidden' });
    };
    sendVisibility();
    document.addEventListener('visibilitychange', sendVisibility);
    window.addEventListener('pagehide', sendVisibility);
    return () => {
      document.removeEventListener('visibilitychange', sendVisibility);
      window.removeEventListener('pagehide', sendVisibility);
    };
  }, [enabled, isHost, send]);

  // Action surface
  const startGame = useCallback(() => send({ type: 'host:start_game' }), [send]);
  const performAction = useCallback((type: string, data?: { tokenId?: number; dieChoice?: 'd1' | 'd2' | 'sum' }) => {
    if (type === 'roll_dice') send({ type: 'roll_dice' });
    else if (type === 'move_token' && typeof data?.tokenId === 'number') {
      send({ type: 'move_token', tokenId: data.tokenId, dieChoice: data.dieChoice });
    }
  }, [send]);
  const toggleReady = useCallback(() => send({ type: 'toggle_ready' }), [send]);
  const sendEmoji = useCallback((emoji: string, clientNonce?: string) => {
    send({ type: 'send_reaction', emoji, clientNonce });
  }, [send]);
  const playAgain = useCallback(() => send({ type: 'host:play_again' }), [send]);
  const pauseGame = useCallback(() => send({ type: 'host:pause_game' }), [send]);
  const resumeGame = useCallback(() => send({ type: 'host:resume_game' }), [send]);
  const endGame = useCallback((reason?: string) => send({ type: 'host:end_game', reason }), [send]);
  const requestPause = useCallback(() => send({ type: 'player:pause_request' }), [send]);
  const requestLeave = useCallback(() => send({ type: 'player:leave_request' }), [send]);
  const kickPlayer = useCallback((targetId: string) => {
    if (targetId === playerId) return;
    send({ type: 'host:kick', playerId: targetId });
  }, [send, playerId]);

  // Host actions
  const approveJoin = useCallback(
    (requestId: string, mode: 'spectator' | 'transfer' | 'spawn', targetSeatId?: string) =>
      send({ type: 'host:approve_join', requestId, mode, targetSeatId }),
    [send],
  );
  const rejectJoin = useCallback(
    (requestId: string) => send({ type: 'host:reject_join', requestId }),
    [send],
  );
  const addBot = useCallback(
    (difficulty: 'easy' | 'smart' = 'smart') => send({ type: 'host:add_bot', difficulty }),
    [send],
  );
  const removeBot = useCallback((botId: string) => send({ type: 'host:remove_bot', botId }), [send]);
  const replaceBotWithHuman = useCallback(
    (botId: string, humanDeviceId: string) =>
      send({ type: 'host:replace_bot_with_human', botId, humanDeviceId }),
    [send],
  );
  const autofillBots = useCallback(
    (targetCount: number, difficulty: 'easy' | 'smart' = 'smart') =>
      send({ type: 'host:autofill_bots', targetCount, difficulty }),
    [send],
  );
  const setRoomPolicy = useCallback(
    (policy: 'open' | 'approval' | 'locked') => send({ type: 'host:set_room_policy', policy }),
    [send],
  );
  const setAiAssistance = useCallback(
    (enabled: boolean) => send({ type: 'host:set_ai_assistance', enabled }),
    [send],
  );
  const setGameSettings = useCallback(
    (settings: Partial<RoomSettings>) => send({ type: 'host:set_game_settings', settings }),
    [send],
  );

  // New reaction host actions
  const setReactionPolicy = useCallback(
    (policy: Partial<ReactionPolicy>) => send({ type: 'host:set_reaction_policy', policy }),
    [send],
  );
  const setTauntPolicy = useCallback(
    (policy: Partial<TauntPolicy>) => send({ type: 'host:set_taunt_policy', policy }),
    [send],
  );
  const clearReactions = useCallback(() => send({ type: 'host:clear_reactions' }), [send]);

  // Whot scaffold actions (Step 4) — additive, no-op against ludo path.
  const setGameType = useCallback(
    (gameType: GameType) => send({ type: 'host:set_game_type', gameType }),
    [send],
  );
  const whotDrawCard = useCallback(() => send({ type: 'whot:draw_card' }), [send]);
  const whotPlayCard = useCallback(
    (cardId: string, calledShape?: WhotShape) =>
      send({ type: 'whot:play_card', cardId, calledShape }),
    [send],
  );
  const whotCallSuit = useCallback(
    (shape: WhotShape) => send({ type: 'whot:call_suit', shape }),
    [send],
  );
  const whotAnnounceLastCard = useCallback(
    () => send({ type: 'whot:announce_last_card' }),
    [send],
  );

  // Trivia (additive)
  const setTriviaSettings = useCallback(
    (settings: Partial<TriviaSettings>) => send({ type: 'host:set_trivia_settings', settings }),
    [send],
  );
  const triviaLockAnswer = useCallback(
    (pickedIndex: 0 | 1 | 2 | 3) => send({ type: 'trivia:lock_answer', pickedIndex }),
    [send],
  );
  const crowdVoteTrivia = useCallback(
    (pickedIndex: 0 | 1 | 2 | 3) => send({ type: 'crowd:vote_trivia', pickedIndex }),
    [send],
  );

  // Connect 4 (additive)
  const connect4Drop = useCallback(
    (column: number) => send({ type: 'connect4:drop', column }),
    [send],
  );

  // ETTT (additive)
  const etttPlace = useCallback(
    (row: number, col: number) => send({ type: 'ettt:place', row, col }),
    [send],
  );

  // Logo Guesser (additive)
  const setLogoSettings = useCallback(
    (settings: Partial<LogoSettings>) => send({ type: 'host:set_logo_settings', settings }),
    [send],
  );
  const logoLockPick = useCallback(
    (pickedIndex: 0 | 1 | 2 | 3) => send({ type: 'logo:lock_pick', pickedIndex }),
    [send],
  );
  const logoLockText = useCallback(
    (guess: string) => send({ type: 'logo:lock_text', guess }),
    [send],
  );

  // Oga Landlord (additive)
  const landlordRoll = useCallback(() => send({ type: 'landlord:roll' }), [send]);
  const landlordBuy = useCallback(() => send({ type: 'landlord:buy' }), [send]);
  const landlordDecline = useCallback(() => send({ type: 'landlord:decline' }), [send]);
  const landlordAckCard = useCallback(() => send({ type: 'landlord:ack_card' }), [send]);
  const landlordPayJailFine = useCallback(() => send({ type: 'landlord:pay_jail_fine' }), [send]);
  const landlordUseJailCard = useCallback(() => send({ type: 'landlord:use_jail_card' }), [send]);
  const landlordEndTurn = useCallback(() => send({ type: 'landlord:end_turn' }), [send]);
  const landlordBuild = useCallback((propertyId: number) => send({ type: 'landlord:build', propertyId }), [send]);
  const landlordSellHouse = useCallback((propertyId: number) => send({ type: 'landlord:sell_house', propertyId }), [send]);
  const landlordMortgage = useCallback((propertyId: number) => send({ type: 'landlord:mortgage', propertyId }), [send]);
  const landlordUnmortgage = useCallback((propertyId: number) => send({ type: 'landlord:unmortgage', propertyId }), [send]);
  const landlordBid = useCallback(
    (amount: number) => send({ type: 'landlord:bid', amount }),
    [send],
  );
  const landlordBidPass = useCallback(() => send({ type: 'landlord:bid_pass' }), [send]);
  const landlordProposeTrade = useCallback(
    (offer: {
      toId: string;
      cashFromOfferer: number;
      offererPropertyIds: number[];
      targetPropertyIds: number[];
      offererJailCards: number;
      targetJailCards: number;
    }) => send({ type: 'landlord:propose_trade', ...offer }),
    [send],
  );
  const landlordCancelTrade = useCallback(() => send({ type: 'landlord:cancel_trade' }), [send]);
  const landlordRespondTrade = useCallback(
    (accept: boolean) => send({ type: 'landlord:respond_trade', accept }),
    [send],
  );
  const setLandlordSettings = useCallback(
    (settings: Partial<import('@/lib/transport/types').LandlordSettings>) =>
      send({ type: 'host:set_landlord_settings', settings }),
    [send],
  );

  // Half & Half (additive)
  const setHalfHalfSettings = useCallback(
    (settings: Partial<HalfHalfSettings>) => send({ type: 'host:set_halfhalf_settings', settings }),
    [send],
  );
  const halfHalfLockGuess = useCallback(
    (position: number) => send({ type: 'halfhalf:lock_guess', position }),
    [send],
  );

  // Color Wahala (additive)
  const setColorWahalaSettings = useCallback(
    (settings: Partial<ColorWahalaSettings>) => send({ type: 'host:set_colorwahala_settings', settings }),
    [send],
  );
  const colorWahalaTap = useCallback(
    (colorId: string) => send({ type: 'colorwahala:tap', colorId, clientTs: Date.now() }),
    [send],
  );

  // Hustle (additive)
  const setHustleSettings = useCallback(
    (settings: Partial<import('@/lib/transport/types').HustleSettings>) =>
      send({ type: 'host:set_hustle_settings', settings }),
    [send],
  );
  const hustleRoll = useCallback(() => send({ type: 'hustle:roll' }), [send]);
  const hustlePlayCard = useCallback(
    (instanceId: string, targetPlayerId: string | null = null) =>
      send({ type: 'hustle:play_card', instanceId, targetPlayerId }),
    [send],
  );
  const hustleClaimJapa = useCallback(() => send({ type: 'hustle:claim_japa' }), [send]);
  const hustleDeclineJapa = useCallback(() => send({ type: 'hustle:decline_japa' }), [send]);

  // Word Wahala (additive)
  const setWordWahalaSettings = useCallback(
    (settings: Partial<import('@/lib/transport/types').WordWahalaSettings>) =>
      send({ type: 'host:set_wordwahala_settings', settings }),
    [send],
  );
  const wordWahalaPlay = useCallback(
    (placements: import('@/lib/transport/types').WordWahalaPlacementIntent[]) =>
      send({ type: 'wordwahala:play', placements }),
    [send],
  );
  const wordWahalaPass = useCallback(() => send({ type: 'wordwahala:pass' }), [send]);
  const wordWahalaSwap = useCallback(
    (letters: string[]) => send({ type: 'wordwahala:swap', letters }),
    [send],
  );

  const onReactionAck = useCallback((fn: (ack: ReactionAckEvent) => void) => {
    reactionAckListenersRef.current.add(fn);
    return () => {
      reactionAckListenersRef.current.delete(fn);
    };
  }, []);

  const syncStatus: SyncStatus = !connected
    ? lastError
      ? 'reconnecting'
      : 'connecting'
    : subscribed
      ? 'ready'
      : 'syncing';

  const presenceMap: Record<string, number> = {};
  for (const [seatId, presence] of Object.entries(roomState.presenceBySeat)) {
    presenceMap[seatId] = presence.lastSeenAt;
  }

  return {
    transportKind: 'colyseus' as const,
    roomState,
    privateState,
    connected,
    syncStatus,
    presenceMap,
    kicked,
    commentaryLine,
    recap,
    aiStatus,
    lastErrorCode: lastError,
    retryCount: reconnectAttempt,
    lastReactionAck,
    onReactionAck,
    startGame,
    performAction,
    toggleReady,
    sendEmoji,
    playAgain,
    pauseGame,
    resumeGame,
    endGame,
    requestPause,
    requestLeave,
    kickPlayer,
    approveJoin,
    rejectJoin,
    addBot,
    removeBot,
    replaceBotWithHuman,
    autofillBots,
    setRoomPolicy,
    setAiAssistance,
    setGameSettings,
    setReactionPolicy,
    setTauntPolicy,
    clearReactions,
    // Whot scaffold (additive)
    privateWhotState: privateState?.whotState ?? null,
    setGameType,
    whotDrawCard,
    whotPlayCard,
    whotCallSuit,
    whotAnnounceLastCard,
    // Trivia (additive)
    privateTriviaState: privateState?.triviaState ?? null,
    setTriviaSettings,
    triviaLockAnswer,
    crowdVoteTrivia,
    // Connect 4 (additive)
    connect4Drop,
    // ETTT (additive)
    etttPlace,
    // Logo Guesser (additive)
    privateLogoState: privateState?.logoState ?? null,
    setLogoSettings,
    logoLockPick,
    logoLockText,
    // Oga Landlord (additive)
    landlordRoll,
    landlordBuy,
    landlordDecline,
    landlordAckCard,
    landlordPayJailFine,
    landlordUseJailCard,
    landlordEndTurn,
    landlordBuild,
    landlordSellHouse,
    landlordMortgage,
    landlordUnmortgage,
    landlordBid,
    landlordBidPass,
    landlordProposeTrade,
    landlordCancelTrade,
    landlordRespondTrade,
    setLandlordSettings,
    // Half & Half (additive)
    privateHalfHalfState: privateState?.halfHalfState ?? null,
    setHalfHalfSettings,
    halfHalfLockGuess,
    // Color Wahala (additive)
    privateColorWahalaState: privateState?.colorWahalaState ?? null,
    setColorWahalaSettings,
    colorWahalaTap,
    // Hustle (additive)
    setHustleSettings,
    hustleRoll,
    hustlePlayCard,
    hustleClaimJapa,
    hustleDeclineJapa,
    // Word Wahala (additive)
    privateWordWahalaState: privateState?.wordWahalaState ?? null,
    setWordWahalaSettings,
    wordWahalaPlay,
    wordWahalaPass,
    wordWahalaSwap,
  };
}
