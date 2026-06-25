import { describe, expect, it } from 'vitest';
import { buildGameRun, buildHouseSession } from '../../server/src/foundations';
import {
  createCompanionPairing,
  getPublicSession,
  issueOwnerCredential,
  redeemCompanionPairing,
  registerSession,
  selectSessionGame,
  setSessionMemberConnected,
  upsertSessionMember,
  verifyControlCredential,
  verifyOwnerCredential,
} from '../../server/src/sessionDirectory';

function createRecord() {
  const session = buildHouseSession({
    hostDeviceId: `host-${Math.random()}`,
  });
  const ownerCredential = issueOwnerCredential();
  registerSession(session, ownerCredential);
  return { session, ownerCredential };
}

describe('house session authority', () => {
  it('accepts only the device-bound owner credential for owner authority', () => {
    const { session, ownerCredential } = createRecord();
    expect(verifyOwnerCredential(session.code, ownerCredential)).toBe(true);
    expect(verifyOwnerCredential(session.code, 'wrong')).toBe(false);
  });

  it('issues a one-time scoped companion credential', () => {
    const { session } = createRecord();
    const pairing = createCompanionPairing(session.code);
    const redeemed = redeemCompanionPairing(session.code, pairing.pairingCode);

    expect(redeemed).not.toBeNull();
    expect(verifyControlCredential(session.code, redeemed?.companionCredential)).toBe(true);
    expect(redeemCompanionPairing(session.code, pairing.pairingCode)).toBeNull();
  });

  it('keeps membership across disconnects and hides private runtime access', () => {
    const { session } = createRecord();
    upsertSessionMember(session.code, {
      deviceId: 'p1',
      displayName: 'Ada',
      role: 'controller',
    });
    setSessionMemberConnected(session.code, 'p1', false);
    const run = buildGameRun({
      houseSessionId: session.id,
      gameType: 'half-half',
      gameVersion: '1.1.0.0',
    });
    selectSessionGame(session.code, run);

    const snapshot = getPublicSession(session.code);
    expect(snapshot?.members[0]).toMatchObject({ deviceId: 'p1', connected: false });
    expect(snapshot?.activeRun?.gameVersion).toBe('1.1.0.0');
    expect(snapshot?.activeRun).not.toHaveProperty('runtimeId');
    expect(snapshot?.activeRun).not.toHaveProperty('roomCode');
  });
});
