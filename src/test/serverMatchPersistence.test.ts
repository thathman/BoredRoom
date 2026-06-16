import { describe, expect, it } from 'vitest';
import { buildMatchKey } from '../../server/src/matchPersistence';

describe('server match persistence helpers', () => {
  it('builds stable keys independent of player order', () => {
    const a = buildMatchKey({ roomCode: 'ROOM', gameType: 'whot', winnerDeviceId: 'p1', playerDeviceIds: ['p2', 'p1'] });
    const b = buildMatchKey({ roomCode: 'ROOM', gameType: 'whot', winnerDeviceId: 'p1', playerDeviceIds: ['p1', 'p2'] });
    expect(a).toBe(b);
  });

  it('separates Ludo and Whot keys for same room/winner', () => {
    const base = { roomCode: 'ROOM', winnerDeviceId: 'p1', playerDeviceIds: ['p1', 'p2'] };
    expect(buildMatchKey({ ...base, gameType: 'ludo' })).not.toBe(buildMatchKey({ ...base, gameType: 'whot' }));
  });
});
