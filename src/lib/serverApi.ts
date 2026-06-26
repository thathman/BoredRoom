// HTTP base + session API for the Colyseus server. Centralizes the ws->http derivation that
// Host/Join pages do inline, and wraps the Phase 1 /sessions endpoint.

import type { SetupSettings } from '@/lib/setupFlow';

export function serverHttpBase(): string | null {
  const raw = (import.meta.env.VITE_COLYSEUS_URL as string | undefined)
    || (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:2567` : undefined);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

// Minimal client view of the created session (mirror of the server HouseSession shape).
export interface CreatedSession {
  id: string;
  code: string;
  status: string;
  currentStage?: string;
  settings: {
    allowCrowdVotes: boolean;
    allowPlayerVotes?: boolean;
    allowBots: boolean;
    hintsEnabled: boolean;
    maxControllers: number;
  };
}

export interface SessionMember {
  deviceId: string;
  displayName: string;
  role: 'display' | 'controller' | 'crowd' | 'companion';
  isBot?: boolean;
  avatar?: string;
  accentColor?: string;
  ready: boolean;
  connected: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface SessionRecap {
  gameType: string;
  status: 'finished' | 'abandoned';
  winnerPlayerIds: string[];
  endedAt: string;
  headline?: string;
  paragraph?: string;
}

export interface HouseVoteResult {
  voteId: string;
  voteType: string;
  winnerOption: string | null;
  voteCounts: Record<string, number>;
  eligibleVoterCount: number;
  castCount: number;
  quorumMet: boolean;
  tied: boolean;
  tiedOptions: string[];
  applied: boolean;
  autoApplied: boolean;
  status: string;
  hostOverride?: { actorId: string; option: string; reason?: string; at: string };
  resolvedAt: string;
}

export interface HouseVote {
  id: string;
  sessionId: string;
  type: string;
  question: string;
  options: string[];
  status: string;
  tally: Record<string, number>;
  eligibleVoterIds: string[];
  openedAt?: string;
  closesAt?: string;
  resolvedAt?: string;
  cancelledAt?: string;
  result?: HouseVoteResult;
}

export interface AiHealth {
  enabled: boolean;
  model: string;
  status: 'active' | 'offline' | 'degraded';
  lastLatencyMs: number | null;
  lastError: string | null;
  rateLimitRemaining: number | null;
  creditStatus: 'available' | 'exhausted' | 'unknown';
  fallbackActive: boolean;
}

const OWNER_KEY_PREFIX = 'boredroom_session_owner:';
const COMPANION_KEY_PREFIX = 'boredroom_session_companion:';

export function storeOwnerCredential(code: string, credential: string): void {
  localStorage.setItem(`${OWNER_KEY_PREFIX}${code.toUpperCase()}`, credential);
}

export function getOwnerCredential(code: string): string {
  return localStorage.getItem(`${OWNER_KEY_PREFIX}${code.toUpperCase()}`) ?? '';
}

export function storeCompanionCredential(code: string, credential: string): void {
  localStorage.setItem(`${COMPANION_KEY_PREFIX}${code.toUpperCase()}`, credential);
}

export function getCompanionCredential(code: string): string {
  return localStorage.getItem(`${COMPANION_KEY_PREFIX}${code.toUpperCase()}`) ?? '';
}

export function getControlCredential(code: string): string {
  return getOwnerCredential(code) || getCompanionCredential(code);
}

export async function createSession(input: {
  hostDeviceId: string;
  settings?: SetupSettings;
}): Promise<{ session: CreatedSession; ownerCredential: string }> {
  const base = serverHttpBase();
  if (!base) {
    throw new Error('session_server_required');
  }
  const res = await fetch(`${base}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`session_create_failed_${res.status}`);
  const data = (await res.json()) as { session: CreatedSession; ownerCredential: string };
  storeOwnerCredential(data.session.code, data.ownerCredential);
  return data;
}

export async function getGameAdminAuth(): Promise<boolean> {
  const base = serverHttpBase();
  if (!base) return false;
  const res = await fetch(`${base}/games/auth`, { credentials: 'include' });
  if (!res.ok) return false;
  return ((await res.json()) as { authenticated?: boolean }).authenticated === true;
}

export async function loginGameAdmin(passphrase: string): Promise<void> {
  const base = serverHttpBase();
  if (!base) throw new Error('no_server');
  const res = await fetch(`${base}/games/auth`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error ?? `game_admin_login_failed_${res.status}`);
  }
}

export async function logoutGameAdmin(): Promise<void> {
  const base = serverHttpBase();
  if (!base) return;
  await fetch(`${base}/games/auth`, { method: 'DELETE', credentials: 'include' });
}

