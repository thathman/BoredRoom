import { describe, expect, it } from 'vitest';
import {
  buildHouseSession,
  buildGameRun,
  buildSessionEvent,
  buildOperatorDevice,
  canTransition,
  selectResumableSession,
  makeSessionCode,
  persistHouseSession,
} from '../../server/src/foundations';
import { HouseSession, GameRun } from '../../shared/src/contracts/session';

// Phase 1 flow coverage (AC-1.3 … AC-1.9). DB writes are env-gated and skip locally;
// these assert the pure spine logic that the persistence layer serializes.
describe('foundations flow', () => {
  it('AC-1.3: creates a valid house session in setup', () => {
    const s = buildHouseSession({ hostDeviceId: 'host-1', selectedPackIds: ['pack.naija'] });
    expect(() => HouseSession.parse(s)).not.toThrow();
    expect(s.status).toBe('setup');
    expect(s.code).toHaveLength(5);
    expect(s.settings.maxControllers).toBe(12);
  });

  it('AC-1.4: a game run attaches to its session', () => {
    const s = buildHouseSession({ hostDeviceId: 'h', selectedPackIds: ['p'] });
    const run = buildGameRun({ houseSessionId: s.id, gameType: 'whot', packId: 'p' });
    expect(() => GameRun.parse(run)).not.toThrow();
    expect(run.houseSessionId).toBe(s.id);
  });

  it('AC-1.5: rematch creates a new game_run_id (never reused)', () => {
    const s = buildHouseSession({ hostDeviceId: 'h', selectedPackIds: ['p'] });
    const r1 = buildGameRun({ houseSessionId: s.id, gameType: 'whot', packId: 'p' });
    const r2 = buildGameRun({ houseSessionId: s.id, gameType: 'whot', packId: 'p' });
    expect(r2.id).not.toBe(r1.id);
  });

  it('AC-1.6: session events carry session + ordering timestamp', () => {
    const s = buildHouseSession({ hostDeviceId: 'h', selectedPackIds: ['p'] });
    const e1 = buildSessionEvent({ sessionId: s.id, type: 'session.created', now: '2026-06-23T00:00:00.000Z' });
    const e2 = buildSessionEvent({ sessionId: s.id, type: 'game.started', now: '2026-06-23T00:00:01.000Z' });
    expect(e1.sessionId).toBe(s.id);
    expect(e1.at.localeCompare(e2.at)).toBeLessThan(0);
  });

  it('AC-1.8: operator device pairs with a role', () => {
    const s = buildHouseSession({ hostDeviceId: 'h', selectedPackIds: ['p'] });
    const op = buildOperatorDevice({ id: 'op-1', sessionId: s.id, role: 'scorekeeper' });
    expect(op.role).toBe('scorekeeper');
    expect(op.sessionId).toBe(s.id);
  });

  it('AC-1.9: resume picks most-recent non-ended session for the host', () => {
    const old = { ...buildHouseSession({ hostDeviceId: 'h', selectedPackIds: ['p'] }), updatedAt: '2026-06-20T00:00:00.000Z' };
    const recent = { ...buildHouseSession({ hostDeviceId: 'h', selectedPackIds: ['p'] }), updatedAt: '2026-06-22T00:00:00.000Z' };
    const ended = { ...buildHouseSession({ hostDeviceId: 'h', selectedPackIds: ['p'] }), updatedAt: '2026-06-23T00:00:00.000Z', status: 'ended' as const };
    const other = { ...buildHouseSession({ hostDeviceId: 'other', selectedPackIds: ['p'] }), updatedAt: '2026-06-24T00:00:00.000Z' };
    const pick = selectResumableSession([old, recent, ended, other], 'h');
    expect(pick?.id).toBe(recent.id);
  });

  it('enforces status transitions', () => {
    expect(canTransition('setup', 'waiting_for_players')).toBe(true);
    expect(canTransition('ended', 'game_active')).toBe(false);
    expect(canTransition('game_active', 'recap')).toBe(true);
  });

  it('session codes use unambiguous alphabet', () => {
    const code = makeSessionCode(20);
    expect(code).not.toMatch(/[OIL10]/);
  });

  it('persistence skips gracefully without backend env', async () => {
    const s = buildHouseSession({ hostDeviceId: 'h', selectedPackIds: ['p'] });
    const prevUrl = process.env.SUPABASE_URL;
    const prevVite = process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    try {
      expect(await persistHouseSession(s)).toBe('skipped');
    } finally {
      if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
      if (prevVite !== undefined) process.env.VITE_SUPABASE_URL = prevVite;
    }
  });
});
