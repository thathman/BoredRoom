import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { clearContentMemory } from './aiContentMemory.js';
import type { GameRun, HouseSession, HouseVote, HouseVoteResult, HouseVoteSettings, HouseVoteType } from '../../shared/src/contracts/session.js';
import {
  applyVote,
  cancelVote,
  castVote,
  closeVote,
  createVote,
  resolveVote,
  type VoteRound,
} from '../../shared/src/votes/engine.js';

export type SessionRole = 'display' | 'controller' | 'crowd' | 'companion';

export interface SessionMember {
  deviceId: string;
  displayName: string;
  role: SessionRole;
  isBot?: boolean;
  pending?: boolean; // awaiting host admission (requireAdmission mode)
  avatar?: string; // emoji glyph or empty for initial
  accentColor?: string; // hex
  ready: boolean;
  connected: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

export interface SessionRuntime {
  run: GameRun;
  selectedAt: string;
  snapshot?: unknown;
}

export interface SessionRecord {
  session: HouseSession;
  ownerCredentialHash: string;
  companionCredentialHashes: Set<string>;
  members: Map<string, SessionMember>;
  activeRuntime: SessionRuntime | null;
  activeVote: VoteRound | null;
  voteHistory: HouseVoteResult[];
  lastRecap?: {
    gameType: string;
    status: 'finished' | 'abandoned';
    winnerPlayerIds: string[];
    endedAt: string;
    headline?: string;
    paragraph?: string;
  };
}

interface PairingRequest {
  code: string;
  pairingCode: string;
  expiresAt: number;
  approved: boolean;
}

export interface PublicSessionSnapshot {
  session: HouseSession;
  members: SessionMember[];
  activeRun: GameRun | null;
  activeVote: HouseVote | null;
  voteHistory: HouseVoteResult[];
  lastRecap?: SessionRecord['lastRecap'];
}

type Listener = (snapshot: PublicSessionSnapshot, event?: string) => void;

const sessions = new Map<string, SessionRecord>();
const listeners = new Map<string, Set<Listener>>();
const pairings = new Map<string, PairingRequest>();

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function hashCredential(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// Settings keys that carry runtime-private content (questions + answer indexes, AI banks,
// surveys, dictionaries, anti-repeat memory). These must NEVER reach a client via session:state —
// the public projection strips them so no answer can leak from GameRun.settings.
const PRIVATE_SETTINGS_KEYS = new Set([
  'questions', 'aiQuestions', 'surveys', 'aiSurveys', 'logos', 'aiLogos',
  'events', 'aiEvents', 'dictionaryWords', 'avoidPrompts',
]);

// Strip private settings from a GameRun before it leaves the server. Settlement/result is kept
// (it carries no answers); only content-bearing keys are removed.
export function publicGameRun(run: GameRun): GameRun {
  const cloned = structuredClone(run);
  if (cloned.settings && typeof cloned.settings === 'object') {
    for (const key of Object.keys(cloned.settings)) {
      if (PRIVATE_SETTINGS_KEYS.has(key)) delete (cloned.settings as Record<string, unknown>)[key];
    }
  }
  return cloned;
}

function publicSnapshot(record: SessionRecord): PublicSessionSnapshot {
  const activeRun = record.activeRuntime
    ? publicGameRun(record.activeRuntime.run)
    : null;
  return {
    session: structuredClone(record.session),
    members: Array.from(record.members.values()).map((member) => ({ ...member })),
    activeRun,
    activeVote: record.activeVote ? structuredClone(record.activeVote.vote) : null,
    voteHistory: record.voteHistory.map((result) => structuredClone(result)),
    lastRecap: record.lastRecap ? { ...record.lastRecap } : undefined,
  };
}

function emit(code: string, event?: string): void {
  const key = normalizeCode(code);
  const record = sessions.get(key);
  if (!record) return;
  const snapshot = publicSnapshot(record);
  for (const listener of listeners.get(key) ?? []) listener(snapshot, event);
}

export function issueOwnerCredential(): string {
  return randomBytes(32).toString('base64url');
}

export function createCompanionPairing(code: string): { pairingCode: string; expiresAt: string } {
  const key = normalizeCode(code);
  const pairingCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 5 * 60 * 1000;
  pairings.set(`${key}:${pairingCode}`, { code: key, pairingCode, expiresAt, approved: true });
  return { pairingCode, expiresAt: new Date(expiresAt).toISOString() };
}

export function redeemCompanionPairing(
  code: string,
  pairingCode: string,
): { companionCredential: string } | null {
  const key = `${normalizeCode(code)}:${pairingCode}`;
  const pairing = pairings.get(key);
  if (!pairing || !pairing.approved || pairing.expiresAt <= Date.now()) return null;
  pairings.delete(key);
  const companionCredential = issueOwnerCredential();
  const record = getSessionRecord(code);
  record?.companionCredentialHashes.add(hashCredential(companionCredential));
  return { companionCredential };
}

export function getSessionCredentialHashes(code: string): {
  ownerCredentialHash: string;
  companionCredentialHashes: string[];
} | null {
  const record = getSessionRecord(code);
  return record
    ? {
        ownerCredentialHash: record.ownerCredentialHash,
        companionCredentialHashes: Array.from(record.companionCredentialHashes),
      }
    : null;
}

export function registerSession(session: HouseSession, ownerCredential: string): SessionRecord {
  const key = normalizeCode(session.code);
  const record: SessionRecord = {
    session,
    ownerCredentialHash: hashCredential(ownerCredential),
    companionCredentialHashes: new Set(),
    members: new Map(),
    activeRuntime: null,
    activeVote: null,
    voteHistory: [],
  };
  sessions.set(key, record);
  emit(key, 'session.created');
  return record;
}

export function hydrateSession(
  session: HouseSession,
  credentials?: { ownerCredentialHash?: string; companionCredentialHashes?: string[] },
): SessionRecord {
  const key = normalizeCode(session.code);
  const existing = sessions.get(key);
  if (existing) return existing;
  const record: SessionRecord = {
    session,
    ownerCredentialHash: credentials?.ownerCredentialHash ?? '',
    companionCredentialHashes: new Set(credentials?.companionCredentialHashes ?? []),
    members: new Map(),
    activeRuntime: null,
    activeVote: null,
    voteHistory: [],
  };
  sessions.set(key, record);
  return record;
}

export function hydrateSessionMember(code: string, member: SessionMember): void {
  const record = getSessionRecord(code);
  if (!record || record.members.has(member.deviceId)) return;
  record.members.set(member.deviceId, { ...member, connected: false });
}

export function hydrateActiveRun(code: string, run: GameRun, snapshot?: unknown): void {
  const record = getSessionRecord(code);
  if (!record || record.activeRuntime?.run.id === run.id) return;
  record.activeRuntime = {
    run,
    selectedAt: run.startedAt ?? new Date().toISOString(),
    snapshot: snapshot === undefined ? undefined : structuredClone(snapshot),
  };
  if (run.status === 'finished' || run.status === 'abandoned') {
    record.lastRecap = {
      gameType: run.gameType,
      status: run.status,
      winnerPlayerIds: run.winnerPlayerIds ?? [],
      endedAt: run.endedAt ?? new Date().toISOString(),
    };
  }
}

export function getSessionRecord(code: string): SessionRecord | null {
  return sessions.get(normalizeCode(code)) ?? null;
}

export function getPublicSession(code: string): PublicSessionSnapshot | null {
  const record = getSessionRecord(code);
  return record ? publicSnapshot(record) : null;
}

export interface SessionSummary {
  code: string;
  status: string;
  members: number;
  connected: number;
  bots: number;
  activeGame: string | null;
  gameStatus: string | null;
  activeVote: string | null;
  recentVotes: number;
  createdAt: string;
  updatedAt: string;
}

// Back-office listing of every live house in this server process. No secrets — codes and
// counts only, never credentials or private runtime state.
export function listSessionSummaries(): SessionSummary[] {
  return Array.from(sessions.values())
    .map((record) => {
      const members = Array.from(record.members.values());
      return {
        code: record.session.code,
        status: record.session.status,
        members: members.length,
        connected: members.filter((m) => m.connected).length,
        bots: members.filter((m) => m.isBot).length,
        activeGame: record.activeRuntime?.run.gameType ?? null,
        gameStatus: record.activeRuntime?.run.status ?? null,
        activeVote: record.activeVote ? record.activeVote.vote.status : null,
        recentVotes: record.voteHistory.length,
        createdAt: record.session.createdAt,
        updatedAt: record.session.updatedAt,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// Aggregate recent resolved votes across all houses for the admin vote-history view.
export function listRecentVotesAcrossSessions(limit = 25): Array<HouseVoteResult & { sessionCode: string }> {
  const all: Array<HouseVoteResult & { sessionCode: string }> = [];
  for (const record of sessions.values()) {
    for (const result of record.voteHistory) {
      all.push({ ...structuredClone(result), sessionCode: record.session.code });
    }
  }
  return all
    .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''))
    .slice(0, limit);
}

export function verifyOwnerCredential(code: string, credential: string | undefined): boolean {
  if (!credential) return false;
  const record = getSessionRecord(code);
  if (!record?.ownerCredentialHash) return false;
  const expected = Buffer.from(record.ownerCredentialHash, 'hex');
  const actual = Buffer.from(hashCredential(credential), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyControlCredential(code: string, credential: string | undefined): boolean {
  if (verifyOwnerCredential(code, credential)) return true;
  if (!credential) return false;
  const record = getSessionRecord(code);
  return record?.companionCredentialHashes.has(hashCredential(credential)) ?? false;
}

export function subscribeToSession(code: string, listener: Listener): () => void {
  const key = normalizeCode(code);
  const set = listeners.get(key) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

// Disambiguate a display name against everyone else in the house: if `desired` is already taken
// by a different device, append " 2", " 3"… so no two members share a name (humans or bots).
export function uniqueDisplayName(record: SessionRecord, desired: string, deviceId: string): string {
  const base = (desired || 'Player').trim();
  const taken = new Set(
    Array.from(record.members.values())
      .filter((m) => m.deviceId !== deviceId)
      .map((m) => m.displayName.toLowerCase()),
  );
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Math.floor(Math.random() * 1000)}`;
}

export function upsertSessionMember(
  code: string,
  input: Pick<SessionMember, 'deviceId' | 'displayName' | 'role'> & Partial<Pick<SessionMember, 'isBot' | 'ready' | 'connected' | 'avatar' | 'accentColor' | 'pending'>>,
): SessionMember | null {
  const record = getSessionRecord(code);
  if (!record) return null;
  const now = new Date().toISOString();
  const previous = record.members.get(input.deviceId);
  // New human controllers start pending when the party requires admission; reconnecting members
  // and bots keep their prior status.
  const pending = previous
    ? previous.pending
    : (input.pending ?? (record.session.settings.requireAdmission && input.role === 'controller' && !input.isBot));
  // Keep a reconnecting member's existing name; otherwise dedupe against the house.
  const rawName = input.displayName || previous?.displayName || 'Player';
  const displayName = previous ? rawName : uniqueDisplayName(record, rawName, input.deviceId);
  const member: SessionMember = {
    deviceId: input.deviceId,
    displayName,
    role: input.role,
    isBot: input.isBot ?? previous?.isBot,
    pending,
    avatar: input.avatar ?? previous?.avatar,
    accentColor: input.accentColor ?? previous?.accentColor,
    ready: input.ready ?? previous?.ready ?? (input.role !== 'crowd' && !pending),
    connected: input.connected ?? true,
    joinedAt: previous?.joinedAt ?? now,
    lastSeenAt: now,
  };
  record.members.set(input.deviceId, member);
  emit(code, previous ? 'member.reconnected' : 'member.joined');
  return member;
}

// Approve a pending player so they can ready up, vote and be seated.
export function admitSessionMember(code: string, deviceId: string): boolean {
  const record = getSessionRecord(code);
  const member = record?.members.get(deviceId);
  if (!record || !member || !member.pending) return false;
  member.pending = false;
  record.session.updatedAt = new Date().toISOString();
  emit(code, 'member.admitted');
  return true;
}

export function setSessionMemberConnected(code: string, deviceId: string, connected: boolean): void {
  const record = getSessionRecord(code);
  const member = record?.members.get(deviceId);
  if (!record || !member) return;
  if (member.isBot) return;
  record.members.set(deviceId, {
    ...member,
    connected,
    lastSeenAt: new Date().toISOString(),
  });
  emit(code, connected ? 'member.reconnected' : 'member.disconnected');
}

export function setSessionMemberReady(code: string, deviceId: string, ready: boolean): void {
  const record = getSessionRecord(code);
  const member = record?.members.get(deviceId);
  if (!record || !member) return;
  record.members.set(deviceId, { ...member, ready, lastSeenAt: new Date().toISOString() });
  emit(code, 'member.ready_changed');
}

function eligibleVoteMembers(record: SessionRecord, allowCrowdVotes: boolean): string[] {
  return Array.from(record.members.values())
    .filter((member) =>
      member.connected
      && !member.isBot
      && !member.pending
      && (member.role === 'controller' || (allowCrowdVotes && member.role === 'crowd')),
    )
    .map((member) => member.deviceId);
}

export function openSessionVote(
  code: string,
  input: {
    type?: HouseVoteType;
    question: string;
    options: string[];
    createdBy?: string;
    settings?: Partial<HouseVoteSettings>;
  },
): HouseVote | null {
  const record = getSessionRecord(code);
  if (!record) return null;
  const settings = {
    allowCrowdVotes: record.session.settings.allowCrowdVotes,
    ...(input.settings ?? {}),
  };
  const eligibleVoterIds = eligibleVoteMembers(record, settings.allowCrowdVotes ?? false);
  if (eligibleVoterIds.length === 0) return null;
  const now = Date.now();
  const round = createVote({
    id: `vote_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    sessionId: record.session.id,
    type: input.type ?? 'custom',
    question: input.question,
    options: input.options,
    eligibleVoterIds,
    createdBy: input.createdBy,
    settings,
    now,
  });
  record.activeVote = round;
  record.session.status = record.session.status === 'in_game' ? record.session.status : 'selecting_game';
  record.session.updatedAt = new Date(now).toISOString();
  emit(code, 'vote.opened');
  return structuredClone(round.vote);
}

export function castSessionVote(code: string, voterId: string, option: string): HouseVote | null {
  const record = getSessionRecord(code);
  if (!record?.activeVote) return null;
  const next = castVote(record.activeVote, voterId, option, Date.now());
  if (next === record.activeVote) return null;
  record.activeVote = next;
  record.session.updatedAt = new Date().toISOString();
  emit(code, 'vote.cast');
  return structuredClone(next.vote);
}

export function closeSessionVote(code: string): HouseVote | null {
  const record = getSessionRecord(code);
  if (!record?.activeVote) return null;
  const next = closeVote(record.activeVote, Date.now());
  record.activeVote = next;
  record.session.updatedAt = new Date().toISOString();
  emit(code, 'vote.locked');
  return structuredClone(next.vote);
}

export function cancelSessionVote(code: string): HouseVote | null {
  const record = getSessionRecord(code);
  if (!record?.activeVote) return null;
  const next = cancelVote(record.activeVote, Date.now());
  record.activeVote = next;
  record.session.updatedAt = new Date().toISOString();
  emit(code, 'vote.cancelled');
  return structuredClone(next.vote);
}

export function resolveSessionVote(
  code: string,
  override?: { actorId: string; option: string; reason?: string },
): { vote: HouseVote; result: HouseVoteResult | null } | null {
  const record = getSessionRecord(code);
  if (!record?.activeVote) return null;
  const next = resolveVote(record.activeVote, Date.now(), override);
  record.activeVote = next;
  if (next.vote.result && !record.voteHistory.some((result) => result.voteId === next.vote.result?.voteId)) {
    record.voteHistory.unshift(structuredClone(next.vote.result));
    record.voteHistory = record.voteHistory.slice(0, 25);
  }
  record.session.updatedAt = new Date().toISOString();
  emit(code, next.vote.status === 'expired' ? 'vote.expired' : 'vote.resolved');
  return { vote: structuredClone(next.vote), result: next.vote.result ? structuredClone(next.vote.result) : null };
}

export function applySessionVote(code: string): { vote: HouseVote; result: HouseVoteResult | null } | null {
  const record = getSessionRecord(code);
  if (!record?.activeVote) return null;
  const next = applyVote(record.activeVote, Date.now());
  record.activeVote = next;
  if (next.vote.result) {
    record.voteHistory = record.voteHistory.filter((result) => result.voteId !== next.vote.result?.voteId);
    record.voteHistory.unshift(structuredClone(next.vote.result));
  }
  record.session.updatedAt = new Date().toISOString();
  emit(code, 'vote.applied');
  return { vote: structuredClone(next.vote), result: next.vote.result ? structuredClone(next.vote.result) : null };
}

export function archiveSessionVote(code: string): void {
  const record = getSessionRecord(code);
  if (!record?.activeVote) return;
  record.activeVote = null;
  record.session.updatedAt = new Date().toISOString();
  emit(code, 'vote.archived');
}

// Remove a player from the house. Returns whether the kicked player was seated in the active
// game (so the room can pause and let the runtime handle the empty seat).
export function kickSessionMember(code: string, deviceId: string): { removed: boolean; wasSeated: boolean } {
  const record = getSessionRecord(code);
  const member = record?.members.get(deviceId);
  if (!record || !member || member.isBot) return { removed: false, wasSeated: false };
  const wasSeated = Boolean(
    record.activeRuntime
    && ['active', 'paused', 'setup'].includes(record.activeRuntime.run.status)
    && member.role === 'controller',
  );
  record.members.delete(deviceId);
  record.session.updatedAt = new Date().toISOString();
  emit(code, 'member.kicked');
  return { removed: true, wasSeated };
}

// Toggle remote/outsider mode. Does not create a second room — the same code stays authoritative.
export function setRemoteMode(code: string, enabled: boolean): boolean {
  const record = getSessionRecord(code);
  if (!record) return false;
  record.session.settings = { ...record.session.settings, allowRemote: enabled };
  record.session.updatedAt = new Date().toISOString();
  emit(code, 'remote.changed');
  return true;
}

// Resolve a vote option (deviceId or display name) to a member deviceId for vote-driven kicks.
export function resolveMemberByOption(code: string, option: string): string | null {
  const record = getSessionRecord(code);
  if (!record) return null;
  const needle = option.trim().toLowerCase();
  for (const member of record.members.values()) {
    if (member.isBot) continue;
    if (member.deviceId.toLowerCase() === needle || member.displayName.trim().toLowerCase() === needle) {
      return member.deviceId;
    }
  }
  return null;
}

export function removeSessionBotMembers(code: string): void {
  const record = getSessionRecord(code);
  if (!record) return;
  let removed = false;
  for (const [deviceId, member] of record.members.entries()) {
    if (member.isBot) {
      record.members.delete(deviceId);
      removed = true;
    }
  }
  if (removed) emit(code, 'bot.removed');
}

// Nigerian first names for bots — distinct, friendly, and deduped against the house.
const BOT_NAMES = ['Chidi', 'Amaka', 'Tunde', 'Ngozi', 'Emeka', 'Bisi', 'Yusuf', 'Zainab', 'Obi', 'Funke', 'Sade', 'Kelechi'];

// Add a single bot to the lobby immediately (host-driven), with a unique name. Returns the new
// bot member, or null if the house already has its max controllers.
export function addSessionBot(code: string): SessionMember | null {
  const record = getSessionRecord(code);
  if (!record) return null;
  const controllers = Array.from(record.members.values()).filter((m) => m.role === 'controller');
  if (controllers.length >= record.session.settings.maxControllers) return null;
  const deviceId = `bot:lobby:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const desired = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const name = uniqueDisplayName(record, desired, deviceId);
  return upsertSessionMember(code, { deviceId, displayName: name, role: 'controller', isBot: true, ready: true, connected: true });
}

// Remove one specific bot by deviceId (host-driven). Returns whether it was removed.
export function removeSessionBot(code: string, deviceId: string): boolean {
  const record = getSessionRecord(code);
  const member = record?.members.get(deviceId);
  if (!record || !member?.isBot) return false;
  record.members.delete(deviceId);
  emit(code, 'bot.removed');
  return true;
}

export function selectSessionGame(code: string, run: GameRun): void {
  const record = getSessionRecord(code);
  if (!record) return;
  const now = new Date().toISOString();
  record.activeRuntime = { run, selectedAt: now };
  record.session.currentGameRunId = run.id;
  record.session.status = 'configuring_game';
  record.session.currentStage = 'game_setup';
  record.session.updatedAt = now;
  emit(code, 'game.selected');
}

export function startSelectedGame(code: string): SessionRuntime | null {
  const record = getSessionRecord(code);
  if (!record?.activeRuntime) return null;
  const now = new Date().toISOString();
  record.activeRuntime.run.status = 'active';
  record.activeRuntime.run.startedAt = now;
  record.session.status = 'in_game';
  record.session.currentStage = 'game';
  record.session.updatedAt = now;
  emit(code, 'game.started');
  return record.activeRuntime;
}

export function finishActiveGame(
  code: string,
  status: 'finished' | 'abandoned',
  winnerPlayerIds: string[] = [],
  result?: GameRun['result'],
): SessionRuntime | null {
  const record = getSessionRecord(code);
  if (!record?.activeRuntime) return null;
  const previousStatus = record.activeRuntime.run.status;
  const now = new Date().toISOString();
  record.activeRuntime.run.status = status;
  record.activeRuntime.run.endedAt = now;
  record.activeRuntime.run.winnerPlayerIds = winnerPlayerIds;
  if (result) record.activeRuntime.run.result = result;
  if (status === 'finished' && previousStatus !== 'finished') {
    const winnerSet = new Set(winnerPlayerIds);
    const participatingPlayers = Array.from(record.members.values())
      .filter((member) => member.role === 'controller' && !member.pending);
    const standings = new Map(record.session.standings.map((standing) => [standing.playerId, { ...standing }]));
    for (const member of participatingPlayers) {
      const standing = standings.get(member.deviceId) ?? {
        playerId: member.deviceId,
        displayName: member.displayName,
        gameWins: 0,
        gamesPlayed: 0,
      };
      standing.displayName = member.displayName;
      standing.gamesPlayed += 1;
      if (winnerSet.has(member.deviceId)) standing.gameWins += 1;
      standings.set(member.deviceId, standing);
    }
    record.session.standings = Array.from(standings.values()).sort((a, b) =>
      b.gameWins - a.gameWins || b.gamesPlayed - a.gamesPlayed || a.displayName.localeCompare(b.displayName),
    );
    record.session.completedGameCount += 1;
  }
  record.lastRecap = {
    gameType: record.activeRuntime.run.gameType,
    status,
    winnerPlayerIds,
    endedAt: now,
  };
  record.session.status = 'game_recap';
  record.session.currentStage = 'recap';
  record.session.updatedAt = now;
  emit(code, status === 'finished' ? 'game.finished' : 'game.abandoned');
  return record.activeRuntime;
}

// Owner/host marks a Money Trivia payout settled after recap. Pure bookkeeping — no money moves.
export function markGameRunPayout(code: string, settlementStatus: 'paid' | 'waived' | 'unsettled'): GameRun['result'] | null {
  const record = getSessionRecord(code);
  const result = record?.activeRuntime?.run.result;
  if (!record?.activeRuntime || !result) return null;
  result.settlementStatus = settlementStatus;
  record.session.updatedAt = new Date().toISOString();
  emit(code, 'game.payout_marked');
  return result;
}

export function pauseActiveGame(code: string, reason = 'controller_disconnected'): SessionRuntime | null {
  const record = getSessionRecord(code);
  if (!record?.activeRuntime || record.activeRuntime.run.status !== 'active') return null;
  const now = new Date().toISOString();
  record.activeRuntime.run.status = 'paused';
  // Party stays in_game; pause is a game-run state surfaced via activeRun.status.
  record.session.status = 'in_game';
  record.session.currentStage = 'game';
  record.session.updatedAt = now;
  emit(code, reason);
  return record.activeRuntime;
}

export function resumeActiveGame(code: string): SessionRuntime | null {
  const record = getSessionRecord(code);
  if (!record?.activeRuntime || record.activeRuntime.run.status !== 'paused') return null;
  const now = new Date().toISOString();
  record.activeRuntime.run.status = 'active';
  record.session.status = 'in_game';
  record.session.currentStage = 'game';
  record.session.updatedAt = now;
  emit(code, 'game.resumed');
  return record.activeRuntime;
}

export function clearActiveGame(code: string): void {
  const record = getSessionRecord(code);
  if (!record) return;
  const now = new Date().toISOString();
  record.activeRuntime = null;
  record.session.currentGameRunId = undefined;
  record.session.status = 'intermission';
  record.session.currentStage = 'game_picker';
  record.session.updatedAt = now;
  emit(code, 'game.cleared');
}

// End the whole party. Distinct from finishing a game: this closes the house for everyone,
// clears any active runtime, and leaves the record in place so resume shows "ended" rather
// than an invalid code. Historical run metadata is preserved.
export function endSession(code: string): PublicSessionSnapshot | null {
  const record = getSessionRecord(code);
  if (!record || record.session.status === 'ended' || record.session.status === 'deleted') return null;
  const now = new Date().toISOString();
  record.activeRuntime = null;
  record.activeVote = null;
  record.session.currentGameRunId = undefined;
  record.session.currentStage = 'ended';
  record.session.status = 'ended';
  record.session.updatedAt = now;
  clearContentMemory(record.session.id);
  emit(code, 'party.ended');
  return getPublicSession(code);
}

// Delete the party: stronger than ending. Emits a final deleted snapshot, then tears down the
// in-memory record, pending pairings, and votes. Owner-only — authority is checked at the room.
export function deleteSession(code: string): PublicSessionSnapshot | null {
  const key = normalizeCode(code);
  const record = sessions.get(key);
  if (!record) return null;
  record.activeRuntime = null;
  record.activeVote = null;
  record.session.status = 'deleted';
  record.session.updatedAt = new Date().toISOString();
  const finalSnapshot = getPublicSession(code);
  emit(code, 'party.deleted');
  clearContentMemory(record.session.id);
  for (const pairKey of pairings.keys()) {
    if (pairKey.startsWith(`${key}:`)) pairings.delete(pairKey);
  }
  sessions.delete(key);
  listeners.delete(key);
  return finalSnapshot;
}

export function setRecapCopy(code: string, copy: { headline: string; paragraph: string }): void {
  const record = getSessionRecord(code);
  if (!record?.lastRecap) return;
  record.lastRecap = { ...record.lastRecap, ...copy };
  emit(code, 'recap.updated');
}

export function storeRuntimeSnapshot(code: string, snapshot: unknown): void {
  const record = getSessionRecord(code);
  if (!record?.activeRuntime) return;
  record.activeRuntime.snapshot = structuredClone(snapshot);
}

export function getRuntimeSnapshot(code: string): unknown {
  const snapshot = getSessionRecord(code)?.activeRuntime?.snapshot;
  return snapshot === undefined ? undefined : structuredClone(snapshot);
}

export function isGameActive(gameType: string): boolean {
  for (const record of sessions.values()) {
    if (
      record.activeRuntime?.run.gameType === gameType &&
      ['setup', 'active', 'paused', 'recoverable'].includes(record.activeRuntime.run.status)
    ) return true;
  }
  return false;
}
