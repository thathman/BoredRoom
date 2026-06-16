import type { GameType } from '../../shared/src/contracts/index.js';

export interface ServerMatchRecord {
  roomCode: string;
  gameType: GameType;
  winnerDeviceId: string | null;
  playerDeviceIds: string[];
  playerNames: Record<string, string>;
  turnCount?: number;
  durationMs?: number;
  matchKey: string;
  hostDisplayId?: string | null;
  partyId?: string | null;
}

interface BackendConfig {
  url: string;
  key: string;
}

function getBackendConfig(): BackendConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const cfg = getBackendConfig();
  if (!cfg) throw new Error('backend_env_missing');
  return fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      authorization: `Bearer ${cfg.key}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export function buildMatchKey(input: Pick<ServerMatchRecord, 'roomCode' | 'gameType' | 'winnerDeviceId' | 'playerDeviceIds'>): string {
  const players = [...input.playerDeviceIds].sort().join(',');
  return [input.roomCode, input.gameType, input.winnerDeviceId ?? '_', players].join('|');
}

export async function persistFinishedMatch(record: ServerMatchRecord): Promise<'inserted' | 'duplicate' | 'skipped'> {
  if (!getBackendConfig()) return 'skipped';
  const matchResp = await apiFetch('matches', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      room_code: record.roomCode,
      game_type: record.gameType,
      winner_device_id: record.winnerDeviceId,
      player_device_ids: record.playerDeviceIds,
      player_names: record.playerNames,
      match_key: record.matchKey,
      turn_count: record.turnCount ?? null,
      duration_ms: record.durationMs ?? null,
      host_display_id: record.hostDisplayId ?? null,
      party_id: record.partyId ?? null,
    }),
  });

  if (matchResp.status === 409) return 'duplicate';
  if (!matchResp.ok) throw new Error(`match_insert_${matchResp.status}:${await matchResp.text()}`);

  const ids = record.playerDeviceIds.map((id) => `"${encodeURIComponent(id)}"`).join(',');
  const profilesResp = await apiFetch(`profiles?device_id=in.(${ids})&select=device_id,games_played,wins`);
  if (!profilesResp.ok) throw new Error(`profiles_fetch_${profilesResp.status}:${await profilesResp.text()}`);
  const profiles = await profilesResp.json() as Array<{ device_id: string; games_played: number; wins: number }>;

  await Promise.all(profiles.map((p) => apiFetch(`profiles?device_id=eq.${encodeURIComponent(p.device_id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      games_played: (p.games_played ?? 0) + 1,
      wins: (p.wins ?? 0) + (p.device_id === record.winnerDeviceId ? 1 : 0),
    }),
  })));

  return 'inserted';
}
