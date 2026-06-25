// Colyseus server bootstrap.
// Responsibilities:
//   - room lifecycle, presence, websocket transport
//   - admission policy (host-issued one-time tokens for host role)
//   - public/private state projection
//   - bot tick loop calling the rules adapter
//   - mid-game approvals + moderation
//
// boardgame.io is used ONLY as a rules library (see ../../shared/src/rules).
// We do NOT use bgio's Client/Server/lobby/transport.

import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { randomUUID } from 'crypto';

import { LudoRoom } from './rooms/LudoRoom.js';
import { WhotRoom } from './rooms/WhotRoom.js';
import { TriviaRoom } from './rooms/TriviaRoom.js';
import { Connect4Room } from './rooms/Connect4Room.js';
import { EtttRoom } from './rooms/EtttRoom.js';
import { LogoRoom } from './rooms/LogoRoom.js';
import { LandlordRoom } from './rooms/LandlordRoom.js';
import { ColorWahalaRoom } from './rooms/ColorWahalaRoom.js';
import { HustleRoom } from './rooms/HustleRoom.js';
import { WordWahalaRoom } from './rooms/WordWahalaRoom.js';
import { HalfHalfRoom } from './rooms/HalfHalfRoom.js';
import { HouseSessionRoom } from './rooms/HouseSessionRoom.js';
import { hostTokenStore } from './auth/hostTokens.js';
import { PROTOCOL_VERSION } from '../../shared/src/contracts/index.js';
import { isValidRoomCode } from '../../shared/src/roomCodes.js';
import { log } from './logger.js';
import { getRoom, upsertRoom } from './roomDirectory.js';
import { installPack, listInstalledPacks, uninstallPack } from './packs.js';
import {
  buildHouseSession,
  persistHouseSession,
  readHouseSession,
  readSessionCredentialHashes,
  readActiveRun,
  buildGameRun,
  persistGameRun,
  buildSessionEvent,
  appendSessionEvent,
} from './foundations.js';
import {
  clearActiveGame,
  createCompanionPairing,
  finishActiveGame,
  getPublicSession,
  getSessionRecord,
  getSessionCredentialHashes,
  hydrateSession,
  issueOwnerCredential,
  redeemCompanionPairing,
  registerSession,
  selectSessionGame,
  startSelectedGame,
  verifyOwnerCredential,
  verifyControlCredential,
} from './sessionDirectory.js';
import {
  clearLoginAttempts,
  clearPackAdminCookie,
  consumeLoginAttempt,
  isAllowedPackAdminOrigin,
  issuePackAdminSession,
  packAdminCookie,
  PACK_ADMIN_COOKIE,
  readCookie,
  verifyPackAdminPassphrase,
  verifyPackAdminSession,
} from './packAdminAuth.js';

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function ownerCredentialFrom(req: express.Request): string | undefined {
  const header = req.header('x-boredroom-owner');
  return header?.trim() || undefined;
}

function requireSessionOwner(req: express.Request, res: express.Response): boolean {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!verifyOwnerCredential(code, ownerCredentialFrom(req))) {
    res.status(403).json({ error: 'owner_credential_invalid' });
    return false;
  }
  return true;
}

function requireSessionController(req: express.Request, res: express.Response): boolean {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!verifyControlCredential(code, ownerCredentialFrom(req))) {
    res.status(403).json({ error: 'control_credential_invalid' });
    return false;
  }
  return true;
}

function requirePackAdmin(req: express.Request, res: express.Response): boolean {
  const expected = process.env.PACK_ADMIN_TOKEN;
  const headerCredential = req.header('x-boredroom-admin')?.trim();
  const cookieCredential = readCookie(req.header('cookie'), PACK_ADMIN_COOKIE);
  const authenticated =
    verifyPackAdminPassphrase(headerCredential ?? '', expected) ||
    verifyPackAdminSession(cookieCredential, expected);
  if (!authenticated) {
    res.status(403).json({ error: 'pack_admin_required' });
    return false;
  }
  return true;
}

