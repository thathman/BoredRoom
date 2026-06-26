import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, type Room } from '@colyseus/sdk';
import {
  fetchSessionWithRun,
  getControlCredential,
  type ActiveRun,
  type CreatedSession,
  type HouseVote,
  type HouseVoteResult,
  type SessionMember,
  type SessionRecap,
} from '@/lib/serverApi';

export type HouseSessionRole = 'display' | 'controller' | 'crowd' | 'companion';

export interface HouseSessionSnapshot {
  session: CreatedSession;
  members: SessionMember[];
  activeRun: ActiveRun | null;
  activeVote: HouseVote | null;
  voteHistory: HouseVoteResult[];
  lastRecap?: SessionRecap;
}

interface UseHouseSessionInput {
  code: string;
  deviceId: string;
  displayName: string;
  role: HouseSessionRole;
  avatar?: string;
  accentColor?: string;
  enabled?: boolean;
}

const COLYSEUS_URL = import.meta.env.VITE_COLYSEUS_URL || 'ws://localhost:2567';

export function useHouseSession({
  code,
  deviceId,
  displayName,
  role,
  avatar,
  accentColor,
  enabled = true,
}: UseHouseSessionInput) {
  const [snapshot, setSnapshot] = useState<HouseSessionSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [lastTransition, setLastTransition] = useState<string | null>(null);
  const [activeVote, setActiveVote] = useState<HouseVote | null>(null);
  const [voteHistory, setVoteHistory] = useState<HouseVoteResult[]>([]);
  const [kicked, setKicked] = useState<{ reason: string } | null>(null);
  const [gamePublicState, setGamePublicState] = useState<{
    gameType: string;
    state: unknown;
  } | null>(null);
  const [gamePrivateState, setGamePrivateState] = useState<{
    gameType: string;
    state: unknown;
  } | null>(null);
  const [aiResult, setAiResult] = useState<{ kind: 'commentary' | 'hint' | 'pacing'; text: string | null } | null>(null);
  const roomRef = useRef<Room | null>(null);
  const reconnectRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let reconnectTimer: number | null = null;
    const normalizedCode = code.trim().toUpperCase();

    async function connect() {
      setStatus('loading');
      const initial = await fetchSessionWithRun(normalizedCode).catch(() => null);
      if (cancelled) return;
      if (!initial) {
        setSnapshot(null);
        setActiveVote(null);
        setVoteHistory([]);
        setStatus('missing');
        return;
      }
      setSnapshot(initial);
      setActiveVote(initial.activeVote ?? null);
      setVoteHistory(initial.voteHistory ?? []);

      try {
        const client = new Client(COLYSEUS_URL);
        const room = await client.joinOrCreate('house-session', {
          code: normalizedCode,
          deviceId,
          displayName,
          role,
          avatar,
          accentColor,
          ownerCredential:
            role === 'display' || role === 'companion'
              ? getControlCredential(normalizedCode)
              : undefined,
        });
        if (cancelled) {
          room.leave();
          return;
        }
        roomRef.current = room;
        room.onMessage('session:state', (next: HouseSessionSnapshot) => {
          setSnapshot(next);
          setActiveVote(next.activeVote ?? null);
          setVoteHistory(next.voteHistory ?? []);
          setStatus('ready');
        });
        room.onMessage('session:transition', (event: {
          type?: string;
          vote?: HouseVote;
          result?: HouseVoteResult | null;
        }) => {
          setLastTransition(event.type ?? null);
          if (event.vote) {
            setActiveVote(event.vote);
          }
          if (event.result) {
            setVoteHistory((current) => [event.result as HouseVoteResult, ...current.filter((item) => item.voteId !== event.result?.voteId)].slice(0, 25));
          }
          if (event.type === 'vote.archived') {
            setActiveVote(null);
          }
        });
        room.onMessage('game:public_state', (payload: { gameType: string; state: unknown }) => {
          setGamePublicState(payload);
        });
        room.onMessage('game:private_state', (payload: { gameType: string; state: unknown }) => {
          setGamePrivateState(payload);
        });
        room.onMessage('ai:result', (payload: { kind: 'commentary' | 'hint' | 'pacing'; text: string | null }) => {
          setAiResult(payload);
        });
        room.onMessage('session:kicked', (payload: { reason?: string }) => {
          setKicked({ reason: payload?.reason ?? 'Removed by host.' });
        });
        room.onError((codeNumber, message) => {
          console.warn('[house-session] room error', codeNumber, message);
          setStatus('error');
        });
        room.onLeave(() => {
          roomRef.current = null;
          if (cancelled) return;
          setStatus('loading');
          reconnectTimer = window.setTimeout(() => {
            reconnectRef.current += 1;
            void connect();
          }, 1200);
        });
        room.send('session:request_state');
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'session_connect_failed';
        setStatus(message.includes('session_not_found') ? 'missing' : 'error');
      }
    }

    void connect();
    return () => {
      cancelled = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, [code, deviceId, displayName, enabled, role, avatar, accentColor]);

  const setReady = useCallback((ready: boolean) => {
    roomRef.current?.send('session:ready', { ready });
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchSessionWithRun(code).catch(() => null);
    if (next) {
      setSnapshot(next);
      setStatus('ready');
    }
  }, [code]);

  const sendGameIntent = useCallback((intent: Record<string, unknown>) => {
    roomRef.current?.send('game:intent', intent);
  }, []);

  const requestHint = useCallback(() => {
    roomRef.current?.send('ai:request_hint');
  }, []);

  const castVote = useCallback((option: string) => {
    roomRef.current?.send('vote:cast', { option });
  }, []);

  const callVote = useCallback((options: string[], opts?: { type?: string; question?: string; settings?: Record<string, unknown> }) => {
    roomRef.current?.send('session:call_vote', {
      type: opts?.type ?? 'game_selection',
      question: opts?.question ?? 'Which game should we play next?',
      options,
      settings: opts?.settings,
    });
  }, []);

  const requestVote = useCallback((options: string[], opts?: { type?: string; question?: string }) => {
    roomRef.current?.send('vote:request', { type: opts?.type, question: opts?.question, options });
  }, []);

  const closeVote = useCallback(() => {
    roomRef.current?.send('vote:close');
  }, []);

  const cancelVote = useCallback(() => {
    roomRef.current?.send('vote:cancel');
  }, []);

  const applyVoteResult = useCallback(() => {
    roomRef.current?.send('vote:apply');
  }, []);

  const overrideVote = useCallback((option: string, reason?: string) => {
    roomRef.current?.send('vote:override', { option, reason });
  }, []);

  const selectGame = useCallback((gameId: string, settings: Record<string, unknown> = {}) => {
    roomRef.current?.send('session:select_game', { gameId, settings });
  }, []);

  const startGame = useCallback((gameId?: string, settings: Record<string, unknown> = {}) => {
    roomRef.current?.send('session:start_game', { gameId, settings });
  }, []);

  const switchGame = useCallback((gameId: string, settings: Record<string, unknown> = {}) => {
    roomRef.current?.send('session:switch_game', { gameId, settings });
  }, []);

  const endGame = useCallback(() => {
    roomRef.current?.send('session:end_game');
  }, []);

  const pauseGame = useCallback((reason = 'player_pause') => {
    roomRef.current?.send('session:pause_game', { reason });
  }, []);

  const resumeGame = useCallback(() => {
    roomRef.current?.send('session:resume_game');
  }, []);

  const kickPlayer = useCallback((targetDeviceId: string, reason?: string) => {
    roomRef.current?.send('session:kick_player', { deviceId: targetDeviceId, reason });
  }, []);

  const setRemoteMode = useCallback((enabled: boolean) => {
    roomRef.current?.send('session:set_remote_mode', { enabled });
  }, []);

  const endParty = useCallback(() => {
    roomRef.current?.send('session:end_party');
  }, []);

  const deleteParty = useCallback((confirm: string) => {
    roomRef.current?.send('session:delete_party', { confirm });
  }, []);

  return {
    snapshot,
    status,
    lastTransition,
    gamePublicState,
    gamePrivateState,
    aiResult,
    activeVote,
    voteHistory,
    votePoll: activeVote && ['open', 'locked', 'resolved', 'expired'].includes(activeVote.status)
      ? { options: activeVote.options, tally: activeVote.tally, status: activeVote.status, result: activeVote.result }
      : null,
    setReady,
    sendGameIntent,
    requestHint,
    castVote,
    callVote,
    requestVote,
    closeVote,
    cancelVote,
    applyVoteResult,
    overrideVote,
    selectGame,
    startGame,
    switchGame,
    endGame,
    pauseGame,
    resumeGame,
    kickPlayer,
    setRemoteMode,
    endParty,
    deleteParty,
    refresh,
    kicked,
  };
}
