import { Room, type Client } from '@colyseus/core';
import {
  finishActiveGame,
  getPublicSession,
  getRuntimeSnapshot,
  getSessionRecord,
  setSessionMemberConnected,
  setSessionMemberReady,
  subscribeToSession,
  storeRuntimeSnapshot,
  upsertSessionMember,
  verifyControlCredential,
  type SessionRole,
} from '../sessionDirectory.js';
import { log } from '../logger.js';
import { rememberController } from '../foundations.js';
import {
  createNativeGameRuntime,
  isNativeGameType,
  type NativeGameRuntime,
} from '../nativeGames.js';

interface JoinOptions {
  code?: string;
  deviceId?: string;
  displayName?: string;
  role?: SessionRole;
  ownerCredential?: string;
}

interface ClientIdentity {
  code: string;
  deviceId: string;
  role: SessionRole;
  isOwner: boolean;
}

export class HouseSessionRoom extends Room {
  private code = '';
  private unsubscribe: (() => void) | null = null;
  private identities = new Map<string, ClientIdentity>();
  private nativeRuntime: NativeGameRuntime | null = null;

  onCreate(options: JoinOptions): void {
    this.code = String(options.code ?? '').trim().toUpperCase();
    if (!getSessionRecord(this.code)) throw new Error('session_not_found');
    this.unsubscribe = subscribeToSession(this.code, (snapshot, event) => {
      this.broadcast('session:state', snapshot);
      if (event) this.broadcast('session:transition', { type: event, at: new Date().toISOString() });
      if (
        event === 'game.started' &&
        snapshot.activeRun &&
        isNativeGameType(snapshot.activeRun.gameType)
      ) {
        const players = snapshot.members
          .filter((member) => member.role === 'controller' && member.ready)
          .slice(0, 12)
          .map((member) => ({ id: member.deviceId, name: member.displayName }));
        this.nativeRuntime = createNativeGameRuntime(snapshot.activeRun.gameType, players);
        const saved = getRuntimeSnapshot(this.code);
        if (saved !== undefined) this.nativeRuntime.restore(saved);
        else storeRuntimeSnapshot(this.code, this.nativeRuntime.snapshot());
        this.broadcastNativeState();
      }
      if (event === 'game.cleared' || event === 'game.abandoned') this.nativeRuntime = null;
    });
    this.onMessage('session:ready', (client, payload: { ready?: boolean }) => {
      const identity = this.identities.get(client.sessionId);
      if (identity) setSessionMemberReady(this.code, identity.deviceId, payload?.ready !== false);
    });
    this.onMessage('session:request_state', (client) => {
      const identity = this.identities.get(client.sessionId);
      client.send('session:state', getPublicSession(this.code));
      if (identity) this.sendNativeState(client, identity.deviceId);
    });
    this.onMessage('game:intent', (client, intent: Record<string, unknown>) => {
      const identity = this.identities.get(client.sessionId);
      if (!identity || !this.nativeRuntime) return;
      const changed = this.nativeRuntime.handleIntent(identity.deviceId, intent ?? {}, identity.isOwner);
      if (!changed) {
        client.send('session:error', { code: 'illegal_game_intent' });
        return;
      }
      this.broadcastNativeState();
      storeRuntimeSnapshot(this.code, this.nativeRuntime.snapshot());
      if (this.nativeRuntime.isFinished()) {
        finishActiveGame(this.code, 'finished', this.nativeRuntime.winnerPlayerIds());
      }
    });
    log('info', 'house_session_room_created', { session: this.code });
  }

  onAuth(_client: Client, options: JoinOptions): ClientIdentity {
    const code = String(options.code ?? '').trim().toUpperCase();
    const deviceId = String(options.deviceId ?? '').trim();
    const role = options.role ?? 'controller';
    if (code !== this.code || !getSessionRecord(code)) throw new Error('session_not_found');
    if (!deviceId) throw new Error('deviceId_required');
    const ownerRole = role === 'display' || role === 'companion';
    const isOwner = ownerRole && verifyControlCredential(code, options.ownerCredential);
    if (ownerRole && !isOwner) throw new Error('owner_credential_invalid');
    return { code, deviceId, role, isOwner };
  }

  onJoin(client: Client, options: JoinOptions, identity: ClientIdentity): void {
    this.identities.set(client.sessionId, identity);
    upsertSessionMember(this.code, {
      deviceId: identity.deviceId,
      displayName: String(options.displayName ?? (identity.role === 'display' ? 'Host display' : 'Player')),
      role: identity.role,
    });
    const record = getSessionRecord(this.code);
    if (identity.role === 'controller' && record) {
      void rememberController({
        id: identity.deviceId,
        displayName: String(options.displayName ?? 'Player'),
        lastSeenAt: new Date().toISOString(),
        pairedSessionIds: [record.session.id],
      }).catch((error) => {
        log('warn', 'controller_persist_failed', { session: this.code, error: String(error) });
      });
    }
    client.send('session:state', getPublicSession(this.code));
    this.sendNativeState(client, identity.deviceId);
  }

  onLeave(client: Client): void {
    const identity = this.identities.get(client.sessionId);
    if (identity) setSessionMemberConnected(this.code, identity.deviceId, false);
    this.identities.delete(client.sessionId);
  }

  onDispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private sendNativeState(client: Client, deviceId: string): void {
    if (!this.nativeRuntime) return;
    client.send('game:public_state', {
      gameType: this.nativeRuntime.gameType,
      state: this.nativeRuntime.publicState(),
    });
    client.send('game:private_state', {
      gameType: this.nativeRuntime.gameType,
      state: this.nativeRuntime.privateState(deviceId),
    });
  }

  private broadcastNativeState(): void {
    if (!this.nativeRuntime) return;
    this.broadcast('game:public_state', {
      gameType: this.nativeRuntime.gameType,
      state: this.nativeRuntime.publicState(),
    });
    for (const client of this.clients) {
      const identity = this.identities.get(client.sessionId);
      if (identity) this.sendNativeState(client, identity.deviceId);
    }
  }
}
