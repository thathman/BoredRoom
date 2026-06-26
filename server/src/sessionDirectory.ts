import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { GameRun, HouseSession } from '../../shared/src/contracts/session.js';

export type SessionRole = 'display' | 'controller' | 'crowd' | 'companion';

export interface SessionMember {
  deviceId: string;
  displayName: string;
  role: SessionRole;
  isBot?: boolean;
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

function publicSnapshot(record: SessionRecord): PublicSessionSnapshot {
  const activeRun = record.activeRuntime
    ? structuredClone(record.activeRuntime.run)
    : null;
  return {
    session: structuredClone(record.session),
    members: Array.from(record.members.values()).map((member) => ({ ...member })),
    activeRun,
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

export function upsertSessionMember(
  code: string,
  input: Pick<SessionMember, 'deviceId' | 'displayName' | 'role'> & Partial<Pick<SessionMember, 'isBot' | 'ready' | 'connected'>>,
): SessionMember | null {
  const record = getSessionRecord(code);
  if (!record) return null;
  const now = new Date().toISOString();
  const previous = record.members.get(input.deviceId);
  const member: SessionMember = {
    deviceId: input.deviceId,
    displayName: input.displayName || previous?.displayName || 'Player',
    role: input.role,
    isBot: input.isBot ?? previous?.isBot,
    ready: input.ready ?? previous?.ready ?? input.role !== 'crowd',
    connected: input.connected ?? true,
    joinedAt: previous?.joinedAt ?? now,
    lastSeenAt: now,
  };
  record.members.set(input.deviceId, member);
  emit(code, previous ? 'member.reconnected' : 'member.joined');
  return member;
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

export function selectSessionGame(code: string, run: GameRun): void {
  const record = getSessionRecord(code);
  if (!record) return;
  const now = new Date().toISOString();
  record.activeRuntime = { run, selectedAt: now };
  record.session.currentGameRunId = run.id;
  record.session.status = 'waiting_for_players';
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
  record.session.status = 'game_active';
  record.session.currentStage = 'game';
  record.session.updatedAt = now;
  emit(code, 'game.started');
  return record.activeRuntime;
}

export function finishActiveGame(
  code: string,
  status: 'finished' | 'abandoned',
  winnerPlayerIds: string[] = [],
): SessionRuntime | null {
  const record = getSessionRecord(code);
  if (!record?.activeRuntime) return null;
  const now = new Date().toISOString();
  record.activeRuntime.run.status = status;
  record.activeRuntime.run.endedAt = now;
  record.activeRuntime.run.winnerPlayerIds = winnerPlayerIds;
  record.lastRecap = {
    gameType: record.activeRuntime.run.gameType,
    status,
    winnerPlayerIds,
    endedAt: now,
  };
  record.session.status = 'recap';
  record.session.currentStage = 'recap';
  record.session.updatedAt = now;
  emit(code, status === 'finished' ? 'game.finished' : 'game.abandoned');
  return record.activeRuntime;
}

export function pauseActiveGame(code: string, reason = 'controller_disconnected'): SessionRuntime | null {
  const record = getSessionRecord(code);
  if (!record?.activeRuntime || record.activeRuntime.run.status !== 'active') return null;
  const now = new Date().toISOString();
  record.activeRuntime.run.status = 'paused';
  record.session.status = 'paused';
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
  record.session.status = 'game_active';
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
  record.session.status = 'next_decision';
  record.session.currentStage = 'game_picker';
  record.session.updatedAt = now;
  emit(code, 'game.cleared');
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