function requirePackAdminOrigin(req: express.Request, res: express.Response): boolean {
  if (!isAllowedPackAdminOrigin(req.header('origin'))) {
    res.status(403).json({ error: 'pack_admin_origin_invalid' });
    return false;
  }
  return true;
}

// Room creation endpoint. Issues a one-time host token bound to a deviceId.
// Players don't need this — they connect to the room directly with deviceId.
app.post('/rooms', (req, res) => {
  const { hostDeviceId, hostDisplayName, gameType } = req.body ?? {};
  if (!hostDeviceId || typeof hostDeviceId !== 'string') {
    return res.status(400).json({ error: 'hostDeviceId required' });
  }
  const validGameType: 'ludo' | 'whot' | 'trivia' | 'connect-4' | 'ettt' | 'logo' | 'landlord' | 'half-half' | 'color-wahala' | 'hustle' | 'word-wahala' =
    gameType === 'whot' || gameType === 'trivia' || gameType === 'connect-4' || gameType === 'ettt' || gameType === 'logo' || gameType === 'landlord' || gameType === 'half-half' || gameType === 'color-wahala' || gameType === 'hustle' || gameType === 'word-wahala'
      ? gameType
      : 'ludo';
  const code = generateRoomCode();
  const hostToken = hostTokenStore.issue(code, hostDeviceId);
  const maxPlayers =
    validGameType === 'whot' ? 8
    : validGameType === 'trivia' ? 8
    : validGameType === 'logo' ? 8
    : validGameType === 'half-half' ? 8
    : validGameType === 'color-wahala' ? 8
    : validGameType === 'connect-4' ? 2
    : validGameType === 'ettt' ? 2
    : validGameType === 'landlord' ? 4
    : validGameType === 'hustle' ? 4
    : 4;
  upsertRoom({
    code,
    gameType: validGameType,
    status: 'lobby',
    roomPolicy: 'open',
    players: 0,
    maxPlayers,
  });
  log('info', 'room_created', { room: code, gameType: validGameType });
  res.json({ code, hostToken, hostDisplayName: hostDisplayName ?? null, gameType: validGameType });
});

app.get('/rooms/:code', (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!isValidRoomCode(code)) {
    return res.status(400).json({ exists: false, error: 'invalid_code' });
  }
  const room = getRoom(code);
  if (!room) return res.status(404).json({ exists: false, code });
  res.json({
    exists: true,
    code: room.code,
    gameType: room.gameType,
    status: room.status,
    roomPolicy: room.roomPolicy,
    players: room.players,
    maxPlayers: room.maxPlayers,
    joinable: room.roomPolicy !== 'locked' && room.players < room.maxPlayers,
  });
});

// Create a HouseSession (Phase 1 spine). The realtime game container is still a Colyseus room,
// created later under a GameRun. Persistence degrades gracefully when Supabase env is absent.
app.post('/sessions', async (req, res) => {
  const { hostDeviceId, selectedPackIds, activePackId, settings } = req.body ?? {};
  if (!hostDeviceId || typeof hostDeviceId !== 'string') {
    return res.status(400).json({ error: 'hostDeviceId required' });
  }
  // A session isn't scoped to chosen packs anymore — all installed games are available. Packs are
  // an install mechanism, not a play-time choice.
  const packIds = Array.isArray(selectedPackIds) ? selectedPackIds : [];
  let session: ReturnType<typeof buildHouseSession>;
  try {
    session = buildHouseSession({
      hostDeviceId,
      selectedPackIds: packIds,
      activePackId,
      settings: settings && typeof settings === 'object' ? settings : undefined,
    });
  } catch (err) {
    log('warn', 'session_build_failed', { error: String(err) });
    return res.status(400).json({ error: 'invalid_session_input' });
  }
  while (getSessionRecord(session.code)) session.code = makeUniqueSessionCode();
  const ownerCredential = issueOwnerCredential();
  registerSession(session, ownerCredential);
  try {
    await persistHouseSession(session, getSessionCredentialHashes(session.code) ?? undefined);
    await appendSessionEvent(buildSessionEvent({ sessionId: session.id, type: 'session.created', actorId: hostDeviceId }));
  } catch (err) {
    log('warn', 'session_persist_failed', { error: String(err) });
    return res.status(503).json({ error: 'session_persist_failed' });
  }
  res.json({ session, ownerCredential });
});

