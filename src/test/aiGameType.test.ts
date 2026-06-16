// Verifies game-aware AI payload propagation: getCommentary/getRecap forward
// `gameType` to the underlying edge-function invoke call, defaulting to omitted
// when not provided (so server falls back to 'ludo' for backward compat).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

import { getCommentary, getRecap } from '@/lib/ai';

describe('AI game-awareness payload propagation', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ data: { line: 'ok', recap: { headline: 'h', paragraph: 'p', mvp: 'm' } }, error: null });
  });

  it('getCommentary forwards gameType=whot when provided', async () => {
    await getCommentary({
      roomCode: 'WHOT1',
      events: [{ type: 'whot_play', actor: 'A', value: 5, shape: 'circle' }],
      players: [{ name: 'A', color: '' }],
      gameType: 'whot',
    });
    expect(invokeMock).toHaveBeenCalledWith('ai-commentary', expect.objectContaining({
      body: expect.objectContaining({ gameType: 'whot' }),
    }));
  });

  it('getCommentary omits gameType when not provided (server defaults to ludo)', async () => {
    // Wait past internal commentary cooldown (3500ms) — use unique room to bypass any per-room state
    await new Promise((r) => setTimeout(r, 3600));
    invokeMock.mockClear();
    await getCommentary({
      roomCode: 'LUDO1',
      events: [{ type: 'roll', actor: 'A', value: 6 }],
      players: [{ name: 'A', color: 'red' }],
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    const callArg = invokeMock.mock.calls[0][1].body;
    expect(callArg.gameType).toBeUndefined();
  });

  it('commentary cooldown is scoped by room and game type', async () => {
    await getCommentary({
      roomCode: 'ROOMA',
      events: [{ type: 'roll', actor: 'A', value: 6 }],
      players: [{ name: 'A', color: 'red' }],
      gameType: 'ludo',
    });
    await getCommentary({
      roomCode: 'ROOMB',
      events: [{ type: 'whot_play', actor: 'B', value: 8 }],
      players: [{ name: 'B', color: 'blue' }],
      gameType: 'whot',
    });

    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('commentary cooldown separates ludo and whot in the same room', async () => {
    await getCommentary({
      roomCode: 'MIXED',
      events: [{ type: 'roll', actor: 'A', value: 6 }],
      players: [{ name: 'A', color: 'red' }],
      gameType: 'ludo',
    });
    await getCommentary({
      roomCode: 'MIXED',
      events: [{ type: 'whot_suspension', actor: 'A' }],
      players: [{ name: 'A', color: 'red' }],
      gameType: 'whot',
    });

    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('getRecap forwards gameType=whot and signals', async () => {
    await getRecap({
      roomCode: 'WHOT2',
      players: [{ name: 'A', color: '', tokensHome: 8 }],
      winnerName: 'A',
      turnCount: 12,
      matchDurationMs: 60000,
      gameType: 'whot',
      signals: { totalPlays: 12, suspensions: 1 },
    });
    expect(invokeMock).toHaveBeenCalledWith('ai-recap', expect.objectContaining({
      body: expect.objectContaining({ gameType: 'whot', signals: expect.any(Object) }),
    }));
  });

  it('getRecap forwards gameType=ludo explicitly', async () => {
    await getRecap({
      roomCode: 'LUDO2',
      players: [{ name: 'A', color: 'red', tokensHome: 4 }],
      winnerName: 'A',
      turnCount: 30,
      matchDurationMs: 120000,
      gameType: 'ludo',
    });
    expect(invokeMock).toHaveBeenCalledWith('ai-recap', expect.objectContaining({
      body: expect.objectContaining({ gameType: 'ludo' }),
    }));
  });
});
