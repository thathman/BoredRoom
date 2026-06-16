// Persistence tests for recordMatchFinished + history queries.
// Verifies that:
//  1) Whot matches persist with game_type='whot'
//  2) Ludo matches persist with game_type='ludo' (default and explicit)
//  3) fetchRecentMatches returns mixed game types as inserted
//
// We mock @/integrations/supabase/client to avoid hitting the network.

import { describe, it, expect, beforeEach, vi } from 'vitest';

type Row = {
  id: string;
  room_code: string;
  game_type: string;
  winner_device_id: string | null;
  player_device_ids: string[];
  player_names: Record<string, string>;
  host_display_id?: string | null;
  party_id?: string | null;
  finished_at: string;
};

const matchesTable: Row[] = [];
const profilesTable: Array<{
  device_id: string;
  username: string;
  avatar: string;
  games_played: number;
  wins: number;
}> = [];

vi.mock('@/integrations/supabase/client', () => {
  // Minimal in-memory shim that mirrors the pieces of the supabase-js
  // builder API used by src/lib/profile.ts.
  function profilesQuery() {
    return {
      select: () => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
        in: (_col: string, _vals: string[]) => ({ data: profilesTable, error: null }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({ single: async () => ({ data: null, error: null }) }),
        }),
      }),
      insert: () => ({
        select: () => ({ single: async () => ({ data: null, error: null }) }),
      }),
    };
  }

  function matchesQuery() {
    return {
      insert: (row: Partial<Row>) => {
        matchesTable.push({
          id: `m_${matchesTable.length + 1}`,
          finished_at: new Date().toISOString(),
          room_code: row.room_code ?? '',
          game_type: row.game_type ?? 'ludo',
          winner_device_id: row.winner_device_id ?? null,
          player_device_ids: row.player_device_ids ?? [],
          player_names: row.player_names ?? {},
          host_display_id: row.host_display_id ?? null,
          party_id: row.party_id ?? null,
        });
        return Promise.resolve({ error: null });
      },
      select: () => ({
        contains: (_col: string, vals: string[]) => ({
          order: () => ({
            limit: async (_n: number) => ({
              data: matchesTable.filter((m) =>
                vals.every((v) => m.player_device_ids.includes(v)),
              ),
              error: null,
            }),
          }),
        }),
        eq: (_col: string, val: string) => ({
          order: () => ({
            limit: async (_n: number) => ({
              data: matchesTable.filter((m) => m.host_display_id === val),
              error: null,
            }),
          }),
        }),
      }),
    };
  }

  return {
    supabase: {
      from: (table: string) => {
        if (table === 'matches') return matchesQuery();
        if (table === 'profiles') return profilesQuery();
        throw new Error(`unexpected table: ${table}`);
      },
    },
  };
});

import { fetchDisplayMatches, recordMatchFinished, fetchRecentMatches } from '@/lib/profile';

beforeEach(() => {
  matchesTable.length = 0;
  profilesTable.length = 0;
});

describe('recordMatchFinished', () => {
  it('persists a Ludo match with game_type=ludo by default (legacy callers)', async () => {
    await recordMatchFinished({
      roomCode: 'ABCD',
      winnerDeviceId: 'd-1',
      playerDeviceIds: ['d-1', 'd-2'],
      playerNames: { 'd-1': 'Ada', 'd-2': 'Bo' },
    });
    expect(matchesTable).toHaveLength(1);
    expect(matchesTable[0].game_type).toBe('ludo');
    expect(matchesTable[0].room_code).toBe('ABCD');
    expect(matchesTable[0].winner_device_id).toBe('d-1');
  });

  it('persists a Whot match with game_type=whot when specified', async () => {
    await recordMatchFinished({
      roomCode: 'WXYZ',
      winnerDeviceId: 'd-9',
      playerDeviceIds: ['d-9', 'd-7'],
      playerNames: { 'd-9': 'Chi', 'd-7': 'Dee' },
      gameType: 'whot',
    });
    expect(matchesTable).toHaveLength(1);
    expect(matchesTable[0].game_type).toBe('whot');
    expect(matchesTable[0].room_code).toBe('WXYZ');
  });

  it('persists explicit ludo gameType identically to default', async () => {
    await recordMatchFinished({
      roomCode: 'EFGH',
      winnerDeviceId: null,
      playerDeviceIds: ['d-1'],
      playerNames: { 'd-1': 'Solo' },
      gameType: 'ludo',
    });
    expect(matchesTable[0].game_type).toBe('ludo');
    expect(matchesTable[0].winner_device_id).toBeNull();
  });

  it('persists display-party identifiers when provided', async () => {
    await recordMatchFinished({
      roomCode: 'HIST',
      winnerDeviceId: 'd-1',
      playerDeviceIds: ['d-1', 'd-2'],
      playerNames: { 'd-1': 'Ada', 'd-2': 'Bo' },
      gameType: 'whot',
      hostDisplayId: 'display-1',
      partyId: 'party-1',
    });
    expect(matchesTable[0].host_display_id).toBe('display-1');
    expect(matchesTable[0].party_id).toBe('party-1');
  });
});

describe('fetchRecentMatches', () => {
  it('returns mixed Ludo + Whot history for a device', async () => {
    await recordMatchFinished({
      roomCode: 'L1', winnerDeviceId: 'me', playerDeviceIds: ['me', 'opp'],
      playerNames: { me: 'Me', opp: 'Opp' }, gameType: 'ludo',
    });
    await recordMatchFinished({
      roomCode: 'W1', winnerDeviceId: 'opp', playerDeviceIds: ['me', 'opp'],
      playerNames: { me: 'Me', opp: 'Opp' }, gameType: 'whot',
    });
    await recordMatchFinished({
      roomCode: 'X1', winnerDeviceId: 'somebody', playerDeviceIds: ['somebody'],
      playerNames: { somebody: 'Other' }, gameType: 'whot',
    });

    const rows = await fetchRecentMatches('me', 10);
    expect(rows).toHaveLength(2);
    const types = rows.map((r) => (r as Row).game_type).sort();
    expect(types).toEqual(['ludo', 'whot']);
  });

  it('returns host-display history independent of room code', async () => {
    await recordMatchFinished({
      roomCode: 'A111', winnerDeviceId: 'p1', playerDeviceIds: ['p1'],
      playerNames: { p1: 'Ada' }, gameType: 'ludo', hostDisplayId: 'display-x',
    });
    await recordMatchFinished({
      roomCode: 'B222', winnerDeviceId: 'p2', playerDeviceIds: ['p2'],
      playerNames: { p2: 'Bola' }, gameType: 'whot', hostDisplayId: 'display-x',
    });
    await recordMatchFinished({
      roomCode: 'C333', winnerDeviceId: 'p3', playerDeviceIds: ['p3'],
      playerNames: { p3: 'Cheta' }, gameType: 'ludo', hostDisplayId: 'other-display',
    });

    const rows = await fetchDisplayMatches('display-x', 10);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => (r as Row).room_code).sort()).toEqual(['A111', 'B222']);
  });
});