// Read a house session by code (for screens to hydrate). 404 when unknown / no backend.
app.get('/sessions/:code', async (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  try {
    const live = getPublicSession(code);
    if (live) return res.json(live);
    const session = await readHouseSession(code);
    if (!session) return res.status(404).json({ exists: false, code });
    const credentials = await readSessionCredentialHashes(code);
    hydrateSession(session, credentials ?? undefined);
    const activeRun = await readActiveRun(session.id);
    return res.json({
      session,
      members: [],
      activeRun: activeRun
        ? { ...activeRun, roomCode: undefined, runtimeId: activeRun.roomCode }
        : null,
    });
  } catch (err) {
    log('warn', 'session_read_failed', { error: String(err) });
    return res.status(503).json({ error: 'session_read_failed' });
  }
});

app.get('/sessions/:code/runtime', (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!requireSessionController(req, res)) return;
  const record = getSessionRecord(code);
  if (!record?.activeRuntime) return res.status(404).json({ error: 'run_not_found' });
  res.json({
    runId: record.activeRuntime.run.id,
    runtimeId: record.activeRuntime.runtimeId ?? null,
    hostToken: record.activeRuntime.hostToken ?? null,
  });
});

const LEGACY_GAME_TYPES = [
  'ludo', 'whot', 'trivia', 'connect-4', 'ettt', 'logo', 'landlord', 'half-half', 'color-wahala', 'hustle', 'word-wahala',
] as const;
type LegacyGameType = (typeof LEGACY_GAME_TYPES)[number];

function maxPlayersFor(gameType: LegacyGameType): number {
  if (gameType === 'whot' || gameType === 'trivia' || gameType === 'logo' || gameType === 'half-half' || gameType === 'color-wahala') return 8;
  if (gameType === 'connect-4' || gameType === 'ettt') return 2;
  return 4;
}

// Select a GameRun under a house session. Existing room-based engines remain private runtime
// implementation details; clients only receive them through credentialed runtime access.
app.post('/sessions/:code/runs', async (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!requireSessionController(req, res)) return;
  const { houseSessionId, hostDeviceId, gameType, packId } = req.body ?? {};
  const record = getSessionRecord(code);
  if (!record || record.session.id !== houseSessionId) {
    return res.status(404).json({ error: 'session_not_found' });
  }
  if (!houseSessionId || typeof houseSessionId !== 'string') {
    return res.status(400).json({ error: 'houseSessionId required' });
  }
  if (!gameType || typeof gameType !== 'string') {
    return res.status(400).json({ error: 'gameType required' });
  }
  let run: ReturnType<typeof buildGameRun>;
  try {
    // packId is required by the schema; treat empty/missing as 'unknown' so a thin client payload
    // can't crash the handler.
    const pid = typeof packId === 'string' && packId.trim() ? packId : 'unknown';
    run = buildGameRun({ houseSessionId, gameType, packId: pid });
  } catch (err) {
    log('warn', 'game_run_build_failed', { error: String(err) });
    return res.status(400).json({ error: 'invalid_run_input' });
  }

  let room: { code: string; hostToken: string } | null = null;
  if ((LEGACY_GAME_TYPES as readonly string[]).includes(gameType)) {
    const roomCode = generateRoomCode();
    const hostToken = hostTokenStore.issue(roomCode, typeof hostDeviceId === 'string' ? hostDeviceId : houseSessionId);
    upsertRoom({
      code: roomCode,
      gameType: gameType as LegacyGameType,
      status: 'lobby',
      roomPolicy: 'open',
      players: 0,
      maxPlayers: maxPlayersFor(gameType as LegacyGameType),
    });
    run.roomCode = roomCode;
    room = { code: roomCode, hostToken };
  }

  selectSessionGame(code, run, room?.code, room?.hostToken);
  try {
    await persistGameRun(run);
    await appendSessionEvent(buildSessionEvent({ sessionId: houseSessionId, gameRunId: run.id, type: 'game_run.created', payload: { gameType } }));
    await persistHouseSession(record.session);
  } catch (err) {
    log('warn', 'game_run_persist_failed', { error: String(err) });
    return res.status(503).json({ error: 'game_run_persist_failed' });
  }
  log('info', 'game_run_created', { session: code, gameType, run: run.id, room: run.roomCode ?? null });
  res.json({ run: { ...run, runtimeId: room?.code }, hostToken: room?.hostToken ?? null });
});

