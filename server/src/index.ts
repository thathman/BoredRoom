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
import { hostTokenStore } from './auth/hostTokens.js';
import { PROTOCOL_VERSION } from '../../shared/src/contracts/index.js';
import { isValidRoomCode } from '../../shared/src/roomCodes.js';
import { log } from './logger.js';
import { getRoom, upsertRoom } from './roomDirectory.js';
import {
  buildHouseSession,
  persistHouseSession,
  readHouseSession,
  buildGameRun,
  persistGameRun,
  buildSessionEvent,
  appendSessionEvent,
} from './foundations.js';

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors());
app.use(express.json());

// Room creation endpoint. Issues a one-time host token bound to a deviceId.
// Players don't need this — they connect to the room directly with deviceId.
app.post('/rooms', (req, res) => {
  const { hostDeviceId, hostDisplayName, gameType } = req.body ?? {};
  if (!hostDeviceId || typeof hostDeviceId !== 'string') {
    return res.status(400).json({ error: 'hostDeviceId required' });
  }
  const validGameType: 'ludo' | 'whot' | 'trivia' | 'connect-4' | 'ettt' | 'logo' | 'landlord' | 'color-wahala' | 'hustle' | 'word-wahala' =
    gameType === 'whot' || gameType === 'trivia' || gameType === 'connect-4' || gameType === 'ettt' || gameType === 'logo' || gameType === 'landlord' || gameType === 'color-wahala' || gameType === 'hustle' || gameType === 'word-wahala'
      ? gameType
      : 'ludo';
  const code = generateRoomCode();
  const hostToken = hostTokenStore.issue(code, hostDeviceId);
  const maxPlayers =
    validGameType === 'whot' ? 8
    : validGameType === 'trivia' ? 8
    : validGameType === 'logo' ? 8
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
  if (!Array.isArray(selectedPackIds) || selectedPackIds.length === 0) {
    return res.status(400).json({ error: 'selectedPackIds required' });
  }
  const session = buildHouseSession({
    hostDeviceId,
    selectedPackIds,
    activePackId,
    settings: settings && typeof settings === 'object' ? settings : undefined,
  });
  try {
    await persistHouseSession(session);
    await appendSessionEvent(buildSessionEvent({ sessionId: session.id, type: 'session.created', actorId: hostDeviceId }));
  } catch (err) {
    log('warn', 'session_persist_failed', { error: String(err) });
  }
  res.json({ session });
});

// Read a house session by code (for screens to hydrate). 404 when unknown / no backend.
app.get('/sessions/:code', async (req, res) => {
  const code = String(req.params.code ?? '');
  try {
    const session = await readHouseSession(code);
    if (!session) return res.status(404).json({ exists: false, code });
    return res.json({ session });
  } catch (err) {
    log('warn', 'session_read_failed', { error: String(err) });
    return res.status(503).json({ error: 'session_read_failed' });
  }
});

const LEGACY_GAME_TYPES = [
  'ludo', 'whot', 'trivia', 'connect-4', 'ettt', 'logo', 'landlord', 'color-wahala', 'hustle', 'word-wahala',
] as const;
type LegacyGameType = (typeof LEGACY_GAME_TYPES)[number];

function maxPlayersFor(gameType: LegacyGameType): number {
  if (gameType === 'whot' || gameType === 'trivia' || gameType === 'logo' || gameType === 'color-wahala') return 8;
  if (gameType === 'connect-4' || gameType === 'ettt') return 2;
  return 4;
}

// Start a GameRun under a house session. For legacy (Colyseus-room) games it also provisions the
// realtime room + host token so players can connect; adapter-only games (Phase 8) run without a
// legacy room. Rematch = call again -> a fresh run id (constitution Art. III.3).
app.post('/sessions/:code/runs', async (req, res) => {
  const code = String(req.params.code ?? '');
  const { houseSessionId, hostDeviceId, gameType, packId } = req.body ?? {};
  if (!houseSessionId || typeof houseSessionId !== 'string') {
    return res.status(400).json({ error: 'houseSessionId required' });
  }
  if (!gameType || typeof gameType !== 'string') {
    return res.status(400).json({ error: 'gameType required' });
  }
  const run = buildGameRun({ houseSessionId, gameType, packId: typeof packId === 'string' ? packId : 'unknown' });

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

  try {
    await persistGameRun(run);
    await appendSessionEvent(
      buildSessionEvent({ sessionId: houseSessionId, gameRunId: run.id, type: 'game_run.created', payload: { gameType } }),
    );
  } catch (err) {
    log('warn', 'game_run_persist_failed', { error: String(err) });
  }
  log('info', 'game_run_created', { session: code, gameType, run: run.id, room: run.roomCode ?? null });
  res.json({ run, room });
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

httpServer.listen(PORT, () => {
  log('info', 'server_listening', { port: PORT, protocolVersion: PROTOCOL_VERSION });
});

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

// Re-export for tooling that wants the uuid impl
export { randomUUID };
