/**
 * Replay persistence + retrieval against Supabase.
 *
 * Lifecycle:
 *   1. initReplay()       — at game START, inserts a placeholder row + returns
 *                           {id, shareToken, url}. Stash the id locally.
 *   2. recordReplayTurn() — for each turn, append a row to replay_turns with
 *                           a JSON snapshot. Throttled by turn_number on caller.
 *   3. finalizeReplay()   — at game END, UPDATE the replays row with
 *                           winner/standings/recap/finalState/turnCount.
 *   4. fetchReplayByShareToken() — public read for /r/:token.
 *
 * The DB trigger only allows finalization fields to be written ONCE — repeated
 * calls fail at the DB level (defensive only; client throttles too).
 */
import { supabase } from '@/integrations/supabase/client';
import type { RecapPayload } from '@/lib/ai';

export interface ReplayStanding {
  id: string;
  displayName: string;
  label: string;
  color?: string;
}

export interface ReplaySaveInput {
  roomCode: string;
  gameType: string;
  winnerDeviceId: string | null;
  winnerName: string | null;
  playerNames: Record<string, string>;
  standings: ReplayStanding[];
  recap: RecapPayload | null;
  finalState: Record<string, unknown>;
  turnCount?: number;
  durationMs?: number;
}

export interface ReplayInitInput {
  roomCode: string;
  gameType: string;
  playerNames: Record<string, string>;
}

export interface ReplayInitResult {
  id: string;
  shareToken: string;
  url: string;
}

export interface ReplayRecord extends ReplaySaveInput {
  id: string;
  shareToken: string;
  createdAt: string;
  viewCount: number;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 — readable

function generateToken(len = 10): string {
  let out = '';
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : null;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint8Array(len);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < len; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  } else {
    for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Insert a placeholder replay row at game start. */
export async function initReplay(input: ReplayInitInput): Promise<ReplayInitResult | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const shareToken = generateToken();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('replays') as any)
      .insert({
        share_token: shareToken,
        room_code: input.roomCode,
        game_type: input.gameType,
        player_names: input.playerNames,
        standings: [],
        final_state: {},
      })
      .select('id, share_token')
      .maybeSingle();
    if (!error && data) {
      const url = `${window.location.origin}/r/${data.share_token}`;
      return { id: data.id as string, shareToken: data.share_token as string, url };
    }
    if (error && (error as { code?: string }).code !== '23505') {
      console.error('[initReplay] failed', error);
      return null;
    }
  }
  return null;
}

/** Append one turn snapshot. Cheap, fire-and-forget — don't await in hot loops. */
export async function recordReplayTurn(
  replayId: string,
  turnNumber: number,
  snapshot: Record<string, unknown>,
  caption?: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('replay_turns') as any).insert({
    replay_id: replayId,
    turn_number: turnNumber,
    snapshot,
    caption: caption ?? null,
  });
  if (error) {
    console.warn('[recordReplayTurn] failed', error);
    return false;
  }
  return true;
}

/** Finalize an existing replay row — once. */
export async function finalizeReplay(
  id: string,
  patch: Omit<ReplaySaveInput, 'roomCode' | 'gameType'>,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('replays') as any)
    .update({
      winner_device_id: patch.winnerDeviceId,
      winner_name: patch.winnerName,
      player_names: patch.playerNames,
      standings: patch.standings,
      recap: patch.recap,
      final_state: patch.finalState,
      turn_count: patch.turnCount ?? null,
      duration_ms: patch.durationMs ?? null,
    })
    .eq('id', id);
  if (error) {
    console.error('[finalizeReplay] failed', error);
    return false;
  }
  return true;
}

/**
 * Legacy single-shot save (kept for the GameOver "Save & share" button path
 * where no init/finalize lifecycle exists). Inserts a fully-formed row.
 */
export async function saveReplay(input: ReplaySaveInput): Promise<{ shareToken: string; url: string; id: string } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const shareToken = generateToken();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('replays') as any)
      .insert({
        share_token: shareToken,
        room_code: input.roomCode,
        game_type: input.gameType,
        winner_device_id: input.winnerDeviceId,
        winner_name: input.winnerName,
        player_names: input.playerNames,
        standings: input.standings,
        recap: input.recap,
        final_state: input.finalState,
        turn_count: input.turnCount ?? null,
        duration_ms: input.durationMs ?? null,
      })
      .select('id, share_token')
      .maybeSingle();
    if (!error && data) {
      const url = `${window.location.origin}/r/${data.share_token}`;
      return { shareToken: data.share_token as string, url, id: data.id as string };
    }
    if (error && (error as { code?: string }).code !== '23505') {
      console.error('[saveReplay] failed', error);
      return null;
    }
  }
  return null;
}

export async function fetchReplayByShareToken(token: string): Promise<ReplayRecord | null> {
  const { data, error } = await supabase
    .from('replays')
    .select('*')
    .eq('share_token', token)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    shareToken: data.share_token,
    roomCode: data.room_code,
    gameType: data.game_type,
    winnerDeviceId: data.winner_device_id,
    winnerName: data.winner_name,
    playerNames: (data.player_names ?? {}) as Record<string, string>,
    standings: (data.standings ?? []) as unknown as ReplayStanding[],
    recap: (data.recap ?? null) as unknown as RecapPayload | null,
    finalState: (data.final_state ?? {}) as Record<string, unknown>,
    turnCount: data.turn_count ?? undefined,
    durationMs: data.duration_ms ?? undefined,
    createdAt: data.created_at,
    viewCount: data.view_count ?? 0,
  };
}
