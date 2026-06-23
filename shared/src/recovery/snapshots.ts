// Snapshot + restore (Phase 10). Active game state should be restorable where supported
// (source-of-truth rule). A GameRun can be marked 'recoverable'; a snapshot captures its state and a
// RecoveryToken lets a device rejoin. Pure logic; the server persists snapshots (matchPersistence /
// supabase) and the transport layer replays them. Deterministic engines may snapshot via event
// replay (O3); others store full state — kind records which.

import type { GameSnapshot, RecoveryToken } from '../contracts/session.js';

function randId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function createSnapshot(input: {
  gameRunId: string;
  state: unknown;
  kind?: GameSnapshot['kind'];
  now?: string;
}): GameSnapshot {
  return {
    id: randId('snap'),
    gameRunId: input.gameRunId,
    kind: input.kind ?? 'full_state',
    state: input.state,
    takenAt: input.now ?? new Date().toISOString(),
  };
}

// Restore returns the captured state for a run, or null if the snapshot is for a different run.
export function restoreFromSnapshot<T = unknown>(snapshot: GameSnapshot, gameRunId: string): T | null {
  if (snapshot.gameRunId !== gameRunId) return null;
  return snapshot.state as T;
}

// Pick the most recent snapshot for a run (snapshots may arrive unordered).
export function latestSnapshot(snapshots: GameSnapshot[], gameRunId: string): GameSnapshot | null {
  const forRun = snapshots
    .filter((s) => s.gameRunId === gameRunId)
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  return forRun[0] ?? null;
}

// --- Recovery tokens ------------------------------------------------------

export function issueRecoveryToken(input: {
  sessionId: string;
  deviceId: string;
  ttlMs?: number;
  now?: number;
}): RecoveryToken {
  const now = input.now ?? Date.now();
  const ttl = input.ttlMs ?? 1000 * 60 * 30; // 30 min default
  return {
    token: randId('rec'),
    sessionId: input.sessionId,
    deviceId: input.deviceId,
    expiresAt: new Date(now + ttl).toISOString(),
  };
}

export function isRecoveryTokenValid(token: RecoveryToken, deviceId: string, now = Date.now()): boolean {
  if (token.deviceId !== deviceId) return false;
  return now < Date.parse(token.expiresAt);
}
