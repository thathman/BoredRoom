// Player profile management.
// Identity is the device id stored in localStorage — no auth required.
// First time on a device: getPlayerId() generates a UUID and persists it.
// Username + avatar are stored in the `profiles` table on the backend
// (and mirrored to localStorage for fast offline reads).

import { supabase } from '@/integrations/supabase/client';
import { getPlayerId } from './roomUtils';

const NAME_KEY = 'boredroom_player_name';
const AVATAR_KEY = 'boredroom_player_avatar';

export interface Profile {
  device_id: string;
  username: string;
  avatar: string;
  games_played: number;
  wins: number;
}

export interface DisplayParty {
  id: string;
  host_display_id: string;
  name: string;
}

interface MatchInsertRow {
  room_code: string;
  game_type: PersistedGameType;
  winner_device_id: string | null;
  player_device_ids: string[];
  player_names: Record<string, string>;
  match_key: string | null;
  turn_count: number | null;
  duration_ms: number | null;
  host_display_id: string | null;
  party_id: string | null;
}

interface MatchRow extends MatchInsertRow {
  id: string;
  finished_at: string;
}

interface UntypedQuery<T = unknown> {
  select(columns?: string): UntypedQuery<T>;
  eq(column: string, value: unknown): UntypedQuery<T>;
  contains(column: string, value: unknown): UntypedQuery<T>;
  order(column: string, options?: { ascending?: boolean }): UntypedQuery<T>;
  limit(count: number): Promise<{ data: T[] | null; error: unknown }>;
  single(): Promise<{ data: T | null; error: unknown }>;
}

interface UntypedTable {
  insert(row: MatchInsertRow): Promise<{ error: { code?: string } | null }>;
  upsert(row: DisplayParty, options?: { onConflict?: string }): UntypedQuery<DisplayParty>;
  select(columns?: string): UntypedQuery<MatchRow>;
}

const untypedFrom = (table: 'matches' | 'display_parties') =>
  (supabase.from as unknown as (name: string) => UntypedTable)(table);

export const AVATAR_OPTIONS = [
  '🎮', '🚀', '👾', '🦄', '🐉', '🦊', '🐸', '🦖',
  '🤖', '👻', '🐙', '🦋', '🌟', '⚡', '🔥', '💎',
] as const;

export function getLocalProfile(): { username: string; avatar: string } | null {
  const username = localStorage.getItem(NAME_KEY);
  const avatar = localStorage.getItem(AVATAR_KEY);
  if (!username) return null;
  return { username, avatar: avatar || '🎮' };
}

export function setLocalProfile(username: string, avatar: string) {
  localStorage.setItem(NAME_KEY, username);
  localStorage.setItem(AVATAR_KEY, avatar);
}

export async function fetchProfile(deviceId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('device_id', deviceId)
    .maybeSingle();
  if (error) {
    console.error('[profile] fetch error', error);
    return null;
  }
  return data as Profile | null;
}

export async function upsertProfile(username: string, avatar: string): Promise<Profile | null> {
  const deviceId = getPlayerId();
  setLocalProfile(username, avatar);

  // Try update first
  const existing = await fetchProfile(deviceId);
  if (existing) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ username, avatar })
      .eq('device_id', deviceId)
      .select()
      .single();
    if (error) {
      console.error('[profile] update error', error);
      return null;
    }
    return data as Profile;
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({ device_id: deviceId, username, avatar })
    .select()
    .single();
  if (error) {
    console.error('[profile] insert error', error);
    return null;
  }
  return data as Profile;
}

export async function loadOrInitProfile(): Promise<Profile | null> {
  const deviceId = getPlayerId();
  const remote = await fetchProfile(deviceId);
  if (remote) {
    setLocalProfile(remote.username, remote.avatar);
    return remote;
  }
  // Fall back to local cache if offline / not yet created
  const local = getLocalProfile();
  if (local) {
    return await upsertProfile(local.username, local.avatar);
  }
  return null;
}

export type PersistedGameType = 'ludo' | 'whot';

