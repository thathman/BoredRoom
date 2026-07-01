import { Room, type Client } from '@colyseus/core';
import {
  clearActiveGame,
  endSession,
  deleteSession,
  kickSessionMember,
  admitSessionMember,
  setRemoteMode,
  resolveMemberByOption,
  applySessionVote,
  archiveSessionVote,
  cancelSessionVote,
  castSessionVote,
  closeSessionVote,
  finishActiveGame,
  markGameRunPayout,
  getPublicSession,
  getRuntimeSnapshot,
  getSessionRecord,
  pauseActiveGame,
  removeSessionBotMembers,
  addSessionBot,
  removeSessionBot,
  resumeActiveGame,
  resolveSessionVote,
  openSessionVote,
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
  findInstalledGameId,
  getInstalledGameManifest,
  getInstalledGameVersion,
  isGameInstalled,
} from '../installedGames.js';
import type { GameRuntime } from '../../../shared/src/contracts/gameRuntime.js';
import { HouseVoteType, type GameRun } from '../../../shared/src/contracts/session.js';
import {
  explainRejectedIntent,
  generateCommentary,
  generatePacingSuggestion,
  generatePrivateHint,
  generateRulesExplanation,
  generateRecap,
  generateGameContent,
} from '../aiService.js';
import { recentPromptsFor, rememberPrompts } from '../aiContentMemory.js';
import { selectRunContent } from '../content/moneyTriviaStore.js';
import { chooseDeterministicBotIntent } from '../botStrategy.js';

// A binary action vote (end party, pause, etc.) fires only when the winning option reads as a yes.
const AFFIRMATIVE_OPTIONS = new Set([
  'yes', 'end party', 'end game', 'pause', 'resume', 'do it', 'agree', 'confirm', 'end',
]);
// Minimum gap between MC commentary lines on ordinary moves (key moments bypass it).
const COMMENTARY_COOLDOWN_MS = 9000;
function isAffirmative(option: string): boolean {
  return AFFIRMATIVE_OPTIONS.has(option.trim().toLowerCase());
}

interface JoinOptions {
  code?: string;
  deviceId?: string;
  displayName?: string;
  role?: SessionRole;
  ownerCredential?: string;
  avatar?: string;
  accentColor?: string;
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
  private voteTimer: NodeJS.Timeout | null = null;
  private lastVoteRequestAt = 0;
  // Earned hints: each player starts a game with 1 and earns +1 (cap 3) whenever their score
  // rises — so hints are won by playing well, not handed out for free.
  private hintBudgets = new Map<string, number>();
  private lastScores = new Map<string, number>();
  private static readonly HINT_CAP = 3;
  private botTimer: NodeJS.Timeout | null = null;
  private paceTimer: NodeJS.Timeout | null = null;
  private paceDeadline: number | null = null;
  private triviaTimer: NodeJS.Timeout | null = null;
  private botTurnNumber = 0;
  private commentarySerial = 0;
  private lastCommentaryAt = 0;
  private commentaryInFlight = false;

