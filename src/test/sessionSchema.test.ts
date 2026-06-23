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
      status: 'setup',
      currentStage: 'landing',
      selectedPackIds: ['pack.naija'],
      hostDeviceId: 'host-1',
      settings: {}, // defaults fill in
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.walkthroughCompleted).toBe(false);
    expect(parsed.activeOperatorIds).toEqual([]);
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
        selectedPackIds: [],
        hostDeviceId: 'host-1',
        settings: {},
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });

  it('rejects a too-short session code', () => {
    expect(() => HouseSession.parse({
      id: 's1', code: 'AB', status: 'setup', currentStage: 'x',
      selectedPackIds: [], hostDeviceId: 'h', settings: {}, createdAt: now, updatedAt: now,
    })).toThrow();
  });

  it('round-trips a GameRun', () => {
    const run = GameRun.parse({
      id: 'r1',
      houseSessionId: 's1',
      gameType: 'whot',
      packId: 'pack.naija',
      status: 'active',
    });
    expect(run.settings).toEqual({});
    expect(GameRun.parse(JSON.parse(JSON.stringify(run)))).toEqual(run);
  });

  it('HouseSessionSettings clamps to sane defaults', () => {
    const s = HouseSessionSettings.parse({});
    expect(s.voteCooldownMs).toBe(15_000);
    expect(s.allowCrowdVotes).toBe(false);
  });
});
