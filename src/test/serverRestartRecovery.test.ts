import { describe, expect, it } from 'vitest';
import { buildHouseSession, buildGameRun } from '../../server/src/foundations';
import {
  registerSession,
  issueOwnerCredential,
  upsertSessionMember,
  selectSessionGame,
  startSelectedGame,
  storeRuntimeSnapshot,
  getRuntimeSnapshot,
  getPublicSession,
  getSessionCredentialHashes,
  deleteSession,
  hydrateSession,
  hydrateSessionMember,
  hydrateActiveRun,
} from '../../server/src/sessionDirectory';

// GOAL1 persistence/reconnection invariant: after a server restart, an in-flight game is
// recovered from persisted session + run + runtime snapshot — players reconnect to the same
// code and the runtime is restored exactly, rather than the house becoming an invalid code.
describe('server-restart recovery', () => {
  it('rehydrates an in-flight game from persisted state after the in-memory store is wiped', () => {
    // --- live session with an active game and a stored runtime snapshot ---
    const session = buildHouseSession({ hostDeviceId: 'host-restart' });
    registerSession(session, issueOwnerCredential());
    const code = session.code;
    upsertSessionMember(code, { deviceId: 'ada', displayName: 'Ada', role: 'controller' });
    upsertSessionMember(code, { deviceId: 'tobi', displayName: 'Tobi', role: 'controller' });

    const run = buildGameRun({ houseSessionId: session.id, gameType: 'whot', gameVersion: '1.3.0.0' });
    selectSessionGame(code, run);
    startSelectedGame(code);

    // The runtime persists its state on meaningful turns; capture a representative snapshot.
    const runtimeState = { topCard: { id: 'c7', shape: 'Circle', number: 7 }, currentPlayerId: 'ada', drawPileCount: 30 };
    storeRuntimeSnapshot(code, runtimeState);

    // What a real deployment persists to Supabase between restarts:
    const persistedSession = structuredClone(getPublicSession(code)!.session);
    const persistedMembers = structuredClone(getPublicSession(code)!.members);
    const persistedRun = structuredClone(getPublicSession(code)!.activeRun!);
    const persistedSnapshot = structuredClone(getRuntimeSnapshot(code));
    const creds = getSessionCredentialHashes(code)!;
    // Mark the run recoverable, as a graceful shutdown would.
    persistedRun.status = 'recoverable';

    // --- simulate the restart: wipe the in-memory record entirely ---
    deleteSession(code);
    expect(getPublicSession(code)).toBeNull();

    // --- recovery on boot: hydrate session, members, active run + snapshot ---
    hydrateSession(persistedSession, { ownerCredentialHash: creds.ownerCredentialHash, companionCredentialHashes: creds.companionCredentialHashes });
    for (const member of persistedMembers) hydrateSessionMember(code, member);
    hydrateActiveRun(code, persistedRun, persistedSnapshot);

    // --- the house is back at the same code, members present (disconnected until they reconnect) ---
    const recovered = getPublicSession(code)!;
    expect(recovered).not.toBeNull();
    expect(recovered.session.code).toBe(code);
    expect(recovered.members.map((m) => m.deviceId).sort()).toEqual(['ada', 'tobi']);
    expect(recovered.members.every((m) => m.connected === false)).toBe(true); // await reconnect
    expect(recovered.activeRun?.gameType).toBe('whot');
    expect(recovered.activeRun?.status).toBe('recoverable');

    // --- the exact runtime snapshot survives, so runtime.restore() rebuilds the same game ---
    expect(getRuntimeSnapshot(code)).toEqual(runtimeState);

    deleteSession(code);
  });

  it('a real game runtime restores its exact state from the recovered snapshot', async () => {
    // Use the actual Whot runtime from the sibling BoredRoom-Games repo to prove end-to-end
    // recovery, not just an opaque blob. Skips cleanly if the sibling repo is not checked out.
    let WhotRuntime: new (m: unknown) => {
      configure: (c: unknown) => void; seatPlayers: (p: unknown[]) => void; start: () => void;
      publicState: () => { currentPlayerId: string }; legalIntents: (id: string) => unknown[];
      handleIntent: (id: string, i: unknown, h: boolean) => boolean; snapshot: () => unknown;
      restore: (s: unknown) => void; privateState: (id: string) => { hand: unknown[] };
    };
    try {
      ({ WhotRuntime } = await import('../../../BoredRoom-Games/runtime/game-runtime.js' as string));
    } catch {
      return; // sibling games repo not present in this checkout — skip
    }
    const manifest = {
      id: 'whot', name: 'Whot', emoji: '🃏', version: '1.3.0.0',
      minPlayers: 2, maxPlayers: 8,
      capabilities: { bots: true, audience: true, hints: true, restore: true },
    };
    const live = new WhotRuntime(manifest);
    live.configure({ sessionId: 's', gameRunId: 'r', settings: { seed: 42 } });
    live.seatPlayers([{ id: 'ada', name: 'Ada' }, { id: 'tobi', name: 'Tobi' }]);
    live.start();
    // Make a legal move so the state is non-trivial.
    const current = live.publicState().currentPlayerId;
    const legal = live.legalIntents(current)[0];
    live.handleIntent(current, legal, false);
    const before = JSON.stringify(live.publicState());

    // Persist (what storeRuntimeSnapshot keeps) then restore into a brand-new runtime.
    const snapshot = structuredClone(live.snapshot());
    const recovered = new WhotRuntime(manifest);
    recovered.configure({ sessionId: 's', gameRunId: 'r', settings: {} });
    recovered.seatPlayers([]);
    recovered.start();
    recovered.restore(snapshot);

    expect(JSON.stringify(recovered.publicState())).toBe(before);
    // And a previously-seated player's private hand comes back intact.
    expect(recovered.privateState('ada').hand.length).toBe(live.privateState('ada').hand.length);
  });
});