  onCreate(options: JoinOptions): void {
    this.code = String(options.code ?? '').trim().toUpperCase();
    if (!getSessionRecord(this.code)) throw new Error('session_not_found');
    this.unsubscribe = subscribeToSession(this.code, (snapshot, event) => {
      this.broadcast('session:state', snapshot);
      if (event) this.broadcast('session:transition', { type: event, at: new Date().toISOString() });
      if (event === 'game.started') {
        this.commentarySerial += 1;
        this.ensureRuntime(snapshot);
      }
      if (event === 'game.cleared' || event === 'game.abandoned') {
        this.commentarySerial += 1;
        this.clearBotTimer();
        this.gameRuntime?.dispose();
        this.gameRuntime = null;
      }
    });
    this.onMessage('session:ready', (client, payload: { ready?: boolean }) => {
      const identity = this.identities.get(client.sessionId);
      if (!identity) return;
      // Pending players cannot ready up until the host admits them.
      if (getSessionRecord(this.code)?.members.get(identity.deviceId)?.pending) return;
      setSessionMemberReady(this.code, identity.deviceId, payload?.ready !== false);
      this.persistMember(identity.deviceId);
    });
    this.onMessage('session:admit_player', (client, payload: { deviceId?: string }) => {
      if (!this.isHostClient(client)) return;
      if (admitSessionMember(this.code, String(payload?.deviceId ?? ''))) {
        this.broadcast('session:state', getPublicSession(this.code));
        this.broadcast('session:transition', { type: 'member.admitted', deviceId: payload?.deviceId, at: new Date().toISOString() });
      }
    });
    this.onMessage('session:reject_player', (client, payload: { deviceId?: string }) => {
      if (!this.isHostClient(client)) return;
      this.kickPlayer(String(payload?.deviceId ?? ''), 'Admission declined by host.');
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
    this.onMessage('session:mark_payout', (client, payload: { settlementStatus?: string }) => {
      if (!this.isHostClient(client)) return;
      const status = payload?.settlementStatus;
      if (status !== 'paid' && status !== 'waived' && status !== 'unsettled') return;
      const result = markGameRunPayout(this.code, status);
      if (result) {
        this.broadcast('session:payout_marked', { result });
        void appendSessionEvent(buildSessionEvent({
          sessionId: getSessionRecord(this.code)?.session.id ?? this.code,
          type: 'game_run.payout_marked',
          payload: { settlementStatus: status, earnedAmount: result.earnedAmount, currency: result.currency },
        })).catch(() => {});
      }
    });
    this.onMessage('session:end_party', (client) => {
      if (!this.isHostClient(client)) return;
      const identity = this.identities.get(client.sessionId);
      this.clearVoteTimer();
      this.clearBotTimer();
      const snapshot = endSession(this.code);
      if (!snapshot) return;
      this.broadcast('session:transition', { type: 'party.ended', at: new Date().toISOString() });
      this.broadcast('session:state', snapshot);
      void this.persistVoteEvent('party.ended', identity?.deviceId, {});
    });
    this.onMessage('session:kick_player', (client, payload: { deviceId?: string; reason?: string }) => {
      if (!this.isHostClient(client)) return;
      const identity = this.identities.get(client.sessionId);
      this.kickPlayer(String(payload?.deviceId ?? ''), payload?.reason, identity?.deviceId);
    });
    this.onMessage('session:add_bot', (client) => {
      if (!this.isHostClient(client)) return;
      if (addSessionBot(this.code)) this.broadcast('session:state', getPublicSession(this.code));
    });
    this.onMessage('session:remove_bot', (client, payload: { deviceId?: string }) => {
      if (!this.isHostClient(client)) return;
      if (removeSessionBot(this.code, String(payload?.deviceId ?? ''))) this.broadcast('session:state', getPublicSession(this.code));
    });
    this.onMessage('session:set_remote_mode', (client, payload: { enabled?: boolean }) => {
      if (!this.isHostClient(client)) return;
      if (!setRemoteMode(this.code, payload?.enabled !== false)) return;
      this.broadcast('session:state', getPublicSession(this.code));
      this.broadcast('session:transition', { type: 'remote.changed', enabled: payload?.enabled !== false, at: new Date().toISOString() });
    });
    this.onMessage('session:delete_party', (client, payload: { confirm?: string }) => {
      if (!this.isHostClient(client)) return;
      // Stronger than ending: require the house code echoed back so it cannot fire by accident.
      if (String(payload?.confirm ?? '').trim().toUpperCase() !== this.code) {
        client.send('session:error', { code: 'delete_confirmation_required' });
        return;
      }
      const identity = this.identities.get(client.sessionId);
      this.clearVoteTimer();
      this.clearBotTimer();
      void this.persistVoteEvent('party.deleted', identity?.deviceId, {});
      const snapshot = deleteSession(this.code);
      if (snapshot) {
        this.broadcast('session:transition', { type: 'party.deleted', at: new Date().toISOString() });
        this.broadcast('session:state', snapshot);
      }
    });
    this.onMessage('session:pause_game', (client, payload: { reason?: string }) => {
      const identity = this.identities.get(client.sessionId);
      if (!identity) return;
      if (identity.role === 'controller' || this.isHostClient(client)) {
        void this.pauseGame(payload?.reason ?? (identity.role === 'controller' ? 'player_pause' : 'host_pause'));
      }
    });
    this.onMessage('session:resume_game', (client) => {
      if (!this.isHostClient(client)) return;
      void this.resumeGame();
    });
    this.onMessage('session:call_vote', (client, payload: {
      type?: string;
      question?: string;
      options?: string[];
      settings?: Record<string, unknown>;
    }) => {
      if (!this.isHostClient(client)) return;
      const options = (payload?.options ?? [])
        .map((option) => String(option ?? '').trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 8);
      if (options.length < 2) return;
      const identity = this.identities.get(client.sessionId);
      const parsedType = HouseVoteType.safeParse(payload?.type);
      const vote = openSessionVote(this.code, {
        type: parsedType.success ? parsedType.data : 'custom',
        question: String(payload?.question ?? 'What should the house choose?').trim().slice(0, 160),
        options,
        createdBy: identity?.deviceId,
        settings: {
          timerMs: typeof payload?.settings?.timerMs === 'number' ? payload.settings.timerMs : undefined,
          quorum: typeof payload?.settings?.quorum === 'number' ? payload.settings.quorum : undefined,
          majorityThreshold: typeof payload?.settings?.majorityThreshold === 'number' ? payload.settings.majorityThreshold : undefined,
          autoApply: typeof payload?.settings?.autoApply === 'boolean' ? payload.settings.autoApply : undefined,
        },
      });
      if (!vote) return;
      this.scheduleVoteResolution(vote.closesAt);
      this.broadcast('session:transition', {
        type: 'vote.opened',
        vote,
        at: new Date().toISOString(),
      });
      void this.persistVoteEvent('vote.opened', identity?.deviceId, { vote });
    });
    this.onMessage('vote:close', (client) => {
      if (!this.isHostClient(client)) return;
      const identity = this.identities.get(client.sessionId);
      const vote = closeSessionVote(this.code);
      if (!vote) return;
      const resolved = resolveSessionVote(this.code);
      this.clearVoteTimer();
      this.broadcast('session:transition', {
        type: 'vote.resolved',
        vote: resolved?.vote ?? vote,
        result: resolved?.result ?? null,
        at: new Date().toISOString(),
      });
      void this.persistVoteEvent('vote.resolved', identity?.deviceId, { vote: resolved?.vote ?? vote, result: resolved?.result ?? null });
      if (resolved) this.maybeAutoApply(resolved);
    });
    this.onMessage('vote:cancel', (client) => {
      if (!this.isHostClient(client)) return;
      const identity = this.identities.get(client.sessionId);
      const vote = cancelSessionVote(this.code);
      if (!vote) return;
      this.clearVoteTimer();
      this.broadcast('session:transition', { type: 'vote.cancelled', vote, at: new Date().toISOString() });
      void this.persistVoteEvent('vote.cancelled', identity?.deviceId, { vote });
    });
    this.onMessage('vote:apply', (client) => {
      if (!this.isHostClient(client)) return;
      const identity = this.identities.get(client.sessionId);
      const applied = applySessionVote(this.code);
      if (!applied) return;
      archiveSessionVote(this.code);
      this.broadcast('session:transition', {
        type: 'vote.applied',
        vote: applied.vote,
        result: applied.result,
        at: new Date().toISOString(),
      });
      void this.persistVoteEvent('vote.applied', identity?.deviceId, { vote: applied.vote, result: applied.result });
      this.applyVoteSideEffects(applied.result);
    });
    this.onMessage('vote:override', (client, payload: { option?: string; reason?: string }) => {
      if (!this.isHostClient(client)) return;
      const identity = this.identities.get(client.sessionId);
      const option = String(payload?.option ?? '').trim().slice(0, 80);
      if (!option || !identity) return;
      const resolved = resolveSessionVote(this.code, {
        actorId: identity.deviceId,
        option,
        reason: payload?.reason ? String(payload.reason).slice(0, 160) : undefined,
      });
      if (!resolved) return;
      this.clearVoteTimer();
      this.broadcast('session:transition', {
        type: 'vote.resolved',
        vote: resolved.vote,
        result: resolved.result,
        at: new Date().toISOString(),
      });
      void this.persistVoteEvent('vote.resolved', identity.deviceId, { vote: resolved.vote, result: resolved.result, override: true });
      this.maybeAutoApply(resolved);
    });
    this.onMessage('vote:request', (client, payload: { type?: string; question?: string; options?: string[] }) => {
      const identity = this.identities.get(client.sessionId);
      const record = getSessionRecord(this.code);
      if (!identity || !record) return;
      if (!['controller', 'crowd'].includes(identity.role)) return;
      if (!record.session.settings.allowPlayerVotes) return;
      if (identity.role === 'crowd' && !record.session.settings.allowCrowdVotes) return;
      if (record.activeVote && ['open', 'locked'].includes(record.activeVote.vote.status)) return;
      const cooldown = record.session.settings.voteCooldownMs ?? 15_000;
      const now = Date.now();
      if (now - this.lastVoteRequestAt < cooldown) return;
      const options = (payload?.options ?? [])
        .map((option) => String(option ?? '').trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 8);
      if (options.length < 2) return;
      this.lastVoteRequestAt = now;
      const vote = openSessionVote(this.code, {
        type: payload?.type === 'game_selection' ? 'game_selection' : 'custom',
        question: String(payload?.question ?? 'A player called a vote.').trim().slice(0, 160),
        options,
        createdBy: identity.deviceId,
      });
      if (!vote) return;
      this.scheduleVoteResolution(vote.closesAt);
      this.broadcast('session:transition', { type: 'vote.opened', vote, at: new Date().toISOString() });
      void this.persistVoteEvent('vote.opened', identity.deviceId, { vote, requestedByPlayer: true });
    });
    this.onMessage('session:request_state', (client) => {
      const identity = this.identities.get(client.sessionId);
      client.send('session:state', getPublicSession(this.code));
      if (identity) this.sendGameState(client, identity);
    });
    this.onMessage('game:intent', (client, intent: Record<string, unknown>) => {
      const identity = this.identities.get(client.sessionId);
      if (!identity || !this.gameRuntime) return;
      const activeRun = getSessionRecord(this.code)?.activeRuntime?.run;
      if (activeRun?.status === 'paused' && intent?.type !== 'advance') {
        client.send('session:error', { code: 'game_paused', explanation: 'The game is paused while a player reconnects.' });
        return;
      }
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
      const publicState = this.gameRuntime.publicState() as { phase?: unknown; result?: GameRun['result'] };
      if (publicState?.phase === 'finished') {
        this.clearBotTimer();
        finishActiveGame(this.code, 'finished', this.gameRuntime.finish().winnerPlayerIds, publicState.result);
      }
      this.requestCommentary(publicState);
      if (publicState?.phase === 'reveal') {
        void generatePacingSuggestion({
          gameName: this.gameRuntime.gameType,
          publicState,
        }).then((line) => {
          if (line) this.broadcast('ai:result', { kind: 'pacing', text: line });
        });
      }
      this.scheduleBotTurn();
    });
    this.onMessage('ai:request_hint', (client) => {
      const identity = this.identities.get(client.sessionId);
      if (!identity || identity.role !== 'controller' || !this.gameRuntime) return;
      // Hints are earned — spend one from the budget, or tell the player to earn more.
      const budget = this.hintBudgets.get(identity.deviceId) ?? 0;
      if (budget <= 0) {
        client.send('ai:result', { kind: 'hint', text: 'No hints left — earn one by scoring or winning a round.' });
        return;
      }
      this.hintBudgets.set(identity.deviceId, budget - 1);
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
      // Refresh the controller's budget display.
      this.sendGameState(client, identity);
    });
    this.onMessage('ai:request_rules', (client) => {
      const identity = this.identities.get(client.sessionId);
      if (!identity || identity.role !== 'controller' || !this.gameRuntime) return;
      // Private to this device only — never broadcast.
      void generateRulesExplanation({
        gameName: this.gameRuntime.gameType,
        rules: this.gameRuntime.metadata.rules?.summary ?? `Have fun playing ${this.gameRuntime.gameType}!`,
      }).then((text) => {
        client.send('ai:result', { kind: 'rules', text });
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
      const vote = castSessionVote(this.code, identity.deviceId, option);
      if (!vote) return;
      this.broadcast('session:transition', { type: 'vote.cast', vote, at: new Date().toISOString() });
      void this.persistVoteEvent('vote.cast', identity.deviceId, { voteId: vote.id, option, tally: vote.tally });
      const resolved = resolveSessionVote(this.code);
      if (resolved?.result?.winnerOption) {
        this.clearVoteTimer();
        this.broadcast('session:transition', {
          type: 'vote.resolved',
          vote: resolved.vote,
          result: resolved.result,
          at: new Date().toISOString(),
        });
        void this.persistVoteEvent('vote.resolved', undefined, { vote: resolved.vote, result: resolved.result });
        this.maybeAutoApply(resolved);
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
      avatar: typeof options.avatar === 'string' ? options.avatar.slice(0, 8) : undefined,
      accentColor: typeof options.accentColor === 'string' ? options.accentColor.slice(0, 16) : undefined,
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
    if (snapshot?.activeRun && ['active', 'paused'].includes(snapshot.activeRun.status)) this.ensureRuntime(snapshot);
    this.sendGameState(client, identity);
    if (identity.role === 'controller') void this.maybeResumeAfterReconnect();
  }

  onLeave(client: Client): void {
    const identity = this.identities.get(client.sessionId);
    if (identity) {
      setSessionMemberConnected(this.code, identity.deviceId, false);
      this.persistMember(identity.deviceId);
      if (identity.role === 'controller') void this.pauseGame('controller_disconnected');
    }
    this.identities.delete(client.sessionId);
  }

  onDispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.clearBotTimer();
    this.clearPaceTimer();
    this.clearTriviaTimer();
    this.clearVoteTimer();
    this.gameRuntime?.dispose();
    this.gameRuntime = null;
  }

  private ensureRuntime(snapshot: NonNullable<ReturnType<typeof getPublicSession>>): void {
    if (!snapshot.activeRun || this.gameRuntime?.gameType === snapshot.activeRun.gameType) return;
    const activeManifest = getInstalledGameManifest(snapshot.activeRun.gameType);
    const players = snapshot.members
      .filter((member) =>
        member.role === 'controller'
        && member.ready
        && member.connected
        && (!member.isBot || activeManifest?.capabilities.bots === true),
      )
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
      this.scheduleBotTurn(250);
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
      paceDeadline: this.paceDeadline,
    });
    if (identity.role === 'controller') {
      if (!this.hintBudgets.has(identity.deviceId)) this.hintBudgets.set(identity.deviceId, 1);
      client.send('game:private_state', {
        gameType: this.gameRuntime.gameType,
        state: this.gameRuntime.privateState(identity.deviceId),
        hintBudget: this.hintBudgets.get(identity.deviceId) ?? 0,
      });
    }
  }

  // Award +1 hint to any player whose score rose since the last broadcast (generic across games).
  private awardHintsFromScores(): void {
    const players = (this.gameRuntime?.publicState() as { players?: Array<{ id: string; score?: number }> })?.players ?? [];
    for (const p of players) {
      const score = Number(p.score ?? 0);
      const prev = this.lastScores.get(p.id);
      if (prev !== undefined && score > prev) {
        this.hintBudgets.set(p.id, Math.min(HouseSessionRoom.HINT_CAP, (this.hintBudgets.get(p.id) ?? 1) + 1));
      }
      this.lastScores.set(p.id, score);
    }
  }

  private broadcastGameState(): void {
    if (!this.gameRuntime) return;
    this.awardHintsFromScores();
    // Establish/clear the authoritative deadline before projecting state so clients never
    // receive a stale deadline (the old ordering produced a visible 0s timer).
    this.schedulePaceTimer();
    this.scheduleTriviaDeadline();
    for (const client of this.clients) {
      const identity = this.identities.get(client.sessionId);
      if (identity) this.sendGameState(client, identity);
    }
  }

  // Fast-paced timer: with a configured pace, auto-advance a round/turn that drags. During
  // 'playing' it force-reveals after timerMs; during 'reveal' it moves on after revealCountdownMs.
  // Off when the host chose 'relaxed' (timerMs 0). Turn-based board games are left untouched.
  private schedulePaceTimer(): void {
    this.clearPaceTimer();
    const run = getSessionRecord(this.code)?.activeRuntime?.run;
    if (!this.gameRuntime || !run || run.status !== 'active') return;
    const state = this.gameRuntime.publicState() as { phase?: string };
    const timerMs = Math.max(0, Math.trunc(Number(run.settings?.timerMs ?? 0)));
    const revealMs = Math.max(0, Math.trunc(Number(run.settings?.revealCountdownMs ?? 5000)));
    let delay = 0;
    if (state.phase === 'playing' && timerMs > 0) delay = timerMs;
    else if (state.phase === 'reveal' && revealMs > 0) delay = revealMs;
    if (delay <= 0) return;
    this.paceDeadline = Date.now() + delay;
    this.paceTimer = setTimeout(() => {
      if (!this.gameRuntime) return;
      const current = this.gameRuntime.publicState() as { mode?: string; currentPlayerId?: string };
      if (current.mode === 'whot' && current.currentPlayerId) {
        const changed = this.gameRuntime.handleIntent(current.currentPlayerId, { type: 'timeout' }, true);
        if (changed) {
          this.broadcastGameState();
          this.scheduleBotTurn();
          return;
        }
      }
      // Force content-game rounds forward as a host 'advance' (reveal → next).
      const host = Array.from(this.identities.values()).find((i) => i.isOwner)?.deviceId ?? 'pace-timer';
      const changed = this.gameRuntime.handleIntent(host, { type: 'advance' }, true);
      if (changed) this.broadcastGameState();
      else this.schedulePaceTimer();
    }, delay).unref();
  }

  // Money Trivia owns its own deadlines (fastest-finger expiry, 4s auto-reveal, question timeout,
  // lifeline expiry). Schedule a single resolver at the runtime's earliest deadline; on fire,
  // resolve due deadlines and reschedule the next one. Cleared while the run is paused.
  private scheduleTriviaDeadline(): void {
    this.clearTriviaTimer();
    const run = getSessionRecord(this.code)?.activeRuntime?.run;
    if (!this.gameRuntime || this.gameRuntime.gameType !== 'trivia' || run?.status !== 'active') return;
    const rt = this.gameRuntime as unknown as { nextDeadline?: () => number | null; resolveDueDeadlines?: (now?: number) => boolean };
    if (typeof rt.nextDeadline !== 'function') return;
    const deadline = rt.nextDeadline();
    if (deadline == null) return;
    const delay = Math.max(0, deadline - Date.now());
    this.triviaTimer = setTimeout(() => {
      if (!this.gameRuntime || typeof rt.resolveDueDeadlines !== 'function') return;
      const changed = rt.resolveDueDeadlines(Date.now());
      if (changed) this.broadcastGameState();
      else this.scheduleTriviaDeadline();
    }, delay + 50).unref();
  }

  private clearTriviaTimer(): void {
    if (this.triviaTimer) clearTimeout(this.triviaTimer);
    this.triviaTimer = null;
  }

  private clearPaceTimer(): void {
    if (this.paceTimer) clearTimeout(this.paceTimer);
    this.paceTimer = null;
    this.paceDeadline = null;
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

  // Inject AI-generated, non-repeating content for content games. Server-authoritative: the AI
  // only proposes question/survey banks; the runtime still validates and falls back to its local
  // bank. Disabled when the party turns AI off or the game opts out (aiContent: false).
  private async withAiContent(
    gameId: string,
    sessionId: string,
    settings: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // Always pass the session's recently-used prompts so every content game's local bank avoids
    // repeats across the whole night — even with AI disabled.
    const avoid = recentPromptsFor(sessionId, gameId);
    let next: Record<string, unknown> = avoid.length ? { ...settings, avoidPrompts: avoid } : settings;

    if (settings.aiContent === false) return next;
    const count = Math.min(12, Math.max(3, Number(settings.questionCount ?? settings.rounds ?? 8)));
    try {
      const { questions, surveys, logos, events } = await generateGameContent({ gameId, count, avoid });
      if (questions.length === 0 && surveys.length === 0 && logos.length === 0 && events.length === 0) return next;
      rememberPrompts(sessionId, gameId, [
        ...questions.map((q) => q.prompt),
        ...surveys.map((s) => s.question),
        ...logos.map((l) => l.name),
        ...events.map((e) => e.event),
      ]);
      next = {
        ...next,
        ...(questions.length ? { aiQuestions: questions } : {}),
        ...(surveys.length ? { aiSurveys: surveys } : {}),
        ...(logos.length ? { aiLogos: logos } : {}),
        ...(events.length ? { aiEvents: events } : {}),
      };
      return next;
    } catch (error) {
      log('warn', 'ai_content_generation_failed', { session: this.code, gameId, error: String(error) });
      return next;
    }
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
    // Money Trivia is a cash game: inject ONLY pre-approved questions (never live AI), and block
    // setup if the chosen age band lacks enough approved content.
    if (gameId === 'trivia') {
      const ageBand = (['pre_teen', 'teen', 'adult'].includes(String(settings.ageBand))
        ? settings.ageBand : 'adult') as 'pre_teen' | 'teen' | 'adult';
      const categories = Array.isArray(settings.categories) ? settings.categories.map(String) : undefined;
      const content = selectRunContent({ ageBand, categories });
      if (!content.ok) {
        this.broadcast('session:error', { code: 'insufficient_approved_questions', detail: content.reason });
        return;
      }
      // Host-funded confirmation is required before a cash run starts.
      if (settings.hostFundedConfirmed !== true) {
        this.broadcast('session:error', { code: 'host_funding_confirmation_required' });
        return;
      }
      const run = buildGameRun({
        houseSessionId: record.session.id,
        gameType: gameId,
        gameVersion,
        settings: { ...settings, ageBand, questions: content.questions, fastestFingerQuestions: content.fastestFingerQuestions, aiContent: false },
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
      ]).catch((error) => log('warn', 'game_select_persist_failed', { session: this.code, error: String(error) }));
      if (startImmediately) await this.startGame();
      return;
    }
    // Generate fresh AI content for content games (with anti-repeat memory), merged ahead of the
    // local bank. Fails soft: any error leaves settings untouched and the local bank is used.
    const enrichedSettings = await this.withAiContent(gameId, record.session.id, settings);
    const run = buildGameRun({
      houseSessionId: record.session.id,
      gameType: gameId,
      gameVersion,
      settings: enrichedSettings,
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
    this.prepareBotSeats();
    // Fresh earned-hint budgets each game (everyone starts with one).
    this.hintBudgets.clear();
    this.lastScores.clear();
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

  private async pauseGame(reason: string): Promise<void> {
    this.clearBotTimer();
    this.clearPaceTimer();
    this.clearTriviaTimer();
    // Freeze trivia deadlines so paused time doesn't count against players.
    (this.gameRuntime as unknown as { pauseTimers?: (now?: number) => void })?.pauseTimers?.(Date.now());
    const runtime = pauseActiveGame(this.code, reason);
    if (!runtime) return;
    this.broadcast('session:state', getPublicSession(this.code));
    this.broadcastGameState();
    const record = getSessionRecord(this.code);
    await Promise.all([
      persistGameRun(runtime.run),
      record ? persistHouseSession(record.session) : Promise.resolve('skipped' as const),
      appendSessionEvent(buildSessionEvent({
        sessionId: runtime.run.houseSessionId,
        gameRunId: runtime.run.id,
        type: 'game_run.paused',
        payload: { reason },
      })),
    ]).catch((error) => {
      log('warn', 'game_pause_persist_failed', { session: this.code, error: String(error) });
    });
  }

  private async resumeGame(): Promise<void> {
    const runtime = resumeActiveGame(this.code);
    if (!runtime) return;
    // Shift trivia deadlines forward by the paused duration before rescheduling.
    (this.gameRuntime as unknown as { resumeTimers?: (now?: number) => void })?.resumeTimers?.(Date.now());
    this.broadcast('session:state', getPublicSession(this.code));
    this.broadcastGameState();
    const record = getSessionRecord(this.code);
    await Promise.all([
      persistGameRun(runtime.run),
      record ? persistHouseSession(record.session) : Promise.resolve('skipped' as const),
      appendSessionEvent(buildSessionEvent({
        sessionId: runtime.run.houseSessionId,
        gameRunId: runtime.run.id,
        type: 'game_run.resumed',
      })),
    ]).catch((error) => {
      log('warn', 'game_resume_persist_failed', { session: this.code, error: String(error) });
    });
    this.scheduleBotTurn(250);
  }

  private async maybeResumeAfterReconnect(): Promise<void> {
    const snapshot = getPublicSession(this.code);
    if (snapshot?.activeRun?.status !== 'paused') return;
    const seatedIds = new Set(
      (this.gameRuntime?.publicState() as { players?: Array<{ id: string }> } | null)?.players?.map((player) => player.id) ?? [],
    );
    if (seatedIds.size === 0) return;
    const disconnectedSeated = snapshot.members.some((member) =>
      seatedIds.has(member.deviceId) && member.role === 'controller' && !member.isBot && !member.connected,
    );
    if (!disconnectedSeated) await this.resumeGame();
  }

  private async switchGame(gameId: string, settings: Record<string, unknown>): Promise<void> {
    await this.endCurrentGame('abandoned');
    clearActiveGame(this.code);
    await this.selectGame(gameId, settings, true);
  }

  private async endCurrentGame(status: 'finished' | 'abandoned'): Promise<void> {
    if (this.gameRuntime) {
      this.clearBotTimer();
      const final = this.gameRuntime.finish();
      const result = (this.gameRuntime.publicState() as { result?: GameRun['result'] }).result;
      finishActiveGame(this.code, status, final.winnerPlayerIds, result);
    } else {
      finishActiveGame(this.code, status, []);
    }
    const record = getSessionRecord(this.code);
    const run = record?.activeRuntime?.run;
    if (!record || !run) return;
    const winnerNames = (run.winnerPlayerIds ?? [])
      .map((id) => record.members.get(id)?.displayName)
      .filter((name): name is string => Boolean(name));
    // Surface notable house votes so the recap can mention them (spec: recaps mention major votes).
    const majorVotes = (record.voteHistory ?? [])
      .filter((vote) => vote.winnerOption && ['game_selection', 'end_game', 'end_party', 'skip_round'].includes(vote.voteType))
      .slice(0, 3)
      .map((vote) => ({ type: vote.voteType, winner: vote.winnerOption, overridden: Boolean(vote.hostOverride) }));
    void generateRecap({
      gameName: run.gameType,
      winnerNames,
      signals: { ...(this.gameRuntime?.recapSignals?.() ?? {}), majorVotes },
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

  // At game start, honour the host's explicit lobby bot roster. If the game can't use bots, drop
  // them; otherwise auto-fill up to the game's minimum and trim any bots over the maximum.
  private prepareBotSeats(): void {
    const record = getSessionRecord(this.code);
    const run = record?.activeRuntime?.run;
    if (!record || !run) return;
    const manifest = getInstalledGameManifest(run.gameType);
    if (!record.session.settings.allowBots || !manifest?.capabilities.bots) {
      removeSessionBotMembers(this.code);
      return;
    }
    const humans = Array.from(record.members.values())
      .filter((m) => m.role === 'controller' && !m.isBot && m.ready && m.connected);
    let bots = Array.from(record.members.values()).filter((m) => m.role === 'controller' && m.isBot);

    // Trim bots that push the table over the game's max.
    while (humans.length + bots.length > manifest.maxPlayers && bots.length > 0) {
      const drop = bots.pop()!;
      removeSessionBot(this.code, drop.deviceId);
    }
    // Auto-fill up to the game's minimum so a solo host can still start.
    const explicit = Math.max(0, Math.trunc(Number(run.settings?.botCount ?? run.settings?.bots ?? 0)));
    const needed = Math.max(manifest.minPlayers - (humans.length + bots.length), explicit - bots.length);
    for (let i = 0; i < needed && humans.length + bots.length < manifest.maxPlayers; i += 1) {
      const added = addSessionBot(this.code);
      if (added) bots = [...bots, added];
    }
  }

  private clearBotTimer(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
  }

  private scheduleVoteResolution(closesAt: string | undefined): void {
    this.clearVoteTimer();
    if (!closesAt) return;
    const delay = Math.max(0, Date.parse(closesAt) - Date.now());
    this.voteTimer = setTimeout(() => {
      const resolved = resolveSessionVote(this.code);
      if (!resolved) return;
      this.broadcast('session:transition', {
        type: resolved.vote.status === 'expired' ? 'vote.expired' : 'vote.resolved',
        vote: resolved.vote,
        result: resolved.result,
        at: new Date().toISOString(),
      });
      void this.persistVoteEvent(resolved.vote.status === 'expired' ? 'vote.expired' : 'vote.resolved', undefined, {
        vote: resolved.vote,
        result: resolved.result,
      });
      this.maybeAutoApply(resolved);
    }, delay).unref();
  }

  // Auto-apply a resolved vote when the vote's settings opted in and an outright winner exists.
  // The applied event archives the vote; companions can still manually apply when autoApply is off.
  private maybeAutoApply(resolved: { vote: { settings: { autoApply: boolean }; status: string }; result: { winnerOption: string | null } | null }): void {
    if (!resolved.result?.winnerOption) return;
    if (resolved.vote.status !== 'resolved') return;
    if (!resolved.vote.settings.autoApply) return;
    const applied = applySessionVote(this.code);
    if (!applied) return;
    archiveSessionVote(this.code);
    this.broadcast('session:transition', {
      type: 'vote.applied',
      vote: applied.vote,
      result: applied.result,
      at: new Date().toISOString(),
    });
    void this.persistVoteEvent('vote.applied', undefined, { vote: applied.vote, result: applied.result, autoApplied: true });
    this.applyVoteSideEffects(applied.result);
  }

  // Remove a player, notify them, force their socket out, and pause the game if they were seated.
  private kickPlayer(deviceId: string, reason?: string, byDeviceId?: string): void {
    if (!deviceId) return;
    const { removed, wasSeated } = kickSessionMember(this.code, deviceId);
    if (!removed) return;
    // Notify and disconnect any connected client for this device.
    for (const client of this.clients) {
      const identity = this.identities.get(client.sessionId);
      if (identity?.deviceId === deviceId) {
        client.send('session:kicked', { reason: reason ?? 'Removed by host.' });
        this.identities.delete(client.sessionId);
        setTimeout(() => client.leave(4000), 50);
      }
    }
    if (wasSeated && this.gameRuntime) void this.pauseGame('player_kicked');
    this.broadcast('session:state', getPublicSession(this.code));
    this.broadcast('session:transition', { type: 'member.kicked', deviceId, at: new Date().toISOString() });
    void this.persistVoteEvent('member.kicked', byDeviceId, { deviceId, reason: reason ?? null, wasSeated });
  }

  // Enact the real-world action behind an applied vote. game_selection starts the winning
  // installed game; binary action votes (end_party, end_game, pause/resume) fire when the
  // winning option is affirmative. Other vote types are applied for the audit trail only.
  private applyVoteSideEffects(result: { voteType: string; winnerOption: string | null } | null): void {
    if (!result?.winnerOption) return;
    if (result.voteType === 'game_selection') {
      if (getSessionRecord(this.code)?.activeRuntime) return;
      const gameId = findInstalledGameId(result.winnerOption);
      if (gameId) void this.selectGame(gameId, {}, false);
      return;
    }
    // kick_player carries the target player as the winning option (not a yes/no).
    if (result.voteType === 'kick_player') {
      const deviceId = resolveMemberByOption(this.code, result.winnerOption);
      if (deviceId) this.kickPlayer(deviceId, 'Voted out by the house.');
      return;
    }
    // admit_player carries the pending player as the winning option.
    if (result.voteType === 'admit_player') {
      const deviceId = resolveMemberByOption(this.code, result.winnerOption);
      if (deviceId && admitSessionMember(this.code, deviceId)) {
        this.broadcast('session:state', getPublicSession(this.code));
        this.broadcast('session:transition', { type: 'member.admitted', deviceId, at: new Date().toISOString() });
      }
      return;
    }
    // remote_mode carries an enable/disable choice.
    if (result.voteType === 'remote_mode') {
      const enabled = /enable|on|yes|allow/i.test(result.winnerOption);
      if (setRemoteMode(this.code, enabled)) this.broadcast('session:state', getPublicSession(this.code));
      return;
    }
    if (!isAffirmative(result.winnerOption)) return;
    switch (result.voteType) {
      case 'end_party': {
        this.clearVoteTimer();
        this.clearBotTimer();
        const snapshot = endSession(this.code);
        if (snapshot) {
          this.broadcast('session:transition', { type: 'party.ended', at: new Date().toISOString() });
          this.broadcast('session:state', snapshot);
          void this.persistVoteEvent('party.ended', undefined, { byVote: true });
        }
        break;
      }
      case 'end_game':
        void this.endCurrentGame('finished');
        break;
      case 'pause_game':
        void this.pauseGame('vote_pause');
        break;
      case 'resume_game':
        void this.resumeGame();
        break;
      default:
        break;
    }
  }

  private clearVoteTimer(): void {
    if (this.voteTimer) clearTimeout(this.voteTimer);
    this.voteTimer = null;
  }

  private async persistVoteEvent(type: string, actorId: string | undefined, payload: Record<string, unknown>): Promise<void> {
    const record = getSessionRecord(this.code);
    if (!record) return;
    await appendSessionEvent(buildSessionEvent({
      sessionId: record.session.id,
      gameRunId: record.activeRuntime?.run.id,
      type,
      actorId,
      payload,
    })).catch((error) => log('warn', 'vote_persist_failed', { session: this.code, type, error: String(error) }));
  }

  private requestCommentary(publicState: unknown): void {
    if (!this.gameRuntime) return;
    // Throttle: commenting on every single move floods the AI and the lines land late and
    // out of context. One line every ~9s, and never two generations in flight at once.
    const now = Date.now();
    const phase = (publicState as { phase?: unknown })?.phase;
    const isKeyMoment = phase === 'reveal' || phase === 'round_end' || phase === 'finished';
    if (this.commentaryInFlight) return;
    if (!isKeyMoment && now - this.lastCommentaryAt < COMMENTARY_COOLDOWN_MS) return;
    this.commentaryInFlight = true;
    this.lastCommentaryAt = now;
    const serial = ++this.commentarySerial;
    const gameName = this.gameRuntime.gameType;
    void generateCommentary({ gameName, publicState })
      .then((line) => {
        if (line && serial === this.commentarySerial && this.gameRuntime?.gameType === gameName) {
          this.broadcast('ai:result', { kind: 'commentary', text: line });
        }
      })
      .finally(() => { this.commentaryInFlight = false; });
  }

  private scheduleBotTurn(delayMs = 700): void {
    this.clearBotTimer();
    const record = getSessionRecord(this.code);
    if (!this.gameRuntime || record?.activeRuntime?.run.status !== 'active') return;
    const publicState = this.gameRuntime.publicState() as { phase?: unknown };
    if (publicState?.phase === 'finished') return;
    const botMembers = Array.from(record.members.values())
      .filter((member) => member.role === 'controller' && member.isBot && member.ready && member.connected);
    if (botMembers.length === 0) return;
    const hasBotMove = botMembers.some((member) => (this.gameRuntime?.legalIntents?.(member.deviceId) ?? []).length > 0);
    if (!hasBotMove) return;
    this.botTimer = setTimeout(() => void this.runBotTurn(), delayMs);
  }

  private async runBotTurn(): Promise<void> {
    this.botTimer = null;
    const record = getSessionRecord(this.code);
    if (!record || !this.gameRuntime || record.activeRuntime?.run.status !== 'active') return;
    const botMembers = Array.from(record.members.values())
      .filter((member) => member.role === 'controller' && member.isBot && member.ready && member.connected);
    for (const member of botMembers) {
      const legalIntents = this.gameRuntime.legalIntents?.(member.deviceId) ?? [];
      if (legalIntents.length === 0) continue;
      const publicState = this.gameRuntime.publicState();
      const privateState = this.gameRuntime.privateState(member.deviceId);
      const selected = this.gameRuntime.rankBotIntent?.(member.deviceId, legalIntents, publicState, privateState)
        ?? chooseDeterministicBotIntent({
          gameType: this.gameRuntime.gameType,
          botPlayerId: member.deviceId,
          legalIntents,
          publicState,
          privateState,
          turnNumber: this.botTurnNumber,
        });
      if (!selected) continue;
      this.botTurnNumber += 1;
      const changed = this.gameRuntime.handleIntent(member.deviceId, selected, false);
      if (!changed) continue;
      this.broadcastGameState();
      const runtimeSnapshot = this.gameRuntime.snapshot();
      storeRuntimeSnapshot(this.code, runtimeSnapshot);
      const runId = record.activeRuntime?.run.id;
      if (runId) {
        void persistRuntimeSnapshot({ gameRunId: runId, reason: 'bot_turn', state: runtimeSnapshot })
          .catch((error) => log('warn', 'runtime_snapshot_persist_failed', { session: this.code, error: String(error) }));
      }
      const nextPublic = this.gameRuntime.publicState() as { phase?: unknown };
      this.requestCommentary(nextPublic);
      if (nextPublic?.phase === 'finished') {
        this.clearBotTimer();
        finishActiveGame(this.code, 'finished', this.gameRuntime.finish().winnerPlayerIds);
        return;
      }
      break;
    }
    this.scheduleBotTurn();
  }
}
