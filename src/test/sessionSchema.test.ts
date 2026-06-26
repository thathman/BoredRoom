import { describe, expect, it } from 'vitest';
import {
  HouseSession,
  HouseSessionSettings,
  GameRun,
} from '../../shared/src/contracts/session';

// AC-1.1: schemas validate — a well-formed value parses, a malformed one is rejected.
describe('session schemas', () => {
  const now = new Date().toISOString();

  it('parses a well-formed HouseSession and applies setting defaults', () => {
    const parsed = HouseSession.parse({
      id: 's1',
      code: 'ABCD',
      status: 'draft',
      currentStage: 'landing',
      hostDeviceId: 'host-1',
      settings: {}, // defaults fill in
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.walkthroughCompleted).toBe(false);
    expect(parsed.settings.maxControllers).toBe(12);
    expect(parsed.settings.language).toBe('en');
  });

  it('rejects an invalid HouseSession status', () => {
    expect(() =>
      HouseSession.parse({
        id: 's1',
        code: 'ABCD',
        status: 'not_a_status',
        currentStage: 'landing',
        hostDeviceId: 'host-1',
        settings: {},
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });

  it('rejects a too-short session code', () => {
    expect(() => HouseSession.parse({
      id: 's1', code: 'AB', status: 'draft', currentStage: 'x',
      hostDeviceId: 'h', settings: {}, createdAt: now, updatedAt: now,
    })).toThrow();
  });

  it('round-trips a GameRun', () => {
    const run = GameRun.parse({
      id: 'r1',
      houseSessionId: 's1',
      gameType: 'whot',
      gameVersion: '1.1.0.0',
      status: 'active',
    });
    expect(run.settings).toEqual({});
    expect(GameRun.parse(JSON.parse(JSON.stringify(run)))).toEqual(run);
  });

  it('accepts Postgres timestamptz offset timestamps (read path)', () => {
    const parsed = HouseSession.parse({
      id: 's1', code: 'ABCD', status: 'draft', currentStage: 'landing',
      hostDeviceId: 'h', settings: {},
      createdAt: '2026-06-23T16:26:29.752+00:00',
      updatedAt: '2026-06-23T16:26:29.752+00:00',
    });
    expect(parsed.createdAt).toContain('+00:00');
  });

  it('HouseSessionSettings clamps to sane defaults', () => {
    const s = HouseSessionSettings.parse({});
    expect(s.voteCooldownMs).toBe(15_000);
    expect(s.allowCrowdVotes).toBe(false);
  });
});