app.post('/sessions/:code/runs/:runId/start', async (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!requireSessionController(req, res)) return;
  const runtime = startSelectedGame(code);
  if (!runtime || runtime.run.id !== req.params.runId) {
    return res.status(404).json({ error: 'run_not_found' });
  }
  try {
    await persistGameRun(runtime.run);
    const record = getSessionRecord(code);
    if (record) await persistHouseSession(record.session);
    await appendSessionEvent(buildSessionEvent({
      sessionId: runtime.run.houseSessionId,
      gameRunId: runtime.run.id,
      type: 'game_run.started',
    }));
  } catch (err) {
    log('warn', 'game_run_start_persist_failed', { error: String(err) });
  }
  res.json({ run: { ...runtime.run, runtimeId: runtime.runtimeId }, hostToken: runtime.hostToken ?? null });
});

app.post('/sessions/:code/runs/:runId/finish', async (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!requireSessionController(req, res)) return;
  const status = req.body?.status === 'abandoned' ? 'abandoned' : 'finished';
  const winnerPlayerIds = Array.isArray(req.body?.winnerPlayerIds)
    ? req.body.winnerPlayerIds.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  const runtime = finishActiveGame(code, status, winnerPlayerIds);
  if (!runtime || runtime.run.id !== req.params.runId) {
    return res.status(404).json({ error: 'run_not_found' });
  }
  try {
    await persistGameRun(runtime.run);
    const record = getSessionRecord(code);
    if (record) await persistHouseSession(record.session);
    await appendSessionEvent(buildSessionEvent({
      sessionId: runtime.run.houseSessionId,
      gameRunId: runtime.run.id,
      type: status === 'finished' ? 'game_run.finished' : 'game_run.abandoned',
      payload: { winnerPlayerIds },
    }));
  } catch (err) {
    log('warn', 'game_run_finish_persist_failed', { error: String(err) });
  }
  res.json({ run: runtime.run });
});

app.delete('/sessions/:code/runs/current', async (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!requireSessionController(req, res)) return;
  clearActiveGame(code);
  const record = getSessionRecord(code);
  if (record) {
    try {
      await persistHouseSession(record.session);
    } catch (err) {
      log('warn', 'session_clear_persist_failed', { error: String(err) });
    }
  }
  res.json({ ok: true });
});

app.post('/sessions/:code/pairing', (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!requireSessionOwner(req, res)) return;
  res.json(createCompanionPairing(code));
});

app.post('/sessions/:code/pairing/redeem', async (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  const pairingCode = typeof req.body?.pairingCode === 'string' ? req.body.pairingCode : '';
  const result = redeemCompanionPairing(code, pairingCode);
  if (!result) return res.status(410).json({ error: 'pairing_invalid_or_expired' });
  const record = getSessionRecord(code);
  if (record) {
    await persistHouseSession(record.session, getSessionCredentialHashes(code) ?? undefined);
  }
  res.json(result);
});

app.get('/packs/auth', (req, res) => {
  const token = readCookie(req.header('cookie'), PACK_ADMIN_COOKIE);
  res.json({ authenticated: verifyPackAdminSession(token, process.env.PACK_ADMIN_TOKEN) });
});

