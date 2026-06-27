import { describe, expect, it } from 'vitest';
import { buildGameRun, buildHouseSession } from '../../server/src/foundations';
import {
  createCompanionPairing,
  deleteSession,
  endSession,
  kickSessionMember,
  admitSessionMember,
  addSessionBot,
  removeSessionBot,
  uniqueDisplayName,
  setRemoteMode,
  resolveMemberByOption,
  getPublicSession,
  getSessionRecord,
  issueOwnerCredential,
  openSessionVote,
  removeSessionBotMembers,
  redeemCompanionPairing,
  registerSession,
  resolveSessionVote,
  selectSessionGame,
  setSessionMemberConnected,
  castSessionVote,
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

  it('marks server bot seats and does not treat them as disconnected phones', () => {
    const { session } = createRecord();
    upsertSessionMember(session.code, {
      deviceId: 'bot:run-1:1',
      displayName: 'Bot 1',
      role: 'controller',
      isBot: true,
      ready: true,
      connected: true,
    });
    setSessionMemberConnected(session.code, 'bot:run-1:1', false);

    expect(getPublicSession(session.code)?.members[0]).toMatchObject({
      deviceId: 'bot:run-1:1',
      isBot: true,
      ready: true,
      connected: true,
    });

    removeSessionBotMembers(session.code);
    expect(getPublicSession(session.code)?.members).toHaveLength(0);
  });

  it('tracks active vote state and resolved history in public session snapshots', () => {
    const { session } = createRecord();
    upsertSessionMember(session.code, {
      deviceId: 'p1',
      displayName: 'Ada',
      role: 'controller',
    });
    upsertSessionMember(session.code, {
      deviceId: 'p2',
      displayName: 'Tobi',
      role: 'controller',
    });

    const opened = openSessionVote(session.code, {
      type: 'game_selection',
      question: 'Next game?',
      options: ['Whot', 'Ludo'],
      createdBy: session.hostDeviceId,
      settings: { quorum: 1, timerMs: 30_000 },
    });

    expect(opened?.status).toBe('open');
    expect(getPublicSession(session.code)?.activeVote?.question).toBe('Next game?');

    castSessionVote(session.code, 'p1', 'Whot');
    castSessionVote(session.code, 'p1', 'Ludo');
    castSessionVote(session.code, 'p2', 'Ludo');
    const resolved = resolveSessionVote(session.code);

    expect(resolved?.result?.winnerOption).toBe('Ludo');
    const snapshot = getPublicSession(session.code);
    expect(snapshot?.activeVote?.status).toBe('resolved');
    expect(snapshot?.activeVote?.tally).toEqual({ Whot: 0, Ludo: 2 });
    expect(snapshot?.voteHistory[0]).toMatchObject({
      voteType: 'game_selection',
      winnerOption: 'Ludo',
      castCount: 2,
    });
  });

  it('ends a party without deleting its record', () => {
    const { session } = createRecord();
    const ended = endSession(session.code);
    expect(ended?.session.status).toBe('ended');
    expect(getSessionRecord(session.code)).not.toBeNull();
    // ending again is a no-op
    expect(endSession(session.code)).toBeNull();
  });

  it('deletes a party and tears down its record', () => {
    const { session } = createRecord();
    const snapshot = deleteSession(session.code);
    expect(snapshot?.session.status).toBe('deleted');
    expect(getSessionRecord(session.code)).toBeNull();
    expect(deleteSession(session.code)).toBeNull();
  });

  it('kicks a player and resolves a vote option to their device id', () => {
    const { session } = createRecord();
    upsertSessionMember(session.code, { deviceId: 'dev-ada', displayName: 'Ada', role: 'controller' });
    expect(resolveMemberByOption(session.code, 'Ada')).toBe('dev-ada');
    const result = kickSessionMember(session.code, 'dev-ada');
    expect(result.removed).toBe(true);
    expect(getSessionRecord(session.code)?.members.has('dev-ada')).toBe(false);
    // kicking an unknown device is a no-op
    expect(kickSessionMember(session.code, 'ghost').removed).toBe(false);
  });

  it('holds new controllers pending when admission is required, then admits them', () => {
    const session = buildHouseSession({ hostDeviceId: `host-${Math.random()}`, settings: { requireAdmission: true } });
    registerSession(session, issueOwnerCredential());
    upsertSessionMember(session.code, { deviceId: 'dev-ada', displayName: 'Ada', role: 'controller' });
    const pending = getSessionRecord(session.code)?.members.get('dev-ada');
    expect(pending?.pending).toBe(true);
    expect(pending?.ready).toBe(false);
    expect(admitSessionMember(session.code, 'dev-ada')).toBe(true);
    expect(getSessionRecord(session.code)?.members.get('dev-ada')?.pending).toBe(false);
    // admitting again is a no-op
    expect(admitSessionMember(session.code, 'dev-ada')).toBe(false);
  });

  it('toggles remote mode on the session settings', () => {
    const { session } = createRecord();
    expect(setRemoteMode(session.code, false)).toBe(true);
    expect(getPublicSession(session.code)?.session.settings.allowRemote).toBe(false);
    setRemoteMode(session.code, true);
    expect(getPublicSession(session.code)?.session.settings.allowRemote).toBe(true);
  });

  it('deduplicates display names so no two members clash (humans and bots)', () => {
    const { session } = createRecord();
    upsertSessionMember(session.code, { deviceId: 'd1', displayName: 'Ada', role: 'controller' });
    upsertSessionMember(session.code, { deviceId: 'd2', displayName: 'Ada', role: 'controller' });
    const names = getPublicSession(session.code)!.members.map((m) => m.displayName).sort();
    expect(names).toContain('Ada');
    expect(names).toContain('Ada 2');
    // the helper is idempotent for the same device (reconnect keeps its name)
    expect(uniqueDisplayName(getSessionRecord(session.code)!, 'Ada', 'd1')).toBe('Ada');
  });

  it('adds and removes named bots without clashing names', () => {
    const { session } = createRecord();
    const b1 = addSessionBot(session.code);
    const b2 = addSessionBot(session.code);
    expect(b1?.isBot).toBe(true);
    expect(b1?.displayName).not.toBe(b2?.displayName); // unique bot names
    expect(removeSessionBot(session.code, b1!.deviceId)).toBe(true);
    expect(getSessionRecord(session.code)?.members.has(b1!.deviceId)).toBe(false);
    // removing a non-bot is rejected
    upsertSessionMember(session.code, { deviceId: 'human', displayName: 'Real', role: 'controller' });
    expect(removeSessionBot(session.code, 'human')).toBe(false);
  });
});
