/**
 * Replay recorder hook — host-display only.
 *
 * Lifecycle wiring:
 *   - On `status` transitioning into 'playing': call initReplay() and stash {id, startedAt}
 *   - On any change to `(turnNumber, lastAction)`: append a turn snapshot
 *   - On `status` transitioning into 'finished': finalize with derived result
 *
 * Snapshot shape is intentionally a generic JSON blob — the visual replay
 * viewer dumps it as JSON and games can layer their own renderer later.
 *
 * Cheap throttle: we only record a turn when (turnNumber, lastAction) changes
 * vs the last recorded tuple. We never await the network call from the effect.
 */
import { useEffect, useRef } from 'react';
import type { RoomState } from '@/lib/realtimeRoom';
import type { RecapPayload } from '@/lib/ai';
import { deriveGameResult } from '@/lib/gameResult';
import { initReplay, recordReplayTurn, finalizeReplay } from '@/lib/replay';

interface TurnLikeState {
  turnNumber?: number;
  lastAction?: string;
  [k: string]: unknown;
}

interface Args {
  enabled: boolean; // host display only
  status: 'lobby' | 'playing' | 'finished' | 'paused' | string;
  roomState: RoomState | null;
  /** Per-game public state (Connect4Public, EtttPublic, HustlePublic, …). */
  gameState: TurnLikeState | null;
  recap?: RecapPayload | null;
}

export interface ReplayRecorderHandle {
  replayId: string | null;
  shareUrl: string | null;
}

const handleStore: { current: ReplayRecorderHandle } = {
  current: { replayId: null, shareUrl: null },
};

export function useReplayRecorder({ enabled, status, roomState, gameState, recap }: Args): ReplayRecorderHandle {
  const replayIdRef = useRef<string | null>(null);
  const shareUrlRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const lastTurnKeyRef = useRef<string>('');
  const turnCountRef = useRef<number>(0);
  const finalizedRef = useRef<boolean>(false);

  // INIT on transition into playing
  useEffect(() => {
    if (!enabled || !roomState) return;
    if (status !== 'playing') return;
    if (replayIdRef.current) return;
    const playerNames: Record<string, string> = {};
    for (const m of roomState.members) {
      if (!m.isSpectator) playerNames[m.id] = m.displayName;
    }
    const gameType = (roomState as { gameType?: string }).gameType ?? 'ludo';
    startedAtRef.current = Date.now();
    void initReplay({
      roomCode: roomState.code,
      gameType,
      playerNames,
    }).then((res) => {
      if (res) {
        replayIdRef.current = res.id;
        shareUrlRef.current = res.url;
        handleStore.current = { replayId: res.id, shareUrl: res.url };
      }
    });
  }, [enabled, status, roomState]);

  // TURN snapshot
  useEffect(() => {
    if (!enabled) return;
    if (status !== 'playing') return;
    if (!replayIdRef.current || !gameState) return;
    const tn = typeof gameState.turnNumber === 'number' ? gameState.turnNumber : turnCountRef.current;
    const la = typeof gameState.lastAction === 'string' ? gameState.lastAction : '';
    const key = `${tn}::${la}`;
    if (key === lastTurnKeyRef.current) return;
    lastTurnKeyRef.current = key;
    turnCountRef.current = tn;
    const replayId = replayIdRef.current;
    void recordReplayTurn(replayId, tn, gameState as Record<string, unknown>, la || undefined);
  }, [enabled, status, gameState]);

  // FINALIZE on finished
  useEffect(() => {
    if (!enabled || !roomState) return;
    if (status !== 'finished') return;
    if (!replayIdRef.current || finalizedRef.current) return;
    finalizedRef.current = true;
    const result = deriveGameResult(roomState as unknown as RoomState & Record<string, unknown>);
    const playerNames: Record<string, string> = {};
    for (const s of result.standings) playerNames[s.id] = s.displayName;
    void finalizeReplay(replayIdRef.current, {
      winnerDeviceId: result.winnerId ?? null,
      winnerName: result.winnerName ?? null,
      playerNames,
      standings: result.standings.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        label: p.label,
        color: p.color,
      })),
      recap: recap ?? null,
      finalState: roomState as unknown as Record<string, unknown>,
      turnCount: turnCountRef.current,
      durationMs: startedAtRef.current ? Date.now() - startedAtRef.current : undefined,
    });
  }, [enabled, status, roomState, recap]);

  return { replayId: replayIdRef.current, shareUrl: shareUrlRef.current };
}

/** Cross-component access to the latest replay handle — consumed by GameOver. */
export function getActiveReplayHandle(): ReplayRecorderHandle {
  return handleStore.current;
}