app.post('/packs/auth', (req, res) => {
  if (!requirePackAdminOrigin(req, res)) return;
  const key =
    req.header('cf-connecting-ip')?.trim() ||
    req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown';
  const attempt = consumeLoginAttempt(key);
  if (!attempt.allowed) {
    res.setHeader('Retry-After', String(attempt.retryAfterSeconds));
    return res.status(429).json({ error: 'pack_admin_rate_limited' });
  }
  const passphrase = typeof req.body?.passphrase === 'string' ? req.body.passphrase : '';
  const secret = process.env.PACK_ADMIN_TOKEN;
  if (!verifyPackAdminPassphrase(passphrase, secret) || !secret) {
    return res.status(403).json({ error: 'pack_admin_invalid' });
  }
  clearLoginAttempts(key);
  res.setHeader('Set-Cookie', packAdminCookie(issuePackAdminSession(secret)));
  res.json({ authenticated: true });
});

app.delete('/packs/auth', (req, res) => {
  if (!requirePackAdminOrigin(req, res)) return;
  res.setHeader('Set-Cookie', clearPackAdminCookie());
  res.json({ authenticated: false });
});

// Pack installation (server-wide). Install a content pack from a GitHub repo URL.
app.get('/packs', async (req, res) => {
  if (!requirePackAdmin(req, res)) return;
  try {
    res.json({ packs: await listInstalledPacks() });
  } catch (err) {
    log('warn', 'packs_list_failed', { error: String(err) });
    res.json({ packs: [] });
  }
});

app.post('/packs/install', async (req, res) => {
  if (!requirePackAdminOrigin(req, res)) return;
  if (!requirePackAdmin(req, res)) return;
  const repoUrl = typeof req.body?.repoUrl === 'string' ? req.body.repoUrl : '';
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl required' });
  const result = await installPack(repoUrl);
  if (!result.ok) {
    log('info', 'pack_install_rejected', { repoUrl, error: result.error });
    return res.status(422).json({ error: result.error });
  }
  log('info', 'pack_installed', { packId: result.pack.packId, games: result.pack.manifest.games.length });
  res.json({ pack: result.pack });
});

app.delete('/packs/:packId', async (req, res) => {
  if (!requirePackAdminOrigin(req, res)) return;
  if (!requirePackAdmin(req, res)) return;
  try {
    await uninstallPack(String(req.params.packId));
    res.json({ ok: true });
  } catch (err) {
    log('warn', 'pack_uninstall_failed', { error: String(err) });
    res.status(503).json({ error: 'uninstall_failed' });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, transport: 'colyseus', version: PROTOCOL_VERSION });
});
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, transport: 'colyseus', version: PROTOCOL_VERSION });
});

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('ludo', LudoRoom).filterBy(['code']);
gameServer.define('whot', WhotRoom).filterBy(['code']);
gameServer.define('trivia', TriviaRoom).filterBy(['code']);
gameServer.define('connect-4', Connect4Room).filterBy(['code']);
gameServer.define('ettt', EtttRoom).filterBy(['code']);
gameServer.define('logo', LogoRoom).filterBy(['code']);
gameServer.define('landlord', LandlordRoom).filterBy(['code']);
gameServer.define('color-wahala', ColorWahalaRoom).filterBy(['code']);
gameServer.define('hustle', HustleRoom).filterBy(['code']);
gameServer.define('word-wahala', WordWahalaRoom).filterBy(['code']);
gameServer.define('half-half', HalfHalfRoom).filterBy(['code']);
gameServer.define('house-session', HouseSessionRoom).filterBy(['code']);

httpServer.listen(PORT, () => {
  log('info', 'server_listening', { port: PORT, protocolVersion: PROTOCOL_VERSION });
});

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function makeUniqueSessionCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 5; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } while (getSessionRecord(code));
  return code;
}

// Re-export for tooling that wants the uuid impl
export { randomUUID };
