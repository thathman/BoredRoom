// Phase 1 Foundations services: HouseSession spine + persistent devices.
//
// HouseSession is the true persistence unit; a GameRun is one play instance under it;
// a Colyseus room is the disposable realtime container for an active run. Persistence uses
// the same Supabase REST + graceful-skip pattern as matchPersistence.ts: when backend env is
// absent, writes return 'skipped' so local/dev play still works. Pure logic (status
// transitions, resume selection, rematch identity, event ordering) is exported for testing.

import {
  HouseSession as HouseSessionSchema,
  GameRun as GameRunSchema,
  type HouseSession,
  type HouseSessionStatus,
  type HouseSessionSettings,
  type GameRun,
  type SessionEvent,
  type ControllerDevice,
  type OperatorDevice,
  type OperatorRole,
} from '../../shared/src/contracts/session.js';

// --- ids & codes ----------------------------------------------------------

function randId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no easily-confused chars (no I/L/O/0/1)

export function makeSessionCode(len = 5): string {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// --- pure transition rules ------------------------------------------------

// Allowed status transitions for a house session. Keeps state moves explicit
// instead of letting any code set any status.
const STATUS_TRANSITIONS: Record<HouseSessionStatus, HouseSessionStatus[]> = {
  setup: ['waiting_for_players', 'walkthrough', 'ended'],
  waiting_for_players: ['walkthrough', 'voting', 'game_active', 'paused', 'ended'],
  walkthrough: ['voting', 'game_active', 'paused', 'ended'],
  voting: ['game_active', 'next_decision', 'paused', 'ended'],
  game_active: ['recap', 'paused', 'recoverable', 'ended'],
  recap: ['next_decision', 'voting', 'ended'],
  next_decision: ['voting', 'game_active', 'walkthrough', 'ended'],
  paused: ['game_active', 'voting', 'recoverable', 'ended'],
  recoverable: ['game_active', 'paused', 'ended'],
  ended: [],
};

export function canTransition(from: HouseSessionStatus, to: HouseSessionStatus): boolean {
  return from === to || STATUS_TRANSITIONS[from].includes(to);
}

// Resume picks the most recently updated session for a host device that is not ended.
export function selectResumableSession(
  sessions: HouseSession[],
  hostDeviceId: string,
): HouseSession | null {
  const candidates = sessions
    .filter((s) => s.hostDeviceId === hostDeviceId && s.status !== 'ended')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return candidates[0] ?? null;
}

// --- builders (pure) ------------------------------------------------------

export const DEFAULT_SESSION_SETTINGS: HouseSessionSettings = HouseSessionSchema.shape.settings.parse({});

export function buildHouseSession(input: {
  hostDeviceId: string;
  selectedPackIds: string[];
  activePackId?: string;
  settings?: Partial<HouseSessionSettings>;
  now?: string;
}): HouseSession {
  const now = input.now ?? new Date().toISOString();
  return HouseSessionSchema.parse({
    id: randId('hs'),
    code: makeSessionCode(),
    status: 'setup',
    currentStage: 'landing',
    selectedPackIds: input.selectedPackIds,
    activePackId: input.activePackId,
    hostDeviceId: input.hostDeviceId,
    activeOperatorIds: [],
    walkthroughCompleted: false,
    settings: { ...DEFAULT_SESSION_SETTINGS, ...(input.settings ?? {}) },
    createdAt: now,
    updatedAt: now,
  });
}

// Every game run (including a rematch) gets a fresh id — rematches never reuse one.
export function buildGameRun(input: {
  houseSessionId: string;
  gameType: string;
  packId: string;
  settings?: Record<string, unknown>;
  now?: string;
}): GameRun {
  return GameRunSchema.parse({
    id: randId('gr'),
    houseSessionId: input.houseSessionId,
    gameType: input.gameType,
    packId: input.packId,
    status: 'setup',
    settings: input.settings ?? {},
    startedAt: input.now ?? new Date().toISOString(),
  });
}

export function buildSessionEvent(input: {
  sessionId: string;
  type: string;
  gameRunId?: string;
  actorId?: string;
  payload?: Record<string, unknown>;
  now?: string;
}): SessionEvent {
  return {
    id: randId('ev'),
    sessionId: input.sessionId,
    gameRunId: input.gameRunId,
    type: input.type,
    actorId: input.actorId,
    payload: input.payload ?? {},
    at: input.now ?? new Date().toISOString(),
  };
}

// --- persistence (Supabase REST; graceful skip) ---------------------------

interface BackendConfig {
  url: string;
  key: string;
}

function getBackendConfig(): BackendConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cfg = getBackendConfig();
  if (!cfg) throw new Error('backend_env_missing');
  // Hard timeout so a slow/hung Supabase never blocks a request indefinitely.
  return fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    signal: AbortSignal.timeout(8000),
    headers: {
      apikey: cfg.key,
      authorization: `Bearer ${cfg.key}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

type WriteResult = 'ok' | 'skipped';

function sessionRow(
  s: HouseSession,
  credentials?: { ownerCredentialHash?: string; companionCredentialHashes?: string[] },
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: s.id,
    code: s.code,
    status: s.status,
    current_stage: s.currentStage,
    selected_pack_ids: s.selectedPackIds,
    active_pack_id: s.activePackId ?? null,
    host_device_id: s.hostDeviceId,
    active_display_id: s.activeDisplayId ?? null,
    active_operator_ids: s.activeOperatorIds,
    current_game_run_id: s.currentGameRunId ?? null,
    walkthrough_completed: s.walkthroughCompleted,
    settings: s.settings,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    ended_at: s.endedAt ?? null,
  };
  if (credentials?.ownerCredentialHash) row.owner_credential_hash = credentials.ownerCredentialHash;
  if (credentials?.companionCredentialHashes) {
    row.companion_credential_hashes = credentials.companionCredentialHashes;
  }
  return row;
}

export async function persistHouseSession(
  s: HouseSession,
  credentials?: { ownerCredentialHash?: string; companionCredentialHashes?: string[] },
): Promise<WriteResult> {
  if (!getBackendConfig()) return 'skipped';
  const response = await apiFetch('house_sessions', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(sessionRow(s, credentials)),
  });
  if (!response.ok) throw new Error(`house_session_write_${response.status}:${await response.text()}`);
  return 'ok';
}

function rowToSession(r: Record<string, unknown>): HouseSession {
  return HouseSessionSchema.parse({
    id: r.id,
    code: r.code,
    status: r.status,
    currentStage: r.current_stage,
    selectedPackIds: r.selected_pack_ids ?? [],
    activePackId: r.active_pack_id ?? undefined,
    hostDeviceId: r.host_device_id,
    activeDisplayId: r.active_display_id ?? undefined,
    activeOperatorIds: r.active_operator_ids ?? [],
    currentGameRunId: r.current_game_run_id ?? undefined,
    walkthroughCompleted: r.walkthrough_completed ?? false,
    settings: r.settings ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    endedAt: r.ended_at ?? undefined,
  });
}

// The most recent game run for a session (the "now playing"), or null. Lets screens follow along
// by polling the read endpoint — a session-scoped realtime channel can replace this later.
export async function readActiveRun(houseSessionId: string): Promise<GameRun | null> {
  if (!getBackendConfig()) return null;
  const resp = await apiFetch(
    `game_runs?house_session_id=eq.${encodeURIComponent(houseSessionId)}&order=started_at.desc.nullslast&limit=1`,
  );
  if (!resp.ok) return null;
  const rows = (await resp.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
  try {
    return GameRunSchema.parse({
      id: r.id,
      houseSessionId: r.house_session_id,
      gameType: r.game_type,
      packId: r.pack_id,
      roomCode: r.room_code ?? undefined,
      status: r.status,
      settings: r.settings ?? {},
      startedAt: r.started_at ?? undefined,
      endedAt: r.ended_at ?? undefined,
      winnerPlayerIds: r.winner_player_ids ?? undefined,
      recapId: r.recap_id ?? undefined,
      latestSnapshotId: r.latest_snapshot_id ?? undefined,
    });
  } catch {
    return null;
  }
}

// Read a house session by code. Returns null when absent or when no backend is configured.
export async function readHouseSession(code: string): Promise<HouseSession | null> {
  if (!getBackendConfig()) return null;
  const resp = await apiFetch(`house_sessions?code=eq.${encodeURIComponent(code)}&limit=1`);
  if (!resp.ok) return null;
  const rows = (await resp.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  try {
    return rowToSession(rows[0]);
  } catch {
    return null;
  }
}

export async function readSessionCredentialHashes(code: string): Promise<{
  ownerCredentialHash: string;
  companionCredentialHashes: string[];
} | null> {
  if (!getBackendConfig()) return null;
  const resp = await apiFetch(
    `house_sessions?code=eq.${encodeURIComponent(code)}&select=owner_credential_hash,companion_credential_hashes&limit=1`,
  );
  if (!resp.ok) return null;
  const rows = (await resp.json()) as Array<{
    owner_credential_hash?: string | null;
    companion_credential_hashes?: string[] | null;
  }>;
  const row = rows[0];
  if (!row) return null;
  return {
    ownerCredentialHash: row.owner_credential_hash ?? '',
    companionCredentialHashes: row.companion_credential_hashes ?? [],
  };
}

export async function persistGameRun(run: GameRun): Promise<WriteResult> {
  if (!getBackendConfig()) return 'skipped';
  const response = await apiFetch('game_runs', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: run.id,
      house_session_id: run.houseSessionId,
      game_type: run.gameType,
      pack_id: run.packId,
      room_code: run.roomCode ?? null,
      status: run.status,
      settings: run.settings,
      started_at: run.startedAt ?? null,
      ended_at: run.endedAt ?? null,
      winner_player_ids: run.winnerPlayerIds ?? null,
      recap_id: run.recapId ?? null,
      latest_snapshot_id: run.latestSnapshotId ?? null,
    }),
  });
  if (!response.ok) throw new Error(`game_run_write_${response.status}:${await response.text()}`);
  return 'ok';
}

export async function appendSessionEvent(ev: SessionEvent): Promise<WriteResult> {
  if (!getBackendConfig()) return 'skipped';
  const response = await apiFetch('session_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: ev.id,
      session_id: ev.sessionId,
      game_run_id: ev.gameRunId ?? null,
      type: ev.type,
      actor_id: ev.actorId ?? null,
      payload: ev.payload,
      at: ev.at,
    }),
  });
  if (!response.ok) throw new Error(`session_event_write_${response.status}:${await response.text()}`);
  return 'ok';
}

// Remember a controller device across sessions (upsert; append session id).
export async function rememberController(
  device: ControllerDevice,
): Promise<WriteResult> {
  if (!getBackendConfig()) return 'skipped';
  const response = await apiFetch('controller_devices', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: device.id,
      display_name: device.displayName,
      last_seen_at: device.lastSeenAt,
      paired_session_ids: device.pairedSessionIds,
      player_profile_id: device.playerProfileId ?? null,
    }),
  });
  if (!response.ok) throw new Error(`controller_write_${response.status}:${await response.text()}`);
  return 'ok';
}

export async function pairOperator(op: OperatorDevice): Promise<WriteResult> {
  if (!getBackendConfig()) return 'skipped';
  const response = await apiFetch('operator_devices', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: op.id,
      session_id: op.sessionId,
      role: op.role,
      paired_at: op.pairedAt,
      last_seen_at: op.lastSeenAt,
    }),
  });
  if (!response.ok) throw new Error(`operator_write_${response.status}:${await response.text()}`);
  return 'ok';
}

export function buildOperatorDevice(input: {
  id: string;
  sessionId: string;
  role?: OperatorRole;
  now?: string;
}): OperatorDevice {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id,
    sessionId: input.sessionId,
    role: input.role ?? 'host',
    pairedAt: now,
    lastSeenAt: now,
  };
}
