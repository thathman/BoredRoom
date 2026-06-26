import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, type Room } from '@colyseus/sdk';
import {
  fetchSessionWithRun,
  getControlCredential,
  type ActiveRun,
  type CreatedSession,
  type SessionMember,
  type SessionRecap,
} from '@/lib/serverApi';

export type HouseSessionRole = 'display' | 'controller' | 'crowd' | 'companion';

export interface HouseSessionSnapshot {
  session: CreatedSession;
  members: SessionMember[];
  activeRun: ActiveRun | null;
  lastRecap?: SessionRecap;
}

interface UseHouseSessionInput {
  code: string;
  deviceId: string;
  displayName: string;
  role: HouseSessionRole;
  enabled?: boolean;
}

const COLYSEUS_URL = import.meta.env.VITE_COLYSEUS_URL || 'ws://localhost:2567';

export function useHouseSession({
  code,
  deviceId,
  displayName,
  role,
  enabled = true,
}: UseHouseSessionInput) {
  const [snapshot, setSnapshot] = useState<HouseSessionSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [lastTransition, setLastTransition] = useState<string | null>(null);
  const [votePoll, setVotePoll] = useState<{ options: string[]; tally: Record<string, number> } | null>(null);
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
        setStatus('missing');
        return;
      }
      setSnapshot(initial);

      try {
        const client = new Client(COLYSEUS_URL);
        const room = await client.joinOrCreate('house-session', {
          code: normalizedCode,
          deviceId,
          displayName,
          role,
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
          setStatus('ready');
        });
        room.onMessage('session:transition', (event: { type?: string; options?: string[]; tally?: Record<string, number> }) => {
          setLastTransition(event.type ?? null);
          if (event.type === 'vote.opened' && Array.isArray(event.options)) {
            setVotePoll({ options: event.options, tally: event.tally ?? {} });
          }
          if (event.type === 'vote.cast' && event.tally) {
            setVotePoll((current) => current ? { ...current, tally: event.tally ?? {} } : null);
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
  }, [code, deviceId, displayName, enabled, role]);

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

  const callVote = useCallback((options: string[]) => {
    roomRef.current?.send('session:call_vote', { options });
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

  return {
    snapshot,
    status,
    lastTransition,
    gamePublicState,
    gamePrivateState,
    aiResult,
    votePoll,
    setReady,
    sendGameIntent,
    requestHint,
    castVote,
    callVote,
    selectGame,
    startGame,
    switchGame,
    endGame,
    pauseGame,
    resumeGame,
    refresh,
  };
}
