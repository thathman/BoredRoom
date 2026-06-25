// HTTP base + session API for the Colyseus server. Centralizes the ws->http derivation that
// Host/Join pages do inline, and wraps the Phase 1 /sessions endpoint.

import type { SetupSettings } from '@/lib/setupFlow';

export function serverHttpBase(): string | null {
  const raw = import.meta.env.VITE_COLYSEUS_URL as string | undefined;
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
  selectedPackIds: string[];
  activePackId?: string;
}

export interface SessionMember {
  deviceId: string;
  displayName: string;
  role: 'display' | 'controller' | 'crowd' | 'companion';
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
  selectedPackIds: string[];
  activePackId?: string;
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

export interface InstalledPackGame {
  slug: string;
  engine: string;
  name: string;
  emoji: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
}
export interface InstalledPack {
  packId: string;
  name: string;
  version: string;
  sourceUrl: string;
  manifest: { id: string; name: string; theme?: { tokenSet: string }; games: InstalledPackGame[] };
  installedAt: string;
}

export async function listPacks(): Promise<InstalledPack[]> {
  const base = serverHttpBase();
  if (!base) throw new Error('no_server');
  const res = await fetch(`${base}/packs`, { credentials: 'include' });
  if (!res.ok) throw new Error(res.status === 403 ? 'pack_admin_required' : `packs_list_failed_${res.status}`);
  return ((await res.json()) as { packs?: InstalledPack[] }).packs ?? [];
}

export async function getPackAdminAuth(): Promise<boolean> {
  const base = serverHttpBase();
  if (!base) return false;
  const res = await fetch(`${base}/packs/auth`, { credentials: 'include' });
  if (!res.ok) return false;
  return ((await res.json()) as { authenticated?: boolean }).authenticated === true;
}

export async function loginPackAdmin(passphrase: string): Promise<void> {
  const base = serverHttpBase();
  if (!base) throw new Error('no_server');
  const res = await fetch(`${base}/packs/auth`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error ?? `pack_admin_login_failed_${res.status}`);
  }
}

export async function logoutPackAdmin(): Promise<void> {
  const base = serverHttpBase();
  if (!base) return;
  await fetch(`${base}/packs/auth`, { method: 'DELETE', credentials: 'include' });
}

// Install a pack from a GitHub repo URL. Throws with a readable code on failure.
export async function installPack(repoUrl: string): Promise<InstalledPack> {
  const base = serverHttpBase();
  if (!base) throw new Error('no_server');
  const res = await fetch(`${base}/packs/install`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `install_failed_${res.status}`);
  }
  return ((await res.json()) as { pack: InstalledPack }).pack;
}

export async function uninstallPack(packId: string): Promise<void> {
  const base = serverHttpBase();
  if (!base) return;
  const res = await fetch(`${base}/packs/${encodeURIComponent(packId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`uninstall_failed_${res.status}`);
}

export interface ActiveRun {
  id: string;
  gameType: string;
  runtimeId?: string;
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
  if (!base) return null;
  const res = await fetch(`${base}/sessions/${encodeURIComponent(code)}`);
  if (!res.ok) return null;
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

export interface StartedRun {
  run: { id: string; gameType: string; runtimeId?: string; status: string };
  hostToken: string | null;
}

// Select a GameRun under the current house session.
export async function startGameRun(input: {
  code: string;
  houseSessionId: string;
  hostDeviceId: string;
  gameType: string;
  packId?: string;
}): Promise<StartedRun> {
  const base = serverHttpBase();
  if (!base) throw new Error('session_server_required');
  const res = await fetch(`${base}/sessions/${encodeURIComponent(input.code)}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-boredroom-owner': getControlCredential(input.code),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`run_start_failed_${res.status}`);
  return (await res.json()) as StartedRun;
}

export async function activateGameRun(code: string, runId: string): Promise<StartedRun> {
  const base = serverHttpBase();
  if (!base) throw new Error('session_server_required');
  const res = await fetch(
    `${base}/sessions/${encodeURIComponent(code)}/runs/${encodeURIComponent(runId)}/start`,
    {
      method: 'POST',
      headers: { 'x-boredroom-owner': getControlCredential(code) },
    },
  );
  if (!res.ok) throw new Error(`run_start_failed_${res.status}`);
  return (await res.json()) as StartedRun;
}

export async function finishGameRun(
  code: string,
  runId: string,
  status: 'finished' | 'abandoned',
  winnerPlayerIds: string[] = [],
): Promise<void> {
  const base = serverHttpBase();
  if (!base) return;
  const res = await fetch(
    `${base}/sessions/${encodeURIComponent(code)}/runs/${encodeURIComponent(runId)}/finish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-boredroom-owner': getControlCredential(code),
      },
      body: JSON.stringify({ status, winnerPlayerIds }),
    },
  );
  if (!res.ok) throw new Error(`run_finish_failed_${res.status}`);
}

export async function clearCurrentGame(code: string): Promise<void> {
  const base = serverHttpBase();
  if (!base) return;
  const res = await fetch(`${base}/sessions/${encodeURIComponent(code)}/runs/current`, {
    method: 'DELETE',
    headers: { 'x-boredroom-owner': getControlCredential(code) },
  });
  if (!res.ok) throw new Error(`run_clear_failed_${res.status}`);
}

export async function fetchRuntimeAccess(code: string): Promise<{
  runId: string;
  runtimeId: string | null;
  hostToken: string | null;
} | null> {
  const base = serverHttpBase();
  if (!base) return null;
  const res = await fetch(`${base}/sessions/${encodeURIComponent(code)}/runtime`, {
    headers: { 'x-boredroom-owner': getControlCredential(code) },
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    runId: string;
    runtimeId: string | null;
    hostToken: string | null;
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