export interface AdminSessionSummary {
  code: string;
  status: string;
  members: number;
  connected: number;
  bots: number;
  activeGame: string | null;
  gameStatus: string | null;
  activeVote: string | null;
  recentVotes: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOverview {
  server: { protocolVersion: number; uptimeSeconds: number; nodeEnv: string };
  ai: AiHealth;
  games: { installed: number; available: number };
  parties: { total: number; inGame: number; list: AdminSessionSummary[] };
  recentVotes: Array<HouseVoteResult & { sessionCode: string }>;
}

export async function fetchAdminOverview(): Promise<AdminOverview | null> {
  const base = serverHttpBase();
  if (!base) return null;
  const res = await fetch(`${base}/admin/overview`, { credentials: 'include' });
  if (!res.ok) return null;
  return (await res.json()) as AdminOverview;
}

export type GameUpdateOverride = 'inherit' | 'enabled' | 'disabled';

export interface LibraryGame {
  id: string;
  name: string;
  emoji: string;
  description: string;
  version: string;
  minPlayers: number;
  maxPlayers: number;
  capabilities: {
    bots: boolean;
    audience: boolean;
    hints: boolean;
    restore: boolean;
  };
  installed: boolean;
  installedVersion?: string;
  updateAvailable: boolean;
  updateOverride: GameUpdateOverride;
  status?: 'installed' | 'error';
}

export interface GameUpdatePolicy {
  automatic: boolean;
  overrides: Record<string, GameUpdateOverride>;
}

export async function fetchGamesCatalog(): Promise<{
  games: LibraryGame[];
  updatePolicy: GameUpdatePolicy;
}> {
  const base = serverHttpBase();
  if (!base) throw new Error('no_server');
  const res = await fetch(`${base}/games/catalog`, { credentials: 'include' });
  if (!res.ok) throw new Error(`catalog_failed_${res.status}`);
  return (await res.json()) as { games: LibraryGame[]; updatePolicy: GameUpdatePolicy };
}

async function mutateGame(gameId: string, method: 'POST' | 'DELETE', action = ''): Promise<void> {
  const base = serverHttpBase();
  if (!base) throw new Error('no_server');
  const suffix = action ? `/${action}` : '';
  const res = await fetch(`${base}/games/${encodeURIComponent(gameId)}${suffix}`, {
    method,
    credentials: 'include',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `game_mutation_failed_${res.status}`);
  }
}

export function installGame(gameId: string): Promise<void> {
  return mutateGame(gameId, 'POST', 'install');
}

export function updateGame(gameId: string): Promise<void> {
  return mutateGame(gameId, 'POST', 'update');
}

export function uninstallGame(gameId: string): Promise<void> {
  return mutateGame(gameId, 'DELETE');
}

export async function updateGamesPolicy(input: {
  automatic?: boolean;
  gameId?: string;
  override?: GameUpdateOverride;
}): Promise<GameUpdatePolicy> {
  const base = serverHttpBase();
  if (!base) throw new Error('no_server');
  const res = await fetch(`${base}/games/update-policy`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`update_policy_failed_${res.status}`);
  return ((await res.json()) as { updatePolicy: GameUpdatePolicy }).updatePolicy;
}

export interface ActiveRun {
  id: string;
  gameType: string;
  gameVersion: string;
  status: string;
}

// Hydrate a session by code (screens use this on load). null when no server or unknown code.
export async function fetchSession(code: string): Promise<CreatedSession | null> {
  const res = await fetchSessionWithRun(code);
  return res?.session ?? null;
}

// Session + its current run ("now playing"). Screens poll this to follow along.
export async function fetchSessionWithRun(
  code: string,
): Promise<{
  session: CreatedSession;
  members: SessionMember[];
  activeRun: ActiveRun | null;
  lastRecap?: SessionRecap;
} | null> {
  const base = serverHttpBase();
  if (!base) throw new Error('no_server');
  const res = await fetch(`${base}/sessions/${encodeURIComponent(code)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`session_fetch_failed_${res.status}`);
  const data = (await res.json()) as {
    session?: CreatedSession;
    members?: SessionMember[];
    activeRun?: ActiveRun | null;
    lastRecap?: SessionRecap;
  };
  if (!data.session) return null;
  return {
    session: data.session,
    members: data.members ?? [],
    activeRun: data.activeRun ?? null,
    lastRecap: data.lastRecap,
  };
}

export async function createCompanionPairing(code: string): Promise<{
  pairingCode: string;
  expiresAt: string;
}> {
  const base = serverHttpBase();
  if (!base) throw new Error('session_server_required');
  const res = await fetch(`${base}/sessions/${encodeURIComponent(code)}/pairing`, {
    method: 'POST',
    headers: { 'x-boredroom-owner': getOwnerCredential(code) },
  });
  if (!res.ok) throw new Error(`pairing_create_failed_${res.status}`);
  return (await res.json()) as { pairingCode: string; expiresAt: string };
}

export async function fetchAiHealth(code: string): Promise<AiHealth> {
  const base = serverHttpBase();
  if (!base) throw new Error('session_server_required');
  const res = await fetch(`${base}/sessions/${encodeURIComponent(code)}/ai/health`, {
    headers: { 'x-boredroom-owner': getControlCredential(code) },
  });
  if (!res.ok) throw new Error(`ai_health_failed_${res.status}`);
  return (await res.json()) as AiHealth;
}

export async function redeemCompanionPairing(code: string, pairingCode: string): Promise<void> {
  const base = serverHttpBase();
  if (!base) throw new Error('session_server_required');
  const res = await fetch(`${base}/sessions/${encodeURIComponent(code)}/pairing/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairingCode }),
  });
  if (!res.ok) throw new Error(`pairing_redeem_failed_${res.status}`);
  const data = (await res.json()) as { companionCredential: string };
  storeCompanionCredential(code, data.companionCredential);
}
