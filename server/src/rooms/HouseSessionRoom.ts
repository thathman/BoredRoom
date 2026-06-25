import { Room, type Client } from '@colyseus/core';
import {
  clearActiveGame,
  finishActiveGame,
  getPublicSession,
  getRuntimeSnapshot,
  getSessionRecord,
  selectSessionGame,
  setRecapCopy,
  setSessionMemberConnected,
  setSessionMemberReady,
  subscribeToSession,
  storeRuntimeSnapshot,
  startSelectedGame,
  upsertSessionMember,
  verifyControlCredential,
  type SessionRole,
} from '../sessionDirectory.js';
import { log } from '../logger.js';
import {
  appendSessionEvent,
  buildGameRun,
  buildSessionEvent,
  persistGameRun,
  persistHouseSession,
  persistRuntimeSnapshot,
  persistSessionMember,
  rememberController,
} from '../foundations.js';
import {
  createInstalledGameRuntime,
  getInstalledGameVersion,
  isGameInstalled,
} from '../installedGames.js';
import type { GameRuntime } from '../../../shared/src/contracts/gameRuntime.js';
import {
  explainRejectedIntent,
  generateCommentary,
  generatePacingSuggestion,
  generatePrivateHint,
  generateRecap,
} from '../aiService.js';

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
  private gameRuntime: GameRuntime | null = null;
  private votes = new Map<string, string>();

  onCreate(options: JoinOptions): void {
    this.code = String(options.code ?? '').trim().toUpperCase();
    if (!getSessionRecord(this.code)) throw new Error('session_not_found');
    this.unsubscribe = subscribeToSession(this.code, (snapshot, event) => {
      this.broadcast('session:state', snapshot);
      if (event) this.broadcast('session:transition', { type: event, at: new Date().toISOString() });
      if (event === 'game.started') this.ensureRuntime(snapshot);
      if (event === 'game.cleared' || event === 'game.abandoned') {
        this.gameRuntime?.dispose();
        this.gameRuntime = null;
      }
    });
    this.onMessage('session:ready', (client, payload: { ready?: boolean }) => {
      const identity = this.identities.get(client.sessionId);
      if (identity) {
        setSessionMemberReady(this.code, identity.deviceId, payload?.ready !== false);
        this.persistMember(identity.deviceId);
      }
    });
    this.onMessage('session:select_game', (client, payload: { gameId?: string; settings?: Record<string, unknown> }) => {
      if (!this.isHostClient(client)) return;
      void this.selectGame(String(payload?.gameId ?? ''), payload?.settings ?? {}, false);
    });
    this.onMessage('session:start_game', (client, payload: { gameId?: string; settings?: Record<string, unknown> }) => {
      if (!this.isHostClient(client)) return;
      void this.selectGame(String(payload?.gameId ?? ''), payload?.settings ?? {}, true);
    });
    this.onMessage('session:switch_game', (client, payload: { gameId?: string; settings?: Record<string, unknown> }) => {
      if (!this.isHostClient(client)) return;
      void this.switchGame(String(payload?.gameId ?? ''), payload?.settings ?? {});
    });
    this.onMessage('session:end_game', (client) => {
      if (!this.isHostClient(client)) return;
      void this.endCurrentGame('finished');
    });
    this.onMessage('session:request_state', (client) => {
      const identity = this.identities.get(client.sessionId);
      client.send('session:state', getPublicSession(this.code));
      if (identity) this.sendGameState(client, identity);
    });
    this.onMessage('game:intent', (client, intent: Record<string, unknown>) => {
      const identity = this.identities.get(client.sessionId);
      if (!identity || !this.gameRuntime) return;
      const changed = this.gameRuntime.handleIntent(identity.deviceId, intent ?? {}, identity.isOwner);
      if (!changed) {
        const rules = this.gameRuntime.metadata.rules?.summary ?? 'Only legal server-validated actions are accepted.';
        void explainRejectedIntent({
          gameName: this.gameRuntime.gameType,
          rules,
          intent,
          runtime: this.gameRuntime,
        }).then((explanation) => {
          client.send('session:error', { code: 'illegal_game_intent', explanation });
        });
        return;
      }
      this.broadcastGameState();
      const runtimeSnapshot = this.gameRuntime.snapshot();
      storeRuntimeSnapshot(this.code, runtimeSnapshot);
      const runId = getSessionRecord(this.code)?.activeRuntime?.run.id;
      if (runId) {
        void persistRuntimeSnapshot({ gameRunId: runId, reason: 'meaningful_turn', state: runtimeSnapshot })
          .catch((error) => log('warn', 'runtime_snapshot_persist_failed', { session: this.code, error: String(error) }));
      }
      const publicState = this.gameRuntime.publicState() as { phase?: unknown };
      if (publicState?.phase === 'finished') {
        finishActiveGame(this.code, 'finished', this.gameRuntime.finish().winnerPlayerIds);
      }
      void generateCommentary({
        gameName: this.gameRuntime.gameType,
        publicState,
      }).then((line) => {
        if (line) this.broadcast('ai:result', { kind: 'commentary', text: line });
      });
      if (publicState?.phase === 'reveal') {
        void generatePacingSuggestion({
          gameName: this.gameRuntime.gameType,
          publicState,
        }).then((line) => {
          if (line) this.broadcast('ai:result', { kind: 'pacing', text: line });
        });
      }
    });
    this.onMessage('ai:request_hint', (client) => {
      const identity = this.identities.get(client.sessionId);
      if (!identity || identity.role !== 'controller' || !this.gameRuntime) return;
      const legalIntents = this.gameRuntime.legalIntents?.(identity.deviceId) ?? [];
      void generatePrivateHint({
        gameName: this.gameRuntime.gameType,
        rules: this.gameRuntime.metadata.rules?.summary ?? 'Use a legal action supplied by the game.',
        publicState: this.gameRuntime.publicState(),
        privateState: this.gameRuntime.privateState(identity.deviceId),
        legalIntents,
      }).then((hint) => {
        client.send('ai:result', { kind: 'hint', text: hint });
      });
    });
    this.onMessage('vote:cast', (client, payload: { option?: string }) => {
      const identity = this.identities.get(client.sessionId);
      const record = getSessionRecord(this.code);
      const option = String(payload?.option ?? '').trim().slice(0, 80);
      if (
        !identity
        || !record
        || !option
        || (identity.role === 'crowd' && !record.session.settings.allowCrowdVotes)
        || !['controller', 'crowd'].includes(identity.role)
      ) return;
      this.votes.set(identity.deviceId, option);
      const tally = Array.from(this.votes.values()).reduce<Record<string, number>>((result, vote) => {
        result[vote] = (result[vote] ?? 0) + 1;
        return result;
      }, {});
      this.broadcast('session:transition', { type: 'vote.cast', tally, at: new Date().toISOString() });
      void appendSessionEvent(buildSessionEvent({
        sessionId: record.session.id,
        gameRunId: record.activeRuntime?.run.id,
        type: 'vote.cast',
        actorId: identity.deviceId,
        payload: { option },
      })).catch((error) => log('warn', 'vote_persist_failed', { session: this.code, error: String(error) }));
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
    this.persistMember(identity.deviceId);
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
    const snapshot = getPublicSession(this.code);
    if (snapshot?.activeRun?.status === 'active') this.ensureRuntime(snapshot);
    this.sendGameState(client, identity);
  }

  onLeave(client: Client): void {
    const identity = this.identities.get(client.sessionId);
    if (identity) {
      setSessionMemberConnected(this.code, identity.deviceId, false);
      this.persistMember(identity.deviceId);
    }
    this.identities.delete(client.sessionId);
  }

  onDispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.gameRuntime?.dispose();
    this.gameRuntime = null;
    this.votes.clear();
  }

  private ensureRuntime(snapshot: NonNullable<ReturnType<typeof getPublicSession>>): void {
    if (!snapshot.activeRun || this.gameRuntime?.gameType === snapshot.activeRun.gameType) return;
    const players = snapshot.members
      .filter((member) => member.role === 'controller' && member.ready)
      .slice(0, snapshot.session.settings.maxControllers)
      .map((member) => ({ id: member.deviceId, name: member.displayName }));
    try {
      this.gameRuntime?.dispose();
      this.gameRuntime = createInstalledGameRuntime(
        snapshot.activeRun.gameType,
        {
          sessionId: snapshot.session.id,
          gameRunId: snapshot.activeRun.id,
          settings: snapshot.activeRun.settings,
        },
        players,
      );
      const saved = getRuntimeSnapshot(this.code);
      if (saved !== undefined) this.gameRuntime.restore(saved);
      else {
        const runtimeSnapshot = this.gameRuntime.snapshot();
        storeRuntimeSnapshot(this.code, runtimeSnapshot);
        void persistRuntimeSnapshot({
          gameRunId: snapshot.activeRun.id,
          reason: 'game_start',
          state: runtimeSnapshot,
        }).catch((error) => log('warn', 'runtime_snapshot_persist_failed', { session: this.code, error: String(error) }));
      }
      this.broadcastGameState();
    } catch (error) {
      this.gameRuntime = null;
      this.broadcast('session:error', {
        code: 'game_runtime_unavailable',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private sendGameState(client: Client, identity: ClientIdentity): void {
    if (!this.gameRuntime) return;
    const projectedState = identity.role === 'crowd'
      ? this.gameRuntime.crowdState()
      : identity.role === 'companion'
        ? this.gameRuntime.companionState()
        : this.gameRuntime.publicState();
    client.send('game:public_state', {
      gameType: this.gameRuntime.gameType,
      state: projectedState,
    });
    if (identity.role === 'controller') {
      client.send('game:private_state', {
        gameType: this.gameRuntime.gameType,
        state: this.gameRuntime.privateState(identity.deviceId),
      });
    }
  }

  private broadcastGameState(): void {
    if (!this.gameRuntime) return;
    for (const client of this.clients) {
      const identity = this.identities.get(client.sessionId);
      if (identity) this.sendGameState(client, identity);
    }
  }

  private persistMember(deviceId: string): void {
    const record = getSessionRecord(this.code);
    const member = record?.members.get(deviceId);
    if (!record || !member) return;
    void persistSessionMember({ sessionId: record.session.id, ...member })
      .catch((error) => log('warn', 'session_member_persist_failed', { session: this.code, error: String(error) }));
  }

  private isHostClient(client: Client): boolean {
    const identity = this.identities.get(client.sessionId);
    if (identity?.isOwner) return true;
    client.send('session:error', { code: 'host_authority_required' });
    return false;
  }

  private async selectGame(
    gameId: string,
    settings: Record<string, unknown>,
    startImmediately: boolean,
  ): Promise<void> {
    const record = getSessionRecord(this.code);
    const gameVersion = getInstalledGameVersion(gameId);
    if (!record || !gameId || !gameVersion || !isGameInstalled(gameId)) {
      this.broadcast('session:error', { code: 'game_not_installed', gameId });
      return;
    }
    if (record.activeRuntime && !['finished', 'abandoned'].includes(record.activeRuntime.run.status)) {
      this.broadcast('session:error', { code: 'active_game_requires_switch_confirmation' });
      return;
    }
    if (record.activeRuntime) clearActiveGame(this.code);
    const run = buildGameRun({
      houseSessionId: record.session.id,
      gameType: gameId,
      gameVersion,
      settings,
    });
    selectSessionGame(this.code, run);
    await Promise.all([
      persistGameRun(run),
      persistHouseSession(record.session),
      appendSessionEvent(buildSessionEvent({
        sessionId: record.session.id,
        gameRunId: run.id,
        type: 'game_run.created',
        payload: { gameType: gameId, gameVersion },
      })),
    ]).catch((error) => {
      log('warn', 'game_select_persist_failed', { session: this.code, error: String(error) });
    });
    if (startImmediately) await this.startGame();
  }

  private async startGame(): Promise<void> {
    const runtime = startSelectedGame(this.code);
    if (!runtime) {
      this.broadcast('session:error', { code: 'run_not_found' });
      return;
    }
    const record = getSessionRecord(this.code);
    await Promise.all([
      persistGameRun(runtime.run),
      record ? persistHouseSession(record.session) : Promise.resolve('skipped' as const),
      appendSessionEvent(buildSessionEvent({
        sessionId: runtime.run.houseSessionId,
        gameRunId: runtime.run.id,
        type: 'game_run.started',
      })),
    ]).catch((error) => {
      log('warn', 'game_start_persist_failed', { session: this.code, error: String(error) });
    });
  }

  private async switchGame(gameId: string, settings: Record<string, unknown>): Promise<void> {
    await this.endCurrentGame('abandoned');
    clearActiveGame(this.code);
    await this.selectGame(gameId, settings, true);
  }

  private async endCurrentGame(status: 'finished' | 'abandoned'): Promise<void> {
    if (this.gameRuntime) {
      const final = this.gameRuntime.finish();
      finishActiveGame(this.code, status, final.winnerPlayerIds);
    } else {
      finishActiveGame(this.code, status, []);
    }
    const record = getSessionRecord(this.code);
    const run = record?.activeRuntime?.run;
    if (!record || !run) return;
    const winnerNames = (run.winnerPlayerIds ?? [])
      .map((id) => record.members.get(id)?.displayName)
      .filter((name): name is string => Boolean(name));
    void generateRecap({
      gameName: run.gameType,
      winnerNames,
      signals: this.gameRuntime?.recapSignals?.() ?? {},
    }).then((copy) => setRecapCopy(this.code, copy));
    await Promise.all([
      persistGameRun(run),
      persistHouseSession(record.session),
      appendSessionEvent(buildSessionEvent({
        sessionId: record.session.id,
        gameRunId: run.id,
        type: status === 'finished' ? 'game_run.finished' : 'game_run.abandoned',
        payload: { winnerPlayerIds: run.winnerPlayerIds ?? [] },
      })),
    ]).catch((error) => {
      log('warn', 'game_finish_persist_failed', { session: this.code, error: String(error) });
    });
  }
}