export async function recordMatchFinished(params: {
  roomCode: string;
  winnerDeviceId: string | null;
  playerDeviceIds: string[];
  playerNames: Record<string, string>;
  /** Defaults to 'ludo' to preserve legacy callers. */
  gameType?: PersistedGameType;
  /** Optional idempotency key; duplicate inserts are treated as success. */
  matchKey?: string;
  turnCount?: number;
  durationMs?: number;
  hostDisplayId?: string | null;
  partyId?: string | null;
  skipProfileStats?: boolean;
}): Promise<void> {
  const {
    roomCode,
    winnerDeviceId,
    playerDeviceIds,
    playerNames,
    gameType = 'ludo',
    matchKey,
    turnCount,
    durationMs,
    hostDisplayId,
    partyId,
    skipProfileStats = false,
  } = params;

  const { error: insertErr } = await untypedFrom('matches').insert({
    room_code: roomCode,
    game_type: gameType,
    winner_device_id: winnerDeviceId,
    player_device_ids: playerDeviceIds,
    player_names: playerNames,
    match_key: matchKey ?? null,
    turn_count: turnCount ?? null,
    duration_ms: durationMs ?? null,
    host_display_id: hostDisplayId ?? null,
    party_id: partyId ?? null,
  });
  if (insertErr) {
    if ((insertErr as { code?: string }).code === '23505') return;
    console.error('[matches] insert error', insertErr);
  }

  if (skipProfileStats) return;

  // Increment stats for each known profile
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('device_id', playerDeviceIds);

  if (!profiles) return;

  await Promise.all(
    profiles.map((p) =>
      supabase
        .from('profiles')
        .update({
          games_played: (p.games_played ?? 0) + 1,
          wins: (p.wins ?? 0) + (p.device_id === winnerDeviceId ? 1 : 0),
        })
        .eq('device_id', p.device_id)
    )
  );
}

export async function upsertDisplayParty(params: {
  id: string;
  hostDisplayId: string;
  name: string;
}): Promise<DisplayParty | null> {
  const { id, hostDisplayId, name } = params;
  const row = {
    id,
    host_display_id: hostDisplayId,
    name: name.trim().slice(0, 40) || 'Home table',
  };
  const { data, error } = await untypedFrom('display_parties')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) {
    console.error('[display_parties] upsert error', error);
    return null;
  }
  return data as DisplayParty;
}

export async function fetchRecentMatches(deviceId: string, limit = 10) {
  const { data, error } = await untypedFrom('matches')
    .select('*')
    .contains('player_device_ids', [deviceId])
    .order('finished_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[matches] fetch error', error);
    return [];
  }
  return data || [];
}

export async function fetchDisplayMatches(hostDisplayId: string, limit = 10) {
  const rowsByHost = await untypedFrom('matches')
    .select('*')
    .eq('host_display_id', hostDisplayId)
    .order('finished_at', { ascending: false })
    .limit(limit);
  if (rowsByHost.error) {
    console.error('[matches] display fetch error', rowsByHost.error);
  }
  return rowsByHost.data || [];
}

export async function fetchDisplayMatchesMerged(params: {
  hostDisplayId: string;
  partyId?: string | null;
  limit?: number;
}) {
  const { hostDisplayId, partyId, limit = 10 } = params;
  const [byHost, byParty] = await Promise.all([
    fetchDisplayMatches(hostDisplayId, limit),
    partyId
      ? (async () => {
        const { data, error } = await untypedFrom('matches')
          .select('*')
          .eq('party_id', partyId)
          .order('finished_at', { ascending: false })
          .limit(limit);
        if (error) {
          console.error('[matches] display-party fetch error', error);
          return [];
        }
        return data || [];
      })()
      : Promise.resolve([] as MatchRow[]),
  ]);

  const merged = [...byHost, ...byParty];
  const dedup = new Map<string, MatchRow>();
  for (const row of merged) dedup.set(row.id, row as MatchRow);
  return [...dedup.values()]
    .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime())
    .slice(0, limit);
}
