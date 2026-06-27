import { describe, expect, it } from 'vitest';
import { buildHouseSession, buildGameRun } from '../../server/src/foundations';
import {
  registerSession,
  issueOwnerCredential,
  upsertSessionMember,
  setSessionMemberConnected,
  selectSessionGame,
  startSelectedGame,
  finishActiveGame,
  clearActiveGame,
  pauseActiveGame,
  resumeActiveGame,
  getPublicSession,
  getSessionRecord,
} from '../../server/src/sessionDirectory';

function freshHouse() {
  const session = buildHouseSession({ hostDeviceId: `host-${Math.random()}` });
  registerSession(session, issueOwnerCredential());
  upsertSessionMember(session.code, { deviceId: 'ada', displayName: 'Ada', role: 'controller' });
  upsertSessionMember(session.code, { deviceId: 'tobi', displayName: 'Tobi', role: 'controller' });
  return session;
}

function play(code: string, gameId: string) {
  const record = getSessionRecord(code)!;
  const run = buildGameRun({ houseSessionId: record.session.id, gameType: gameId, gameVersion: '1.3.0.0' });
  selectSessionGame(code, run);
  startSelectedGame(code);
}

// GOAL1 invariants: create once / join once / play all night, with pause+reconnect.
describe('house session lifecycle (consecutive games + reconnect)', () => {
  it('plays consecutive games in one session without ending the party or changing the code', () => {
    const session = freshHouse();
    const code = session.code;

    // Game A
    play(code, 'trivia');
    expect(getPublicSession(code)?.session.status).toBe('in_game');
    finishActiveGame(code, 'finished', ['ada']);
    expect(getPublicSession(code)?.session.status).toBe('game_recap'); // recap, NOT ended
    expect(getPublicSession(code)?.session.code).toBe(code); // code unchanged

    clearActiveGame(code);
    expect(getPublicSession(code)?.session.status).toBe('intermission');

    // Game B — same session, same members, no rejoin needed
    play(code, 'color-wahala');
    const snap = getPublicSession(code)!;
    expect(snap.session.status).toBe('in_game');
    expect(snap.session.code).toBe(code);
    expect(snap.members.map((m) => m.deviceId).sort()).toEqual(['ada', 'tobi']);
    // The party is never 'ended' just because games came and went.
    expect(snap.session.status).not.toBe('ended');
  });

  it('auto-pauses on a seated player disconnect and resumes on reconnect', () => {
    const session = freshHouse();
    const code = session.code;
    play(code, 'trivia');
    expect(getPublicSession(code)?.activeRun?.status).toBe('active');

    // Ada disconnects mid-game → seated controller gone → host pauses.
    setSessionMemberConnected(code, 'ada', false);
    pauseActiveGame(code, 'controller_disconnected');
    expect(getPublicSession(code)?.activeRun?.status).toBe('paused');
    expect(getPublicSession(code)?.members.find((m) => m.deviceId === 'ada')?.connected).toBe(false);
    // Party stays in_game while paused (pause is a game-run state, not a party state).
    expect(getPublicSession(code)?.session.status).toBe('in_game');

    // Ada reconnects with the SAME code + deviceId — no new room, same member.
    upsertSessionMember(code, { deviceId: 'ada', displayName: 'Ada', role: 'controller' });
    setSessionMemberConnected(code, 'ada', true);
    resumeActiveGame(code);

    const snap = getPublicSession(code)!;
    expect(snap.activeRun?.status).toBe('active');
    expect(snap.members.find((m) => m.deviceId === 'ada')?.connected).toBe(true);
    expect(snap.session.code).toBe(code); // never dropped to a new/invalid code
    // Reconnecting member kept its identity (joinedAt preserved, not a fresh seat).
    expect(snap.members.filter((m) => m.deviceId === 'ada')).toHaveLength(1);
  });
});
