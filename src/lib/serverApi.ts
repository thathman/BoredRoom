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

export async function createSession(input: {
  hostDeviceId: string;
  selectedPackIds: string[];
  activePackId?: string;
  settings?: SetupSettings;
}): Promise<CreatedSession> {
  const base = serverHttpBase();
  if (!base) {
    // Offline/dev fallback: a local-only session so the flow still works without a server.
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    return {
      id: `local_${code}`,
      code,
      status: 'setup',
      selectedPackIds: input.selectedPackIds,
      activePackId: input.activePackId,
    };
  }
  const res = await fetch(`${base}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`session_create_failed_${res.status}`);
  const data = (await res.json()) as { session: CreatedSession };
  return data.session;
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
  if (!base) return [];
  const res = await fetch(`${base}/packs`);
  if (!res.ok) return [];
  return ((await res.json()) as { packs?: InstalledPack[] }).packs ?? [];
}

// Install a pack from a GitHub repo URL. Throws with a readable code on failure.
export async function installPack(repoUrl: string): Promise<InstalledPack> {
  const base = serverHttpBase();
  if (!base) throw new Error('no_server');
  const res = await fetch(`${base}/packs/install`, {
    method: 'POST',
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
  await fetch(`${base}/packs/${encodeURIComponent(packId)}`, { method: 'DELETE' });
}

export interface ActiveRun {
  id: string;
  gameType: string;
  roomCode?: string;
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
): Promise<{ session: CreatedSession; activeRun: ActiveRun | null } | null> {
  const base = serverHttpBase();
  if (!base) return null;
  const res = await fetch(`${base}/sessions/${encodeURIComponent(code)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { session?: CreatedSession; activeRun?: ActiveRun | null };
  if (!data.session) return null;
  return { session: data.session, activeRun: data.activeRun ?? null };
}

export interface StartedRun {
  run: { id: string; gameType: string; roomCode?: string; status: string };
  room: { code: string; hostToken: string } | null;
}

// Start a GameRun under a session. Legacy games get a Colyseus room (room != null); adapter games
// run roomless. Returns null when no server is configured (offline/dev).
export async function startGameRun(input: {
  code: string;
  houseSessionId: string;
  hostDeviceId: string;
  gameType: string;
  packId?: string;
}): Promise<StartedRun | null> {
  const base = serverHttpBase();
  if (!base) return null;
  const res = await fetch(`${base}/sessions/${encodeURIComponent(input.code)}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`run_start_failed_${res.status}`);
  return (await res.json()) as StartedRun;
}
